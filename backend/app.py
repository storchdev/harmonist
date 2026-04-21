import json
import os
import uuid

from flask import (
    Flask,
    jsonify,
    render_template,
    request,
    send_file,
    send_from_directory,
)
from flask_cors import CORS

app = Flask(
    __name__,
    static_folder="../frontend/dist/assets",
    template_folder="../frontend/dist",
)

CORS(app)  # Allow cross-origin requests for dev

# CONFIG
PROJECTS_DIR = os.path.join(os.getcwd(), "projects")
AUDIO_DIR = os.path.join(os.getcwd(), "audio_files")  # Place to store uploaded audio
os.makedirs(PROJECTS_DIR, exist_ok=True)
os.makedirs(AUDIO_DIR, exist_ok=True)

# --- AI CONFIG ---
ANALYSIS_DIR = os.path.join(os.getcwd(), "analysis_cache")
os.makedirs(ANALYSIS_DIR, exist_ok=True)

try:
    import pretty_midi
    from basic_pitch.inference import predict

    AI_AVAILABLE = True
except ImportError:
    print("AI Library not installed.")
    AI_AVAILABLE = False


# --- HELPER FUNCTIONS ---
def get_project_path(project_id):
    return os.path.join(PROJECTS_DIR, f"{project_id}.json")


def normalize_region(region):
    if not isinstance(region, dict):
        return region

    normalized = dict(region)
    comment = normalized.get("comment")

    if comment is None:
        return normalized

    normalized_comment = str(comment).strip()
    if normalized_comment:
        normalized["comment"] = normalized_comment
    else:
        normalized.pop("comment", None)

    return normalized


def normalize_project_data(project_data):
    if not isinstance(project_data, dict):
        return project_data

    normalized = dict(project_data)
    regions = normalized.get("regions", [])

    if not isinstance(regions, list):
        normalized["regions"] = []
    else:
        normalized["regions"] = [normalize_region(region) for region in regions]

    return normalized


# --- ROUTES ---


@app.route("/")
def serve_index():
    return render_template("index.html")


# Catch-all route to handle SvelteKit/Vite client-side routing
# If the path isn't an API route, serve the index.html
@app.route("/<path:path>")
def catch_all(path):
    # Check if path exists in static folder (e.g. favicon.ico)
    if path.startswith("assets/"):
        return send_from_directory(
            "../frontend/dist/assets", path.replace("assets/", "")
        )
    return render_template("index.html")


@app.route("/api/test")
def test():
    return jsonify({"message": "skibidi"})


@app.route("/api/projects", methods=["GET"])
def list_projects():
    projects = []
    for f in os.listdir(PROJECTS_DIR):
        if f.endswith(".json"):
            with open(os.path.join(PROJECTS_DIR, f), "r") as file:
                data = json.load(file)
                projects.append(
                    {
                        "id": f.removesuffix(".json"),
                        "name": data.get("name", "Untitled"),
                        "last_modified": data.get("last_modified", ""),
                    }
                )
    return jsonify(projects)


@app.route("/api/projects", methods=["POST"])
def create_project():
    data = request.json
    project_id = str(uuid.uuid4())

    # Initial State
    project_data = {
        "id": project_id,
        "name": data.get("name", "New Analysis"),
        "audio_file": None,  # Filename in AUDIO_DIR
        "regions": [],  # format: {id, start, end, chord_symbol, octave?, comment?}
        "bpm": 120,
    }

    with open(get_project_path(project_id), "w") as f:
        json.dump(project_data, f, indent=4)

    return jsonify(project_data)


@app.route("/api/projects/<project_id>", methods=["GET"])
def get_project(project_id):
    path = get_project_path(project_id)
    print(path)
    if not os.path.exists(path):
        return jsonify({"error": "Project not found"}), 404
    with open(path, "r") as f:
        return jsonify(normalize_project_data(json.load(f)))


@app.route("/api/projects/<project_id>", methods=["PUT"])
def save_project(project_id):
    path = get_project_path(project_id)
    payload = normalize_project_data(request.json)
    with open(path, "w") as f:
        json.dump(payload, f, indent=4)
    return jsonify({"status": "saved"})


# --- AUDIO HANDLING ---
# We need this because browsers can't just load "C:\Users\Music\song.mp3" due to security.
# We serve it via this route.
@app.route("/api/audio/<filename>")
def stream_audio(filename):
    return send_file(os.path.join(AUDIO_DIR, filename))


@app.route("/api/upload", methods=["POST"])
def upload_audio():
    if "file" not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400

    # Save file to our dedicated audio folder
    # In production, you'd want to sanitize this filename
    save_path = os.path.join(AUDIO_DIR, file.filename)
    file.save(save_path)

    return jsonify({"filename": file.filename})


# ... imports ...


@app.route("/api/identify_chord", methods=["GET"])
def get_chord_at_time():
    """
    Query: ?filename=...&time=...&onset=0.6&frame=0.4&min_note_len=100
    """
    if not AI_AVAILABLE:
        return jsonify({"error": "AI not installed"}), 500

    filename = request.args.get("filename")
    timestamp = float(request.args.get("time", 0))

    # Get Parameters (with defaults)
    onset = float(request.args.get("onset", 0.5))
    frame = float(request.args.get("frame", 0.3))
    min_note_len = float(request.args.get("min_note_len", 58.0))

    audio_path = os.path.join(AUDIO_DIR, filename)
    midi_path = os.path.join(ANALYSIS_DIR, f"{filename}.mid")
    meta_path = os.path.join(ANALYSIS_DIR, f"{filename}.meta.json")

    if not os.path.exists(audio_path):
        return jsonify({"error": "Audio file not found"}), 404

    # --- CACHE INVALIDATION LOGIC ---
    should_run_ai = True

    if os.path.exists(midi_path) and os.path.exists(meta_path):
        try:
            with open(meta_path, "r") as f:
                cached_meta = json.load(f)
                # Check if params match (using small epsilon for floats just in case)
                if (
                    abs(cached_meta.get("onset", 0) - onset) < 0.01
                    and abs(cached_meta.get("frame", 0) - frame) < 0.01
                    and abs(cached_meta.get("min_note_len", 0) - min_note_len) < 1.0
                ):
                    should_run_ai = False
        except:
            should_run_ai = True  # Corrupt meta, re-run

    if should_run_ai:
        print(
            f"Running AI for {filename} with params: onset={onset}, frame={frame}, len={min_note_len}"
        )
        try:
            model_output, midi_data, note_events = predict(
                audio_path,
                onset_threshold=onset,
                frame_threshold=frame,
                minimum_note_length=min_note_len,
                minimum_frequency=None,
                maximum_frequency=None,
            )
            midi_data.write(midi_path)

            # Save Metadata
            with open(meta_path, "w") as f:
                json.dump(
                    {"onset": onset, "frame": frame, "min_note_len": min_note_len}, f
                )

        except Exception as e:
            print(e)
            return jsonify({"error": "AI Analysis Failed"}), 500

    # 2. FAST LOOKUP
    try:
        midi_data = pretty_midi.PrettyMIDI(midi_path)
    except:
        return jsonify({"error": "Could not read analysis file"}), 500

    active_notes = []
    for instrument in midi_data.instruments:
        for note in instrument.notes:
            if note.start <= timestamp <= note.end:
                active_notes.append(note.pitch)

    if not active_notes:
        return jsonify({"notes": [], "status": "silence"})

    active_notes.sort()
    PITCH_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
    note_names = []
    for midi_num in active_notes:
        idx = midi_num % 12
        note_names.append(PITCH_NAMES[idx])

    return jsonify({"notes": note_names, "status": "success"})

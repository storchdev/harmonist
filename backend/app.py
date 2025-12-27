import os
import json
import uuid
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS

app = Flask(__name__)


CORS(app)  # Allow cross-origin requests for dev

# CONFIG
PROJECTS_DIR = os.path.join(os.getcwd(), "projects")
AUDIO_DIR = os.path.join(os.getcwd(), "audio_files")  # Place to store uploaded audio
os.makedirs(PROJECTS_DIR, exist_ok=True)
os.makedirs(AUDIO_DIR, exist_ok=True)


# --- HELPER FUNCTIONS ---
def get_project_path(project_id):
    return os.path.join(PROJECTS_DIR, f"{project_id}.json")


# --- ROUTES ---


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
        "regions": [],  # format: {id, start, end, chord_symbol}
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
        return jsonify(json.load(f))


@app.route("/api/projects/<project_id>", methods=["PUT"])
def save_project(project_id):
    path = get_project_path(project_id)
    with open(path, "w") as f:
        json.dump(request.json, f, indent=4)
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

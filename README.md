## i tried vibe coding :((

# Harmonist

A local web application that uses AI to analyze audio files, detect chords, and create an interactive, editable timeline.

## Features

- **Visual Waveform Editor:** Zoom, scrub, and navigate audio.
- **AI Chord Detection:** Uses Spotify's Basic Pitch to detect notes and infer chords.
- **Editing Tools:** Adjust chord names, octaves, and add subtitles/roman numerals.
- **Phrase Markers:** Mark musical sections on the timeline.
- **Local Privacy:** All processing happens on your machine.

---

## Prerequisites

- **Node.js** (v18+)
- **uv** (An extremely fast Python package installer and resolver)

If you don't have `uv` installed:

```bash
# On macOS/Linux
curl -LsSf [https://astral.sh/uv/install.sh](https://astral.sh/uv/install.sh) | sh

# On Windows
powershell -c "irm [https://astral.sh/uv/install.ps1](https://astral.sh/uv/install.ps1) | iex"

```

---

## Installation & Setup

### 1. Build the Frontend

We compile the Svelte/Vite frontend into static HTML/CSS/JS files so the Python backend can serve them directly.

```bash
cd frontend
npm install
npm run build

```

_This creates a `dist` folder containing the production-ready app._

### 2. Setup the Backend

We use `uv` to create a virtual environment and install the heavy AI dependencies (TensorFlow, Basic Pitch, etc.) quickly.

```bash
cd ../backend
uv sync
```

---

## Running the App

Once built, you only need to run the Python server. It will serve both the API and the UI.

1. Ensure you are in the `backend` directory.
2. Ensure your virtual environment is active (if not, run the activate command above).
3. Run the app:

```bash
uv run flask run
```

4. Open your browser to: **`http://127.0.0.1:5000`**

---

## Notes

- The first time you click the "✨ AI" button for a file, it downloads the model weights (~500MB) and runs the inference. This can take 15-30 seconds. Subsequent runs for the same file are instant (cached).
- to adjust ai settings, click button and then drag sliders. dragging 2nd one down matters most for picking up the less obvious notes. after adjusting settings and clicking AI button, it will take a little bit to generate the whole midi again.

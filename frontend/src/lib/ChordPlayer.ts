import * as Tone from "tone";
import { Chord } from "@tonaljs/tonal";

export class ChordPlayer {
  private synth: Tone.PolySynth;
  private isReady: boolean = false;

  constructor() {
    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" }, // Default
      envelope: {
        attack: 0.05,
        decay: 0.1,
        sustain: 0.3,
        release: 1,
      },
    }).toDestination();
    this.synth.volume.value = -10;
  }
  async ensureReady() {
    if (!this.isReady) {
      await Tone.start(); // Browsers require a user gesture to start AudioContext
      this.isReady = true;
      console.log("Audio Engine Ready");
    }
  }

  playChord(chordName: string, duration: number) {
    if (!this.isReady) return;

    // 1. Parse the chord name (e.g., "Cm7" -> ["C", "Eb", "G", "Bb"])
    // We add "4" to the root to place it in the 4th octave by default if not specified
    const chord = Chord.get(chordName);

    if (chord.empty) {
      console.warn(`Could not parse chord: ${chordName}`);
      return;
    }

    // 2. Add octaves (simple strategy: spread around octave 4)
    const notes = chord.notes.map((note) => {
      // If the library returns just "C", append "4".
      // If it returns "C#", append "4".
      // If the user typed "C5", Tonal handles that.
      return /\d/.test(note) ? note : note + "4";
    });

    // 3. Trigger
    // release = duration + a little tail
    this.synth.triggerAttackRelease(notes, duration);
  }

  stopAll() {
    this.synth.releaseAll();
  }

  setVolume(db: number) {
    this.synth.volume.rampTo(db, 0.1);
  }

  // NEW: Allow changing sound type (sine, square, triangle, sawtooth)
  setOscillatorType(type: "triangle" | "sine" | "square" | "sawtooth") {
    this.synth.set({ oscillator: { type } });
  }
}

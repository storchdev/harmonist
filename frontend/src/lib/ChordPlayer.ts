import * as Tone from "tone";
import { parseChordInput } from "./chordParsing";

export class ChordPlayer {
  private synth: Tone.PolySynth;
  private limiter: Tone.Limiter; // NEW
  private isReady: boolean = false;

  constructor() {
    this.limiter = new Tone.Limiter(-1).toDestination();

    // Electric Piano / Guitar-ish Sound (FM Synthesis)
    this.synth = new Tone.PolySynth(Tone.FMSynth, {
      oscillator: { type: "sine" },
      harmonicity: 3,
      modulationIndex: 2,
      modulation: { type: "square" },
      envelope: {
        attack: 0.005,
        decay: 0.3,
        sustain: 0.5,
        release: 1.2,
      },
    }).toDestination();

    this.synth.volume.value = 0;
  }

  async ensureReady() {
    if (!this.isReady) {
      await Tone.start();
      this.isReady = true;
      console.log("Audio Engine Ready");
    }
  }

  playChord(chordName: string, duration: number, octave: number = 4) {
    if (!this.isReady) return;

    const parsed = parseChordInput(chordName);
    if (!parsed.isValid || !parsed.chord) return;

    const { chord, bassNote } = parsed;

    const notesToPlay: string[] = [];

    // 1. Bass Note (One octave lower than selected)
    const bassOctave = Math.max(0, octave - 1);

    if (bassNote) {
      notesToPlay.push(bassNote + bassOctave);
    } else {
      if (chord.tonic) notesToPlay.push(chord.tonic + bassOctave);
    }

    // 2. Chord Notes (At selected octave)
    chord.notes.forEach((note) => {
      notesToPlay.push(note + octave);
    });

    // 3. Play
    const uniqueNotes = [...new Set(notesToPlay)];
    this.synth.triggerAttackRelease(uniqueNotes, duration);
  }

  stopAll() {
    this.synth.releaseAll();
  }

  setVolume(db: number) {
    this.synth.volume.rampTo(db, 0.1);
  }

  setOscillatorType(type: any) {
    if (["sine", "square", "triangle", "sawtooth"].includes(type)) {
      this.synth.set({ oscillator: { type } });
    }
  }
}

import { Chord, Note } from "@tonaljs/tonal";

type ParsedChord = ReturnType<typeof Chord.get>;

function parseChordWithFallback(symbol: string): ParsedChord | null {
  const attempts = new Set([symbol]);

  if (/add2\b/i.test(symbol)) {
    attempts.add(symbol.replace(/add2\b/gi, "add9"));
  }

  if (/dim\s*(?:\(\s*(?:maj7|M7)\s*\)|(?:maj7|M7))/i.test(symbol)) {
    attempts.add(
      symbol.replace(/dim\s*(?:\(\s*(?:maj7|M7)\s*\)|(?:maj7|M7))/gi, "oM7"),
    );
  }

  for (const candidate of attempts) {
    const parsed = Chord.get(candidate);
    if (!parsed.empty) return parsed;
  }

  return null;
}

export function parseChordInput(value: string): {
  chord: ParsedChord | null;
  bassNote: string | null;
  isValid: boolean;
} {
  const cleanValue = value.trim();
  if (!cleanValue) return { chord: null, bassNote: null, isValid: false };

  const parts = cleanValue.split("/").map((part) => part.trim());
  if (parts.length > 2 || !parts[0]) {
    return { chord: null, bassNote: null, isValid: false };
  }

  const chord = parseChordWithFallback(parts[0]);
  if (!chord || !chord.tonic) {
    return { chord: null, bassNote: null, isValid: false };
  }

  if (parts.length === 1) {
    return { chord, bassNote: null, isValid: true };
  }

  const bass = Note.get(parts[1]);
  if (bass.empty) {
    return { chord: null, bassNote: null, isValid: false };
  }

  return { chord, bassNote: bass.pc, isValid: true };
}

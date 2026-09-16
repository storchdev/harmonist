# Theming via Shiki's Bundled Editor Themes

Harmonist's theme picker doesn't hand-author its color palettes. Instead it
reuses [Shiki](https://shiki.style)'s collection of ~65 bundled TextMate/VS
Code editor themes (Tokyo Night, Catppuccin, Rosé Pine, Dracula, Nord,
Gruvbox, One Dark Pro, and more) as the source of truth, and derives the
app's UI colors from each theme's editor/token colors at runtime.

This gives users hundreds of familiar, professionally-designed color
combinations "for free," correctly split into light and dark variants,
without the app maintaining its own palette data.

## Why Shiki

Shiki ships each bundled theme as a real VS Code theme JSON (`colors` for
editor chrome, `tokenColors` for syntax highlighting), lazily loadable by
id. Two things make it a good fit for app-wide theming, not just code
highlighting:

- **`shiki/themes`** is a themes-only entry point — no language grammars,
  no highlighter engine. Importing it costs almost nothing; each theme's
  actual color data is only fetched when the user selects it.
- **`bundledThemesInfo`** exposes `{ id, displayName, type }` for every
  theme, where `type` is `"light" | "dark"` — Shiki already classifies
  every theme correctly, so there's no need to guess or hand-tag them.

```ts
import { bundledThemes, bundledThemesInfo, type BundledTheme } from "shiki/themes";

const lightThemes = bundledThemesInfo.filter((t) => t.type === "light"); // 21
const darkThemes = bundledThemesInfo.filter((t) => t.type === "dark");   // 44
```

Note: `shiki/bundle/web` also re-exports the same theme APIs, but it's the
"kitchen sink" web bundle that also pulls in dozens of language grammars,
ballooning the build by megabytes. Import from `shiki/themes` directly to
get only theme data.

## Stratifying by light/dark mode

The app keeps its own independent light/dark toggle (`theme: "light" |
"dark"`), driven by `prefers-color-scheme` with a manual override, same as
before. Theme *selection* is layered on top of that and kept separate per
mode:

```ts
let lightThemeId = $state<BundledTheme>(
  localStorage.getItem("lightThemeId") ?? "github-light",
);
let darkThemeId = $state<BundledTheme>(
  localStorage.getItem("darkThemeId") ?? "tokyo-night",
);

function activeThemeId(): BundledTheme {
  return theme === "dark" ? darkThemeId : lightThemeId;
}
```

The picker UI only lists themes matching the current mode
(`darkThemes`/`lightThemes`), with a text filter since the list can run to
several dozen entries per mode. Selecting a theme writes to whichever of
`lightThemeId`/`darkThemeId` matches that theme's own `type`, so a user's
light and dark choices don't clobber each other when the OS or the manual
toggle flips between modes.

## Deriving UI colors from a theme

A Shiki theme is designed for a code editor, not a whole app, so there's no
single "accent" or "success" field to read off directly. Instead, colors
are picked out of the theme's `colors` map (VS Code's `editor.background`,
`editor.foreground`, `panel.border`, `terminal.ansiGreen`, etc.) and its
`tokenColors` (syntax scopes like `entity.name.function` or
`constant.numeric`), each with a sensible fallback chain:

```ts
function extractPalette(shikiTheme, mode: "light" | "dark"): RawPalette {
  const colors = shikiTheme.colors ?? {};
  const bg = colors["editor.background"] ?? fallbackBg;
  const text = colors["editor.foreground"] ?? fallbackText;
  const accent =
    colors["button.background"] ??
    colors["focusBorder"] ??
    findTokenColor(shikiTheme.tokenColors, ["entity.name.function"], fallbackAccent);
  const secondary = findTokenColor(
    shikiTheme.tokenColors,
    ["keyword.control", "storage.type"],
    colors["terminal.ansiMagenta"] ?? accent,
  );
  // ...surface/border/success/danger/amber follow the same pattern
}
```

`findTokenColor` walks a theme's `tokenColors` array back-to-front (later
rules win, matching how VS Code themes are applied) looking for a rule
whose scope matches one of the requested TextMate scopes, returning its
`settings.foreground`.

The resulting `RawPalette` (13 base colors) is fed through the same
`shade()`/`withAlpha()` helpers used by the app's original hand-authored
palettes to derive `-strong` and `-soft` variants, then pushed onto
`document.documentElement.style` as CSS custom properties
(`--bg`, `--accent`, `--secondary`, `--wave-color`, etc.) — so the rest of
the app's CSS, which already reads these variables, doesn't need to know
where the colors came from.

## Keeping the timeline/waveform in sync

Two kinds of consumers read these variables, and each needs different
handling:

- **CSS values** (chord region borders, fills, label chips) reference
  `var(--accent)` directly, often through `color-mix(in srgb, var(--accent)
  16%, transparent)` for translucency — the browser re-resolves these
  automatically the instant the custom property changes, no JS required.
- **Canvas values** (WaveSurfer's `waveColor`/`progressColor`) are baked
  into canvas draw calls and can't reference CSS variables at all. These
  need an explicit refresh: `WaveformController.refreshThemeColors()`
  reads the current `--wave-color`/`--wave-progress-color` via
  `getComputedStyle()` and calls `wavesurfer.setOptions({ waveColor,
  progressColor })`, invoked once after every theme change.

## Applying a theme

```ts
async function applyPalette() {
  const id = activeThemeId();
  const mod = await bundledThemes[id]();          // lazy import, ~4-9kb gzipped
  const shikiTheme = "default" in mod ? mod.default : mod;
  const raw = extractPalette(shikiTheme, theme);
  // ...set CSS custom properties from raw
  waveformRef?.refreshThemeColors();
}
```

Because each theme is its own dynamically-imported chunk, selecting a new
theme has a small one-time network/parse cost the first time it's picked,
then nothing — Vite code-splits every bundled theme into its own chunk
automatically.

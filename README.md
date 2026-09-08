# Monster Rancher Battle Card — local restoration

A private local web remake built with React, TypeScript, Three.js, React Three Fiber, and an HTML HUD.

## Run it

```bash
pnpm install
pnpm assets
pnpm dev
```

Open `http://localhost:3000`. The asset command reads `../cards` and `../_MFBC_Rule-Book-v3.1.pdf`, validates the archive, and creates cached WebP textures without modifying the source files.

## Included milestone

- All three official 50-card starters, 66 authored skill definitions, and nine starter monsters.
- Deterministic reducer, seeded shuffling, ordered defenses, Guts, KO/deck-out victory rules, combat events, and replay metadata.
- Easy, normal, and hard AI policies. Hard AI evaluates a shallow action beam and sampled hidden-card risk in a Web Worker using only `PlayerObservation`.
- Three.js tabletop with a DOM command HUD, card close-ups, keyboard/touch buttons, reduced-motion support, and a WebGL fallback.
- IndexedDB autosave/resume and completed-match archives.
- Searchable 366-skill visual archive and 65 logical-monster gallery; Gray Wolf maps to `C-044V`, and the 318 misprint is gallery-only.

Cards outside the 66-card starter pool are intentionally visual-reference-only until their behavior is authored and tested. Deck validation rejects unknown or unimplemented skill definitions instead of allowing a silent no-op.

## Verify

```bash
pnpm test
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```

See [ATTRIBUTION.md](./ATTRIBUTION.md) for prototype scope and rights notes.

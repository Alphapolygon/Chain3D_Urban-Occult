# Chain3D - Urban Occult Web Prototype

Three.js + TypeScript prototype for the Urban Occult Chain3D direction.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The project intentionally does not ship with `package-lock.json` right now because earlier lockfiles were generated with incompatible Vite/plugin versions. Run `npm install` once locally, then commit the generated `package-lock.json` if you want to switch GitHub Actions back to `npm ci`.

## Recent patch contents

- Brighter neon block material and lighting.
- Fighter-style HUD: Cleaners left, Breach center, Nightmare right.
- Smaller default board for readability (`maxSize: 15`, `initialRadius: 4`).
- Debug panel for board boundary, initial radius, fill percentage, and speed mode.
- Match removed-index tracking for particle effects.
- Match pop particles driven by `@tweenjs/tween.js`.
- Dynamic camera tactical/action stance.
- Screen shake and hit stop for big snaps/chains.
- Island snap movement records for visual interpolation.
- Smooth renderer interpolation for snapping blocks.
- Cache/hold slot, once per turn.
- Hard Knockdown: large Island Snaps delay enemy attack by +1 turn.
- Poise: enemy gets temporary super armor against repeated knockdowns.
- One-shot shop reroll behavior: after use, reroll glitches to `NO SIGNAL`.

## GitHub Pages

The included workflow uses `npm install`, not `npm ci`, and disables package-manager caching while the prototype is moving fast.

Make sure the Vite base in `vite.config.ts` matches your repo:

```ts
base: '/Chain3D_Urban-Occult/'
```

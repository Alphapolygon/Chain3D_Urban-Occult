# Chain3D - Urban Occult Three.js Prototype

A rapid web prototype of the Chain3D Urban Occult design using TypeScript, Three.js, React UI overlays, and a data-oriented simulation core.

## Run

```bash
npm install
npm run dev
```

## Structure

```text
src/
├── sim/
│   ├── CellBits.ts
│   ├── BreachBoard.ts
│   ├── MatchSystem.ts
│   ├── IslandSnapSystem.ts
│   ├── CoreGrowthSystem.ts
│   ├── CombatSystem.ts
│   ├── ShopSystem.ts
│   └── RunState.ts
├── render/
│   ├── BreachRenderer.ts
│   ├── BreachPicking.ts
│   └── CameraRig.ts
├── ui/
│   ├── HeroPanel.tsx
│   ├── EnemyPanel.tsx
│   ├── QueuePreview.tsx
│   └── DarkwebBodega.tsx
├── data/
│   ├── heroes.ts
│   ├── enemies.ts
│   └── shopItems.ts
└── main.ts
```

## Implemented

- Flat `Uint16Array` board storage with bit-packed cells.
- 3D match-3 detection on X/Y/Z axes.
- Island snapping toward the static core as rigid groups.
- Static core growth after enemy attacks.
- Queued block preview.
- Hero AP, frontline switching, active powers, shields, healing, damage.
- Enemy waves, attack timer, damage escalation, AoE phase scaling.
- Darkweb Bodega shop between waves.
- InstancedMesh rendering and Raycaster placement.

## Design note

The `sim/` folder intentionally imports no Three.js or React. It can be unit-tested or ported back into Unity without dragging in rendering or UI code.

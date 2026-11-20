# AngelShot

A browser-first, physics-led first-person sniper prototype. Milestone 1 is a single-player flight range used to validate movement, aiming, ballistics, and player-body physics before online multiplayer or custom shaders are introduced.

## Run locally

```sh
npm install
npm run dev
```

Open the Vite URL in a desktop browser. Build check: `npm run build`.

## Deploy to GitHub Pages

The `Deploy static content to Pages` workflow builds the Vite app and publishes `dist` on pushes to `main`. GitHub Pages is served from `/AngelShot/`; the workflow sets that Vite base path. For a local production build, run `npm run build`; set `VITE_BASE_PATH=/AngelShot/` if you want to preview the project-site paths locally.

## Milestone 1 controls

- **W / A / S / D** — move
- **Mouse** — look; click **Enter Range** first to capture the pointer
- **Left mouse** — fire a simulated .338 round (850 m/s, gravity enabled)
- **Right mouse** — hold the 8× scope
- **Space** — jump; tap again in air to flap; hold in air to glide
- **R** — spawn an articulated physics ragdoll for testing
- **T** — reset after the ragdoll test
- **Esc** — release the pointer

The test range has three steel targets at different distances and a hit counter. Movement uses a Rapier dynamic capsule with ground collision, gravity, and air control; the ragdoll uses linked rigid bodies and spherical joints. The render layer uses Three.js standard materials and simple geometry. No custom shaders or external art assets are required.

## Scope boundary

This is a local gameplay prototype, not multiplayer yet. Multiplayer should follow once the control feel, flight behavior, and hit registration are validated; networking will need server-authoritative shot and movement validation. Custom shaders remain deferred until the core game reaches the agreed level.

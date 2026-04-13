# Asphra

Asphra is now set up as a Vite + Three.js project focused on a high-quality world pass:

- continuous ribbon-style procedural road
- rolling terrain updates around the player
- cinematic rear camera rig
- keyboard vehicle placeholder for world/camera iteration

## Run

```bash
npm install
npm run dev
```

Then open the local Vite URL (usually `http://localhost:5173`).

## Build

```bash
npm run build
npm run preview
```

## Controls

- `W` / `↑`: throttle
- `S` / `↓`: brake / reverse
- `A` / `←`: steer left
- `D` / `→`: steer right

## Project Structure

```text
src/
  main.js
  core/math.js
  camera/CameraRig.js
  vehicle/VehicleController.js
  world/RoadSystem.js
  world/TerrainSystem.js
  world/noise.js
```

# Asphra

Asphra is a browser-based 3D driving prototype built using the Three.js library. The project demonstrates fundamental concepts in real-time rendering, camera systems, and physics-inspired vehicle movement.

## Features

* 3D scene rendering using Three.js
* Player-controlled vehicle with smooth steering
* Acceleration and deceleration system with friction
* Third-person follow camera with smoothing
* Basic road and lane visualization
* Modular code structure for scalability

## Project Structure

```
.
├── index.html     # Entry point
├── main.js        # Scene setup and animation loop
├── car.js         # Vehicle movement and controls
├── camera.js      # Camera follow system
├── road.js        # Road creation logic
```

## Getting Started

### Option 1: Run locally (recommended)

Due to browser security restrictions, it is recommended to run the project using a local server.

#### Using Python

1. Open a terminal in the project directory
2. Run the following command:

```
python3 -m http.server
```

3. Open your browser and navigate to:

```
http://localhost:8000
```

---

### Option 2: Open directly

You may open `index.html` directly in a browser, but some features may not work correctly depending on your browser’s security settings.

## Controls

* Arrow Up: Accelerate
* Arrow Down: Brake / Reverse
* Arrow Left: Turn left
* Arrow Right: Turn right

## Technologies Used

* JavaScript
* Three.js (via CDN)

## Future Improvements

* Infinite procedural road generation
* Curved and branching roads
* Collision detection and boundaries
* Vehicle model replacement
* UI and HUD elements

## License

This project is open source. You may use, modify, and distribute it under the terms of the chosen license.

## Acknowledgements

* Three.js for providing a powerful and accessible 3D rendering library

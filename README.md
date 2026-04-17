# Vidasun — Ant Colony Simulation

An interactive ant colony simulation built with vanilla JavaScript and HTML5 Canvas. Watch ants forage for food, coordinate to carry crumbs back to their colony, and grow their population over time.

## How It Works

Click anywhere on the canvas to drop food crumbs. Nearby ants will detect the crumbs, navigate toward them, and work together to carry them back to the hole. Each crumb delivered grows the colony by spawning a new ant.

- **Small crumbs** — carried by a single ant
- **Medium crumbs** — require 2 ants
- **Large crumbs** — require 3 ants

## Features

- **Emergent coordination** — ants dynamically assign themselves to tasks based on proximity and crumb needs
- **Natural movement** — sinusoidal wandering, edge avoidance, and smooth turning give ants organic behavior
- **Visual effects** — ripple on drop, particle burst on delivery, persistent motion trails
- **Colony growth** — each delivered crumb spawns a new ant from the hole
- **HiDPI support** — crisp rendering on high-resolution displays
- **Touch-friendly** — works on desktop and mobile

## Stack

- HTML5 Canvas API
- Vanilla JavaScript (ES6, no dependencies)
- CSS — fullscreen layout with crosshair cursor
- Hosted on IIS (`web.config` included)

## Running Locally

Serve the project root with any static file server:

```bash
npx serve .
# or
python -m http.server
```

Then open `http://localhost:3000` (or whichever port) in a browser.

## Files

| File | Purpose |
|---|---|
| `index.html` | Entry point and canvas element |
| `script.js` | Simulation logic, rendering, input handling |
| `styles.css` | Fullscreen layout |
| `web.config` | IIS static file configuration |

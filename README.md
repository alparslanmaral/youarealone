# You Are Alone

A small browser game prototype inspired by “survivor” style games (Vampire Survivors-like).  
You control a character on a full-screen canvas while enemies spawn around the edges and chase you. Your character attacks automatically, gains XP from kills, and levels up to pick upgrades.

The project is intentionally simple: plain HTML/CSS/JavaScript with no build step.

## How to play

- Move around and avoid contact damage from enemies.
- Your character fires automatically at the nearest enemy.
- Killing enemies gives XP. When you level up, you must choose one of two upgrades.
- If your HP reaches 0, the run ends (refresh the page to restart).

## Controls

### Keyboard
- Move: **W / A / S / D** or **Arrow keys**

### Mobile / touch devices
- A joystick appears on touch devices.
- Drag the joystick to move.

## Upgrades

When you level up, you’ll see two random upgrade options. Current upgrades include:
- +10% attack speed
- +10% movement speed
- +1 projectile per shot
- +1 max HP (permanent)
- +3 instant heal

## Run locally

Because this is a static project, you can run it in any of these ways:

### Option 1: Open the file
- Open `index.html` in your browser.

### Option 2: Use a simple local server (recommended)
Any static server works. Examples:

- VS Code: “Live Server” extension
- Python:
  - `python -m http.server`
- Node:
  - `npx serve`

Then visit the local address shown in the terminal.

## Project structure

- `index.html` – page markup (canvas + HUD + level-up panel + mobile joystick)
- `style.css` – UI styling and layout
- `main.js` – game loop, player/enemy/projectile logic, XP/level-up system, upgrades, input handling

## Notes

- The canvas is resized to the full browser window.
- Enemy spawning is dynamically tuned to avoid overwhelming the player/device.
- This is a prototype meant for experimentation and iteration.

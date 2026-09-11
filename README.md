# Fluid Lab

A colorful ink playground in thirteen small discoveries, with a 3D "hills" view of pressure, ink or speed on every GPU chapter, a "Play with the rules" drawer of physics knobs on every page,: how water, smoke and wind move (the three ingredients of the Navier-Stokes equations), built for a parent and a nine-year-old to explore together. English with a Hebrew toggle, a Glow or Paper look, and a "Peek inside" drawer with the science in each chapter.

Inspired by the Two Minute Papers video "I Never Thought I'd See This Happen" (https://youtu.be/mOvtumfyjCs), on OpenAI's claimed solution of the Navier-Stokes existence and smoothness problem. Transcript: `reference/video-transcript.txt`.

## Play it

- Live: https://fluid-lab-phi.vercel.app
- Source: https://github.com/drorlazar/fluid-lab

Works on phones and tablets too (Safari 15+, Chrome). On a phone the tools scroll sideways under the water.

## Open it

Double-click `index.html`. No install, no build. Works in any modern browser with WebGL2 (Chrome, Safari 15+, Firefox, Edge). The fonts load from Google Fonts when online and fall back to system fonts offline. It remembers which chapter, language and look you were on. You can also jump to a chapter with `index.html?ch=7`.

The simulation runs on the GPU: the water is solved at 256 cells across and the ink is drawn at 1024 across (the sandbox can switch to 160 or 384). If a device can't hold a smooth frame rate for a couple of seconds, the lab drops one quality tier by itself. Without WebGL2 it falls back to the CPU solver at low resolution.

## Chapters

| # | Chapter | What you do |
|---|---|---|
| 1 | The river puzzle | Watch ink drops fall into water. Drag to push. |
| 2 | Advection | Paint ink, push through it, watch it ride the flow. |
| 3 | Pressure | Flip the Make-room switch off and watch ink pile up wrongly. Switch to 3D hills to see pressure as a landscape; paint as usual, right-drag to look around. |
| 4 | Diffusion | Sliders for ink spreading and fluid thickness (viscosity). |
| 5 | Forces | Fan switch, heavy and light ink. |
| 6 | The grid trick | A 24 by 15 grid with numbers in every box. Step one frame at a time. |
| 7 | Wind tunnel | Round, box or wing obstacle, or draw your own. Watch the vortex street. |
| 8 | Hot smoke | Click to place candles. Buoyancy, heat and a side fan. |
| 9 | Light a fire in 3D | A real 3D smoke simulation (a 64-cell cube) with raymarched rendering: campfire, puff, and a 3D wind tunnel with a ball. Right-drag to orbit. |
| 10 | Vortex dance | Drop whirls. Same-way pairs orbit, opposite pairs travel. |
| 11 | The mixing race | Wait for diffusion versus stir, with a timer and a mixed-ness meter. |
| 12 | Marble painting | Swirl and comb ink, save the picture. |
| 13 | The big sandbox | Every knob of the solver, with presets. |

## Buttons

- **Restart** clears the ink and motion but keeps walls, candles and every knob. **Start over** resets the chapter completely.
- **Story / Rules** tabs beside the water: the story, and that chapter's physics knobs with a "Restore this chapter" button.

## Files

- `index.html`, `style.css`, `icons.js` — the page, its game-style chrome (sky, cream cards, cobalt slabs, gold action) and the SVG icon set
- `gpu3d.js` — the 3D volumetric smoke engine (tiled-atlas WebGL2 solver plus raymarched rendering with shadows)
- `gpu.js` — the WebGL2 fluid engine (velocity, pressure, RGB ink at higher resolution, temperature and buoyancy, obstacles, vorticity confinement, MacCormack ink advection, wind inflow, bloom, mixing meter)
- `fluid.js` — the CPU solver with the same interface, used for the 24 by 15 counting grid and as a fallback
- `lab.js` — the reusable lab: canvases, brushes, render modes, the controls tray, quality tiers
- `content.js` — every visible string in English and Hebrew (UI labels and the thirteen chapters)
- `chapters.js` — the twelve lab configurations
- `app.js` — navigation, language and look switching
- `build-single.py` — bundles everything into `dist/fluid-lab.html` for publishing
- `test/solver.test.mjs` — solver tests, run with `node --test test/solver.test.mjs`
- `plans/` — design spec

## Tests

```bash
node --test test/solver.test.mjs
```

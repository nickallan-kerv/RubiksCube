# RubiksCube

A GitHub Copilot experimentation project exploring how far an AI-assisted workflow can go when building an interactive 3D product from scratch.

The result is a browser-based Rubik's Cube experience with smooth 3D rendering, drag-based face turns, scramble/reset controls, and support for multiple puzzle sizes.

## Live Links

- Play the project (GitHub Pages): https://nickallan-kerv.github.io/rubikscube/
- Delivery Kanban board: https://github.com/users/nickallan-kerv/projects/5
- Repository: https://github.com/nickallan-kerv/rubikscube

## Why This Project Exists

This project was created as a practical experiment in AI-accelerated software delivery:

- Use GitHub Copilot as a day-to-day implementation partner.
- Keep architecture and quality intentional instead of "prompt-and-pray".
- Measure whether disciplined engineering methods still matter in an AI-first build flow.

In short: this is as much about the delivery process as it is about the cube itself.

## What It Does

- Renders a fully interactive 3D Rubik's Cube in the browser.
- Supports variable dimensions with built-in presets:
	- 2x2 (Pocket)
	- 3x3 (Classic)
	- 4x4 (Revenge)
- Allows direct manipulation of faces through pointer interactions.
- Includes scramble and reset actions for quick practice loops.
- Tracks solve progress with move count, timer, and solved-state feedback.
- Persists selected cube size for a smoother return experience.

## Technology, At A Glance

- TypeScript for maintainable, explicit logic.
- Three.js for 3D scene setup, camera, meshes, and rendering.
- Vite for fast local development and production builds.
- Vitest for automated tests around cube logic and interaction behavior.

## SDD Methodology (Specification-Driven Delivery)

This project followed an SDD-style workflow to keep AI output aligned with product intent:

1. Specify outcomes first.
2. Decompose work into scoped backlog items.
3. Implement against clear acceptance criteria.
4. Validate with tests and focused manual checks.
5. Iterate in small increments via Kanban.

Practically, this meant every meaningful change was driven by a concrete objective (behavior, UX, or quality), not just by code generation opportunities.

## What Makes This Interesting For Delivery Teams

- Demonstrates that Copilot can speed implementation while still preserving engineering discipline.
- Shows how a visual, interaction-heavy experience can be delivered with a tight feedback loop.
- Highlights a replicable workflow: combine AI pair-programming with explicit requirements, test coverage, and transparent task flow.

## Running Locally

```bash
npm install
npm run dev
```

Open the local URL shown by Vite to interact with the cube.

## Testing

```bash
npm run test
```

## Deploying To GitHub Pages

Push the current `main` commit and wait for the matching Pages deployment:

```powershell
npm run deploy:pages
```

The helper verifies that `deploy-pages.yml` ran for the pushed commit. If the push event does not create a workflow run, it dispatches the workflow explicitly and waits for completion.

## Project Status

This is an active experimentation project. Expect ongoing refinements in interaction quality, puzzle behavior, and delivery workflow patterns as the Copilot-assisted process evolves.

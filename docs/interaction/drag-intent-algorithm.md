# Drag Intent Algorithm

## Status

Accepted on 2026-09-01. The legacy lookup-table implementation is preserved by the annotated Git tag `drag-intent-legacy-baseline-2026-09-01`.

## Problem

The original pointer-drag resolver mixed camera-relative horizontal and vertical intent, face-specific sign tables, special handling for top and bottom bands, and a separate fallback direction mapper. Correcting one gesture could therefore alter unrelated gestures that happened to share a branch.

A cube viewed from a fixed orbit exposes three faces. On any hit face, a valid slice gesture follows one of exactly two cube-local tangents. Once that tangent and its sign are known:

1. The cross product of the hit-face normal and signed tangent gives the quarter-turn axis and sign.
2. The clicked cubie's coordinate on that axis gives the exact slice.
3. The axis, slice, and sign translate to the existing `CubeMove` representation.

For a 3x3 cube, the physical planes are the three axis families `L/M/R`, `D/E/U`, and `B/S/F`, each in two directions. The same coordinate rule extends to every layer of an N x N cube.

## Research

### pengfeiw/rubiks-cube

- Repository: <https://github.com/pengfeiw/rubiks-cube>
- Relevant source: `src/rubiks/core/control.ts` and the cube rotation implementation it calls
- License: MIT
- Useful pattern: raycast the pointer-down target, retain a stable gesture session, derive rotation from cube geometry, and lock interaction while a turn completes.

This is the primary licensed implementation reference. The implementation in this project is original and uses the existing controller and move engine rather than copying source.

### buuing/Rubiks-Cube

- Repository: <https://github.com/buuing/Rubiks-Cube>
- Relevant source: `src/index.ts`, especially `computeRotation`, `onMouseDown`, and `onMouseMove`
- License: no license file was found during research
- Useful concept: capture a raycast point and face normal, compare movement with cardinal directions, and use the touched cubie's coordinate to select a layer.

Because no license was found, this repository is a conceptual comparison only. No source is adapted from it.

## Decision

At pointer-down, the controller will capture:

- The pointer identifier and starting canvas-pixel position.
- The raycast hit point.
- The hit face's cube-local cardinal normal.
- The touched cubie's local integer coordinates and cube dimension.
- The two legal cube-local cardinal tangents, projected through the current cube transform and camera into normalized screen-space vectors.

After a pixel dead zone, the resolver compares the normalized accumulated pointer delta with both projected tangents. Absolute dot product selects the tangent family; the signed dot product selects its direction. A confidence margin prevents nearly diagonal gestures from resolving prematurely. Once selected, intent remains locked for the pointer sequence.

The physical rotation is:

```text
rotation axis and sign = face normal x signed tangent
```

The touched cubie's coordinate on the unsigned rotation axis selects the layer. One adapter translates that physical rotation to `CubeMove { face, layer, direction }`. `M`, `E`, and `S` remain human-readable aliases for center planes rather than new domain primitives.

If the projected basis is degenerate, the drag remains below threshold, or neither tangent wins with sufficient confidence, pointer-up emits no move. There is no fallback classifier.

## Replaced Design

The replacement removes all original intent logic, including:

- Face-specific drag/rotation sign tables.
- Screen-horizontal and screen-vertical routing.
- Top/bottom band and U/D special cases.
- Direction overrides.
- Face-local fallback inference.
- Tests whose expected values encode those branches rather than physical rotation invariants.

Neutral infrastructure remains: pointer events, raycasting, mesh coordinate extraction, OrbitControls integration, debug delivery, and the existing move/animation callback.

## Verification Invariants

Automated coverage must prove:

1. Each of three visible hit faces supports both legal tangent families.
2. Every touched layer coordinate resolves to that exact physical slice.
3. Both drag signs produce opposite quarter turns on the same slice.
4. Equivalent gestures from neighbouring visible faces produce the same physical rotation.
5. Camera orientation and canvas aspect ratio change projected screen directions but not the resulting physical move.
6. Intent never changes after locking.
7. Sub-threshold, ambiguous, cancelled, and degenerate gestures emit no move.
8. The rules work for 2x2, 3x3, and 4x4 cubes without dimension-specific intent branches.

A repository search for every legacy resolver symbol must return no production or test references before completion.
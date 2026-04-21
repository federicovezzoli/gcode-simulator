# G-Code Simulator

A browser-based CNC milling simulator. Paste or upload a G-code file, configure your stock and tools, run the simulation, and inspect the carved result in an interactive 3D view.

**[Live demo →](https://federicovezzoli.github.io/gcode-simulator/)**

## Features

- **G-code support** — G0/G1 linear moves, G2/G3 arcs (IJ format), G90/G91 absolute/relative modes, M0 tool changes
- **Multi-tool sections** — auto-detects tool changes; each section gets its own diameter and type settings
- **Tool types** — flat-end mill and ball-nose mill with analytical swept-volume calculations
- **3D visualization** — interactive orbit camera, custom GLSL shaders with depth-based lighting and smooth normals
- **File upload** — accepts `.nc`, `.gcode`, `.ngc`, `.tap`, `.txt`
- **Configurable stock** — set width, height, and depth; adjust simulation grid resolution

## Tech stack

- [Next.js](https://nextjs.org/) · [React](https://react.dev/) · TypeScript
- [Three.js](https://threejs.org/) · [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) · [Drei](https://github.com/pmndrs/drei)
- [Tailwind CSS v4](https://tailwindcss.com/) · [shadcn/ui](https://ui.shadcn.com/)

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How it works

The simulator converts G-code moves into a **heightmap** — a float grid where each cell stores the minimum Z depth reached by any tool pass. Arcs are approximated as polyline segments (0.002 mm chord tolerance). Each linear segment is carved as an analytical capsule sweep, avoiding the gaps that discrete sampling would leave on curved paths. The heightmap is uploaded to the GPU as a texture; a vertex shader displaces geometry and a fragment shader computes smooth normals via a 5×5 Gaussian-weighted Sobel filter.

## License

[MIT](LICENSE)

# [1.1.0](https://github.com/federicovezzoli/gcode-simulator/compare/v1.0.0...v1.1.0) (2026-04-15)


### Bug Fixes

* adjust main container height for better layout in Home component ([0247cd8](https://github.com/federicovezzoli/gcode-simulator/commit/0247cd8face742d35ebeb5f30a56f507dc8822ae))
* improve section label handling in G-code parsing to ignore generic Estlcam messages ([c436ba7](https://github.com/federicovezzoli/gcode-simulator/commit/c436ba7f52d2ecb4633054cc2b228b4f9fc5b53c))
* refactor theme initialization script and improve layout structure in RootLayout component ([499e56c](https://github.com/federicovezzoli/gcode-simulator/commit/499e56c51430668c3bb0b7aca029c5574948dec2))


### Features

* add theme toggle component and update layout for improved user experience ([5705e30](https://github.com/federicovezzoli/gcode-simulator/commit/5705e30c4d303c0b8b20aef5d78246e37bc26820))
* add unique IDs to section tools for better tracking in Simulator3D ([7bda217](https://github.com/federicovezzoli/gcode-simulator/commit/7bda217f677764c542684c601405cf4f6efe3c8b))

# 1.0.0 (2026-04-14)


### Bug Fixes

* correct JSX syntax for Slider component rendering ([09de85f](https://github.com/federicovezzoli/gcode-simulator/commit/09de85f714ed9c35bab4b25d71e93a355cdfa768))
* correct pixel scaling in Simulator and initialize heightmap data ([d895d96](https://github.com/federicovezzoli/gcode-simulator/commit/d895d96c7dee95785af5b0c64b18e7c9423cc307))
* downgrade three.js version to 0.175.0 for compatibility ([5f7e711](https://github.com/federicovezzoli/gcode-simulator/commit/5f7e711d800a0a25341db5356b8afde61dfcbc98))
* remove unused @types/three dependency and update description in Home component ([8759190](https://github.com/federicovezzoli/gcode-simulator/commit/8759190ba86a24a4c5736783a48dc2730f6a58a2))
* update default cell size in Simulator3D configuration ([9055b22](https://github.com/federicovezzoli/gcode-simulator/commit/9055b228597440e076caac31f51040d444b2a2f5))
* update depthColor function to return RGB array and initialize heightmap data to zero ([e1a3952](https://github.com/federicovezzoli/gcode-simulator/commit/e1a3952124f0438ca76c5b973b87a0e2a6eba141))


### Features

* add CI workflow for linting and TypeScript type checking ([82b9aaf](https://github.com/federicovezzoli/gcode-simulator/commit/82b9aaf468e260c744bb1567d2d4c9d7f9f25607))
* add GitHub Actions workflow for automatic branch cleanup on merged pull requests ([326a55c](https://github.com/federicovezzoli/gcode-simulator/commit/326a55c610d9d5c69ccb5eef015a52f852fe4ff6))
* add GitHub Actions workflow for deploying to GitHub Pages ([1d8745b](https://github.com/federicovezzoli/gcode-simulator/commit/1d8745be60581dbcc05893ea1d138f6c907346fa))
* add NumberField, SliderField, and ToolSection components; enhance G-code parsing and simulation logic ([71e9083](https://github.com/federicovezzoli/gcode-simulator/commit/71e9083ba422dde3f816fb9bfe6c3d26379f8124))
* add typecheck script to package.json ([1cee305](https://github.com/federicovezzoli/gcode-simulator/commit/1cee3051deafa21690a1146a07eb17a1d657518c))
* allow pull requests from the dev branch in CI workflow ([201ab35](https://github.com/federicovezzoli/gcode-simulator/commit/201ab352ccda61e1c493c5613c0b0d715f8d56af))
* enhance G-code parsing and heightmap simulation documentation ([6aa8db2](https://github.com/federicovezzoli/gcode-simulator/commit/6aa8db248ca567d2ba00876e25f1f5d4cab130c7))
* enhance GitHub Actions workflow for release management and issue closing ([0f2a7af](https://github.com/federicovezzoli/gcode-simulator/commit/0f2a7afd3a142f32909ec4caef51e6540856e989))
* enhance heightmap simulation with move logging and improved tool stamping ([6cdcc26](https://github.com/federicovezzoli/gcode-simulator/commit/6cdcc26fbe95605ffe957b1a23cf549aedacb175))
* implement arc approximation for G2/G3 commands and enhance G-code parsing ([3883044](https://github.com/federicovezzoli/gcode-simulator/commit/38830444629308dac42816bcfb591972347e2de3))
* implement G-code parsing and heightmap simulation functionality ([5d97240](https://github.com/federicovezzoli/gcode-simulator/commit/5d97240f64840e62d25fad3f1610d831cc310ccb))
* implement G-code simulator with heightmap rendering and UI components ([9780a60](https://github.com/federicovezzoli/gcode-simulator/commit/9780a60cfca026ac6b5fadac74935abc81c1a29c))
* implement GLSL shaders for heightmap rendering and improve tool stamping logic ([d688e62](https://github.com/federicovezzoli/gcode-simulator/commit/d688e62e2d7cc44f80efc877fcd55ae1bf5dc965))
* initial commit ([a0b2e33](https://github.com/federicovezzoli/gcode-simulator/commit/a0b2e33bc5d4e294350605e45ef5360cadb3e170))
* integrate 3D heightmap simulation using React Three Fiber ([4b573ea](https://github.com/federicovezzoli/gcode-simulator/commit/4b573eabec7f30e1750f20a30682111af036be34))
* refactor depth stops to a constant and update gradient background logic ([0dd93df](https://github.com/federicovezzoli/gcode-simulator/commit/0dd93df8e64e4ac55d03ace44e456c36029881b9))
* refactor Simulator3D layout and enhance G-code input handling ([8a5680d](https://github.com/federicovezzoli/gcode-simulator/commit/8a5680de0ecc3987ddc1134c6ade740555591c1c))
* replace SliderField with NumberField for stock dimensions input ([a2a6f45](https://github.com/federicovezzoli/gcode-simulator/commit/a2a6f454457beb45d7fd209296e77130980c0704))
* update GitHub Actions workflows for branch cleanup and deployment concurrency ([6e3f0ef](https://github.com/federicovezzoli/gcode-simulator/commit/6e3f0efe940d5558928dd04620fcb835ca24e739))

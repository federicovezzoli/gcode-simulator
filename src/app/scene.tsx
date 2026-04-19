"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import type { Heightmap } from "@/lib/simulator/types";

// ── GLSL shaders ─────────────────────────────────────────────────────────────

const vertexShader = /* glsl */ `
  // Heightmap: R channel = surface Z in mm (≤ 0).
  uniform sampler2D uHeightmap;

  // Passed to the fragment shader for depth colouring and normal estimation.
  varying vec2  vUv;
  varying float vZ;

  void main() {
    vUv = uv;

    // Sample Z from the heightmap and displace this vertex along Z.
    // The PlaneGeometry has one vertex per heightmap cell, so each sample
    // lands exactly on a texel centre — no interpolation artefacts.
    float z = texture2D(uHeightmap, uv).r;
    vZ = z;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x, position.y, z, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uHeightmap;
  // One texel in UV space: vec2(1.0/cols, 1.0/rows).
  uniform vec2  uTexelSize;
  // Physical size of one texel in mm (= cellSize).
  uniform float uCellSize;

  varying vec2  vUv;
  varying float vZ;

  void main() {
    // ── Surface normal via 5×5 Gaussian-weighted Sobel ────────────────────
    // Kernel = [1 4 6 4 1]ᵀ ⊗ [-1 -2 0 2 1]   (and its transpose for dZ/dy).
    // Why 5×5 and not 3×3:
    //   For a flat-endmill rim, the heightmap drops from 0 (uncut) to
    //   -depth (cut) across a single cell — a vertical wall the grid can't
    //   represent. Along a *curved* rim, the "first cell inside" line
    //   zig-zags against the cell grid; a 3×3 Sobel still resolves that
    //   single-cell flip and shades it as periodic bands. The extra
    //   Gaussian rows smooth those flips into a continuous wall gradient.
    //   See docs/heightmap-rim-artifacts.md for the long-form explanation
    //   and a future upgrade path (dexel representation) that would fix
    //   the data side too.
    //
    // Naming: z{col}{row}, indices 0..4 mapping to offsets -2..+2 cells.
    float tx = uTexelSize.x;
    float ty = uTexelSize.y;
    float z00 = texture2D(uHeightmap, vUv + vec2(-2.0*tx, -2.0*ty)).r;
    float z10 = texture2D(uHeightmap, vUv + vec2(-1.0*tx, -2.0*ty)).r;
    float z20 = texture2D(uHeightmap, vUv + vec2( 0.0,    -2.0*ty)).r;
    float z30 = texture2D(uHeightmap, vUv + vec2( 1.0*tx, -2.0*ty)).r;
    float z40 = texture2D(uHeightmap, vUv + vec2( 2.0*tx, -2.0*ty)).r;
    float z01 = texture2D(uHeightmap, vUv + vec2(-2.0*tx, -1.0*ty)).r;
    float z11 = texture2D(uHeightmap, vUv + vec2(-1.0*tx, -1.0*ty)).r;
    float z21 = texture2D(uHeightmap, vUv + vec2( 0.0,    -1.0*ty)).r;
    float z31 = texture2D(uHeightmap, vUv + vec2( 1.0*tx, -1.0*ty)).r;
    float z41 = texture2D(uHeightmap, vUv + vec2( 2.0*tx, -1.0*ty)).r;
    float z02 = texture2D(uHeightmap, vUv + vec2(-2.0*tx,  0.0   )).r;
    float z12 = texture2D(uHeightmap, vUv + vec2(-1.0*tx,  0.0   )).r;
    float z22 = texture2D(uHeightmap, vUv                         ).r;
    float z32 = texture2D(uHeightmap, vUv + vec2( 1.0*tx,  0.0   )).r;
    float z42 = texture2D(uHeightmap, vUv + vec2( 2.0*tx,  0.0   )).r;
    float z03 = texture2D(uHeightmap, vUv + vec2(-2.0*tx,  1.0*ty)).r;
    float z13 = texture2D(uHeightmap, vUv + vec2(-1.0*tx,  1.0*ty)).r;
    float z23 = texture2D(uHeightmap, vUv + vec2( 0.0,     1.0*ty)).r;
    float z33 = texture2D(uHeightmap, vUv + vec2( 1.0*tx,  1.0*ty)).r;
    float z43 = texture2D(uHeightmap, vUv + vec2( 2.0*tx,  1.0*ty)).r;
    float z04 = texture2D(uHeightmap, vUv + vec2(-2.0*tx,  2.0*ty)).r;
    float z14 = texture2D(uHeightmap, vUv + vec2(-1.0*tx,  2.0*ty)).r;
    float z24 = texture2D(uHeightmap, vUv + vec2( 0.0,     2.0*ty)).r;
    float z34 = texture2D(uHeightmap, vUv + vec2( 1.0*tx,  2.0*ty)).r;
    float z44 = texture2D(uHeightmap, vUv + vec2( 2.0*tx,  2.0*ty)).r;

    // Normalisation: applying [-1,-2,0,2,1] to a unit ramp z=x gives 8;
    // the row-weight vector [1,4,6,4,1] sums to 16 → divide by 128 to get
    // slope in (mm Z) per (cell). Divide again by cellSize for mm/mm.
    float dzdx = (
      -1.0*z00 - 2.0*z10            + 2.0*z30 + 1.0*z40
      -4.0*z01 - 8.0*z11            + 8.0*z31 + 4.0*z41
      -6.0*z02 -12.0*z12            +12.0*z32 + 6.0*z42
      -4.0*z03 - 8.0*z13            + 8.0*z33 + 4.0*z43
      -1.0*z04 - 2.0*z14            + 2.0*z34 + 1.0*z44
    ) / (128.0 * uCellSize);

    float dzdy = (
      -1.0*z00 - 4.0*z10 - 6.0*z20 - 4.0*z30 - 1.0*z40
      -2.0*z01 - 8.0*z11 -12.0*z21 - 8.0*z31 - 2.0*z41
      // middle row (j=0) has zero weight
      +2.0*z03 + 8.0*z13 +12.0*z23 + 8.0*z33 + 2.0*z43
      +1.0*z04 + 4.0*z14 + 6.0*z24 + 4.0*z34 + 1.0*z44
    ) / (128.0 * uCellSize);

    // For a heightmap z = f(x,y), the surface normal is (-dzdx, -dzdy, 1).
    vec3 normal = normalize(vec3(-dzdx, -dzdy, 1.0));

    // ── Ambient + diffuse lighting ────────────────────────────────────────
    vec3  baseColor = vec3(228.0, 228.0, 231.0) / 255.0; // zinc-200
    vec3  lightDir  = normalize(vec3(1.0, 1.0, 2.0));
    float diffuse   = max(dot(normal, lightDir), 0.0);
    float light     = 0.4 + 0.6 * diffuse;

    gl_FragColor = vec4(baseColor * light, 1.0);
  }
`;

// ── Components ────────────────────────────────────────────────────────────────

export interface SceneConfig {
	stockWidth: number;
	stockDepth: number;
	stockHeight: number;
}

function HeightmapMesh({
	heightmap,
	config,
}: {
	heightmap: Heightmap;
	config: SceneConfig;
}) {
	const { stockWidth, stockDepth } = config;

	// Upload the heightmap once as a single-channel float texture.
	// The vertex shader displaces each vertex by sampling this texture —
	// zero CPU work per frame after upload.
	const texture = useMemo(() => {
		const tex = new THREE.DataTexture(
			heightmap.data,
			heightmap.cols,
			heightmap.rows,
			THREE.RedFormat,
			THREE.FloatType,
		);
		tex.minFilter = THREE.LinearFilter;
		tex.magFilter = THREE.LinearFilter;
		tex.needsUpdate = true;
		return tex;
	}, [heightmap]);

	const material = useMemo(
		() =>
			new THREE.ShaderMaterial({
				vertexShader,
				fragmentShader,
				uniforms: {
					uHeightmap: { value: texture },
					uTexelSize: {
						value: new THREE.Vector2(1 / heightmap.cols, 1 / heightmap.rows),
					},
					uCellSize: { value: heightmap.cellSize },
				},
				side: THREE.DoubleSide,
			}),
		[texture, heightmap],
	);

	// One vertex per heightmap cell — each UV lands exactly on a texel centre.
	return (
		<mesh material={material}>
			<planeGeometry
				args={[stockWidth, stockDepth, heightmap.cols - 1, heightmap.rows - 1]}
			/>
		</mesh>
	);
}

// BoxGeometry face group order: 0=+x, 1=-x, 2=+y, 3=-y, 4=+z (stock top), 5=-z (stock bottom).
// Face 4 (+Z) is removed — the displaced heightmap surface sits there instead.
function StockBox({ config }: { config: SceneConfig }) {
	const { stockWidth, stockDepth, stockHeight } = config;
	return (
		<mesh position={[0, 0, -stockHeight / 2]}>
			<boxGeometry args={[stockWidth, stockDepth, stockHeight]} />
			{[0, 1, 2, 3, 4, 5].map((i) =>
				i === 4 ? (
					<meshBasicMaterial
						key={i}
						attach={`material-${i}`}
						transparent
						opacity={0}
						depthWrite={false}
					/>
				) : (
					<meshStandardMaterial
						key={i}
						attach={`material-${i}`}
						color="#e4e4e7"
						polygonOffset
						polygonOffsetFactor={2}
						polygonOffsetUnits={2}
					/>
				),
			)}
		</mesh>
	);
}

export interface SceneProps {
	heightmap: Heightmap | null;
	config: SceneConfig;
}

export function Scene({ heightmap, config }: SceneProps) {
	const { stockWidth, stockDepth, stockHeight } = config;
	const d = Math.max(stockWidth, stockDepth, stockHeight);

	return (
		<Canvas
			camera={{
				position: [d * 0.9, -d * 0.9, d * 0.8],
				up: [0, 0, 1],
				fov: 45,
			}}
			style={{ position: "absolute", inset: 0, background: "#09090b" }}
		>
			<ambientLight intensity={0.5} />
			<directionalLight position={[1, 1, 2]} intensity={1} />

			{heightmap && <HeightmapMesh heightmap={heightmap} config={config} />}
			<StockBox config={config} />

			<OrbitControls makeDefault enableZoom target={[0, 0, -stockHeight / 4]} />
		</Canvas>
	);
}

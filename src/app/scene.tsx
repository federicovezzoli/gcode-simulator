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
    // ── Surface normal via finite differences ─────────────────────────────
    float zR = texture2D(uHeightmap, vUv + vec2(uTexelSize.x, 0.0)).r;
    float zU = texture2D(uHeightmap, vUv + vec2(0.0, uTexelSize.y)).r;
    vec3 tangentX = normalize(vec3(uCellSize, 0.0,      zR - vZ));
    vec3 tangentY = normalize(vec3(0.0,      uCellSize, zU - vZ));
    vec3 normal   = normalize(cross(tangentX, tangentY));

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

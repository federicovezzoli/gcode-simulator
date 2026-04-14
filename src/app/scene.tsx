"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import type { Heightmap } from "@/lib/simulator/types";


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
	const geo = useMemo(() => {
		const { cols, rows, data } = heightmap;
		const { stockWidth, stockDepth } = config;

		const vertexCount = cols * rows;
		const positions = new Float32Array(vertexCount * 3);

		for (let row = 0; row < rows; row++) {
			for (let col = 0; col < cols; col++) {
				const i = row * cols + col;
				positions[i * 3 + 0] = (col / (cols - 1)) * stockWidth - stockWidth / 2;
				positions[i * 3 + 1] = (row / (rows - 1)) * stockDepth - stockDepth / 2;
				positions[i * 3 + 2] = data[i];
			}
		}

		const triCount = (cols - 1) * (rows - 1) * 6;
		const indices = new Uint32Array(triCount);
		let idx = 0;
		for (let row = 0; row < rows - 1; row++) {
			for (let col = 0; col < cols - 1; col++) {
				const tl = row * cols + col;
				const tr = row * cols + col + 1;
				const bl = (row + 1) * cols + col;
				const br = (row + 1) * cols + col + 1;
				indices[idx++] = tl;
				indices[idx++] = bl;
				indices[idx++] = tr;
				indices[idx++] = tr;
				indices[idx++] = bl;
				indices[idx++] = br;
			}
		}

		const g = new THREE.BufferGeometry();
		g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
		g.setIndex(new THREE.BufferAttribute(indices, 1));
		g.computeVertexNormals();
		return g;
	}, [heightmap, config]);

	return (
		<mesh geometry={geo}>
			<meshStandardMaterial color="#e4e4e7" side={THREE.DoubleSide} />
		</mesh>
	);
}

// BoxGeometry face group order: 0=+x, 1=-x, 2=+y, 3=-y, 4=+z (stock top), 5=-z (stock bottom)
// Face 4 (+Z) is the top surface of the stock — remove it so the pocket below is visible.
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

			<OrbitControls
				makeDefault
				enableZoom
				target={[0, 0, -stockHeight / 4]}
			/>
		</Canvas>
	);
}

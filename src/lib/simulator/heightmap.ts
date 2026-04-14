import type { GCodeMove, Heightmap, SimulatorConfig } from "./types";

/**
 * Stamps the tool footprint at a single position into the heightmap.
 *
 * @param toolZ - Z of the tool tip (lowest point) for both flat and ball-nose.
 *
 * Flat-end mill:  all cells within radius get `toolZ` (uniform disc).
 * Ball-nose mill: spherical-cap profile — a cell at XY distance d from centre
 *                 is cut to `toolZ + r - sqrt(r² - d²)`, which equals `toolZ`
 *                 at the centre and rises toward the rim.
 *
 * Complexity per stamp: O((radius/cellSize)²)
 */
function stampTool(
	data: Float32Array,
	cols: number,
	rows: number,
	cellSize: number,
	cx: number, // world X of tool centre
	cy: number, // world Y of tool centre
	toolZ: number, // Z of the tool tip
	radius: number,
	isBallNose: boolean,
): void {
	const r2 = radius * radius;
	const radiusCells = Math.ceil(radius / cellSize);

	// Grid cell that contains the tool centre (floor so origin aligns with cell 0)
	const col0 = Math.floor(cx / cellSize);
	const row0 = Math.floor(cy / cellSize);

	for (let dr = -radiusCells; dr <= radiusCells; dr++) {
		const row = row0 + dr;
		if (row < 0 || row >= rows) continue;

		for (let dc = -radiusCells; dc <= radiusCells; dc++) {
			const col = col0 + dc;
			if (col < 0 || col >= cols) continue;

			// World position of cell centre
			const wx = (col + 0.5) * cellSize;
			const wy = (row + 0.5) * cellSize;
			const dx = wx - cx;
			const dy = wy - cy;
			const d2 = dx * dx + dy * dy;

			if (d2 > r2) continue;

			let cutZ: number;
			if (isBallNose) {
				// Spherical-cap profile: surface rises toward the edge of the tool
				cutZ = toolZ + radius - Math.sqrt(r2 - d2);
			} else {
				cutZ = toolZ;
			}

			const idx = row * cols + col;
			if (cutZ < data[idx]) data[idx] = cutZ;
		}
	}
}

/**
 * Walks a linear path from (x0,y0,z0) to (x1,y1,z1) in steps of ≤ cellSize/2,
 * stamping the tool at each sample point so no cell is skipped.
 *
 * Complexity: O(pathLength / cellSize × (radius/cellSize)²)
 */
function stampPath(
	data: Float32Array,
	cols: number,
	rows: number,
	cellSize: number,
	x0: number,
	y0: number,
	z0: number,
	x1: number,
	y1: number,
	z1: number,
	radius: number,
	isBallNose: boolean,
): void {
	const dx = x1 - x0;
	const dy = y1 - y0;
	const dz = z1 - z0;
	const xyDist = Math.sqrt(dx * dx + dy * dy);

	const stepSize = cellSize * 0.5;
	const steps = Math.max(1, Math.ceil(xyDist / stepSize));

	for (let i = 0; i <= steps; i++) {
		const t = i / steps;
		stampTool(
			data,
			cols,
			rows,
			cellSize,
			x0 + dx * t,
			y0 + dy * t,
			z0 + dz * t,
			radius,
			isBallNose,
		);
	}
}

/**
 * Simulates material removal for a list of G-code moves.
 *
 * Only G1 (linear) moves are simulated — G0 (rapid) moves are assumed to be
 * positioning moves above the stock and are skipped entirely.
 *
 * Actual complexity: O(Σ pathLength_i / cellSize × (radius/cellSize)²)
 * Halving cellSize ≈ ×8 the work (×2 from path sampling, ×4 from stamp area).
 */
export function simulateHeightmap(
	moves: GCodeMove[],
	config: SimulatorConfig,
): Heightmap {
	const { stock, tool, cellSize } = config;
	const cols = Math.ceil(stock.width / cellSize);
	const rows = Math.ceil(stock.depth / cellSize);
	const radius = tool.diameter / 2;
	const isBallNose = tool.type === "ball-nose";

	// Initialise every cell to the top of the stock
	const data = new Float32Array(cols * rows).fill(stock.height);

	for (const move of moves) {
		// Rapid moves (G0) are not simulated as cutting passes
		if (move.type === "rapid") continue;

		// Skip if the move never descends into the stock
		const minZ = Math.min(move.from.z, move.to.z);
		if (minZ >= stock.height) continue;

		stampPath(
			data,
			cols,
			rows,
			cellSize,
			move.from.x,
			move.from.y,
			move.from.z,
			move.to.x,
			move.to.y,
			move.to.z,
			radius,
			isBallNose,
		);
	}

	// Compute actual Z range for colour mapping
	let minZ = stock.height;
	let maxZ = -Infinity;
	for (let i = 0; i < data.length; i++) {
		if (data[i] < minZ) minZ = data[i];
		if (data[i] > maxZ) maxZ = data[i];
	}

	return { cols, rows, cellSize, data, minZ, maxZ };
}

import type {
	GCodeMove,
	Heightmap,
	MoveLogEntry,
	SimulatorConfig,
} from "./types";

/**
 * Stamps the tool footprint at a single position into the heightmap.
 * Returns the number of cells whose Z value was lowered.
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
	cx: number,
	cy: number,
	toolZ: number,
	radius: number,
	isBallNose: boolean,
): number {
	const r2 = radius * radius;
	const radiusCells = Math.ceil(radius / cellSize);
	const col0 = Math.floor(cx / cellSize);
	const row0 = Math.floor(cy / cellSize);
	let updated = 0;

	for (let dr = -radiusCells; dr <= radiusCells; dr++) {
		const row = row0 + dr;
		if (row < 0 || row >= rows) continue;

		for (let dc = -radiusCells; dc <= radiusCells; dc++) {
			const col = col0 + dc;
			if (col < 0 || col >= cols) continue;

			const wx = (col + 0.5) * cellSize;
			const wy = (row + 0.5) * cellSize;
			const dx = wx - cx;
			const dy = wy - cy;
			const d2 = dx * dx + dy * dy;

			if (d2 > r2) continue;

			const cutZ = isBallNose ? toolZ + radius - Math.sqrt(r2 - d2) : toolZ;

			const idx = row * cols + col;
			if (cutZ < data[idx]) {
				data[idx] = cutZ;
				updated++;
			}
		}
	}

	return updated;
}

/**
 * Walks a linear path from (x0,y0,z0) to (x1,y1,z1) stamping the tool at
 * each sample point (step ≤ cellSize/2 so no cell is skipped).
 *
 * Returns { samples, cellsUpdated }.
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
): { samples: number; cellsUpdated: number } {
	const dx = x1 - x0;
	const dy = y1 - y0;
	const dz = z1 - z0;
	const xyDist = Math.sqrt(dx * dx + dy * dy);

	const steps = Math.max(1, Math.ceil(xyDist / (cellSize * 0.5)));
	let cellsUpdated = 0;

	for (let i = 0; i <= steps; i++) {
		const t = i / steps;
		cellsUpdated += stampTool(
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

	return { samples: steps + 1, cellsUpdated };
}

/**
 * Simulates material removal for a list of G-code moves.
 *
 * G0 (rapid) moves are not stamped — they are skipped for cutting/stamping
 * but may still be reported to `onMove` with `simulated: false`.
 *
 * @param onMove - optional callback fired after each move is processed,
 *                 useful for logging and progress tracking.
 *
 * Actual complexity: O(Σ pathLength_i / cellSize × (radius/cellSize)²)
 * Halving cellSize ≈ ×8 the work (×2 from path sampling, ×4 from stamp area).
 */
export function simulateHeightmap(
	moves: GCodeMove[],
	config: SimulatorConfig,
	onMove?: (entry: MoveLogEntry) => void,
): Heightmap {
	const { stock, tool, cellSize } = config;
	const cols = Math.ceil(stock.width / cellSize);
	const rows = Math.ceil(stock.depth / cellSize);
	const radius = tool.diameter / 2;
	const isBallNose = tool.type === "ball-nose";

	const data = new Float32Array(cols * rows).fill(stock.height);

	for (let i = 0; i < moves.length; i++) {
		const move = moves[i];
		const xyLength = Math.sqrt(
			(move.to.x - move.from.x) ** 2 + (move.to.y - move.from.y) ** 2,
		);
		const skipped =
			move.type === "rapid" || Math.min(move.from.z, move.to.z) >= stock.height;

		let samples = 0;
		let cellsUpdated = 0;

		if (!skipped) {
			({ samples, cellsUpdated } = stampPath(
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
			));
		}

		if (onMove) {
			onMove({
				index: i,
				type: move.type,
				from: move.from,
				to: move.to,
				simulated: !skipped,
				xyLength,
				samples,
				cellsUpdated,
			});
		}
	}

	let minZ = stock.height;
	let maxZ = -Infinity;
	for (let i = 0; i < data.length; i++) {
		if (data[i] < minZ) minZ = data[i];
		if (data[i] > maxZ) maxZ = data[i];
	}

	return { cols, rows, cellSize, data, minZ, maxZ };
}

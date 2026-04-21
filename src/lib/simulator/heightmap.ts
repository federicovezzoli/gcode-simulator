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
	// +1 cell beyond radius to cover boundary cells.
	const radiusCells = Math.ceil(radius / cellSize) + 1;
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
			const d = Math.sqrt(dx * dx + dy * dy);

			// Binary cell-center test: the cell is "cut" iff its centre lies
			// inside the tool disc. No coverage-based Z blending — that was the
			// source of rim/halo artefacts on curved paths, because adjacent
			// boundary cells ended up at different Z values based on sub-grid
			// geometry of where the continuous rim curve passed through them,
			// and the shader's finite-difference normal amplified that noise
			// into visible sawtooth shading.
			// Trade-off: the outline of cuts is now quantised to the cell grid
			// (stair-stepping at low resolution is honest; it reflects the
			// actual heightmap resolution).
			if (d > radius) continue;

			const dClamped = d;
			const fullCutZ = isBallNose
				? toolZ + radius - Math.sqrt(r2 - dClamped * dClamped)
				: toolZ;

			const idx = row * cols + col;
			if (fullCutZ < data[idx]) {
				data[idx] = fullCutZ;
				updated++;
			}
		}
	}

	return updated;
}

/**
 * Analytically carves the swept region of a linear move into the heightmap.
 *
 * The Minkowski sum of a line segment with a disc of radius r is a capsule:
 * a rectangle of width 2r perpendicular to the segment, plus two hemispherical
 * caps at the endpoints. For every cell whose centre lies inside this capsule,
 * we compute the tool's closest approach to that cell and write the depth.
 *
 * This replaces the previous discrete-stamp approach. Discrete stamps at step
 * cellSize/2 missed rim cells whose centres lay near the tool boundary without
 * an aligned stamp, producing sampling-dependent dropouts that were amplified
 * by the shader's finite-difference normal into periodic teeth on arcs.
 *
 * Z at the closest-approach point is interpolated linearly along the segment.
 *
 * Returns { samples, cellsUpdated }. `samples` is retained for logging compat —
 * no longer a true sample count; we now report 1 per segment.
 *
 * Complexity: O(capsuleBoundingCells) per segment, independent of segment length
 * sampling.
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
	const xyLen2 = dx * dx + dy * dy;
	const r2 = radius * radius;

	// Degenerate segment → single stamp at the start position.
	if (xyLen2 < 1e-12) {
		const updated = stampTool(
			data,
			cols,
			rows,
			cellSize,
			x0,
			y0,
			z0,
			radius,
			isBallNose,
		);
		return { samples: 1, cellsUpdated: updated };
	}

	const invXyLen2 = 1 / xyLen2;

	// Axis-aligned bounding box of the capsule (XY), in mm.
	const minX = Math.min(x0, x1) - radius;
	const maxX = Math.max(x0, x1) + radius;
	const minY = Math.min(y0, y1) - radius;
	const maxY = Math.max(y0, y1) + radius;

	// Expand by one cell so we cover boundary cells whose centres might still
	// test inside the capsule.
	const col0 = Math.max(0, Math.floor(minX / cellSize) - 1);
	const col1 = Math.min(cols - 1, Math.ceil(maxX / cellSize) + 1);
	const row0 = Math.max(0, Math.floor(minY / cellSize) - 1);
	const row1 = Math.min(rows - 1, Math.ceil(maxY / cellSize) + 1);

	let cellsUpdated = 0;

	for (let row = row0; row <= row1; row++) {
		const wy = (row + 0.5) * cellSize;
		for (let col = col0; col <= col1; col++) {
			const wx = (col + 0.5) * cellSize;

			// Project cell centre onto the segment and clamp to [0,1].
			let t = ((wx - x0) * dx + (wy - y0) * dy) * invXyLen2;
			if (t < 0) t = 0;
			else if (t > 1) t = 1;

			const px = x0 + dx * t;
			const py = y0 + dy * t;
			const ex = wx - px;
			const ey = wy - py;
			const d2 = ex * ex + ey * ey;

			// Binary cell-centre test: is cell centre inside the capsule?
			if (d2 > r2) continue;

			// Z at the closest-approach point, linearly interpolated along the
			// segment. Matches the original per-stamp interpolation exactly at
			// the sample points, but with no sampling dropouts between them.
			const toolZ = z0 + dz * t;

			const fullCutZ = isBallNose ? toolZ + radius - Math.sqrt(r2 - d2) : toolZ;

			const idx = row * cols + col;
			if (fullCutZ < data[idx]) {
				data[idx] = fullCutZ;
				cellsUpdated++;
			}
		}
	}

	return { samples: 1, cellsUpdated };
}

/**
 * Simulates material removal for a list of G-code moves.
 *
 * G0 (rapid) moves are not stamped — they are skipped for cutting/stamping
 * but may still be reported to `onMove` with `simulated: false`.
 *
 * @param onMove      - optional callback fired after each move is processed,
 *                      useful for logging and progress tracking.
 * @param existingData - when provided, simulation writes into this buffer
 *                       instead of allocating a fresh one; allows multiple
 *                       tool-change sections to accumulate onto the same grid.
 *
 * Actual complexity: O(Σ pathLength_i / cellSize × (radius/cellSize)²)
 * Halving cellSize ≈ ×8 the work (×2 from path sampling, ×4 from stamp area).
 */
export function simulateHeightmap(
	moves: GCodeMove[],
	config: SimulatorConfig,
	onMove?: (entry: MoveLogEntry) => void,
	existingData?: Float32Array,
): Heightmap {
	const { stock, tool, cellSize } = config;
	const cols = Math.ceil(stock.width / cellSize);
	const rows = Math.ceil(stock.depth / cellSize);
	const radius = tool.diameter / 2;
	const isBallNose = tool.type === "ball-nose";

	// Z=0 is the top surface of the stock (G-code convention).
	// Cells are initialised to 0; cuts drive them negative.
	const data = existingData ?? new Float32Array(cols * rows);

	for (let i = 0; i < moves.length; i++) {
		const move = moves[i];
		const xyLength = Math.sqrt(
			(move.to.x - move.from.x) ** 2 + (move.to.y - move.from.y) ** 2,
		);
		const skipped =
			move.type === "rapid" || Math.min(move.from.z, move.to.z) >= 0;

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

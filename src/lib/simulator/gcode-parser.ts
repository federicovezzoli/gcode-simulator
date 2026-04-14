import type { GCodeMove, Vec3 } from "./types";

interface ParseState {
	x: number;
	y: number;
	z: number;
	/** true = G90 absolute, false = G91 relative */
	absolute: boolean;
	/** 0 = rapid (G0), 1 = linear (G1) */
	motionMode: number;
}

/**
 * Parses a subset of G-code: G0, G1, G90, G91.
 * Returns moves with absolute world-space from/to positions.
 * Comments (`;` to end of line) and unknown words are ignored.
 *
 * Multiple G-codes on one line are supported, e.g. `G90 G1 X10 Y5`.
 * Modal updates (G90/G91, G0/G1) are applied before axis coordinates are
 * resolved, so `G91 X10` and `G90 G1 X0` both work correctly.
 */
export function parseGCode(source: string): GCodeMove[] {
	const moves: GCodeMove[] = [];
	const state: ParseState = {
		x: 0,
		y: 0,
		z: 0,
		absolute: true,
		motionMode: 0,
	};

	for (const rawLine of source.split("\n")) {
		// Strip comments and normalise
		const line = rawLine.split(";")[0].trim().toUpperCase();
		if (!line) continue;

		// Tokenise: each word is a letter followed by an optional signed decimal
		const tokens = line.match(/[A-Z][+-]?[0-9]*\.?[0-9]*/g) ?? [];

		// Collect all words; G can appear multiple times per line
		const gCodes: number[] = [];
		const words: Record<string, number> = {};

		for (const t of tokens) {
			const letter = t[0];
			const value = Number.parseFloat(t.slice(1));
			if (Number.isNaN(value)) continue;

			if (letter === "G") {
				gCodes.push(Math.round(value * 10) / 10);
			} else {
				words[letter] = value;
			}
		}

		// Apply all modal G-codes first so axis words are resolved with the
		// updated mode (e.g. `G91 X10` treats X as relative on the same line)
		let hasMotionCode = false;
		for (const g of gCodes) {
			if (g === 90) {
				state.absolute = true;
			} else if (g === 91) {
				state.absolute = false;
			} else if (g === 0 || g === 1) {
				state.motionMode = g;
				hasMotionCode = true;
			}
		}

		// Emit a move when axis words are present (motion code implicit or explicit)
		const hasMotion =
			words.X !== undefined || words.Y !== undefined || words.Z !== undefined;
		if (!hasMotion) continue;

		// Pure modal lines with no axis words (e.g. bare `G90`) are already handled above
		const from: Vec3 = { x: state.x, y: state.y, z: state.z };

		if (state.absolute) {
			state.x = words.X ?? state.x;
			state.y = words.Y ?? state.y;
			state.z = words.Z ?? state.z;
		} else {
			state.x += words.X ?? 0;
			state.y += words.Y ?? 0;
			state.z += words.Z ?? 0;
		}

		// Suppress unused-variable warning — hasMotionCode tracks intent
		void hasMotionCode;

		moves.push({
			type: state.motionMode === 0 ? "rapid" : "linear",
			from,
			to: { x: state.x, y: state.y, z: state.z },
		});
	}

	return moves;
}

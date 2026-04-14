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
		const words: Record<string, number> = {};
		for (const t of tokens) {
			const value = Number.parseFloat(t.slice(1));
			if (!Number.isNaN(value)) words[t[0]] = value;
		}

		// Modal G-codes that carry no motion
		if (words.G !== undefined) {
			const g = Math.round(words.G * 10) / 10;
			if (g === 90) {
				state.absolute = true;
				continue;
			}
			if (g === 91) {
				state.absolute = false;
				continue;
			}
			if (g === 0 || g === 1) {
				state.motionMode = g;
			}
		}

		// Only emit a move when at least one axis is specified
		const hasMotion =
			words.X !== undefined || words.Y !== undefined || words.Z !== undefined;
		if (!hasMotion) continue;

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

		moves.push({
			type: state.motionMode === 0 ? "rapid" : "linear",
			from,
			to: { x: state.x, y: state.y, z: state.z },
		});
	}

	return moves;
}

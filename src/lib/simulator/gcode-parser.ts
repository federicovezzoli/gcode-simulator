import type { GCodeMove, Vec3 } from "./types";

export interface GCodeSection {
	/** Human-readable label extracted from the MSG comment, or a fallback */
	label: string;
	/** Raw G-code lines belonging to this section */
	source: string;
}

interface ParseState {
	x: number;
	y: number;
	z: number;
	/** true = G90 absolute, false = G91 relative */
	absolute: boolean;
	/** 0 = rapid, 1 = linear, 2 = arc CW, 3 = arc CCW */
	motionMode: number;
}

/**
 * Approximates a G2/G3 arc as a sequence of linear moves.
 *
 * @param from      - start position
 * @param to        - end position
 * @param i         - X offset from start to arc centre
 * @param j         - Y offset from start to arc centre
 * @param clockwise - true = G2, false = G3
 * @param chordTol  - max chord error in mm (controls smoothness vs. move count)
 */
function arcToMoves(
	from: Vec3,
	to: Vec3,
	i: number,
	j: number,
	clockwise: boolean,
	// Kept well below a typical cell size so that the polyline deviation from
	// the true arc is sub-cell. At 0.02 mm the swept rim undulated by ~0.02 mm
	// between chord endpoints and midpoints, which at cellSize ≥ ~0.1 mm
	// produced a one-cell angular on/off ring (visible as periodic teeth on
	// rounded corners).
	chordTol = 0.002,
): GCodeMove[] {
	const cx = from.x + i;
	const cy = from.y + j;
	const r = Math.sqrt(i * i + j * j);

	if (r < 1e-6) return []; // degenerate arc

	const startAngle = Math.atan2(from.y - cy, from.x - cx);
	const endAngle = Math.atan2(to.y - cy, to.x - cx);

	// Sweep angle in the correct direction
	let sweep: number;
	if (clockwise) {
		sweep = startAngle - endAngle;
		if (sweep <= 0) sweep += 2 * Math.PI;
	} else {
		sweep = endAngle - startAngle;
		if (sweep <= 0) sweep += 2 * Math.PI;
	}

	// Full circle when start ≈ end but we actually have a non-zero arc
	const dxy =
		(to.x - from.x) * (to.x - from.x) + (to.y - from.y) * (to.y - from.y);
	if (dxy < 1e-6) sweep = 2 * Math.PI;

	// Number of segments: chord error = r * (1 - cos(θ/2)) ≤ chordTol
	// → θ = 2 * acos(1 - chordTol/r)
	const segAngle = 2 * Math.acos(Math.max(-1, Math.min(1, 1 - chordTol / r)));
	const nSegments = Math.max(1, Math.ceil(sweep / segAngle));

	const moves: GCodeMove[] = [];
	let prev: Vec3 = { ...from };

	for (let s = 1; s <= nSegments; s++) {
		const t = s / nSegments;
		const angle = clockwise ? startAngle - sweep * t : startAngle + sweep * t;

		const isLast = s === nSegments;
		const next: Vec3 = isLast
			? { ...to } // snap to exact endpoint to avoid float drift
			: {
					x: cx + r * Math.cos(angle),
					y: cy + r * Math.sin(angle),
					// interpolate Z linearly along the arc (helical support)
					z: from.z + (to.z - from.z) * t,
				};

		moves.push({ type: "linear", from: prev, to: next });
		prev = next;
	}

	return moves;
}

/**
 * Parses a subset of G-code: G0, G1, G2, G3, G90, G91.
 * G2/G3 arcs (IJ centre-offset format) are approximated as linear segments.
 * Returns moves with absolute world-space from/to positions.
 * Comments (`;` and parenthesised) and unknown words are ignored.
 *
 * Multiple G-codes on one line are supported, e.g. `G90 G1 X10 Y5`.
 * Modal updates are applied before axis coordinates are resolved.
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
		// Strip parenthesised comments and ; comments, then normalise
		const line = rawLine
			.replace(/\(.*?\)/g, "")
			.split(";")[0]
			.trim()
			.toUpperCase();
		if (!line) continue;

		// Tokenise: letter followed by an optional signed decimal
		const tokens = line.match(/[A-Z][+-]?[0-9]*\.?[0-9]*/g) ?? [];

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

		// Apply all modal G-codes first
		for (const g of gCodes) {
			if (g === 90) state.absolute = true;
			else if (g === 91) state.absolute = false;
			else if (g === 0 || g === 1 || g === 2 || g === 3) state.motionMode = g;
		}

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

		const to: Vec3 = { x: state.x, y: state.y, z: state.z };

		if (state.motionMode === 2 || state.motionMode === 3) {
			// Arc — IJ format (XY plane). I,J default to 0 when omitted.
			const arcMoves = arcToMoves(
				from,
				to,
				words.I ?? 0,
				words.J ?? 0,
				state.motionMode === 2,
			);
			for (const m of arcMoves) moves.push(m);
		} else {
			moves.push({
				type: state.motionMode === 0 ? "rapid" : "linear",
				from,
				to,
			});
		}
	}

	return moves;
}

/**
 * Splits G-code source into sections at tool-change boundaries.
 *
 * A tool change is signalled by an `M0` command whose line contains a
 * parenthesised MSG comment with "change tool" (case-insensitive), which is
 * the convention used by most CAM post-processors (e.g. Estlcam, Fusion 360).
 *
 * If no tool-change lines are found the whole source is returned as one section
 * labelled "Tool 1".
 *
 * Section labels are taken from the first `(No. N ...)` or `(MSG ...)` comment
 * in the section. Generic Estlcam probe/tool-change messages ("attach probe",
 * "change tool, probe") are ignored and fall back to "Tool N".
 */
export function splitGCodeSections(source: string): GCodeSection[] {
	const lines = source.split("\n");

	const breakpoints: number[] = [];
	for (let i = 0; i < lines.length; i++) {
		if (
			/\bM0\b/.test(lines[i].toUpperCase()) &&
			/MSG.*CHANGE\s*TOOL/i.test(lines[i])
		) {
			breakpoints.push(i);
		}
	}

	if (breakpoints.length === 0) {
		return [{ label: "Tool 1", source }];
	}

	// Build slice ranges: [0, bp0), [bp0, bp1), [bp1, bp2), ...
	const starts = [0, ...breakpoints];
	const ends = [...breakpoints, lines.length];

	// Labels matching these Estlcam-generated probe/change messages carry no
	// useful info — fall back to the sequential "Tool N" name.
	const GENERIC_LABEL = /attach\s*probe|change\s*tool/i;

	return starts.map((start, idx) => {
		const sectionLines = lines.slice(start, ends[idx]);

		let label = `Tool ${idx + 1}`;
		for (const l of sectionLines) {
			const m = l.match(/\(No\.\s*\d+[^)]*\)/i) ?? l.match(/\(MSG[^)]*\)/i);
			if (m) {
				const candidate = m[0].replace(/^\(|\)$/g, "").trim();
				if (!GENERIC_LABEL.test(candidate)) label = candidate;
				break;
			}
		}

		return { label, source: sectionLines.join("\n") };
	});
}

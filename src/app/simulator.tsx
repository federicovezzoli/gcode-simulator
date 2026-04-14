"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { SAMPLE_GCODE } from "@/lib/sample-gcode";
import { parseGCode, simulateHeightmap } from "@/lib/simulator";

interface Config {
	stockWidth: number;
	stockDepth: number;
	stockHeight: number;
	toolDiameter: number;
	cellSize: number;
}

const DEPTH_STOPS: [number, number, number][] = [
	[15, 23, 42],
	[30, 64, 175],
	[3, 105, 161],
	[8, 145, 178],
	[16, 185, 129],
	[234, 179, 8],
	[228, 228, 231],
];

const DEFAULTS: Config = {
	stockWidth: 100,
	stockDepth: 100,
	stockHeight: 20,
	toolDiameter: 8,
	cellSize: 1,
};

/** Returns interpolated [r, g, b] from DEPTH_STOPS at position t ∈ [0, 1]. */
function depthColor(t: number): [number, number, number] {
	const scaled = t * (DEPTH_STOPS.length - 1);
	const lo = Math.floor(scaled);
	const hi = Math.min(lo + 1, DEPTH_STOPS.length - 1);
	const frac = scaled - lo;
	const [r0, g0, b0] = DEPTH_STOPS[lo];
	const [r1, g1, b1] = DEPTH_STOPS[hi];
	return [
		Math.round(r0 + (r1 - r0) * frac),
		Math.round(g0 + (g1 - g0) * frac),
		Math.round(b0 + (b1 - b0) * frac),
	];
}

export function Simulator() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [gcode, setGcode] = useState(SAMPLE_GCODE);
	const [config, setConfig] = useState<Config>(DEFAULTS);
	const [error, setError] = useState<string | null>(null);

	const run = useCallback(() => {
		setError(null);
		try {
			// ── Parse ──────────────────────────────────────────────
			const t0 = performance.now();
			const moves = parseGCode(gcode);
			const tParse = performance.now() - t0;

			console.group("G-code parse");
			console.log(
				`${moves.length} moves  (${moves.filter((m) => m.type === "rapid").length} rapid, ${moves.filter((m) => m.type === "linear").length} linear)`,
			);
			console.table(
				moves.map((m, i) => ({
					"#": i + 1,
					type: m.type,
					x0: m.from.x,
					y0: m.from.y,
					z0: m.from.z,
					x1: m.to.x,
					y1: m.to.y,
					z1: m.to.z,
				})),
			);
			console.log(`parse time: ${tParse.toFixed(2)} ms`);
			console.groupEnd();

			// ── Simulate ────────────────────────────────────────────
			const t1 = performance.now();
			const hm = simulateHeightmap(
				moves,
				{
					stock: {
						width: config.stockWidth,
						depth: config.stockDepth,
						height: config.stockHeight,
					},
					tool: { diameter: config.toolDiameter, type: "flat" },
					cellSize: config.cellSize,
				},
				(entry) => {
					if (!entry.simulated) return;
					console.log(
						`move #${entry.index + 1}  Z ${entry.from.z.toFixed(2)}→${entry.to.z.toFixed(2)}  XY ${entry.xyLength.toFixed(1)} mm  ${entry.samples} samples  ${entry.cellsUpdated} cells↓`,
					);
				},
			);
			const tSim = performance.now() - t1;

			console.group("Simulation summary");
			console.log(
				`grid: ${hm.cols} × ${hm.rows}  (${(hm.cols * hm.rows).toLocaleString()} cells @ ${config.cellSize} mm/cell)`,
			);
			console.log(`Z range: ${hm.minZ.toFixed(3)} → ${hm.maxZ.toFixed(3)} mm`);
			console.log(`simulate time: ${tSim.toFixed(2)} ms`);
			console.groupEnd();

			// ── Render (isometric) ──────────────────────────────────
			const canvas = canvasRef.current;
			if (!canvas) return;

			const t2 = performance.now();
			const container = canvas.parentElement;
			const availW = container ? container.clientWidth - 2 : 600;

			// Tile half-widths: scale based on mm of stock (not cell count) so that
			// reducing cellSize adds detail rather than just shrinking each tile.
			const pxPerMm = Math.max(
				1,
				Math.floor(availW / (config.stockWidth + config.stockDepth)),
			);
			const tileHalfW = Math.max(1, Math.round(pxPerMm * hm.cellSize));
			const tileHalfH = Math.max(1, Math.round(tileHalfW / 2));
			const pixPerMm = tileHalfW;

			const maxColPx = config.stockHeight * pixPerMm;
			canvas.width = (hm.cols + hm.rows) * tileHalfW;
			canvas.height =
				(hm.cols + hm.rows) * tileHalfH + maxColPx + tileHalfH * 2;

			// Origin = top-left cell's top diamond vertex, after leaving room for columns
			const originX = hm.rows * tileHalfW;
			const originY = maxColPx + tileHalfH;

			const ctx = canvas.getContext("2d");
			if (!ctx) return;
			ctx.clearRect(0, 0, canvas.width, canvas.height);

			const zRange = hm.maxZ - hm.minZ;

			// Back-to-front (painter's algorithm): iterate diagonals sum = col + row
			for (let sum = 0; sum < hm.rows + hm.cols - 1; sum++) {
				const rowMin = Math.max(0, sum - hm.cols + 1);
				const rowMax = Math.min(sum, hm.rows - 1);

				for (let row = rowMin; row <= rowMax; row++) {
					const col = sum - row;

					const z = hm.data[row * hm.cols + col];
					const t = zRange > 0 ? (z - hm.minZ) / zRange : 1;
					const [r, g, b] = depthColor(t);

					// Screen centre of the floor diamond for this cell
					const cx = originX + (col - row) * tileHalfW;
					const cy = originY + (col + row) * tileHalfH;

					// Column height: remaining material from stock bottom to surface
					const h = Math.max(0, z + config.stockHeight) * pixPerMm;

					// Diamond corners at floor level
					const Tx = cx;
					const Ty = cy - tileHalfH;
					const Rx = cx + tileHalfW;
					const Ry = cy;
					const Bx = cx;
					const By = cy + tileHalfH;
					const Lx = cx - tileHalfW;
					const Ly = cy;

					if (h > 0) {
						// Left side face  (L–B edge, facing lower-left)
						ctx.fillStyle = `rgb(${Math.round(r * 0.55)},${Math.round(g * 0.55)},${Math.round(b * 0.55)})`;
						ctx.beginPath();
						ctx.moveTo(Lx, Ly - h);
						ctx.lineTo(Bx, By - h);
						ctx.lineTo(Bx, By);
						ctx.lineTo(Lx, Ly);
						ctx.closePath();
						ctx.fill();

						// Right side face  (B–R edge, facing lower-right)
						ctx.fillStyle = `rgb(${Math.round(r * 0.75)},${Math.round(g * 0.75)},${Math.round(b * 0.75)})`;
						ctx.beginPath();
						ctx.moveTo(Bx, By - h);
						ctx.lineTo(Rx, Ry - h);
						ctx.lineTo(Rx, Ry);
						ctx.lineTo(Bx, By);
						ctx.closePath();
						ctx.fill();
					}

					// Top face (always last so it sits on top of side faces)
					ctx.fillStyle = `rgb(${r},${g},${b})`;
					ctx.beginPath();
					ctx.moveTo(Tx, Ty - h);
					ctx.lineTo(Rx, Ry - h);
					ctx.lineTo(Bx, By - h);
					ctx.lineTo(Lx, Ly - h);
					ctx.closePath();
					ctx.fill();
				}
			}

			const tRender = performance.now() - t2;
			console.log(
				`render: ${tRender.toFixed(2)} ms  |  total: ${(tParse + tSim + tRender).toFixed(2)} ms`,
			);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Unknown error");
		}
	}, [gcode, config]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: intentionally runs only on mount
	useEffect(() => {
		run();
	}, []);

	function setConfigKey<K extends keyof Config>(key: K, value: Config[K]) {
		setConfig((prev) => ({ ...prev, [key]: value }));
	}

	return (
		<div className="flex h-[calc(100vh-65px)] flex-col gap-0 lg:flex-row">
			<aside className="flex w-full flex-col gap-5 overflow-y-auto border-b border-zinc-800 p-5 lg:w-72 lg:border-b-0 lg:border-r">
				<section>
					<p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
						Stock (mm)
					</p>
					<div className="space-y-4">
						<SliderField
							label={`Width (X): ${config.stockWidth}`}
							value={config.stockWidth}
							min={10}
							max={300}
							step={5}
							onChange={(v) => setConfigKey("stockWidth", v)}
						/>
						<SliderField
							label={`Depth (Y): ${config.stockDepth}`}
							value={config.stockDepth}
							min={10}
							max={300}
							step={5}
							onChange={(v) => setConfigKey("stockDepth", v)}
						/>
						<SliderField
							label={`Height (Z): ${config.stockHeight}`}
							value={config.stockHeight}
							min={1}
							max={100}
							step={1}
							onChange={(v) => setConfigKey("stockHeight", v)}
						/>
					</div>
				</section>

				<Separator className="bg-zinc-800" />

				<section>
					<p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
						Tool
					</p>
					<SliderField
						label={`Diameter: ${config.toolDiameter} mm`}
						value={config.toolDiameter}
						min={0.5}
						max={25}
						step={0.5}
						onChange={(v) => setConfigKey("toolDiameter", v)}
					/>
				</section>

				<Separator className="bg-zinc-800" />

				<section>
					<p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
						Resolution
					</p>
					<SliderField
						label={`Cell size: ${config.cellSize} mm`}
						value={config.cellSize}
						min={0.25}
						max={5}
						step={0.25}
						onChange={(v) => setConfigKey("cellSize", v)}
					/>
					<p className="mt-2 text-xs text-zinc-600">
						Grid: {Math.ceil(config.stockWidth / config.cellSize)} ×{" "}
						{Math.ceil(config.stockDepth / config.cellSize)} cells
					</p>
				</section>

				<Separator className="bg-zinc-800" />

				<section className="flex flex-1 flex-col">
					<div className="mb-2 flex items-center justify-between">
						<p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
							G-code
						</p>
						<button
							type="button"
							onClick={() => setGcode(SAMPLE_GCODE)}
							className="text-xs text-zinc-500 hover:text-zinc-300"
						>
							reset
						</button>
					</div>
					<Textarea
						value={gcode}
						onChange={(e) => setGcode(e.target.value)}
						className="min-h-40 flex-1 resize-none bg-zinc-900 font-mono text-xs text-zinc-300"
						spellCheck={false}
					/>
				</section>

				<Button onClick={run} className="w-full">
					Run simulation
				</Button>

				{error && (
					<p className="rounded border border-red-800 bg-red-950 px-3 py-2 text-xs text-red-400">
						{error}
					</p>
				)}
			</aside>

			<div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
				<div className="overflow-auto rounded-lg border border-zinc-800 bg-zinc-900 p-1">
					<canvas ref={canvasRef} className="block" />
				</div>
				<div className="flex items-center gap-2 text-xs text-zinc-500">
					<span>Deep cut</span>
					<div
						className="h-3 w-32 rounded"
						style={{
							background: `linear-gradient(to right, ${DEPTH_STOPS.map(([r, g, b]) => `rgb(${r},${g},${b})`).join(", ")})`,
						}}
					/>
					<span>Untouched</span>
				</div>
			</div>
		</div>
	);
}

function SliderField({
	label,
	value,
	min,
	max,
	step,
	onChange,
}: {
	label: string;
	value: number;
	min: number;
	max: number;
	step: number;
	onChange: (v: number) => void;
}) {
	return (
		<div className="space-y-1.5">
			<Label className="text-xs text-zinc-400">{label}</Label>
			<Slider
				min={min}
				max={max}
				step={step}
				value={[value]}
				onValueChange={(vals) => onChange(Array.isArray(vals) ? vals[0] : vals)}
				className="w-full"
			/>
		</div>
	);
}

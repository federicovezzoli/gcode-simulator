"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { SAMPLE_GCODE } from "@/lib/sample-gcode";
import { type Heightmap, parseGCode, simulateHeightmap } from "@/lib/simulator";

interface Config {
	stockWidth: number;
	stockDepth: number;
	stockHeight: number;
	toolDiameter: number;
	cellSize: number;
}

interface Stats {
	moves: number;
	gridCols: number;
	gridRows: number;
	cells: number;
	minZ: number;
	maxZ: number;
	elapsedMs: number;
}

const DEFAULTS: Config = {
	stockWidth: 100,
	stockDepth: 100,
	stockHeight: 20,
	toolDiameter: 8,
	cellSize: 1,
};

/** Maps a normalised value [0,1] to a colour string via a blue→cyan→green→yellow gradient. */
function depthColor(t: number): string {
	// t=0 → deepest cut (dark blue), t=1 → untouched stock (light zinc)
	const stops: [number, number, number][] = [
		[15, 23, 42], // deep cut — slate-900
		[30, 64, 175], // mid cut — blue-700
		[3, 105, 161], // blue-800
		[8, 145, 178], // cyan-600
		[16, 185, 129], // emerald-500
		[234, 179, 8], // yellow-500
		[228, 228, 231], // untouched — zinc-200
	];

	const scaled = t * (stops.length - 1);
	const lo = Math.floor(scaled);
	const hi = Math.min(lo + 1, stops.length - 1);
	const frac = scaled - lo;

	const [r0, g0, b0] = stops[lo];
	const [r1, g1, b1] = stops[hi];
	const r = Math.round(r0 + (r1 - r0) * frac);
	const g = Math.round(g0 + (g1 - g0) * frac);
	const b = Math.round(b0 + (b1 - b0) * frac);
	return `rgb(${r},${g},${b})`;
}

function renderHeightmap(
	canvas: HTMLCanvasElement,
	hm: Heightmap,
	config: Config,
): void {
	const pixelsPerCell = Math.max(
		1,
		Math.floor(
			Math.min(canvas.width, canvas.height) / Math.max(hm.cols, hm.rows),
		),
	);

	canvas.width = hm.cols * pixelsPerCell;
	canvas.height = hm.rows * pixelsPerCell;

	const ctx = canvas.getContext("2d");
	if (!ctx) return;

	const zRange = config.stockHeight - hm.minZ;

	for (let row = 0; row < hm.rows; row++) {
		for (let col = 0; col < hm.cols; col++) {
			const z = hm.data[row * hm.cols + col];
			// t=1 → untouched stock, t=0 → deepest cut
			const t = zRange > 0 ? (z - hm.minZ) / zRange : 1;
			ctx.fillStyle = depthColor(t);
			ctx.fillRect(
				col * pixelsPerCell,
				row * pixelsPerCell,
				pixelsPerCell,
				pixelsPerCell,
			);
		}
	}
}

export function Simulator() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [gcode, setGcode] = useState(SAMPLE_GCODE);
	const [config, setConfig] = useState<Config>(DEFAULTS);
	const [stats, setStats] = useState<Stats | null>(null);
	const [error, setError] = useState<string | null>(null);

	const run = useCallback(() => {
		setError(null);
		try {
			const t0 = performance.now();
			const moves = parseGCode(gcode);
			const hm = simulateHeightmap(moves, {
				stock: {
					width: config.stockWidth,
					depth: config.stockDepth,
					height: config.stockHeight,
				},
				tool: { diameter: config.toolDiameter, type: "flat" },
				cellSize: config.cellSize,
			});
			const elapsed = performance.now() - t0;

			if (canvasRef.current) renderHeightmap(canvasRef.current, hm, config);

			setStats({
				moves: moves.filter((m) => m.type === "linear").length,
				gridCols: hm.cols,
				gridRows: hm.rows,
				cells: hm.cols * hm.rows,
				minZ: hm.minZ,
				maxZ: hm.maxZ,
				elapsedMs: elapsed,
			});
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
			{/* ── Controls panel ── */}
			<aside className="flex w-full flex-col gap-5 overflow-y-auto border-b border-zinc-800 p-5 lg:w-72 lg:border-b-0 lg:border-r">
				{/* Stock */}
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

				{/* Tool */}
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

				{/* Resolution */}
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

				{/* G-code */}
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

			{/* ── Canvas + stats ── */}
			<div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
				{stats && (
					<div className="flex flex-wrap justify-center gap-2">
						<Badge variant="outline" className="border-zinc-700 text-zinc-400">
							{stats.moves} linear moves
						</Badge>
						<Badge variant="outline" className="border-zinc-700 text-zinc-400">
							{stats.gridCols} × {stats.gridRows} grid
						</Badge>
						<Badge variant="outline" className="border-zinc-700 text-zinc-400">
							{stats.cells.toLocaleString()} cells
						</Badge>
						<Badge variant="outline" className="border-zinc-700 text-zinc-400">
							Z {stats.minZ.toFixed(2)} → {stats.maxZ.toFixed(2)} mm
						</Badge>
						<Badge variant="outline" className="border-zinc-700 text-zinc-400">
							{stats.elapsedMs.toFixed(1)} ms
						</Badge>
					</div>
				)}

				<div className="overflow-auto rounded-lg border border-zinc-800 bg-zinc-900 p-1">
					<canvas
						ref={canvasRef}
						className="block"
						style={{ imageRendering: "pixelated" }}
					/>
				</div>

				{/* Colour legend */}
				<div className="flex items-center gap-2 text-xs text-zinc-500">
					<span>Deep cut</span>
					<div
						className="h-3 w-32 rounded"
						style={{
							background:
								"linear-gradient(to right, rgb(15,23,42), rgb(30,64,175), rgb(8,145,178), rgb(16,185,129), rgb(234,179,8), rgb(228,228,231))",
						}}
					/>
					<span>Untouched</span>
				</div>
			</div>
		</div>
	);
}

/* ── Shared slider field ── */
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

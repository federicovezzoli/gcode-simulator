"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { SAMPLE_GCODE } from "@/lib/sample-gcode";
import { parseGCode, simulateHeightmap } from "@/lib/simulator";
import type { Heightmap } from "@/lib/simulator/types";
import type { SceneConfig } from "./scene";

const Scene = dynamic(() => import("./scene").then((m) => m.Scene), {
	ssr: false,
	loading: () => (
		<div className="flex h-full items-center justify-center text-sm text-zinc-500">
			Loading 3D renderer…
		</div>
	),
});

interface Config {
	stockWidth: number;
	stockDepth: number;
	stockHeight: number;
	toolDiameter: number;
	cellSize: number;
}

const DEFAULTS: Config = {
	stockWidth: 100,
	stockDepth: 100,
	stockHeight: 20,
	toolDiameter: 8,
	cellSize: 0.25,
};

interface Result {
	heightmap: Heightmap;
	config: SceneConfig;
}

export function Simulator3D() {
	const [gcode, setGcode] = useState(SAMPLE_GCODE);
	const [config, setConfig] = useState<Config>(DEFAULTS);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<Result | null>(null);

	const run = useCallback(() => {
		setError(null);
		try {
			const moves = parseGCode(gcode);
			const heightmap = simulateHeightmap(moves, {
				stock: {
					width: config.stockWidth,
					depth: config.stockDepth,
					height: config.stockHeight,
				},
				tool: { diameter: config.toolDiameter, type: "flat" },
				cellSize: config.cellSize,
			});
			setResult({
				heightmap,
				config: {
					stockWidth: config.stockWidth,
					stockDepth: config.stockDepth,
					stockHeight: config.stockHeight,
				},
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
			<aside className="flex w-full flex-col border-b border-zinc-800 lg:w-72 lg:border-b-0 lg:border-r">
				<div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
					<section>
						<p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
							Stock (mm)
						</p>
						<div className="space-y-3">
							<NumberField
								label="Width (X)"
								value={config.stockWidth}
								onChange={(v) => setConfigKey("stockWidth", v)}
							/>
							<NumberField
								label="Depth (Y)"
								value={config.stockDepth}
								onChange={(v) => setConfigKey("stockDepth", v)}
							/>
							<NumberField
								label="Height (Z)"
								value={config.stockHeight}
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

					<section>
						<div className="mb-2 flex items-center justify-between">
							<p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
								G-code
							</p>
							<div className="flex items-center gap-3">
								<label className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300">
									open file
									<input
										type="file"
										accept=".nc,.gcode,.ngc,.tap,.txt"
										className="sr-only"
										onChange={(e) => {
											const file = e.target.files?.[0];
											if (!file) return;
											file.text().then(setGcode);
											e.target.value = "";
										}}
									/>
								</label>
								<button
									type="button"
									onClick={() => setGcode(SAMPLE_GCODE)}
									className="text-xs text-zinc-500 hover:text-zinc-300"
								>
									reset
								</button>
							</div>
						</div>
						<Textarea
							value={gcode}
							onChange={(e) => setGcode(e.target.value)}
							className="max-h-64 min-h-40 resize-none bg-zinc-900 font-mono text-xs text-zinc-300"
							spellCheck={false}
						/>
					</section>
				</div>

				<div className="flex flex-col gap-3 border-t border-zinc-800 p-5">
					<Button onClick={run} className="w-full">
						Run simulation
					</Button>
					{error && (
						<p className="rounded border border-red-800 bg-red-950 px-3 py-2 text-xs text-red-400">
							{error}
						</p>
					)}
				</div>
			</aside>

			<div className="relative flex-1">
				<Scene
					heightmap={result?.heightmap ?? null}
					config={
						result?.config ?? {
							stockWidth: config.stockWidth,
							stockDepth: config.stockDepth,
							stockHeight: config.stockHeight,
						}
					}
				/>
			</div>
		</div>
	);
}

function NumberField({
	label,
	value,
	onChange,
}: {
	label: string;
	value: number;
	onChange: (v: number) => void;
}) {
	return (
		<div className="flex items-center justify-between gap-3">
			<Label className="text-xs text-zinc-400">{label}</Label>
			<input
				type="number"
				value={value}
				onChange={(e) => {
					const v = Number(e.target.value);
					if (Number.isFinite(v) && v > 0) onChange(v);
				}}
				className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-right text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500"
			/>
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

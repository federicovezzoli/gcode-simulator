"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { SAMPLE_GCODE } from "@/lib/sample-gcode";
import type { GCodeSection, ToolConfig } from "@/lib/simulator";
import {
	parseGCode,
	simulateHeightmap,
	splitGCodeSections,
} from "@/lib/simulator";
import type { Heightmap } from "@/lib/simulator/types";
import { NumberField } from "./number-field";
import type { SceneConfig } from "./scene";
import { SliderField } from "./slider-field";
import { ToolSection } from "./tool-section";

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
	cellSize: number;
}

const DEFAULTS: Config = {
	stockWidth: 100,
	stockDepth: 100,
	stockHeight: 20,
	cellSize: 0.25,
};

const DEFAULT_TOOL: ToolConfig = { diameter: 6, type: "flat" };

interface SectionTool {
	id: string;
	section: GCodeSection;
	tool: ToolConfig;
}

interface Result {
	heightmap: Heightmap;
	config: SceneConfig;
}

export function Simulator3D() {
	const [gcode, setGcode] = useState(SAMPLE_GCODE);
	const [config, setConfig] = useState<Config>(DEFAULTS);
	const [sectionTools, setSectionTools] = useState<SectionTool[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<Result | null>(null);

	// Re-detect sections whenever G-code changes, preserving existing tool configs.
	useEffect(() => {
		const sections = splitGCodeSections(gcode);
		setSectionTools((prev) =>
			sections.map((section, i) => ({
				id: prev[i]?.id ?? crypto.randomUUID(),
				section,
				tool: prev[i]?.tool ?? DEFAULT_TOOL,
			})),
		);
	}, [gcode]);

	const run = useCallback(() => {
		setError(null);
		try {
			const cols = Math.ceil(config.stockWidth / config.cellSize);
			const rows = Math.ceil(config.stockDepth / config.cellSize);
			const sharedData = new Float32Array(cols * rows);

			let lastHeightmap: Heightmap | null = null;

			for (const { section, tool } of sectionTools) {
				const moves = parseGCode(section.source);
				lastHeightmap = simulateHeightmap(
					moves,
					{
						stock: {
							width: config.stockWidth,
							depth: config.stockDepth,
							height: config.stockHeight,
						},
						tool,
						cellSize: config.cellSize,
					},
					undefined,
					sharedData,
				);
			}

			if (!lastHeightmap) return;

			setResult({
				heightmap: lastHeightmap,
				config: {
					stockWidth: config.stockWidth,
					stockDepth: config.stockDepth,
					stockHeight: config.stockHeight,
				},
			});
		} catch (e) {
			setError(e instanceof Error ? e.message : "Unknown error");
		}
	}, [config, sectionTools]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: intentionally runs only on mount
	useEffect(() => {
		run();
	}, []);

	function setConfigKey<K extends keyof Config>(key: K, value: Config[K]) {
		setConfig((prev) => ({ ...prev, [key]: value }));
	}

	function setSectionTool(i: number, tool: ToolConfig) {
		setSectionTools((prev) =>
			prev.map((st, idx) => (idx === i ? { ...st, tool } : st)),
		);
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
							Tools
						</p>
						<div className="space-y-4">
							{sectionTools.map((st, i) => (
								<ToolSection
									key={st.id}
									label={st.section.label}
									tool={st.tool}
									onChange={(tool) => setSectionTool(i, tool)}
								/>
							))}
						</div>
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

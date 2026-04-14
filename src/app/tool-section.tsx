"use client";

import { Label } from "@/components/ui/label";
import type { ToolConfig } from "@/lib/simulator";
import { SliderField } from "./slider-field";

export function ToolSection({
	label,
	tool,
	onChange,
}: {
	label: string;
	tool: ToolConfig;
	onChange: (tool: ToolConfig) => void;
}) {
	return (
		<div className="rounded border border-zinc-800 p-3 space-y-3">
			<p className="text-xs text-zinc-400 font-medium truncate" title={label}>
				{label}
			</p>
			<SliderField
				label={`Diameter: ${tool.diameter} mm`}
				value={tool.diameter}
				min={0.5}
				max={35}
				step={0.5}
				onChange={(v) => onChange({ ...tool, diameter: v })}
			/>
			<div className="flex items-center justify-between gap-3">
				<Label className="text-xs text-zinc-400">Type</Label>
				<select
					value={tool.type}
					onChange={(e) =>
						onChange({ ...tool, type: e.target.value as ToolConfig["type"] })
					}
					className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500"
				>
					<option value="flat">Flat</option>
					<option value="ball-nose">Ball-nose</option>
				</select>
			</div>
		</div>
	);
}

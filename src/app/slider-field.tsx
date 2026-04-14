"use client";

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

export function SliderField({
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

"use client";

import { Label } from "@/components/ui/label";

export function NumberField({
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

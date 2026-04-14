import { Simulator } from "./simulator";

export default function Home() {
	return (
		<main className="min-h-screen bg-zinc-950 text-zinc-100">
			<div className="border-b border-zinc-800 px-6 py-4">
				<h1 className="font-mono text-sm font-medium text-zinc-100">
					G-code Simulator
				</h1>
				<p className="mt-1 text-xs text-zinc-500">
					Heightmap rendered as a flat colour grid — Canvas 2D, no libraries.
				</p>
			</div>
			<Simulator />
		</main>
	);
}

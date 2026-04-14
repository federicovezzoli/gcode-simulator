import { Simulator3D } from "./simulator3d";

export default function Home() {
	return (
		<main className="min-h-screen bg-zinc-950 text-zinc-100">
			<div className="border-b border-zinc-800 px-6 py-4">
				<h1 className="font-mono text-sm font-medium text-zinc-100">
					G-code Simulator
				</h1>
				<p className="mt-1 text-xs text-zinc-500">
					3D heightmap — React Three Fiber, vertex colours, orbit controls.
				</p>
			</div>
			<Simulator3D />
		</main>
	);
}

export type MotionType = "rapid" | "linear";
export type ToolType = "flat" | "ball-nose";

export interface Vec3 {
	x: number;
	y: number;
	z: number;
}

export interface GCodeMove {
	type: MotionType;
	from: Vec3;
	to: Vec3;
}

export interface StockConfig {
	/** mm */
	width: number; // X
	/** mm */
	depth: number; // Y
	/** mm */
	height: number; // Z
}

export interface ToolConfig {
	/** mm */
	diameter: number;
	type: ToolType;
}

export interface SimulatorConfig {
	stock: StockConfig;
	tool: ToolConfig;
	/** mm per grid cell — smaller = higher resolution, O(1/cellSize²) cost */
	cellSize: number;
}

export interface Heightmap {
	cols: number; // stock.width  / cellSize
	rows: number; // stock.depth  / cellSize
	cellSize: number;
	/** Row-major: data[row * cols + col] = minimum surface Z reached at that (x, y) cell */
	data: Float32Array;
	minZ: number;
	maxZ: number;
}

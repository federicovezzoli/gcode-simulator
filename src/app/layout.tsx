import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "G-Code Simulator",
	description:
		"Browser-based CNC G-code simulator. Visualises material removal via heightmap simulation — Canvas 2D, isometric, Three.js and GLSL levels.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="en"
			className={`${geistSans.variable} ${geistMono.variable} h-screen overflow-hidden antialiased`}
			suppressHydrationWarning
		>
			<head>
				<script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("theme");if(t==="dark"||(t===null&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(_){}` }} />
			</head>
			<body className="min-h-full flex flex-col">
				<header className="border-b border-zinc-800 px-6 py-4">
					<div className="w-full flex justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
						<div>
							<h1 className="font-mono text-sm font-medium text-zinc-100">
								G-code Simulator
							</h1>
							<p className="mt-1 text-xs text-zinc-500">
								GLSL shader rendering — DataTexture, finite-difference normals,
								orbit controls.
							</p>
						</div>

						<div className="flex justify-end items-center gap-x-4 text-right">
							<span>
								Made by{" "}
								<a
									href="https://federicovezzoli.com"
									target="_blank"
									rel="noopener noreferrer"
									className="underline underline-offset-2 hover:text-foreground transition-colors"
								>
									Federico Vezzoli
								</a>
							</span>
							<span>·</span>
							<span>v{process.env.NEXT_PUBLIC_APP_VERSION}</span>

							<a
								href="https://github.com/federicovezzoli/gcode-simulator"
								target="_blank"
								rel="noopener noreferrer"
								className="text-zinc-500 hover:text-foreground transition-colors"
								aria-label="GitHub repository"
							>
								<svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true">
									<path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
								</svg>
							</a>
							<ThemeToggle />
						</div>
					</div>
				</header>
				{children}
			</body>
		</html>
	);
}

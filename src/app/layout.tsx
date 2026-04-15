import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
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
		>
			<Script id="theme-init" strategy="beforeInteractive">{`
				try {
					var t = localStorage.getItem("theme");
					if (t === "dark" || (t === null && matchMedia("(prefers-color-scheme: dark)").matches))
						document.documentElement.classList.add("dark");
				} catch (_) {}
			`}</Script>
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

							<ThemeToggle />
						</div>
					</div>
				</header>
				{children}
			</body>
		</html>
	);
}

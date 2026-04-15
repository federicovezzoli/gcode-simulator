"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
	const [dark, setDark] = useState(false);

	useEffect(() => {
		setDark(document.documentElement.classList.contains("dark"));
	}, []);

	function toggle() {
		const next = !dark;
		setDark(next);
		document.documentElement.classList.toggle("dark", next);
		localStorage.setItem("theme", next ? "dark" : "light");
	}

	return (
		<button
			type="button"
			onClick={toggle}
			aria-label="Toggle theme"
			className="ml-auto text-zinc-400 hover:text-zinc-100 transition-colors"
		>
			{dark ? <Sun size={14} /> : <Moon size={14} />}
		</button>
	);
}

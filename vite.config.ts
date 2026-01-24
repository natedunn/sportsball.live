import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import viteReact from "@vitejs/plugin-react";

export default defineConfig({
	server: {
		port: 3000,
	},
	ssr: {
		noExternal: ["@convex-dev/better-auth"],
	},
	plugins: [
		tailwindcss(),
		tsConfigPaths({
			projects: ["./tsconfig.json"],
		}),
		cloudflare({ viteEnvironment: { name: "ssr" } }),
		tanstackStart({
			srcDirectory: "src",
		}),
		viteReact(),
	],
});

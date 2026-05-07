import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import viteReact from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");

	return {
		server: {
			host: env.HOST || "0.0.0.0",
			port: Number.parseInt(env.PORT || "5173", 10),
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
	};
});

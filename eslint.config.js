import js from "@eslint/js";
import convexPlugin from "@convex-dev/eslint-plugin";
import pluginQuery from "@tanstack/eslint-plugin-query";
import pluginRouter from "@tanstack/eslint-plugin-router";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
	{
		ignores: [
			"dist/",
			".output/",
			".tanstack/",
			".wrangler/",
			".convex/",
			"public/",
			"src/convex/_generated/",
			"src/routeTree.gen.ts",
			"workers/*/.wrangler/",
		],
	},
	js.configs.recommended,
	tseslint.configs.recommended,
	pluginQuery.configs["flat/recommended"],
	pluginRouter.configs["flat/recommended"],
	convexPlugin.configs.recommended,
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node },
		},
		plugins: { "react-hooks": reactHooks },
		rules: {
			// The classic hook rules. The plugin's recommended set adds React
			// Compiler rules, and this app doesn't use the compiler.
			"react-hooks/rules-of-hooks": "error",
			"react-hooks/exhaustive-deps": "warn",

			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
					ignoreRestSiblings: true,
				},
			],
			// `interface Props extends Base {}` is the shadcn/ui component pattern
			"@typescript-eslint/no-empty-object-type": ["error", { allowInterfaces: "with-single-extends" }],
			"@typescript-eslint/no-explicit-any": "warn",
		},
	},
	{
		files: ["src/convex/**/*.ts"],
		plugins: { "@convex-dev": convexPlugin },
		rules: {
			// ctx.db.get("table", id) style; the codebase uses ctx.db.get(id)
			"@convex-dev/explicit-table-ids": "off",
			// Prefix indexes cost storage but dropping them is a schema change
			"@convex-dev/no-duplicate-indexes": "warn",
		},
	},
);

import path from "path";
import * as esbuild from "esbuild";
import { dedent } from "ts-dedent";
import { defineConfig } from "vitest/config";
import type { BuildContext } from "esbuild";
import type { Plugin } from "vite";

const TEMPLATES_DIR = path.join(__dirname, "templates");

const workersContexts = new Map<string, BuildContext>();

function embedWorkersPlugin(): Plugin {
	return {
		name: "embed-workers",

		async resolveId(id) {
			if (id.startsWith("worker:")) {
				const name = id.substring("worker:".length);

				return `\0worker:${path.join(TEMPLATES_DIR, name)}.ts`;
			}
		},
		async load(id) {
			if (!id.startsWith(`\0worker:`)) {
				return null;
			}
			id = id.substring(`\0worker:`.length);
			const ctx =
				workersContexts.get(id) ??
				(await esbuild.context({
					platform: "node", // Marks `node:*` imports as external
					format: "esm",
					target: "esnext",
					bundle: true,
					sourcemap: true,
					sourcesContent: false,
					metafile: true,
					entryPoints: [id],
				}));
			const result = await ctx.rebuild();
			workersContexts.set(id, ctx);
			const watchFiles = Object.keys(result?.metafile?.inputs ?? {});
			const scriptPath = Object.keys(result?.metafile?.outputs ?? {}).find(
				(filepath) => filepath.endsWith(".js")
			);

			for (const file of watchFiles) {
				this.addWatchFile(file);
			}

			return dedent/*javascript*/ `
			import path from "node:path";
			const scriptPath = path.resolve(__dirname, "..", "${scriptPath}");
			export default scriptPath;`;
		},
	};
}

export default defineConfig({
	plugins: [embedWorkersPlugin()],
	test: {
		testTimeout: 5_000,
		hookTimeout: 5_000,
		teardownTimeout: 5_000,
		include: ["src/__vitests__/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
	},
});

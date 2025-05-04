await Bun.build({
	entrypoints: ["./src/index.ts", "./src/main.ts"],
	outdir: "./build",
	target: "node",
});

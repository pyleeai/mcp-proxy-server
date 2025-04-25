await Bun.build({
	entrypoints: ["./src/main.ts"],
	outdir: "./build",
	target: "node",
});

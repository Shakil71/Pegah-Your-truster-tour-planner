// Development runner: TypeScript in watch mode + Node restarting on changes.
// (tsc, not esbuild/tsx, because NestJS needs emitted decorator metadata.)
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const tsc = spawn(
  process.execPath,
  [
    "../../node_modules/typescript/bin/tsc",
    "-p",
    "tsconfig.build.json",
    "--watch",
    "--preserveWatchOutput",
  ],
  { stdio: "inherit" },
);

const nodeArgs = ["--watch-path=dist", "--enable-source-maps"];
if (existsSync(".env")) nodeArgs.push("--env-file=.env");
nodeArgs.push("dist/main.js");

let app;
const start = () => {
  if (!existsSync("dist/main.js")) return setTimeout(start, 500);
  app = spawn(process.execPath, nodeArgs, { stdio: "inherit" });
};
start();

const stop = () => {
  tsc.kill();
  app?.kill();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

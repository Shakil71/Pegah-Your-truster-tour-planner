import { Logger } from "@nestjs/common";
import { createApp } from "./app.factory";
import { loadConfig } from "./config/config";

async function main(): Promise<void> {
  const config = loadConfig();
  const app = await createApp({ config });
  await app.listen({ port: config.PORT, host: config.HOST });
  new Logger("Bootstrap").log(
    `Pegah API listening on http://${config.HOST}:${config.PORT}/api/v1 (${config.NODE_ENV})`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

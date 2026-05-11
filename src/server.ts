import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { seedDevelopmentAdmin } from "./modules/users/users.seed.js";
import { prisma } from "./shared/prisma/client.js";

const app = await buildApp();

await seedDevelopmentAdmin(prisma, env.NODE_ENV);

const close = async () => {
  await app.close();
  await prisma.$disconnect();
};

process.on("SIGINT", () => {
  close().finally(() => process.exit(0));
});

process.on("SIGTERM", () => {
  close().finally(() => process.exit(0));
});

await app.listen({
  host: env.HOST,
  port: env.PORT
});

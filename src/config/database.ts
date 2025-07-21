import { PrismaClient } from "@prisma/client";
import { ENV } from "./env";

// Global is used here to maintain a single instance across hot reloads in development
declare global {
  var __prisma: PrismaClient | undefined;
}

// Create Prisma client instance
export const prisma =
  globalThis.__prisma ||
  new PrismaClient({
    log:
      ENV.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    errorFormat: "pretty",
  });

// In development, save the instance to global to prevent creating multiple instances
if (ENV.NODE_ENV === "development") {
  globalThis.__prisma = prisma;
}

// Graceful shutdown
process.on("beforeExit", async () => {
  await prisma.$disconnect();
});

export default prisma;

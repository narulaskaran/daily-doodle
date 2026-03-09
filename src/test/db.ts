import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";

const TEST_DB_PATH = path.join(__dirname, "../../prisma/test.sqlite");
const TEST_DB_URL = `file:${TEST_DB_PATH}`;

export function setupTestDb(): PrismaClient {
  // Remove old test db if it exists
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }

  // Use prisma db push to create the schema from prisma/schema.prisma
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: "pipe",
  });

  const prisma = new PrismaClient({
    datasources: {
      db: { url: TEST_DB_URL },
    },
    log: [],
  });

  return prisma;
}

export async function cleanupTestDb(prisma: PrismaClient) {
  await prisma.$disconnect();
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
}

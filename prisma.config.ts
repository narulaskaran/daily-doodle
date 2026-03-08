import path from "node:path";
import { defineConfig } from "prisma/config";

const url = process.env.DATABASE_URL ?? "file:./prisma/db.sqlite";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: { url },
  migrate: {
    adapter: async () => {
      const { PrismaBetterSqlite3 } = await import(
        "@prisma/adapter-better-sqlite3"
      );
      return new PrismaBetterSqlite3({ url });
    },
  },
});

import { IS_VERCEL_ENV } from "lib/const";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (!IS_VERCEL_ENV) {
      // run DB migration - make optional for dev
      try {
        const runMigrate = await import("./lib/db/pg/migrate.pg").then(
          (m) => m.runMigrate,
        );
        await runMigrate();
      } catch (e) {
        console.warn("⚠️ Database migration failed - continuing in dev mode:", e.message);
        // Don't exit process in development
      }
      
      try {
        const initMCPManager = await import("./lib/ai/mcp/mcp-manager").then(
          (m) => m.initMCPManager,
        );
        await initMCPManager();
      } catch (e) {
        console.warn("⚠️ MCP Manager initialization failed - continuing in dev mode:", e.message);
        // Don't exit process in development
      }
    }
  }
}

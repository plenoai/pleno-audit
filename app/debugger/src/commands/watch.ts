import { Command } from "commander";
import { getExtensionClient } from "../extension-client.js";

export const watchCommand = new Command("watch").description(
  "Watch for real-time updates"
);

watchCommand
  .command("storage")
  .description("Watch for storage changes in real-time")
  .action(async () => {
    console.log("Watching storage changes (Ctrl+C to stop)...\n");

    try {
      const client = await getExtensionClient();

      // Subscribe to storage changes
      await client.send("DEBUG_WATCH_STORAGE");

      // Handle incoming changes
      client.on("storage-change", (change: unknown) => {
        const time = new Date().toISOString();
        console.log(`[${time}] ${JSON.stringify(change)}`);
      });

      // Keep process alive
      process.on("SIGINT", () => {
        console.log("\nStopping watch...");
        client.disconnect();
        process.exit(0);
      });

      // Wait forever
      await new Promise(() => {});
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      process.exit(1);
    }
  });

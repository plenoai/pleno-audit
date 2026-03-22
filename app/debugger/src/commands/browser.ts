import { Command } from "commander";
import { getExtensionClient } from "../extension-client.js";

export const browserCommand = new Command("browser")
  .description("Browser control commands");

browserCommand
  .command("open <url>")
  .description("Open a URL in a new browser tab")
  .action(async (url: string) => {
    try {
      const client = await getExtensionClient();
      const response = await client.send("DEBUG_TAB_OPEN", { url });

      if (response.success) {
        const data = response.data as { url?: string; tabId?: number } | undefined;
        console.log(`Opened: ${data?.url}`);
        console.log(`Tab ID: ${data?.tabId}`);
      } else {
        console.error(`Failed: ${response.error}`);
        process.exit(1);
      }

      client.disconnect();
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      process.exit(1);
    }
  });

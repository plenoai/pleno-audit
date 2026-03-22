import { Command } from "commander";
import { getExtensionClient } from "../extension-client.js";

export const statusCommand = new Command("status")
  .description("Check extension connection status")
  .action(async () => {
    try {
      const client = await getExtensionClient();
      const response = await client.send("DEBUG_PING");

      if (response.success) {
        const data = response.data as { extensionId?: string; version?: string; devMode?: boolean; context?: string } | undefined;
        console.log("Status: Connected");
        console.log(`Extension ID: ${data?.extensionId || "unknown"}`);
        console.log(`Version: ${data?.version || "unknown"}`);
        console.log(`Dev mode: ${data?.devMode ? "yes" : "no"}`);
        if (data?.context) {
          console.log(`Context: ${data.context}`);
        }
      } else {
        console.log("Status: Error");
        console.log(`Error: ${response.error}`);
      }

      client.disconnect();
    } catch (error) {
      console.log("Status: Disconnected");
      console.log(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      process.exit(1);
    }
  });

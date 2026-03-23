import { Command } from "commander";
import { getExtensionClient } from "../extension-client.js";

export const messageCommand = new Command("message")
  .description("Send a raw message to the extension")
  .argument("<type>", "Message type (e.g., GET_SERVICES, GET_AI_PROMPTS)")
  .argument("[data]", "JSON data to send with the message")
  .option("-p, --pretty", "Pretty print JSON output")
  .action(async (type: string, data: string | undefined, options) => {
    try {
      let parsedData: unknown;
      if (data) {
        try {
          parsedData = JSON.parse(data);
        } catch {
          console.error("Error: data must be valid JSON");
          process.exit(1);
        }
      }

      const client = await getExtensionClient();
      const response = await client.send(type, parsedData);

      if (response.success) {
        const output = options.pretty
          ? JSON.stringify(response.data, null, 2)
          : JSON.stringify(response.data);
        console.log(output);
      } else {
        console.error(`Error: ${response.error}`);
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

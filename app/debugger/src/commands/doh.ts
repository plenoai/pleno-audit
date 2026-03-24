import { Command } from "commander";
import { getExtensionClient } from "../extension-client.js";

interface DoHRequest {
  id: string;
  timestamp: number;
  url: string;
  domain: string;
  method: string;
  detectionMethod: string;
  initiator?: string;
}

export const dohCommand = new Command("doh").description(
  "DoH (DNS over HTTPS) monitoring operations"
);

dohCommand
  .command("list")
  .description("List detected DoH requests")
  .option("-n, --limit <number>", "Number of requests to show", "20")
  .option("-p, --pretty", "Pretty print JSON output")
  .action(async (options) => {
    try {
      const client = await getExtensionClient();
      const response = await client.send("DEBUG_DOH_REQUESTS", {
        limit: parseInt(options.limit, 10),
      });

      if (response.success) {
        const result = response.data as { requests: DoHRequest[]; total: number };

        if (result.requests.length === 0) {
          console.log("(no DoH requests detected)");
        } else if (options.pretty) {
          console.log(JSON.stringify(result.requests, null, 2));
        } else {
          console.log(`Total: ${result.total}`);
          console.log("---");
          for (const req of result.requests) {
            const time = new Date(req.timestamp).toISOString();
            console.log(`[${time}] ${req.domain} (${req.detectionMethod})`);
          }
        }
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

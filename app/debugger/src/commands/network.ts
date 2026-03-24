import { Command } from "commander";
import { getExtensionClient } from "../extension-client.js";

export const networkCommand = new Command("network").description(
  "Network Monitor operations"
);

networkCommand
  .command("requests")
  .description("Get recent network requests")
  .option("-l, --limit <number>", "Limit number of requests", "20")
  .option("-t, --type <type>", "Filter by initiator type (extension/page/browser)")
  .option("-p, --pretty", "Pretty print JSON output")
  .action(async (options) => {
    let client;
    try {
      client = await getExtensionClient();

      const limit = parseInt(options.limit, 10) || 20;
      const response = await client.send("DEBUG_NETWORK_REQUESTS_GET", {
        limit,
        initiatorType: options.type,
      });

      if (response.success) {
        const responseData = response.data as {
          requests: Array<{
            timestamp: number;
            url: string;
            method: string;
            initiatorType: string;
            domain: string;
          }>;
          total: number;
        };
        const requests = responseData.requests;

        if (options.pretty) {
          console.log(JSON.stringify(responseData, null, 2));
        } else {
          console.log(`Network Requests (${requests.length}/${responseData.total}):`);
          for (const req of requests) {
            const time = new Date(req.timestamp).toLocaleTimeString();
            const urlShort = req.url.length > 60 ? req.url.substring(0, 60) + "..." : req.url;
            console.log(`  [${time}] [${req.initiatorType}] ${req.method} ${urlShort}`);
          }
        }
      } else {
        console.error(`Error: ${response.error}`);
        process.exit(1);
      }
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      process.exit(1);
    } finally {
      client?.disconnect();
    }
  });

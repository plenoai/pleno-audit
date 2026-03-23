import { Command } from "commander";
import { getExtensionClient } from "../extension-client.js";
import type { NetworkMonitorConfig } from "@libztbs/extension-runtime";

export const networkCommand = new Command("network").description(
  "Network Monitor operations"
);

networkCommand
  .command("config")
  .description("Get or set Network Monitor config")
  .option("-e, --enabled <boolean>", "Enable/disable monitoring (true/false)")
  .option("-a, --all-requests <boolean>", "Capture all requests (true/false)")
  .option("-x, --exclude-own <boolean>", "Exclude own extension (true/false)")
  .option("-p, --pretty", "Pretty print JSON output")
  .action(async (options) => {
    let client;
    try {
      client = await getExtensionClient();

      const updates: Partial<NetworkMonitorConfig> = {};
      if (options.enabled !== undefined) {
        updates.enabled = options.enabled === "true";
      }
      if (options.allRequests !== undefined) {
        updates.captureAllRequests = options.allRequests === "true";
      }
      if (options.excludeOwn !== undefined) {
        updates.excludeOwnExtension = options.excludeOwn === "true";
      }

      if (Object.keys(updates).length > 0) {
        const response = await client.send("DEBUG_NETWORK_CONFIG_SET", updates);
        if (response.success) {
          console.log("Network Monitor config updated:");
          const config = response.data as NetworkMonitorConfig;
          console.log(`  Enabled: ${config.enabled}`);
          console.log(`  Capture all requests: ${config.captureAllRequests}`);
          console.log(`  Exclude own extension: ${config.excludeOwnExtension}`);
        } else {
          console.error(`Error: ${response.error}`);
          process.exit(1);
        }
      } else {
        const response = await client.send("DEBUG_NETWORK_CONFIG_GET");
        if (response.success) {
          const config = response.data as NetworkMonitorConfig;
          if (options.pretty) {
            console.log(JSON.stringify(config, null, 2));
          } else {
            console.log(`Enabled: ${config.enabled}`);
            console.log(`Capture all requests: ${config.captureAllRequests}`);
            console.log(`Exclude own extension: ${config.excludeOwnExtension}`);
            console.log(`Excluded domains: ${config.excludedDomains.length}`);
            console.log(`Excluded extensions: ${config.excludedExtensions.length}`);
          }
        } else {
          console.error(`Error: ${response.error}`);
          process.exit(1);
        }
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

import { readFileSync, writeFileSync } from "node:fs";
import { Command } from "commander";
import { getExtensionClient } from "../extension-client.js";

export const dataCommand = new Command("data").description(
  "Export/Import security data"
);

dataCommand
  .command("export")
  .description("Export all security data to JSON file")
  .option("-o, --output <file>", "Output file path")
  .option("-p, --pretty", "Pretty print JSON output")
  .action(async (options) => {
    try {
      const client = await getExtensionClient();
      const response = await client.send("DEBUG_EXPORT_DATA");

      if (response.success) {
        const json = options.pretty
          ? JSON.stringify(response.data, null, 2)
          : JSON.stringify(response.data);

        if (options.output) {
          writeFileSync(options.output, json, "utf-8");
          console.log(`Exported to ${options.output}`);
        } else {
          console.log(json);
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

dataCommand
  .command("import <file>")
  .description("Import security data from JSON file")
  .action(async (file: string) => {
    try {
      const content = readFileSync(file, "utf-8");
      const parsed = JSON.parse(content);

      if (!Array.isArray(parsed.services)) {
        console.error("Error: Invalid file format - services array not found");
        process.exit(1);
      }

      const client = await getExtensionClient();
      const response = await client.send("DEBUG_IMPORT_DATA", {
        services: parsed.services,
        serviceConnections: parsed.serviceConnections,
        extensionConnections: parsed.extensionConnections,
      });

      if (response.success) {
        const counts = (response.data as { counts: { services: number; serviceConnections: number; extensionConnections: number } }).counts;
        console.log(`Imported: ${counts.services} services, ${counts.serviceConnections} service connections, ${counts.extensionConnections} extension connections`);
      } else {
        console.error(`Error: ${response.error}`);
        process.exit(1);
      }

      client.disconnect();
    } catch (error) {
      if (error instanceof SyntaxError) {
        console.error("Error: Invalid JSON file");
      } else {
        console.error(
          `Error: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
      process.exit(1);
    }
  });

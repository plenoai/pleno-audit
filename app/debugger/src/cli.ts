#!/usr/bin/env node
import { Command } from "commander";
import { statusCommand } from "./commands/status.js";
import { snapshotCommand } from "./commands/snapshot.js";
import { storageCommand } from "./commands/storage.js";

import { servicesCommand } from "./commands/services.js";
import { messageCommand } from "./commands/message.js";
import { watchCommand } from "./commands/watch.js";
import { logsCommand } from "./commands/logs.js";
import { installCommand as serverCommand } from "./commands/install.js";
import { browserCommand } from "./commands/browser.js";
import { dohCommand } from "./commands/doh.js";
import { networkCommand } from "./commands/network.js";
import { devCommand } from "./commands/dev.js";

const program = new Command();

program
  .name("pleno-debug")
  .description("Debug CLI for Pleno Audit Chrome Extension")
  .version("0.1.0");

// Server command (for standalone server mode)
program.addCommand(serverCommand);

// Basic commands
program.addCommand(statusCommand);
program.addCommand(snapshotCommand);

// Data commands
program.addCommand(storageCommand);

program.addCommand(servicesCommand);

// Extension operations
program.addCommand(messageCommand);
program.addCommand(watchCommand);
program.addCommand(logsCommand);

// Browser control
program.addCommand(browserCommand);

// DoH monitoring
program.addCommand(dohCommand);

// Network Monitor
program.addCommand(networkCommand);

// Development environment
program.addCommand(devCommand);

program.parse();

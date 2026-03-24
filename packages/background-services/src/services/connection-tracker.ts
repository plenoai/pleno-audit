import type { Logger } from "@libztbs/extension-runtime";
import { extractDomainFromUrl } from "../background-services/utils.js";

export interface ConnectionRecord {
  initiator: string | null;
  initiatorType: string;
  domain: string;
  extensionId?: string;
  extensionName?: string;
}

export interface ConnectionTrackerDeps {
  logger: Logger;
  /** Read/write service and extension connections from storage */
  getConnections: () => Promise<{
    serviceConnections: Record<string, string[]>;
    extensionConnections: Record<string, string[]>;
  }>;
  setConnections: (data: {
    serviceConnections: Record<string, string[]>;
    extensionConnections: Record<string, string[]>;
  }) => Promise<void>;
}

export interface ConnectionTracker {
  /** Track a network request's service connection */
  track(record: ConnectionRecord): void;
  /** Flush pending connections to storage */
  flush(): void;
  /** Get service connections from storage */
  getServiceConnections(): Promise<Record<string, string[]>>;
  /** Get extension connections from storage */
  getExtensionConnections(): Promise<Record<string, string[]>>;
}

export function createConnectionTracker(deps: ConnectionTrackerDeps): ConnectionTracker {
  let pendingConnections = new Map<string, Set<string>>();
  let pendingExtensionConnections = new Map<string, Set<string>>();
  let writeChain: Promise<void> = Promise.resolve();

  async function flushBatch(
    serviceBatch: Map<string, Set<string>>,
    extensionBatch: Map<string, Set<string>>,
  ): Promise<void> {
    const stored = await deps.getConnections();
    const connections = stored.serviceConnections;
    const extConnections = stored.extensionConnections;

    for (const [source, destSet] of serviceBatch) {
      const existing = new Set(connections[source] || []);
      for (const dest of destSet) {
        existing.add(dest);
      }
      connections[source] = [...existing];
    }

    for (const [extKey, destSet] of extensionBatch) {
      const existing = new Set(extConnections[extKey] || []);
      for (const dest of destSet) {
        existing.add(dest);
      }
      extConnections[extKey] = [...existing];
    }

    await deps.setConnections({ serviceConnections: connections, extensionConnections: extConnections });
  }

  function track(record: ConnectionRecord): void {
    if (!record.initiator) return;

    if (record.initiatorType === "page") {
      const sourceDomain = extractDomainFromUrl(record.initiator);
      if (!sourceDomain || sourceDomain === "unknown" || sourceDomain === record.domain) return;

      let destSet = pendingConnections.get(sourceDomain);
      if (!destSet) {
        destSet = new Set();
        pendingConnections.set(sourceDomain, destSet);
      }
      destSet.add(record.domain);
    } else if (record.initiatorType === "extension" && record.extensionId) {
      let destSet = pendingExtensionConnections.get(record.extensionId);
      if (!destSet) {
        destSet = new Set();
        pendingExtensionConnections.set(record.extensionId, destSet);
      }
      destSet.add(record.domain);
    }
  }

  function flush(): void {
    if (pendingConnections.size === 0 && pendingExtensionConnections.size === 0) return;

    const serviceBatch = pendingConnections;
    const extensionBatch = pendingExtensionConnections;
    pendingConnections = new Map();
    pendingExtensionConnections = new Map();

    writeChain = writeChain
      .then(() => flushBatch(serviceBatch, extensionBatch))
      .catch((error) => {
        deps.logger.error("Failed to flush connections:", error);
      });
  }

  async function getServiceConnections(): Promise<Record<string, string[]>> {
    const stored = await deps.getConnections();
    return stored.serviceConnections;
  }

  async function getExtensionConnections(): Promise<Record<string, string[]>> {
    const stored = await deps.getConnections();
    return stored.extensionConnections;
  }

  return { track, flush, getServiceConnections, getExtensionConnections };
}

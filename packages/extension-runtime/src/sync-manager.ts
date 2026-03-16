import { ApiClient, getApiClient } from "./api-client.js";
import { createLogger } from "./logger.js";

const logger = createLogger("sync-manager");

const SYNC_ALARM_NAME = "syncReports";
const LAST_SYNC_TIME_KEY = "lastSyncTime";
const SYNC_ENABLED_KEY = "syncEnabled";

export class SyncManager {
  private localClient: ApiClient | null = null;
  private remoteClient: ApiClient | null = null;
  private enabled = false;
  private remoteEndpoint: string | null = null;
  private alarmListenerRegistered = false;

  private async initClients(endpoint: string): Promise<void> {
    this.localClient = await getApiClient();
    this.remoteClient = new ApiClient({ mode: "remote", remoteEndpoint: endpoint });
  }

  async init(): Promise<void> {
    const config = await chrome.storage.local.get([SYNC_ENABLED_KEY, "remoteEndpoint"]) as Record<string, unknown>;
    this.enabled = (config[SYNC_ENABLED_KEY] as boolean) || false;
    this.remoteEndpoint = (config.remoteEndpoint as string) || null;

    if (this.enabled && this.remoteEndpoint) {
      await this.initClients(this.remoteEndpoint);
    }
  }

  async startSync(intervalMinutes: number = 1): Promise<void> {
    if (!this.enabled) return;

    chrome.alarms.create(SYNC_ALARM_NAME, { periodInMinutes: intervalMinutes });

    if (!this.alarmListenerRegistered) {
      chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === SYNC_ALARM_NAME) {
          this.sync().catch((err) => logger.debug("Sync failed:", err));
        }
      });
      this.alarmListenerRegistered = true;
    }
  }

  async stopSync(): Promise<void> {
    await chrome.alarms.clear(SYNC_ALARM_NAME);
  }

  async sync(): Promise<{ sent: number; received: number }> {
    if (!this.enabled || !this.localClient || !this.remoteClient || !this.remoteEndpoint) {
      return { sent: 0, received: 0 };
    }

    const syncData = await chrome.storage.local.get(LAST_SYNC_TIME_KEY) as Record<string, unknown>;
    const since = (syncData[LAST_SYNC_TIME_KEY] as string) || "1970-01-01T00:00:00.000Z";

    const { reports: localNew } = await this.localClient.sync(since);

    const { serverReports, serverTime } = await this.remoteClient.pushAndPull(
      localNew,
      since
    );

    if (serverReports.length > 0) {
      await this.localClient.postReports(serverReports);
    }

    await chrome.storage.local.set({ [LAST_SYNC_TIME_KEY]: serverTime });
    return { sent: localNew.length, received: serverReports.length };
  }

  async setEnabled(enabled: boolean, endpoint?: string): Promise<void> {
    this.enabled = enabled;
    this.remoteEndpoint = endpoint || null;

    await chrome.storage.local.set({
      [SYNC_ENABLED_KEY]: enabled,
      remoteEndpoint: endpoint || null,
    });

    if (enabled && endpoint) {
      await this.initClients(endpoint);
      await this.startSync();
    } else {
      await this.stopSync();
      this.localClient = null;
      this.remoteClient = null;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getRemoteEndpoint(): string | null {
    return this.remoteEndpoint;
  }
}

let syncManagerInstance: SyncManager | null = null;

export async function getSyncManager(): Promise<SyncManager> {
  if (!syncManagerInstance) {
    syncManagerInstance = new SyncManager();
    await syncManagerInstance.init();
  }
  return syncManagerInstance;
}

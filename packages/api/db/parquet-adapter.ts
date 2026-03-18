import { ParquetStore } from "@pleno-audit/parquet-storage";
import type {
  CSPReport,
  CSPViolation,
  NetworkRequest,
} from "@pleno-audit/csp";
import type {
  DatabaseAdapter,
  DatabaseStats,
  PaginatedResult,
  QueryOptions,
} from "./interface";
import { createLogger } from "@pleno-audit/extension-runtime";

const logger = createLogger("parquet-adapter");

export class ParquetAdapter implements DatabaseAdapter {
  private store: ParquetStore;

  constructor() {
    this.store = new ParquetStore();
  }

  async init(): Promise<void> {
    await this.store.init();
    logger.info("ParquetAdapter initialized");
  }

  async insertReports(reports: CSPReport[]): Promise<void> {
    await this.store.insertReports(reports);
  }

  async getAllReports(): Promise<CSPReport[]> {
    const result = await this.store.getReports({
      limit: -1,
    });
    return result.data;
  }

  async getAllViolations(): Promise<CSPViolation[]> {
    const result = await this.store.getViolations({
      limit: -1,
    });
    return result.data;
  }

  async getAllNetworkRequests(): Promise<NetworkRequest[]> {
    const result = await this.store.getNetworkRequests({
      limit: -1,
    });
    return result.data;
  }

  async getReportsSince(timestamp: string): Promise<CSPReport[]> {
    const result = await this.store.getReports({
      since: timestamp,
      limit: -1,
    });
    return result.data;
  }

  async getReports(options?: QueryOptions): Promise<PaginatedResult<CSPReport>> {
    return await this.store.getReports(options);
  }

  async getViolations(
    options?: QueryOptions
  ): Promise<PaginatedResult<CSPViolation>> {
    return await this.store.getViolations(options);
  }

  async getNetworkRequests(
    options?: QueryOptions
  ): Promise<PaginatedResult<NetworkRequest>> {
    return await this.store.getNetworkRequests(options);
  }

  async getStats(): Promise<DatabaseStats> {
    return await this.store.getStats();
  }

  async deleteOldReports(beforeTimestamp: string): Promise<number> {
    const date = new Date(beforeTimestamp).toISOString().split("T")[0];
    return await this.store.deleteOldReports(date);
  }

  async clearAll(): Promise<void> {
    await this.store.clearAll();
    logger.info("All data cleared");
  }

  async close(): Promise<void> {
    await this.store.close();
    logger.debug("ParquetAdapter closed");
  }
}

import type { CSPViolation, NetworkRequest, CSPReport } from '@pleno-audit/csp'
import type { DatabaseStats, QueryOptions, PaginatedResult } from '@pleno-audit/parquet-storage'

export type { DatabaseStats, QueryOptions, PaginatedResult }

export interface DatabaseAdapter {
  init(): Promise<void>
  insertReports(reports: CSPReport[]): Promise<void>
  getAllReports(): Promise<CSPReport[]>
  getAllViolations(): Promise<CSPViolation[]>
  getAllNetworkRequests(): Promise<NetworkRequest[]>
  getStats(): Promise<DatabaseStats>
  clearAll(): Promise<void>
  close(): Promise<void>
  getReportsSince(timestamp: string): Promise<CSPReport[]>
  getReports(options?: QueryOptions): Promise<PaginatedResult<CSPReport>>
  getViolations(options?: QueryOptions): Promise<PaginatedResult<CSPViolation>>
  getNetworkRequests(options?: QueryOptions): Promise<PaginatedResult<NetworkRequest>>
  deleteOldReports(beforeTimestamp: string): Promise<number>
}

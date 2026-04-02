/**
 * @fileoverview Data Export Types
 *
 * Types for exporting security data in various formats.
 */

/**
 * Export format types
 */
export type ExportFormat = "json" | "csv" | "markdown" | "html";

/**
 * Export data type
 */
export type ExportDataType =
  | "services"
  | "violations"
  | "alerts"
  | "compliance"
  | "permissions"
  | "graph"
  | "full_report";

/**
 * Export options
 */
export interface ExportOptions {
  format: ExportFormat;
  dataType: ExportDataType;
  dateRange?: {
    start: number;
    end: number;
  };
  filters?: Record<string, unknown>;
  includeMetadata?: boolean;
  prettyPrint?: boolean;
}

/**
 * Export result
 */
export interface ExportResult {
  success: boolean;
  format: ExportFormat;
  dataType: ExportDataType;
  content: string;
  filename: string;
  recordCount: number;
  exportedAt: number;
  error?: string;
}

/**
 * CSV column definition
 */
export interface CSVColumn<T> {
  header: string;
  accessor: (item: T) => string | number | boolean | null | undefined;
}

/**
 * Full security report
 */
export interface SecurityReport {
  metadata: ReportMetadata;
  summary: ReportSummary;
  services: ServiceExport[];
  violations: ViolationExport[];
  alerts: AlertExport[];
  permissions: PermissionExport[];
  compliance: ComplianceExport;
}

/**
 * Report metadata
 */
export interface ReportMetadata {
  generatedAt: number;
  reportPeriod: {
    start: number;
    end: number;
  };
  version: string;
  exportFormat: ExportFormat;
}

/**
 * Report summary
 */
export interface ReportSummary {
  totalServices: number;
  totalViolations: number;
  totalAlerts: number;
  securityScore: number;
  riskDistribution: Record<string, number>;
  topRisks: string[];
}

/**
 * Service export structure
 */
export interface ServiceExport {
  domain: string;
  firstSeen: number;
  lastSeen: number;
  hasLogin: boolean;
  hasPrivacyPolicy: boolean;
  hasTermsOfService: boolean;
  isNRD: boolean;
  nrdConfidence?: string;
  isTyposquat: boolean;
  typosquatConfidence?: string;
  cookieCount: number;
  riskScore: number;
}

/**
 * Violation export structure
 */
export interface ViolationExport {
  id: string;
  type: string;
  domain: string;
  severity: string;
  description: string;
  timestamp: number;
  acknowledged: boolean;
}

/**
 * Alert export structure
 */
export interface AlertExport {
  id: string;
  title: string;
  severity: string;
  category: string;
  description: string;
  domain?: string;
  timestamp: number;
  status: string;
}

/**
 * Permission export structure
 */
export interface PermissionExport {
  extensionId: string;
  extensionName: string;
  riskScore: number;
  riskLevel: string;
  permissions: string[];
  findingsCount: number;
  analyzedAt: number;
}

/**
 * Compliance export structure
 */
export interface ComplianceExport {
  framework: string;
  overallScore: number;
  controlsPassed: number;
  controlsFailed: number;
  controls: ComplianceControlExport[];
}

/**
 * Compliance control export
 */
export interface ComplianceControlExport {
  id: string;
  name: string;
  status: string;
  evidence: string[];
}

// ============================================================================
// Audit Log Export Types
// ============================================================================

/**
 * AI prompt export structure (privacy-safe)
 */
export interface AIPromptExport {
  id: string;
  timestamp: number;
  pageUrl: string;
  provider: string;
  model?: string;
  contentSize: number;
  hasSensitiveData: boolean;
  sensitiveDataTypes: string[];
  riskLevel: string;
  riskScore?: number;
}

/**
 * Detected service export structure (extended)
 */
export interface DetectedServiceExport {
  domain: string;
  detectedAt: number;
  hasLoginPage: boolean;
  privacyPolicyUrl: string | null;
  termsOfServiceUrl: string | null;
  cookieCount: number;
  isNRD: boolean;
  nrdConfidence?: string;
  nrdDomainAge?: number | null;
  isTyposquat: boolean;
  typosquatConfidence?: string;
  typosquatScore?: number;
  hasAIActivity: boolean;
  aiProviders?: string[];
  aiHasSensitiveData?: boolean;
  aiRiskLevel?: string;
}

/**
 * Audit log export options
 */
export interface AuditLogExportOptions {
  format: "json" | "csv";
  dateRange?: {
    start: number;
    end: number;
  };
  dataTypes?: string[];
  includeDetails?: boolean;
}

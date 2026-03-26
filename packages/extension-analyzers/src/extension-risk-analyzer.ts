/**
 * @fileoverview Extension Risk Analyzer
 *
 * ブラウザ拡張機能のリスク分析を行う。
 * - パーミッション分析
 * - ネットワーク活動パターン分析
 * - リスクスコア算出
 */

import type { ExtensionRequestRecord } from "@libztbs/types";
import {
  scoreToExtensionRiskLevel,
  type ExtensionRiskLevel,
} from "@libztbs/types";

// ============================================================================
// Risk Categories
// ============================================================================

/**
 * 危険なパーミッションのカテゴリ
 */
export type PermissionRiskCategory =
  | "data_access" // データアクセス系
  | "code_execution" // コード実行系
  | "network" // ネットワーク系
  | "privacy" // プライバシー系
  | "system"; // システム系

/**
 * パーミッションリスク情報
 */
export interface PermissionRisk {
  permission: string;
  category: PermissionRiskCategory;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
}

/**
 * 危険なパーミッションのマッピング
 */
export const DANGEROUS_PERMISSIONS: PermissionRisk[] = [
  // Critical - Data Access
  {
    permission: "<all_urls>",
    category: "data_access",
    severity: "critical",
    description: "すべてのウェブサイトのデータにアクセス可能",
  },
  {
    permission: "http://*/*",
    category: "data_access",
    severity: "critical",
    description: "すべてのHTTPサイトのデータにアクセス可能",
  },
  {
    permission: "https://*/*",
    category: "data_access",
    severity: "critical",
    description: "すべてのHTTPSサイトのデータにアクセス可能",
  },
  {
    permission: "cookies",
    category: "data_access",
    severity: "high",
    description: "Cookie情報の読み取り・変更が可能",
  },
  {
    permission: "history",
    category: "privacy",
    severity: "high",
    description: "閲覧履歴へのアクセスが可能",
  },
  {
    permission: "bookmarks",
    category: "privacy",
    severity: "medium",
    description: "ブックマークへのアクセスが可能",
  },

  // Critical - Code Execution
  {
    permission: "debugger",
    category: "code_execution",
    severity: "critical",
    description: "デバッガーAPIによるコード注入が可能",
  },
  {
    permission: "scripting",
    category: "code_execution",
    severity: "high",
    description: "ページへのスクリプト注入が可能",
  },
  {
    permission: "declarativeNetRequest",
    category: "network",
    severity: "medium",
    description: "ネットワークリクエストの変更が可能",
  },
  {
    permission: "webRequest",
    category: "network",
    severity: "high",
    description: "すべてのネットワークリクエストの監視・変更が可能",
  },
  {
    permission: "webRequestBlocking",
    category: "network",
    severity: "critical",
    description: "ネットワークリクエストのブロック・変更が可能",
  },

  // Privacy
  {
    permission: "geolocation",
    category: "privacy",
    severity: "high",
    description: "位置情報へのアクセスが可能",
  },
  {
    permission: "clipboardRead",
    category: "privacy",
    severity: "high",
    description: "クリップボードの内容を読み取り可能",
  },
  {
    permission: "clipboardWrite",
    category: "privacy",
    severity: "medium",
    description: "クリップボードへの書き込みが可能",
  },

  // System
  {
    permission: "nativeMessaging",
    category: "system",
    severity: "critical",
    description: "ネイティブアプリケーションとの通信が可能",
  },
  {
    permission: "management",
    category: "system",
    severity: "high",
    description: "他の拡張機能の管理が可能",
  },
  {
    permission: "downloads",
    category: "system",
    severity: "medium",
    description: "ファイルのダウンロード管理が可能",
  },
  {
    permission: "proxy",
    category: "network",
    severity: "critical",
    description: "プロキシ設定の変更が可能",
  },
  {
    permission: "privacy",
    category: "privacy",
    severity: "high",
    description: "プライバシー設定の変更が可能",
  },

  // Additional data access
  {
    permission: "storage",
    category: "data_access",
    severity: "low",
    description: "拡張機能ストレージへのアクセス",
  },
  {
    permission: "tabs",
    category: "privacy",
    severity: "medium",
    description: "タブ情報へのアクセスが可能",
  },
  {
    permission: "activeTab",
    category: "data_access",
    severity: "low",
    description: "アクティブタブへの一時的なアクセス",
  },
];

// ============================================================================
// Extension Risk Analysis
// ============================================================================

/**
 * 拡張機能リスク分析結果
 */
export interface ExtensionRiskAnalysis {
  extensionId: string;
  extensionName: string;
  riskScore: number;
  riskLevel: ExtensionRiskLevel;
  permissionRisks: PermissionRisk[];
  networkRisks: NetworkRisk[];
  flags: RiskFlag[];
  analyzedAt: number;
}

/**
 * ネットワークリスク
 */
export interface NetworkRisk {
  type: "high_frequency" | "sensitive_domain" | "data_exfiltration" | "suspicious_pattern";
  description: string;
  severity: "high" | "medium" | "low";
  details?: Record<string, unknown>;
}

/**
 * リスクフラグ
 */
export interface RiskFlag {
  flag: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
}

/**
 * 機密ドメインパターン
 */
const SENSITIVE_DOMAIN_PATTERNS = [
  /^api\./i, // API endpoints
  /auth|login|signin|oauth/i, // Authentication
  /bank|payment|paypal|stripe/i, // Financial
  /password|credential|secret|key/i, // Credentials
  /admin|dashboard|console/i, // Admin interfaces
];

/**
 * パーミッションからリスクを分析
 */
export function analyzePermissions(permissions: string[]): PermissionRisk[] {
  const risks: PermissionRisk[] = [];

  for (const permission of permissions) {
    // 完全一致
    const exactMatch = DANGEROUS_PERMISSIONS.find(
      (p) => p.permission === permission
    );
    if (exactMatch) {
      risks.push(exactMatch);
      continue;
    }

    // ホストパーミッションのパターンマッチ
    if (permission.includes("://")) {
      // 広範なホストパーミッションをチェック
      if (permission.includes("*")) {
        const wildcardRisk: PermissionRisk = {
          permission,
          category: "data_access",
          severity: permission.includes("/*") ? "high" : "medium",
          description: `${permission} へのアクセスが可能`,
        };
        risks.push(wildcardRisk);
      }
    }
  }

  return risks;
}

/**
 * ネットワーク活動からリスクを分析
 */
export function analyzeNetworkActivity(
  requests: ExtensionRequestRecord[],
  timeWindowMs: number = 60000 // デフォルト1分
): NetworkRisk[] {
  const risks: NetworkRisk[] = [];

  if (requests.length === 0) return risks;

  // リクエスト頻度分析
  const now = Date.now();
  const recentRequests = requests.filter(
    (r) => now - r.timestamp < timeWindowMs
  );
  const requestsPerMinute = (recentRequests.length / timeWindowMs) * 60000;

  if (requestsPerMinute > 100) {
    risks.push({
      type: "high_frequency",
      description: `異常に高いリクエスト頻度: ${Math.round(requestsPerMinute)}回/分`,
      severity: "high",
      details: { requestsPerMinute },
    });
  } else if (requestsPerMinute > 30) {
    risks.push({
      type: "high_frequency",
      description: `高いリクエスト頻度: ${Math.round(requestsPerMinute)}回/分`,
      severity: "medium",
      details: { requestsPerMinute },
    });
  }

  // 機密ドメインへのアクセス
  const sensitiveAccesses = requests.filter((r) =>
    SENSITIVE_DOMAIN_PATTERNS.some((pattern) => pattern.test(r.domain))
  );

  if (sensitiveAccesses.length > 0) {
    const uniqueDomains = [...new Set(sensitiveAccesses.map((r) => r.domain))];
    risks.push({
      type: "sensitive_domain",
      description: `機密ドメインへのアクセス: ${uniqueDomains.slice(0, 5).join(", ")}${uniqueDomains.length > 5 ? "..." : ""}`,
      severity: uniqueDomains.length > 3 ? "high" : "medium",
      details: { domains: uniqueDomains, count: sensitiveAccesses.length },
    });
  }

  // 多数のドメインへのアクセス（データ送信の可能性）
  const uniqueDomains = new Set(requests.map((r) => r.domain));
  if (uniqueDomains.size > 20) {
    risks.push({
      type: "data_exfiltration",
      description: `多数の異なるドメインへアクセス: ${uniqueDomains.size}ドメイン`,
      severity: "medium",
      details: { domainCount: uniqueDomains.size },
    });
  }

  // POSTリクエストの頻度
  const postRequests = requests.filter((r) => r.method === "POST");
  if (postRequests.length > 10) {
    const postDomains = [...new Set(postRequests.map((r) => r.domain))];
    risks.push({
      type: "suspicious_pattern",
      description: `大量のPOSTリクエスト: ${postRequests.length}件`,
      severity: postRequests.length > 50 ? "high" : "medium",
      details: { count: postRequests.length, domains: postDomains.slice(0, 5) },
    });
  }

  return risks;
}

/**
 * リスクスコアを計算
 */
export function calculateRiskScore(
  permissionRisks: PermissionRisk[],
  networkRisks: NetworkRisk[]
): number {
  let score = 0;

  // パーミッションリスク
  for (const risk of permissionRisks) {
    switch (risk.severity) {
      case "critical":
        score += 30;
        break;
      case "high":
        score += 20;
        break;
      case "medium":
        score += 10;
        break;
      case "low":
        score += 5;
        break;
    }
  }

  // ネットワークリスク
  for (const risk of networkRisks) {
    switch (risk.severity) {
      case "high":
        score += 25;
        break;
      case "medium":
        score += 15;
        break;
      case "low":
        score += 5;
        break;
    }
  }

  return Math.min(100, score);
}


/**
 * リスクフラグを生成
 */
export function generateRiskFlags(
  permissionRisks: PermissionRisk[],
  networkRisks: NetworkRisk[]
): RiskFlag[] {
  const flags: RiskFlag[] = [];

  // 危険なパーミッション組み合わせ
  const hasWebRequest = permissionRisks.some(
    (r) => r.permission === "webRequest" || r.permission === "webRequestBlocking"
  );
  const hasAllUrls = permissionRisks.some(
    (r) =>
      r.permission === "<all_urls>" ||
      r.permission === "http://*/*" ||
      r.permission === "https://*/*"
  );

  if (hasWebRequest && hasAllUrls) {
    flags.push({
      flag: "FULL_NETWORK_ACCESS",
      description: "すべてのネットワークトラフィックを監視・変更可能",
      severity: "critical",
    });
  }

  // コード注入能力
  const hasScripting = permissionRisks.some(
    (r) => r.permission === "scripting" || r.permission === "debugger"
  );
  if (hasScripting && hasAllUrls) {
    flags.push({
      flag: "ARBITRARY_CODE_EXECUTION",
      description: "任意のウェブサイトでコードを実行可能",
      severity: "critical",
    });
  }

  // ネイティブアプリ連携
  const hasNative = permissionRisks.some(
    (r) => r.permission === "nativeMessaging"
  );
  if (hasNative) {
    flags.push({
      flag: "NATIVE_APP_ACCESS",
      description: "ローカルアプリケーションとの通信が可能",
      severity: "high",
    });
  }

  // 機密データ漏洩リスク
  const hasSensitiveDomainAccess = networkRisks.some(
    (r) => r.type === "sensitive_domain"
  );
  if (hasSensitiveDomainAccess && hasAllUrls) {
    flags.push({
      flag: "DATA_EXFILTRATION_RISK",
      description: "機密データの外部送信リスク",
      severity: "high",
    });
  }

  // 高頻度リクエスト
  const hasHighFrequency = networkRisks.some(
    (r) => r.type === "high_frequency" && r.severity === "high"
  );
  if (hasHighFrequency) {
    flags.push({
      flag: "SUSPICIOUS_ACTIVITY",
      description: "異常なネットワーク活動を検出",
      severity: "high",
    });
  }

  return flags;
}

/**
 * パーミッションリストから最も高いリスクレベルを判定
 *
 * @param permissions - 通常のパーミッション
 * @param hostPermissions - ホストパーミッション
 * @returns 4段階リスクレベル
 */
export type PermissionRiskLevel = "critical" | "high" | "medium" | "low";

export function getPermissionRiskLevel(
  permissions: string[],
  hostPermissions: string[] = [],
): PermissionRiskLevel {
  const risks = analyzePermissions([...permissions, ...hostPermissions]);
  if (risks.length === 0) return "low";

  const severityOrder: PermissionRiskLevel[] = ["critical", "high", "medium", "low"];
  for (const level of severityOrder) {
    if (risks.some((r) => r.severity === level)) return level;
  }
  return "low";
}

/**
 * 拡張機能のリスク分析を実行
 */
export function analyzeExtensionRisk(
  extensionId: string,
  extensionName: string,
  permissions: string[],
  requests: ExtensionRequestRecord[]
): ExtensionRiskAnalysis {
  const permissionRisks = analyzePermissions(permissions);
  const networkRisks = analyzeNetworkActivity(requests);
  const riskScore = calculateRiskScore(permissionRisks, networkRisks);
  const riskLevel = scoreToExtensionRiskLevel(riskScore);
  const flags = generateRiskFlags(permissionRisks, networkRisks);

  return {
    extensionId,
    extensionName,
    riskScore,
    riskLevel,
    permissionRisks,
    networkRisks,
    flags,
    analyzedAt: Date.now(),
  };
}

/**
 * 拡張機能情報を取得してリスク分析
 */
export async function analyzeInstalledExtension(
  extensionId: string,
  requests: ExtensionRequestRecord[]
): Promise<ExtensionRiskAnalysis | null> {
  try {
    const extensions = await chrome.management.getAll();
    const extension = extensions.find((e: chrome.management.ExtensionInfo) => e.id === extensionId);

    if (!extension) return null;

    const permissions = [
      ...(extension.permissions || []),
      ...(extension.hostPermissions || []),
    ];

    return analyzeExtensionRisk(
      extension.id,
      extension.name,
      permissions,
      requests
    );
  } catch {
    return null;
  }
}

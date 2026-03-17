/**
 * @fileoverview DLP (Data Loss Prevention) Rules
 *
 * テキスト内の機密データ検出を一元管理する。
 * - 基本パターン（credentials, PII, financial, health, code, internal）
 * - 拡張パターン（追加APIキー、日本固有、ネットワーク等）
 * - ルールの有効/無効化、カスタムルール追加
 */

// ============================================================================
// Types
// ============================================================================

/**
 * データ分類
 */
export type DataClassification =
  | "credentials"
  | "pii"
  | "financial"
  | "health"
  | "code"
  | "internal"
  | "unknown";

/**
 * 検出結果
 */
export interface SensitiveDataResult {
  classification: DataClassification;
  confidence: "high" | "medium" | "low";
  pattern: string;
  matchedText?: string;
  position?: number;
}

/**
 * DLPルール
 */
export interface DLPRule {
  id: string;
  name: string;
  description: string;
  classification: DataClassification;
  pattern: RegExp;
  confidence: "high" | "medium" | "low";
  enabled: boolean;
  custom?: boolean;
}

/**
 * DLPルール設定
 */
export interface DLPConfig {
  enabled: boolean;
  rules: DLPRule[];
  alertOnDetection: boolean;
  blockOnHighRisk: boolean;
}

/**
 * DLP検出結果
 */
export interface DLPDetectionResult extends SensitiveDataResult {
  ruleId: string;
  ruleName: string;
  blocked: boolean;
}

/**
 * DLP分析結果
 */
export interface DLPAnalysisResult {
  detected: DLPDetectionResult[];
  blocked: boolean;
  riskLevel: "critical" | "high" | "medium" | "low" | "none";
  summary: {
    total: number;
    byClassification: Record<DataClassification, number>;
    highConfidenceCount: number;
  };
}

// ============================================================================
// All DLP Rules
// ============================================================================

/**
 * 全DLPルール（基本パターン + 拡張パターン）
 */
const BASE_DLP_RULES: DLPRule[] = [
  // === Base: Credentials ===
  {
    id: "base-api-key",
    name: "API Key",
    description: "汎用APIキー・シークレット",
    classification: "credentials",
    pattern:
      /(?:api[_-]?key|apikey|api_secret|secret_key|access_token|auth_token|bearer)[\s:="']+[a-zA-Z0-9_-]{20,}/gi,
    confidence: "high",
    enabled: true,
  },
  {
    id: "base-password",
    name: "Password",
    description: "パスワード",
    classification: "credentials",
    pattern: /(?:password|passwd|pwd)[\s:="']+[^\s"']{8,}/gi,
    confidence: "high",
    enabled: true,
  },
  {
    id: "base-openai-api-key",
    name: "OpenAI API Key",
    description: "OpenAI APIキー",
    classification: "credentials",
    pattern: /sk-[a-zA-Z0-9]{32,}/g,
    confidence: "high",
    enabled: true,
  },
  {
    id: "base-anthropic-api-key",
    name: "Anthropic API Key",
    description: "Anthropic APIキー",
    classification: "credentials",
    pattern: /sk-ant-[a-zA-Z0-9-]{80,}/g,
    confidence: "high",
    enabled: true,
  },
  {
    id: "base-github-token",
    name: "GitHub Token",
    description: "GitHub Personal Access Token",
    classification: "credentials",
    pattern: /ghp_[a-zA-Z0-9]{36}/g,
    confidence: "high",
    enabled: true,
  },
  {
    id: "base-github-oauth-token",
    name: "GitHub OAuth Token",
    description: "GitHub OAuthトークン",
    classification: "credentials",
    pattern: /gho_[a-zA-Z0-9]{36}/g,
    confidence: "high",
    enabled: true,
  },
  {
    id: "base-aws-access-key",
    name: "AWS Access Key",
    description: "AWSアクセスキー",
    classification: "credentials",
    pattern: /AKIA[0-9A-Z]{16}/g,
    confidence: "high",
    enabled: true,
  },
  {
    id: "base-private-key",
    name: "Private Key",
    description: "秘密鍵ヘッダー",
    classification: "credentials",
    pattern: /-----BEGIN (?:RSA |DSA |EC )?PRIVATE KEY-----/g,
    confidence: "high",
    enabled: true,
  },

  // === Base: PII ===
  {
    id: "base-email-address",
    name: "Email Address",
    description: "メールアドレス",
    classification: "pii",
    pattern:
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}/g,
    confidence: "medium",
    enabled: true,
  },
  {
    id: "base-us-phone-number",
    name: "US Phone Number",
    description: "米国電話番号",
    classification: "pii",
    pattern: /(?:\+?1[-.]?)?\(?[0-9]{3}\)?[-.]?[0-9]{3}[-.]?[0-9]{4}/g,
    confidence: "medium",
    enabled: true,
  },
  {
    id: "base-jp-phone-number",
    name: "JP Phone Number",
    description: "日本の携帯電話番号",
    classification: "pii",
    pattern: /0[789]0[-]?[0-9]{4}[-]?[0-9]{4}/g,
    confidence: "medium",
    enabled: true,
  },
  {
    id: "base-possible-ssn",
    name: "Possible SSN",
    description: "社会保障番号の可能性",
    classification: "pii",
    pattern: /\d{3}[-]?\d{2}[-]?\d{4}/g,
    confidence: "low",
    enabled: true,
  },
  {
    id: "base-physical-address",
    name: "Physical Address",
    description: "物理住所",
    classification: "pii",
    pattern:
      /(?:住所|address)[\s:：]+.{10,50}(?:市|区|町|村|県|都|道|府|street|ave|road|st\.|dr\.)/gi,
    confidence: "medium",
    enabled: true,
  },

  // === Base: Financial ===
  {
    id: "base-credit-card-number",
    name: "Credit Card Number",
    description: "クレジットカード番号",
    classification: "financial",
    pattern: /(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})/g,
    confidence: "high",
    enabled: true,
  },
  {
    id: "base-possible-card-number",
    name: "Possible Card Number",
    description: "カード番号の可能性",
    classification: "financial",
    pattern: /[0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4}/g,
    confidence: "medium",
    enabled: true,
  },
  {
    id: "base-bank-account",
    name: "Bank Account",
    description: "口座番号",
    classification: "financial",
    pattern: /(?:口座番号|account.?number)[\s:：]*[0-9]{7,14}/gi,
    confidence: "high",
    enabled: true,
  },

  // === Base: Health ===
  {
    id: "base-medical-record",
    name: "Medical Record",
    description: "医療記録",
    classification: "health",
    pattern:
      /(?:診断|diagnosis|medical.?record|patient.?id|health.?id)[\s:：]+[a-zA-Z0-9-]{5,}/gi,
    confidence: "medium",
    enabled: true,
  },
  {
    id: "base-insurance-number",
    name: "Insurance Number",
    description: "保険証番号",
    classification: "health",
    pattern:
      /(?:保険証番号|insurance.?number)[\s:：]*[a-zA-Z0-9]{8,}/gi,
    confidence: "high",
    enabled: true,
  },

  // === Base: Code ===
  {
    id: "base-source-code",
    name: "Source Code",
    description: "ソースコード",
    classification: "code",
    pattern: /(?:function|const|let|var|class|def|public|private)\s+\w+\s*[({]/g,
    confidence: "low",
    enabled: true,
  },
  {
    id: "base-import-statement",
    name: "Import Statement",
    description: "インポート文",
    classification: "code",
    pattern: /(?:import|from|require)\s+['"][^'"]+['"]/g,
    confidence: "low",
    enabled: true,
  },
  {
    id: "base-sql-query",
    name: "SQL Query",
    description: "SQLクエリ",
    classification: "code",
    pattern:
      /(?:SELECT|INSERT|UPDATE|DELETE|CREATE|DROP)\s+(?:FROM|INTO|TABLE)/gi,
    confidence: "medium",
    enabled: true,
  },

  // === Base: Internal ===
  {
    id: "base-confidential-marker",
    name: "Confidential Marker",
    description: "機密マーカー",
    classification: "internal",
    pattern: /(?:内部|機密|confidential|internal.?only|do.?not.?share)/gi,
    confidence: "medium",
    enabled: true,
  },
  {
    id: "base-proprietary-info",
    name: "Proprietary Info",
    description: "専有情報マーカー",
    classification: "internal",
    pattern: /(?:社内|proprietary|trade.?secret)/gi,
    confidence: "medium",
    enabled: true,
  },

];

const EXTENDED_DLP_RULES_INTERNAL: DLPRule[] = [
  // === Extended: Additional API Keys ===
  {
    id: "google-api-key",
    name: "Google API Key",
    description: "Google Cloud/APIキー",
    classification: "credentials",
    pattern: /AIza[0-9A-Za-z-_]{35}/g,
    confidence: "high",
    enabled: true,
  },
  {
    id: "azure-subscription-key",
    name: "Azure Subscription Key",
    description: "Azure Cognitive Services等",
    classification: "credentials",
    pattern: /[0-9a-f]{32}/gi,
    confidence: "low",
    enabled: false, // 誤検出が多いため無効
  },
  {
    id: "stripe-key",
    name: "Stripe API Key",
    description: "Stripe決済APIキー",
    classification: "credentials",
    pattern: /(?:sk|pk)_(?:test|live)_[0-9a-zA-Z]{24,}/g,
    confidence: "high",
    enabled: true,
  },
  {
    id: "slack-token",
    name: "Slack Token",
    description: "Slack Bot/User Token",
    classification: "credentials",
    pattern: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*/g,
    confidence: "high",
    enabled: true,
  },
  {
    id: "twilio-key",
    name: "Twilio API Key",
    description: "Twilio SID/Auth Token",
    classification: "credentials",
    pattern: /(?:AC|SK)[a-f0-9]{32}/gi,
    confidence: "high",
    enabled: true,
  },
  {
    id: "sendgrid-key",
    name: "SendGrid API Key",
    description: "SendGrid メール送信キー",
    classification: "credentials",
    pattern: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/g,
    confidence: "high",
    enabled: true,
  },
  {
    id: "mailchimp-key",
    name: "Mailchimp API Key",
    description: "Mailchimpキー",
    classification: "credentials",
    pattern: /[0-9a-f]{32}-us[0-9]{1,2}/g,
    confidence: "high",
    enabled: true,
  },
  {
    id: "jwt-token",
    name: "JWT Token",
    description: "JSON Web Token",
    classification: "credentials",
    pattern: /eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+/=]+/g,
    confidence: "high",
    enabled: true,
  },
  {
    id: "basic-auth",
    name: "Basic Auth Header",
    description: "Basic認証ヘッダー",
    classification: "credentials",
    pattern: /Basic\s+[A-Za-z0-9+/=]{20,}/g,
    confidence: "high",
    enabled: true,
  },
  {
    id: "bearer-token",
    name: "Bearer Token",
    description: "Bearerトークン",
    classification: "credentials",
    pattern: /Bearer\s+[A-Za-z0-9-_.~+/]+=*/g,
    confidence: "medium",
    enabled: true,
  },

  // === Extended: Japan-specific ===
  {
    id: "my-number",
    name: "マイナンバー",
    description: "日本の個人番号（12桁）",
    classification: "pii",
    pattern: /(?:マイナンバー|個人番号|my\s*number)[\s:：]*[0-9]{4}[\s-]?[0-9]{4}[\s-]?[0-9]{4}/gi,
    confidence: "high",
    enabled: true,
  },
  {
    id: "jp-drivers-license",
    name: "運転免許証番号",
    description: "日本の運転免許証番号",
    classification: "pii",
    pattern: /(?:運転免許|免許証|driver.?license)[\s:：]*[0-9]{12}/gi,
    confidence: "high",
    enabled: true,
  },
  {
    id: "jp-passport",
    name: "旅券番号",
    description: "日本のパスポート番号",
    classification: "pii",
    pattern: /(?:旅券番号|passport.?number)[\s:：]*[A-Z]{2}[0-9]{7}/gi,
    confidence: "high",
    enabled: true,
  },
  {
    id: "jp-bank-code",
    name: "銀行コード・支店コード",
    description: "金融機関コード",
    classification: "financial",
    pattern: /(?:銀行コード|支店コード|branch.?code)[\s:：]*[0-9]{3,4}/gi,
    confidence: "medium",
    enabled: true,
  },

  // === Extended: Network/URL ===
  {
    id: "url-with-token",
    name: "URL内トークン",
    description: "URLに含まれるトークンやキー",
    classification: "credentials",
    pattern: /https?:\/\/[^\s?&]*[?&](?:token|key|api_key|access_token|secret)=[A-Za-z0-9-_.~+/]+/gi,
    confidence: "high",
    enabled: true,
  },
  {
    id: "connection-string",
    name: "接続文字列",
    description: "DB接続文字列等",
    classification: "credentials",
    pattern: /(?:mongodb|mysql|postgresql|redis|amqp):\/\/[^\s:]+:[^\s@]+@[^\s]+/gi,
    confidence: "high",
    enabled: true,
  },

  // === Extended: Environment variables ===
  {
    id: "env-variable",
    name: "環境変数",
    description: "環境変数の値",
    classification: "internal",
    pattern: /(?:export\s+)?[A-Z_][A-Z0-9_]*=['""]?[^'"">\s]{10,}['""]?/g,
    confidence: "medium",
    enabled: true,
  },
];

export const ALL_DLP_RULES: DLPRule[] = [
  ...BASE_DLP_RULES,
  ...EXTENDED_DLP_RULES_INTERNAL,
];

/**
 * 拡張ルールのみ（後方互換）
 */
export const EXTENDED_DLP_RULES: DLPRule[] = EXTENDED_DLP_RULES_INTERNAL;

const RULE_CATALOG = {
  all: ALL_DLP_RULES,
  base: BASE_DLP_RULES,
  extended: EXTENDED_DLP_RULES_INTERNAL,
} as const;

// ============================================================================
// Sensitive Data Detection Functions
// ============================================================================

/**
 * テキストをマスク
 */
function maskText(text: string): string {
  if (text.length <= 4) return "****";
  const visibleStart = Math.min(4, Math.floor(text.length / 4));
  const visibleEnd = Math.min(4, Math.floor(text.length / 4));
  const maskedLength = text.length - visibleStart - visibleEnd;
  return (
    text.substring(0, visibleStart) +
    "*".repeat(maskedLength) +
    text.substring(text.length - visibleEnd)
  );
}

function getBaseEnabledRules(): DLPRule[] {
  return RULE_CATALOG.base.filter((r) => r.enabled);
}

function scanRules<T>(
  text: string,
  rules: DLPRule[],
  onMatch: (rule: DLPRule, match: RegExpExecArray) => T
): T[] {
  const results: T[] = [];
  for (const rule of rules) {
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      results.push(onMatch(rule, match));
    }
  }
  return results;
}

function hasAnyMatch(text: string, rules: DLPRule[]): boolean {
  for (const rule of rules) {
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    if (regex.test(text)) {
      return true;
    }
  }
  return false;
}

function toSensitiveDataResult(
  rule: DLPRule,
  match: RegExpExecArray
): SensitiveDataResult {
  return {
    classification: rule.classification,
    confidence: rule.confidence,
    pattern: rule.name,
    matchedText: maskText(match[0]),
    position: match.index,
  };
}

function toDLPDetectionResult(
  rule: DLPRule,
  match: RegExpExecArray
): DLPDetectionResult {
  return {
    classification: rule.classification,
    confidence: rule.confidence,
    pattern: rule.name,
    matchedText: maskText(match[0]),
    position: match.index,
    ruleId: rule.id,
    ruleName: rule.name,
    blocked: false,
  };
}

/**
 * テキスト内の機密データを検出
 */
export function detectSensitiveData(text: string): SensitiveDataResult[] {
  const baseRules = getBaseEnabledRules();
  return scanRules(text, baseRules, toSensitiveDataResult);
}

/**
 * 機密データが含まれているかチェック
 */
export function hasSensitiveData(text: string): boolean {
  return hasAnyMatch(text, getBaseEnabledRules());
}

/**
 * 最も高リスクな分類を取得
 */
export function getHighestRiskClassification(
  results: SensitiveDataResult[]
): DataClassification | null {
  if (results.length === 0) return null;

  const priority: Record<DataClassification, number> = {
    credentials: 7,
    financial: 6,
    health: 5,
    pii: 4,
    internal: 3,
    code: 2,
    unknown: 1,
  };

  return results.reduce((highest, result) => {
    if (
      !highest ||
      priority[result.classification] > priority[highest.classification]
    ) {
      return result;
    }
    return highest;
  }, results[0]).classification;
}

/**
 * 分類ごとの検出数サマリーを取得
 */
export function getSensitiveDataSummary(
  results: SensitiveDataResult[]
): Record<DataClassification, number> {
  const summary: Record<DataClassification, number> = {
    credentials: 0,
    pii: 0,
    financial: 0,
    health: 0,
    code: 0,
    internal: 0,
    unknown: 0,
  };

  for (const result of results) {
    summary[result.classification]++;
  }

  return summary;
}

// ============================================================================
// DLP Manager
// ============================================================================

/**
 * デフォルトDLP設定
 */
export const DEFAULT_DLP_CONFIG: DLPConfig = {
  enabled: true,
  rules: ALL_DLP_RULES,
  alertOnDetection: true,
  blockOnHighRisk: false,
};

/**
 * DLPルールマネージャーを作成
 */
export function createDLPManager(config: DLPConfig = DEFAULT_DLP_CONFIG) {
  let currentConfig = { ...config };

  function updateConfig(updates: Partial<DLPConfig>): void {
    currentConfig = { ...currentConfig, ...updates };
  }

  function setRuleEnabled(ruleId: string, enabled: boolean): boolean {
    const rule = currentConfig.rules.find((r) => r.id === ruleId);
    if (rule) {
      rule.enabled = enabled;
      return true;
    }
    return false;
  }

  function addCustomRule(rule: Omit<DLPRule, "custom">): void {
    currentConfig.rules.push({ ...rule, custom: true });
  }

  function removeCustomRule(ruleId: string): boolean {
    const index = currentConfig.rules.findIndex(
      (r) => r.id === ruleId && r.custom
    );
    if (index !== -1) {
      currentConfig.rules.splice(index, 1);
      return true;
    }
    return false;
  }

  function analyze(text: string): DLPAnalysisResult {
    if (!currentConfig.enabled) {
      return createEmptyAnalysisResult();
    }

    const enabledRules = currentConfig.rules.filter((r) => r.enabled);
    const allResults = scanRules(text, enabledRules, toDLPDetectionResult);

    // 重複除去
    const merged = mergeResults(allResults);

    // ブロック判定
    const shouldBlock = applyBlockingPolicy(merged, currentConfig.blockOnHighRisk);

    const summary = createSummary(merged);
    const riskLevel = calculateRiskLevel(merged);

    return {
      detected: merged,
      blocked: shouldBlock,
      riskLevel,
      summary,
    };
  }

  function getEnabledRules(): DLPRule[] {
    return currentConfig.rules.filter((r) => r.enabled);
  }

  function getAllRules(): DLPRule[] {
    return [...currentConfig.rules];
  }

  function getConfig(): DLPConfig {
    return { ...currentConfig };
  }

  return {
    analyze,
    updateConfig,
    setRuleEnabled,
    addCustomRule,
    removeCustomRule,
    getEnabledRules,
    getAllRules,
    getConfig,
  };
}

export type DLPManager = ReturnType<typeof createDLPManager>;

// ============================================================================
// Helper Functions
// ============================================================================

function createEmptyAnalysisResult(): DLPAnalysisResult {
  return {
    detected: [],
    blocked: false,
    riskLevel: "none",
    summary: {
      total: 0,
      byClassification: {
        credentials: 0,
        pii: 0,
        financial: 0,
        health: 0,
        code: 0,
        internal: 0,
        unknown: 0,
      },
      highConfidenceCount: 0,
    },
  };
}

function applyBlockingPolicy(
  results: DLPDetectionResult[],
  blockOnHighRisk: boolean
): boolean {
  if (!blockOnHighRisk) return false;

  const shouldBlock = results.some(
    (r) =>
      r.confidence === "high" &&
      (r.classification === "credentials" || r.classification === "financial")
  );

  if (shouldBlock) {
    for (const r of results) {
      if (
        r.confidence === "high" &&
        (r.classification === "credentials" || r.classification === "financial")
      ) {
        r.blocked = true;
      }
    }
  }

  return shouldBlock;
}

function mergeResults(results: DLPDetectionResult[]): DLPDetectionResult[] {
  const merged: DLPDetectionResult[] = [];

  for (const result of results) {
    const existing = merged.find(
      (m) =>
        m.position !== undefined &&
        result.position !== undefined &&
        Math.abs(m.position - result.position) < 5 &&
        m.classification === result.classification
    );

    if (!existing) {
      merged.push(result);
    }
  }

  return merged;
}

function createSummary(results: DLPDetectionResult[]): DLPAnalysisResult["summary"] {
  const byClassification: Record<DataClassification, number> = {
    credentials: 0,
    pii: 0,
    financial: 0,
    health: 0,
    code: 0,
    internal: 0,
    unknown: 0,
  };

  let highConfidenceCount = 0;

  for (const result of results) {
    byClassification[result.classification]++;
    if (result.confidence === "high") {
      highConfidenceCount++;
    }
  }

  return {
    total: results.length,
    byClassification,
    highConfidenceCount,
  };
}

function calculateRiskLevel(
  results: DLPDetectionResult[]
): DLPAnalysisResult["riskLevel"] {
  if (results.length === 0) return "none";

  const hasHighCredentials = results.some(
    (r) => r.classification === "credentials" && r.confidence === "high"
  );
  const hasHighFinancial = results.some(
    (r) => r.classification === "financial" && r.confidence === "high"
  );

  if (hasHighCredentials) return "critical";
  if (hasHighFinancial) return "high";

  const hasHighConfidence = results.some((r) => r.confidence === "high");
  if (hasHighConfidence) return "high";

  const hasMediumConfidence = results.some((r) => r.confidence === "medium");
  if (hasMediumConfidence) return "medium";

  return "low";
}

/**
 * @fileoverview Policy Enforcement Types
 *
 * Types for enterprise security policy enforcement.
 * Allows organizations to define custom security policies.
 */

/**
 * Policy rule action
 */
export type PolicyAction = "allow" | "block" | "warn";

/**
 * Policy rule match type
 */
export type PolicyMatchType = "exact" | "suffix" | "prefix" | "regex" | "contains";

/**
 * Domain policy rule
 */
export interface DomainPolicyRule {
  id: string;
  enabled: boolean;
  name: string;
  description?: string;
  action: PolicyAction;
  matchType: PolicyMatchType;
  pattern: string;
  priority: number;
}

/**
 * Tool/Service policy rule
 */
export interface ToolPolicyRule {
  id: string;
  enabled: boolean;
  name: string;
  description?: string;
  action: PolicyAction;
  /** Tool categories: ai, productivity, social, communication, etc. */
  category?: string;
  /** Specific tool/service patterns */
  patterns: string[];
  priority: number;
}

/**
 * AI service policy rule
 */
export interface AIPolicyRule {
  id: string;
  enabled: boolean;
  name: string;
  description?: string;
  action: PolicyAction;
  /** AI provider (openai, anthropic, google, etc.) */
  provider?: string;
  /** Block specific data types in prompts */
  blockedDataTypes?: string[];
  priority: number;
}

/**
 * Data transfer policy rule
 */
export interface DataTransferPolicyRule {
  id: string;
  enabled: boolean;
  name: string;
  description?: string;
  action: PolicyAction;
  /** Max size in KB */
  maxSizeKB?: number;
  /** Blocked destination patterns */
  blockedDestinations?: string[];
  /** Allowed destination patterns (whitelist) */
  allowedDestinations?: string[];
  priority: number;
}

/**
 * Policy configuration
 */
export interface PolicyConfig {
  enabled: boolean;
  domainRules: DomainPolicyRule[];
  toolRules: ToolPolicyRule[];
  aiRules: AIPolicyRule[];
  dataTransferRules: DataTransferPolicyRule[];
}

/**
 * Policy violation result
 */
export interface PolicyViolation {
  ruleId: string;
  ruleName: string;
  ruleType: "domain" | "tool" | "ai" | "data_transfer";
  action: PolicyAction;
  matchedPattern: string;
  target: string;
  timestamp: number;
}

/**
 * Default policy configuration
 */
export const DEFAULT_POLICY_CONFIG: PolicyConfig = {
  enabled: false,
  domainRules: [],
  toolRules: [],
  aiRules: [],
  dataTransferRules: [],
};

/**
 * Example policy templates
 */
export const POLICY_TEMPLATES = {
  /**
   * Block social media domains
   */
  blockSocialMedia: {
    id: "block-social-media",
    enabled: false,
    name: "ソーシャルメディアをブロック",
    description: "社内でのソーシャルメディア利用を制限",
    action: "block" as PolicyAction,
    matchType: "suffix" as PolicyMatchType,
    pattern: "",
    priority: 100,
  } satisfies Omit<DomainPolicyRule, "pattern"> & { pattern: string },

  /**
   * Block file sharing services
   */
  blockFileSharing: {
    id: "block-file-sharing",
    enabled: false,
    name: "外部ファイル共有をブロック",
    description: "未承認のファイル共有サービスを制限",
    action: "block" as PolicyAction,
    patterns: [
      "dropbox.com",
      "wetransfer.com",
      "sendspace.com",
      "mediafire.com",
    ],
    priority: 100,
  } satisfies Omit<ToolPolicyRule, "id" | "enabled" | "name" | "action" | "priority"> & {
    id: string;
    enabled: boolean;
    name: string;
    action: PolicyAction;
    priority: number;
  },

  /**
   * Block unauthorized AI services
   */
  blockUnauthorizedAI: {
    id: "block-unauthorized-ai",
    enabled: false,
    name: "未承認AIサービスをブロック",
    description: "企業が承認していないAIサービスへのアクセスを制限",
    action: "warn" as PolicyAction,
    blockedDataTypes: ["credentials", "pii", "api_key"],
    priority: 100,
  } satisfies Omit<AIPolicyRule, "id" | "enabled" | "name" | "action" | "priority"> & {
    id: string;
    enabled: boolean;
    name: string;
    action: PolicyAction;
    priority: number;
  },

  /**
   * Limit data transfer size
   */
  limitDataTransfer: {
    id: "limit-data-transfer",
    enabled: false,
    name: "大量データ転送を制限",
    description: "外部への大量データ転送を検出・警告",
    action: "warn" as PolicyAction,
    maxSizeKB: 500,
    priority: 100,
  } satisfies Omit<DataTransferPolicyRule, "id" | "enabled" | "name" | "action" | "priority"> & {
    id: string;
    enabled: boolean;
    name: string;
    action: PolicyAction;
    priority: number;
  },
};

/**
 * Social media domain patterns
 */
export const SOCIAL_MEDIA_DOMAINS = [
  "facebook.com",
  "twitter.com",
  "x.com",
  "instagram.com",
  "tiktok.com",
  "linkedin.com",
  "pinterest.com",
  "reddit.com",
  "tumblr.com",
  "snapchat.com",
];

/**
 * Productivity tool domains
 */
export const PRODUCTIVITY_DOMAINS = [
  "notion.so",
  "airtable.com",
  "asana.com",
  "trello.com",
  "monday.com",
  "clickup.com",
  "evernote.com",
  "todoist.com",
];

/**
 * Communication tool domains
 */
export const COMMUNICATION_DOMAINS = [
  "slack.com",
  "discord.com",
  "teams.microsoft.com",
  "zoom.us",
  "meet.google.com",
  "webex.com",
];

/**
 * @fileoverview Policy Manager
 *
 * Manages security policy enforcement and violation detection.
 */

import type {
  PolicyConfig,
  PolicyViolation,
  DomainPolicyRule,
  ToolPolicyRule,
  AIPolicyRule,
  DataTransferPolicyRule,
  PolicyMatchType,
} from "./policy-types.js";
import { DEFAULT_POLICY_CONFIG } from "./policy-types.js";

/**
 * Policy check result
 */
export interface PolicyCheckResult {
  allowed: boolean;
  violations: PolicyViolation[];
}

/**
 * Match domain against pattern
 */
function matchDomain(
  domain: string,
  pattern: string,
  matchType: PolicyMatchType
): boolean {
  if (domain == null || pattern == null) return false;
  const normalizedDomain = domain.toLowerCase();
  const normalizedPattern = pattern.toLowerCase();

  switch (matchType) {
    case "exact":
      return normalizedDomain === normalizedPattern;
    case "suffix":
      return (
        normalizedDomain === normalizedPattern ||
        normalizedDomain.endsWith(`.${normalizedPattern}`)
      );
    case "prefix":
      return normalizedDomain.startsWith(normalizedPattern);
    case "contains":
      return normalizedDomain.includes(normalizedPattern);
    case "regex":
      try {
        const regex = new RegExp(pattern, "i");
        return regex.test(domain);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

/**
 * Check if domain matches any pattern in the list
 */
function matchesAnyPattern(
  domain: string,
  patterns: string[],
  matchType: PolicyMatchType = "suffix"
): boolean {
  return patterns.some((pattern) => matchDomain(domain, pattern, matchType));
}

/**
 * Create policy manager
 */
export function createPolicyManager(config: PolicyConfig = DEFAULT_POLICY_CONFIG) {
  let currentConfig = { ...config };

  /**
   * Update policy configuration
   */
  function updateConfig(newConfig: Partial<PolicyConfig>): void {
    currentConfig = { ...currentConfig, ...newConfig };
  }

  /**
   * Get current configuration
   */
  function getConfig(): PolicyConfig {
    return { ...currentConfig };
  }

  /**
   * Check domain against policy rules
   */
  function checkDomain(domain: string): PolicyCheckResult {
    if (!currentConfig.enabled) {
      return { allowed: true, violations: [] };
    }

    const violations: PolicyViolation[] = [];
    const enabledRules = currentConfig.domainRules
      .filter((rule) => rule.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of enabledRules) {
      if (matchDomain(domain, rule.pattern, rule.matchType)) {
        violations.push({
          ruleId: rule.id,
          ruleName: rule.name,
          ruleType: "domain",
          action: rule.action,
          matchedPattern: rule.pattern,
          target: domain,
          timestamp: Date.now(),
        });

        // If block rule matches, stop checking
        if (rule.action === "block") {
          return { allowed: false, violations };
        }
      }
    }

    // Check if blocked by highest priority rule
    const hasBlockViolation = violations.some((v) => v.action === "block");
    return { allowed: !hasBlockViolation, violations };
  }

  /**
   * Check tool/service against policy rules
   */
  function checkTool(domain: string): PolicyCheckResult {
    if (!currentConfig.enabled) {
      return { allowed: true, violations: [] };
    }

    const violations: PolicyViolation[] = [];
    const enabledRules = currentConfig.toolRules
      .filter((rule) => rule.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of enabledRules) {
      if (matchesAnyPattern(domain, rule.patterns)) {
        violations.push({
          ruleId: rule.id,
          ruleName: rule.name,
          ruleType: "tool",
          action: rule.action,
          matchedPattern: rule.patterns.find((p) =>
            matchDomain(domain, p, "suffix")
          ) || rule.patterns[0],
          target: domain,
          timestamp: Date.now(),
        });

        if (rule.action === "block") {
          return { allowed: false, violations };
        }
      }
    }

    const hasBlockViolation = violations.some((v) => v.action === "block");
    return { allowed: !hasBlockViolation, violations };
  }

  /**
   * Check AI service against policy rules
   */
  function checkAIService(params: {
    domain: string;
    provider?: string;
    dataTypes?: string[];
  }): PolicyCheckResult {
    if (!currentConfig.enabled) {
      return { allowed: true, violations: [] };
    }

    const violations: PolicyViolation[] = [];
    const enabledRules = currentConfig.aiRules
      .filter((rule) => rule.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of enabledRules) {
      let matches = false;
      let matchedPattern = "";

      // Check provider match
      if (rule.provider && params.provider) {
        if (rule.provider.toLowerCase() === params.provider.toLowerCase()) {
          matches = true;
          matchedPattern = `provider:${rule.provider}`;
        }
      }

      // Check blocked data types
      if (rule.blockedDataTypes && params.dataTypes) {
        const blockedFound = rule.blockedDataTypes.filter((blocked) =>
          params.dataTypes!.some(
            (dt) => dt.toLowerCase() === blocked.toLowerCase()
          )
        );
        if (blockedFound.length > 0) {
          matches = true;
          matchedPattern = `data:${blockedFound.join(",")}`;
        }
      }

      // If no specific rules, it's a general AI block
      if (!rule.provider && !rule.blockedDataTypes) {
        matches = true;
        matchedPattern = "all_ai";
      }

      if (matches) {
        violations.push({
          ruleId: rule.id,
          ruleName: rule.name,
          ruleType: "ai",
          action: rule.action,
          matchedPattern,
          target: params.domain,
          timestamp: Date.now(),
        });

        if (rule.action === "block") {
          return { allowed: false, violations };
        }
      }
    }

    const hasBlockViolation = violations.some((v) => v.action === "block");
    return { allowed: !hasBlockViolation, violations };
  }

  /**
   * Check data transfer against policy rules
   */
  function checkDataTransfer(params: {
    destination: string;
    sizeKB: number;
  }): PolicyCheckResult {
    if (!currentConfig.enabled) {
      return { allowed: true, violations: [] };
    }

    const violations: PolicyViolation[] = [];
    const enabledRules = currentConfig.dataTransferRules
      .filter((rule) => rule.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of enabledRules) {
      let matches = false;
      let matchedPattern = "";

      // Check size limit
      if (rule.maxSizeKB && params.sizeKB > rule.maxSizeKB) {
        matches = true;
        matchedPattern = `size:${params.sizeKB}KB>${rule.maxSizeKB}KB`;
      }

      // Check blocked destinations
      if (rule.blockedDestinations) {
        if (matchesAnyPattern(params.destination, rule.blockedDestinations)) {
          matches = true;
          matchedPattern = `blocked:${params.destination}`;
        }
      }

      // Check allowed destinations (whitelist mode)
      if (rule.allowedDestinations && rule.allowedDestinations.length > 0) {
        if (!matchesAnyPattern(params.destination, rule.allowedDestinations)) {
          matches = true;
          matchedPattern = `not_allowed:${params.destination}`;
        }
      }

      if (matches) {
        violations.push({
          ruleId: rule.id,
          ruleName: rule.name,
          ruleType: "data_transfer",
          action: rule.action,
          matchedPattern,
          target: params.destination,
          timestamp: Date.now(),
        });

        if (rule.action === "block") {
          return { allowed: false, violations };
        }
      }
    }

    const hasBlockViolation = violations.some((v) => v.action === "block");
    return { allowed: !hasBlockViolation, violations };
  }

  /**
   * Add domain rule
   */
  function addDomainRule(rule: DomainPolicyRule): void {
    currentConfig.domainRules.push(rule);
  }

  /**
   * Add tool rule
   */
  function addToolRule(rule: ToolPolicyRule): void {
    currentConfig.toolRules.push(rule);
  }

  /**
   * Add AI rule
   */
  function addAIRule(rule: AIPolicyRule): void {
    currentConfig.aiRules.push(rule);
  }

  /**
   * Add data transfer rule
   */
  function addDataTransferRule(rule: DataTransferPolicyRule): void {
    currentConfig.dataTransferRules.push(rule);
  }

  /**
   * Remove rule by ID
   */
  function removeRule(ruleId: string): boolean {
    let removed = false;

    const domainIndex = currentConfig.domainRules.findIndex(
      (r) => r.id === ruleId
    );
    if (domainIndex >= 0) {
      currentConfig.domainRules.splice(domainIndex, 1);
      removed = true;
    }

    const toolIndex = currentConfig.toolRules.findIndex((r) => r.id === ruleId);
    if (toolIndex >= 0) {
      currentConfig.toolRules.splice(toolIndex, 1);
      removed = true;
    }

    const aiIndex = currentConfig.aiRules.findIndex((r) => r.id === ruleId);
    if (aiIndex >= 0) {
      currentConfig.aiRules.splice(aiIndex, 1);
      removed = true;
    }

    const dataIndex = currentConfig.dataTransferRules.findIndex(
      (r) => r.id === ruleId
    );
    if (dataIndex >= 0) {
      currentConfig.dataTransferRules.splice(dataIndex, 1);
      removed = true;
    }

    return removed;
  }

  /**
   * Toggle rule enabled state
   */
  function toggleRule(ruleId: string, enabled: boolean): boolean {
    const allRules = [
      ...currentConfig.domainRules,
      ...currentConfig.toolRules,
      ...currentConfig.aiRules,
      ...currentConfig.dataTransferRules,
    ];

    const rule = allRules.find((r) => r.id === ruleId);
    if (rule) {
      rule.enabled = enabled;
      return true;
    }
    return false;
  }

  return {
    updateConfig,
    getConfig,
    checkDomain,
    checkTool,
    checkAIService,
    checkDataTransfer,
    addDomainRule,
    addToolRule,
    addAIRule,
    addDataTransferRule,
    removeRule,
    toggleRule,
  };
}

export type PolicyManager = ReturnType<typeof createPolicyManager>;

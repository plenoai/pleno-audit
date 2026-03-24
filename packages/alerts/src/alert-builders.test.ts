import { describe, it, expect } from "vitest";
import {
  resolveSeverity,
  severityFromConfidence,
  buildRiskDescription,
  translateViolations,
  VIOLATION_DESCRIPTIONS,
  buildNRDAlert,
  buildTyposquatAlert,
  buildAISensitiveAlert,
  buildShadowAIAlert,
  buildExtensionAlert,
  buildDataExfiltrationAlert,
  buildCredentialTheftAlert,
  buildSupplyChainRiskAlert,
  buildComplianceAlert,
  buildPolicyViolationAlert,
  buildTrackingBeaconAlert,
  buildClipboardHijackAlert,
  buildCookieAccessAlert,
  buildXSSInjectionAlert,
  buildDOMScrapingAlert,
  buildSuspiciousDownloadAlert,
  type NRDAlertParams,
  type TyposquatAlertParams,
  type AISensitiveAlertParams,
  type ShadowAIAlertParams,
  type ExtensionAlertParams,
  type DataExfiltrationAlertParams,
  type CredentialTheftAlertParams,
  type SupplyChainRiskAlertParams,
  type ComplianceAlertParams,
  type PolicyViolationAlertParams,
  type TrackingBeaconAlertParams,
  type ClipboardHijackAlertParams,
  type CookieAccessAlertParams,
  type XSSInjectionAlertParams,
  type DOMScrapingAlertParams,
  type SuspiciousDownloadAlertParams,
} from "./alert-builders.js";

// ============================================================================
// Severity Resolution Tests
// ============================================================================

describe("resolveSeverity", () => {
  it("returns first matching severity", () => {
    const severity = resolveSeverity(
      [
        [false, "critical"],
        [true, "high"],
        [true, "medium"],
      ],
      "low"
    );
    expect(severity).toBe("high");
  });

  it("returns default when no condition matches", () => {
    const severity = resolveSeverity(
      [
        [false, "critical"],
        [false, "high"],
      ],
      "low"
    );
    expect(severity).toBe("low");
  });

  it("handles empty conditions array", () => {
    const severity = resolveSeverity([], "medium");
    expect(severity).toBe("medium");
  });
});

describe("severityFromConfidence", () => {
  it("returns critical when confidence is high", () => {
    const severity = severityFromConfidence("high", "critical", "medium");
    expect(severity).toBe("critical");
  });

  it("returns default for medium confidence", () => {
    const severity = severityFromConfidence("medium", "critical", "medium");
    expect(severity).toBe("medium");
  });

  it("returns default for low confidence", () => {
    const severity = severityFromConfidence("low", "critical", "medium");
    expect(severity).toBe("medium");
  });

  it("returns default for unknown confidence", () => {
    const severity = severityFromConfidence("unknown", "critical", "medium");
    expect(severity).toBe("medium");
  });
});

// ============================================================================
// Description Building Tests
// ============================================================================

describe("buildRiskDescription", () => {
  it("joins descriptions from true conditions", () => {
    const description = buildRiskDescription([
      [true, "risk A"],
      [true, "risk B"],
      [false, "risk C"],
    ]);
    expect(description).toBe("risk A, risk B");
  });

  it("uses custom separator", () => {
    const description = buildRiskDescription(
      [
        [true, "risk A"],
        [true, "risk B"],
      ],
      " | "
    );
    expect(description).toBe("risk A | risk B");
  });

  it("returns fallback when no conditions are true", () => {
    const description = buildRiskDescription(
      [
        [false, "risk A"],
        [false, "risk B"],
      ],
      ", ",
      "no risks"
    );
    expect(description).toBe("no risks");
  });

  it("returns empty string as default fallback", () => {
    const description = buildRiskDescription([
      [false, "risk A"],
      [false, "risk B"],
    ]);
    expect(description).toBe("");
  });

  it("handles empty conditions array", () => {
    const description = buildRiskDescription([], ", ", "default");
    expect(description).toBe("default");
  });
});

describe("translateViolations", () => {
  it("translates known violation codes", () => {
    const translated = translateViolations([
      "missing_privacy_policy",
      "missing_cookie_banner",
    ]);
    expect(translated).toEqual([
      "プライバシーポリシーなし",
      "クッキーバナーなし",
    ]);
  });

  it("keeps unknown violations as-is", () => {
    const translated = translateViolations([
      "missing_privacy_policy",
      "unknown_violation",
    ]);
    expect(translated).toEqual([
      "プライバシーポリシーなし",
      "unknown_violation",
    ]);
  });

  it("handles empty array", () => {
    const translated = translateViolations([]);
    expect(translated).toEqual([]);
  });
});

// ============================================================================
// Alert Builder Tests
// ============================================================================

describe("buildNRDAlert", () => {
  it("builds NRD alert with high confidence", () => {
    const params: NRDAlertParams = {
      domain: "newdomain.com",
      domainAge: 5,
      registrationDate: "2025-02-04",
      confidence: "high",
    };
    const alert = buildNRDAlert(params);

    expect(alert.category).toBe("nrd");
    expect(alert.severity).toBe("high");
    expect(alert.title).toBe("NRD検出: newdomain.com");
    expect(alert.domain).toBe("newdomain.com");
    expect(alert.details.type).toBe("nrd");
  });

  it("builds NRD alert with null domain age", () => {
    const params: NRDAlertParams = {
      domain: "newdomain.com",
      domainAge: null,
      registrationDate: null,
      confidence: "medium",
    };
    const alert = buildNRDAlert(params);

    expect(alert.severity).toBe("medium");
    expect(alert.description).toContain("日数不明");
  });

  it("builds NRD alert with low confidence", () => {
    const params: NRDAlertParams = {
      domain: "domain.com",
      domainAge: 1,
      registrationDate: "2025-02-08",
      confidence: "low",
    };
    const alert = buildNRDAlert(params);

    expect(alert.severity).toBe("medium");
  });
});

describe("buildTyposquatAlert", () => {
  it("builds typosquat alert with high confidence", () => {
    const params: TyposquatAlertParams = {
      domain: "googel.com",
      targetDomain: "google.com",
      homoglyphCount: 1,
      confidence: "high",
    };
    const alert = buildTyposquatAlert(params);

    expect(alert).not.toBeNull();
    expect(alert!.category).toBe("typosquat");
    expect(alert!.severity).toBe("critical");
    expect(alert!.description).toContain("google.com");
  });

  it("returns null for 'none' confidence", () => {
    const params: TyposquatAlertParams = {
      domain: "example.com",
      homoglyphCount: 0,
      confidence: "none",
    };
    const alert = buildTyposquatAlert(params);

    expect(alert).toBeNull();
  });

  it("builds typosquat alert without target domain", () => {
    const params: TyposquatAlertParams = {
      domain: "exampl.com",
      homoglyphCount: 2,
      confidence: "medium",
    };
    const alert = buildTyposquatAlert(params);

    expect(alert).not.toBeNull();
    expect(alert!.description).toContain("ホモグリフ 2個検出");
  });
});

describe("buildAISensitiveAlert", () => {
  it("builds alert with credentials", () => {
    const params: AISensitiveAlertParams = {
      domain: "example.com",
      provider: "ChatGPT",
      model: "gpt-4",
      dataTypes: ["credentials", "personal_info"],
    };
    const alert = buildAISensitiveAlert(params);

    expect(alert.severity).toBe("critical");
    expect(alert.description).toContain("ChatGPT");
    expect(alert.description).toContain("credentials");
  });

  it("builds alert without credentials", () => {
    const params: AISensitiveAlertParams = {
      domain: "example.com",
      provider: "Claude",
      dataTypes: ["email"],
    };
    const alert = buildAISensitiveAlert(params);

    expect(alert.severity).toBe("high");
  });

  it("handles empty data types", () => {
    const params: AISensitiveAlertParams = {
      domain: "example.com",
      provider: "Gemini",
      dataTypes: [],
    };
    const alert = buildAISensitiveAlert(params);

    expect(alert.description).toContain("不明なデータ");
  });
});

describe("buildShadowAIAlert", () => {
  it("builds alert for unknown provider", () => {
    const params: ShadowAIAlertParams = {
      domain: "example.com",
      provider: "unknown",
      providerDisplayName: "Unknown AI",
      category: "specialized",
      riskLevel: "high",
      confidence: "high",
    };
    const alert = buildShadowAIAlert(params);

    expect(alert.severity).toBe("high");
    expect(alert.title).toContain("未知のAIサービス検出");
  });

  it("builds alert for known provider", () => {
    const params: ShadowAIAlertParams = {
      domain: "example.com",
      provider: "claude",
      providerDisplayName: "Claude",
      category: "major",
      riskLevel: "low",
      confidence: "high",
    };
    const alert = buildShadowAIAlert(params);

    expect(alert.title).toContain("Shadow AI検出: Claude");
  });

  it("sets high severity for high risk level", () => {
    const params: ShadowAIAlertParams = {
      domain: "example.com",
      provider: "openai",
      providerDisplayName: "OpenAI",
      category: "enterprise",
      riskLevel: "high",
      confidence: "medium",
    };
    const alert = buildShadowAIAlert(params);

    expect(alert.severity).toBe("high");
  });
});

describe("buildExtensionAlert", () => {
  it("builds extension alert with flags", () => {
    const params: ExtensionAlertParams = {
      extensionId: "abcdef123456",
      extensionName: "Suspicious Extension",
      riskLevel: "critical",
      riskScore: 85,
      flags: ["data_theft", "tracking"],
      requestCount: 100,
      targetDomains: ["example.com", "bank.com"],
    };
    const alert = buildExtensionAlert(params);

    expect(alert.category).toBe("extension");
    expect(alert.severity).toBe("critical");
    expect(alert.description).toContain("data_theft");
  });

  it("falls back to risk score when no flags", () => {
    const params: ExtensionAlertParams = {
      extensionId: "xyz789",
      extensionName: "Test Extension",
      riskLevel: "high",
      riskScore: 70,
      flags: [],
      requestCount: 50,
      targetDomains: ["example.com"],
    };
    const alert = buildExtensionAlert(params);

    expect(alert.description).toContain("リスクスコア: 70");
  });
});

describe("buildDataExfiltrationAlert", () => {
  it("builds critical alert for large data transfer", () => {
    const params: DataExfiltrationAlertParams = {
      sourceDomain: "example.com",
      targetDomain: "attacker.com",
      bodySize: 600000,
      method: "POST",
      initiator: "unknown",
    };
    const alert = buildDataExfiltrationAlert(params);

    expect(alert.severity).toBe("critical");
    expect(alert.description).toContain("586KB");
  });

  it("builds high alert for normal data transfer", () => {
    const params: DataExfiltrationAlertParams = {
      sourceDomain: "example.com",
      targetDomain: "cdn.example.com",
      bodySize: 100000,
      method: "GET",
      initiator: "fetch",
    };
    const alert = buildDataExfiltrationAlert(params);

    expect(alert.severity).toBe("high");
    expect(alert.description).toContain("98KB");
  });
});

describe("buildCredentialTheftAlert", () => {
  it("builds critical alert for insecure protocol", () => {
    const params: CredentialTheftAlertParams = {
      sourceDomain: "example.com",
      targetDomain: "attacker.com",
      formAction: "http://attacker.com/collect",
      isSecure: false,
      isCrossOrigin: true,
      fieldType: "password",
      risks: ["insecure_protocol"],
    };
    const alert = buildCredentialTheftAlert(params);

    expect(alert.severity).toBe("critical");
    expect(alert.description).toContain("非HTTPS通信");
  });

  it("builds high alert for cross-origin", () => {
    const params: CredentialTheftAlertParams = {
      sourceDomain: "example.com",
      targetDomain: "other.com",
      formAction: "https://other.com/submit",
      isSecure: true,
      isCrossOrigin: true,
      fieldType: "username",
      risks: [],
    };
    const alert = buildCredentialTheftAlert(params);

    expect(alert.severity).toBe("high");
    expect(alert.description).toContain("クロスオリジン送信");
  });
});

describe("buildSupplyChainRiskAlert", () => {
  it("builds high alert for CDN without SRI", () => {
    const params: SupplyChainRiskAlertParams = {
      pageDomain: "example.com",
      resourceUrl: "https://cdn.jsdelivr.net/library.js",
      resourceDomain: "cdn.jsdelivr.net",
      resourceType: "script",
      hasIntegrity: false,
      hasCrossorigin: true,
      isCDN: true,
      risks: [],
    };
    const alert = buildSupplyChainRiskAlert(params);

    expect(alert.severity).toBe("high");
    expect(alert.description).toContain("SRIなし");
  });

  it("builds medium alert for local resource", () => {
    const params: SupplyChainRiskAlertParams = {
      pageDomain: "example.com",
      resourceUrl: "https://example.com/script.js",
      resourceDomain: "example.com",
      resourceType: "script",
      hasIntegrity: true,
      hasCrossorigin: false,
      isCDN: false,
      risks: [],
    };
    const alert = buildSupplyChainRiskAlert(params);

    expect(alert.severity).toBe("medium");
  });
});

describe("buildComplianceAlert", () => {
  it("builds high alert for missing privacy on login form", () => {
    const params: ComplianceAlertParams = {
      pageDomain: "example.com",
      hasPrivacyPolicy: false,
      hasTermsOfService: true,
      hasCookiePolicy: true,
      hasCookieBanner: true,
      isCookieBannerGDPRCompliant: true,
      hasLoginForm: true,
    };
    const alert = buildComplianceAlert(params);

    expect(alert).not.toBeNull();
    expect(alert!.severity).toBe("high");
  });

  it("returns null for full compliance", () => {
    const params: ComplianceAlertParams = {
      pageDomain: "example.com",
      hasPrivacyPolicy: true,
      hasTermsOfService: true,
      hasCookiePolicy: true,
      hasCookieBanner: true,
      isCookieBannerGDPRCompliant: true,
      hasLoginForm: true,
    };
    const alert = buildComplianceAlert(params);

    expect(alert).toBeNull();
  });

  it("detects non-compliant cookie banner", () => {
    const params: ComplianceAlertParams = {
      pageDomain: "example.com",
      hasPrivacyPolicy: true,
      hasTermsOfService: true,
      hasCookiePolicy: true,
      hasCookieBanner: true,
      isCookieBannerGDPRCompliant: false,
      hasLoginForm: false,
    };
    const alert = buildComplianceAlert(params);

    expect(alert).not.toBeNull();
    expect(alert!.description).toContain("GDPR非準拠バナー");
  });
});

describe("buildPolicyViolationAlert", () => {
  it("builds high alert for block action", () => {
    const params: PolicyViolationAlertParams = {
      domain: "example.com",
      ruleId: "rule-1",
      ruleName: "Block Malicious Sites",
      ruleType: "domain",
      action: "block",
      matchedPattern: "*.malicious.com",
      target: "evil.malicious.com",
    };
    const alert = buildPolicyViolationAlert(params);

    expect(alert).not.toBeNull();
    expect(alert!.severity).toBe("high");
    expect(alert!.title).toContain("ブロック");
  });

  it("returns null for allow action", () => {
    const params: PolicyViolationAlertParams = {
      domain: "example.com",
      ruleId: "rule-2",
      ruleName: "Allow Work Sites",
      ruleType: "domain",
      action: "allow",
      matchedPattern: "*.company.com",
      target: "tools.company.com",
    };
    const alert = buildPolicyViolationAlert(params);

    expect(alert).toBeNull();
  });

  it("builds medium alert for warn action", () => {
    const params: PolicyViolationAlertParams = {
      domain: "example.com",
      ruleId: "rule-3",
      ruleName: "Warn AI Services",
      ruleType: "ai",
      action: "warn",
      matchedPattern: "*.openai.com",
      target: "chat.openai.com",
    };
    const alert = buildPolicyViolationAlert(params);

    expect(alert!.severity).toBe("medium");
  });
});

describe("buildTrackingBeaconAlert", () => {
  it("builds tracking beacon alert", () => {
    const params: TrackingBeaconAlertParams = {
      sourceDomain: "example.com",
      targetDomain: "analytics.com",
      url: "https://analytics.com/beacon?id=123",
      bodySize: 100,
      initiator: "image",
    };
    const alert = buildTrackingBeaconAlert(params);

    expect(alert.category).toBe("tracking_beacon");
    expect(alert.severity).toBe("medium");
  });
});

describe("buildClipboardHijackAlert", () => {
  it("builds clipboard hijack alert", () => {
    const params: ClipboardHijackAlertParams = {
      domain: "example.com",
      cryptoType: "Bitcoin",
      textPreview: "1A1z7agoat4...",
    };
    const alert = buildClipboardHijackAlert(params);

    expect(alert.category).toBe("clipboard_hijack");
    expect(alert.severity).toBe("critical");
  });
});

describe("buildCookieAccessAlert", () => {
  it("builds cookie access alert", () => {
    const params: CookieAccessAlertParams = {
      domain: "example.com",
      readCount: 5,
    };
    const alert = buildCookieAccessAlert(params);

    expect(alert.category).toBe("cookie_access");
    expect(alert.severity).toBe("medium");
    expect(alert.details.type).toBe("cookie_access");
  });
});

describe("buildXSSInjectionAlert", () => {
  it("builds XSS injection alert", () => {
    const params: XSSInjectionAlertParams = {
      domain: "example.com",
      injectionType: "DOM",
      payloadPreview: "<img src=x onerror=alert(1)>",
    };
    const alert = buildXSSInjectionAlert(params);

    expect(alert.category).toBe("xss_injection");
    expect(alert.severity).toBe("critical");
  });
});

describe("buildDOMScrapingAlert", () => {
  it("builds DOM scraping alert", () => {
    const params: DOMScrapingAlertParams = {
      domain: "example.com",
      selector: ".credit-card",
      callCount: 50,
    };
    const alert = buildDOMScrapingAlert(params);

    expect(alert.category).toBe("dom_scraping");
    expect(alert.severity).toBe("medium");
  });
});

describe("buildSuspiciousDownloadAlert", () => {
  it("builds critical alert for executable", () => {
    const params: SuspiciousDownloadAlertParams = {
      domain: "example.com",
      downloadType: "executable",
      filename: "installer.exe",
      extension: ".exe",
      size: 5242880,
      mimeType: "application/octet-stream",
    };
    const alert = buildSuspiciousDownloadAlert(params);

    expect(alert.severity).toBe("critical");
  });

  it("builds high alert for non-executable", () => {
    const params: SuspiciousDownloadAlertParams = {
      domain: "example.com",
      downloadType: "document",
      filename: "document.pdf",
      extension: ".pdf",
      size: 1048576,
      mimeType: "application/pdf",
    };
    const alert = buildSuspiciousDownloadAlert(params);

    expect(alert.severity).toBe("high");
  });

  it("handles case-insensitive extensions", () => {
    const params: SuspiciousDownloadAlertParams = {
      domain: "example.com",
      downloadType: "executable",
      filename: "setup.MSI",
      extension: ".MSI",
      size: 1048576,
      mimeType: "application/octet-stream",
    };
    const alert = buildSuspiciousDownloadAlert(params);

    expect(alert.severity).toBe("critical");
  });

  it("handles empty extension", () => {
    const params: SuspiciousDownloadAlertParams = {
      domain: "example.com",
      downloadType: "file",
      filename: "unknown",
      extension: "",
      size: 100000,
      mimeType: "application/octet-stream",
    };
    const alert = buildSuspiciousDownloadAlert(params);

    expect(alert.severity).toBe("high");
  });
});

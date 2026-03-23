import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createAlertManager,
  createInMemoryAlertStore,
  type AlertStore,
} from "./alert-manager.js";
import type { SecurityAlert, AlertConfig } from "./types.js";

describe("createInMemoryAlertStore", () => {
  let store: AlertStore;

  beforeEach(() => {
    store = createInMemoryAlertStore();
  });

  describe("addAlert", () => {
    it("adds alert to store", async () => {
      const alert: SecurityAlert = {
        id: "test-1",
        category: "nrd",
        severity: "high",
        status: "new",
        title: "Test Alert",
        description: "Test description",
        domain: "example.com",
        timestamp: Date.now(),
        details: { type: "nrd", domainAge: 5, registrationDate: null, confidence: "high" },
        actions: [],
      };
      await store.addAlert(alert);
      const alerts = await store.getAlerts();
      expect(alerts.length).toBe(1);
      expect(alerts[0].id).toBe("test-1");
    });
  });

  describe("getAlerts", () => {
    it("returns alerts sorted by timestamp descending", async () => {
      await store.addAlert({
        id: "old",
        category: "nrd",
        severity: "high",
        status: "new",
        title: "Old",
        description: "Old",
        domain: "old.com",
        timestamp: 1000,
        details: { type: "nrd", domainAge: 5, registrationDate: null, confidence: "high" },
        actions: [],
      });
      await store.addAlert({
        id: "new",
        category: "nrd",
        severity: "high",
        status: "new",
        title: "New",
        description: "New",
        domain: "new.com",
        timestamp: 2000,
        details: { type: "nrd", domainAge: 5, registrationDate: null, confidence: "high" },
        actions: [],
      });
      const alerts = await store.getAlerts();
      expect(alerts[0].id).toBe("new");
      expect(alerts[1].id).toBe("old");
    });

    it("filters by status", async () => {
      await store.addAlert({
        id: "new-alert",
        category: "nrd",
        severity: "high",
        status: "new",
        title: "New",
        description: "New",
        domain: "new.com",
        timestamp: Date.now(),
        details: { type: "nrd", domainAge: 5, registrationDate: null, confidence: "high" },
        actions: [],
      });
      await store.addAlert({
        id: "ack-alert",
        category: "nrd",
        severity: "high",
        status: "acknowledged",
        title: "Ack",
        description: "Ack",
        domain: "ack.com",
        timestamp: Date.now(),
        details: { type: "nrd", domainAge: 5, registrationDate: null, confidence: "high" },
        actions: [],
      });
      const alerts = await store.getAlerts({ status: ["new"] });
      expect(alerts.length).toBe(1);
      expect(alerts[0].id).toBe("new-alert");
    });

    it("limits results", async () => {
      for (let i = 0; i < 5; i++) {
        await store.addAlert({
          id: `alert-${i}`,
          category: "nrd",
          severity: "high",
          status: "new",
          title: `Alert ${i}`,
          description: `Alert ${i}`,
          domain: `domain${i}.com`,
          timestamp: i,
          details: { type: "nrd", domainAge: 5, registrationDate: null, confidence: "high" },
          actions: [],
        });
      }
      const alerts = await store.getAlerts({ limit: 3 });
      expect(alerts.length).toBe(3);
    });
  });

  describe("updateAlert", () => {
    it("updates existing alert", async () => {
      await store.addAlert({
        id: "test",
        category: "nrd",
        severity: "high",
        status: "new",
        title: "Test",
        description: "Test",
        domain: "test.com",
        timestamp: Date.now(),
        details: { type: "nrd", domainAge: 5, registrationDate: null, confidence: "high" },
        actions: [],
      });
      await store.updateAlert("test", { status: "acknowledged" });
      const alerts = await store.getAlerts();
      expect(alerts[0].status).toBe("acknowledged");
    });

    it("does nothing for non-existent alert", async () => {
      await store.updateAlert("non-existent", { status: "acknowledged" });
      const alerts = await store.getAlerts();
      expect(alerts.length).toBe(0);
    });
  });

  describe("deleteAlert", () => {
    it("deletes alert", async () => {
      await store.addAlert({
        id: "test",
        category: "nrd",
        severity: "high",
        status: "new",
        title: "Test",
        description: "Test",
        domain: "test.com",
        timestamp: Date.now(),
        details: { type: "nrd", domainAge: 5, registrationDate: null, confidence: "high" },
        actions: [],
      });
      await store.deleteAlert("test");
      const alerts = await store.getAlerts();
      expect(alerts.length).toBe(0);
    });
  });

  describe("getAlertCount", () => {
    it("returns total count", async () => {
      await store.addAlert({
        id: "1",
        category: "nrd",
        severity: "high",
        status: "new",
        title: "1",
        description: "1",
        domain: "1.com",
        timestamp: Date.now(),
        details: { type: "nrd", domainAge: 5, registrationDate: null, confidence: "high" },
        actions: [],
      });
      await store.addAlert({
        id: "2",
        category: "nrd",
        severity: "high",
        status: "acknowledged",
        title: "2",
        description: "2",
        domain: "2.com",
        timestamp: Date.now(),
        details: { type: "nrd", domainAge: 5, registrationDate: null, confidence: "high" },
        actions: [],
      });
      expect(await store.getAlertCount()).toBe(2);
    });

    it("returns count filtered by status", async () => {
      await store.addAlert({
        id: "1",
        category: "nrd",
        severity: "high",
        status: "new",
        title: "1",
        description: "1",
        domain: "1.com",
        timestamp: Date.now(),
        details: { type: "nrd", domainAge: 5, registrationDate: null, confidence: "high" },
        actions: [],
      });
      await store.addAlert({
        id: "2",
        category: "nrd",
        severity: "high",
        status: "acknowledged",
        title: "2",
        description: "2",
        domain: "2.com",
        timestamp: Date.now(),
        details: { type: "nrd", domainAge: 5, registrationDate: null, confidence: "high" },
        actions: [],
      });
      expect(await store.getAlertCount(["new"])).toBe(1);
    });
  });
});

describe("createAlertManager", () => {
  describe("configuration", () => {
    it("creates manager with default config", () => {
      const manager = createAlertManager();
      expect(manager).toBeDefined();
    });

    it("creates manager with custom config", () => {
      const config: AlertConfig = {
        enabled: false,
        showNotifications: false,
        playSound: false,
        rules: [],
        severityFilter: ["critical"],
      };
      const manager = createAlertManager(config);
      expect(manager).toBeDefined();
    });

    it("does not create alert when disabled", async () => {
      const manager = createAlertManager({ enabled: false, showNotifications: false, playSound: false, rules: [], severityFilter: ["critical", "high"] });
      const alert = await manager.alertNRD({
        domain: "test.com",
        domainAge: 5,
        registrationDate: null,
        confidence: "high",
      });
      expect(alert).toBeNull();
    });
  });

  describe("severity filtering", () => {
    it("creates alert when severity matches filter", async () => {
      const manager = createAlertManager({
        enabled: true,
        showNotifications: false,
        playSound: false,
        rules: [],
        severityFilter: ["high"], // Only high to allow high severity alerts
      });
      const alert = await manager.alertNRD({
        domain: "test.com",
        domainAge: 5,
        registrationDate: null,
        confidence: "high",
      });
      expect(alert).not.toBeNull();
    });

    it("creates critical alert with default filter", async () => {
      const manager = createAlertManager({
        enabled: true,
        showNotifications: false,
        playSound: false,
        rules: [],
        severityFilter: ["critical", "high"], // Default - allows critical (min)
      });
      // Typosquat with high confidence is "critical"
      const alert = await manager.alertTyposquat({
        domain: "g00gle.com",
        targetDomain: "google.com",
        homoglyphCount: 2,
        confidence: "high",
      });
      expect(alert).not.toBeNull();
    });

    it("does not create alert when severity below filter", async () => {
      const manager = createAlertManager({
        enabled: true,
        showNotifications: false,
        playSound: false,
        rules: [],
        severityFilter: ["critical"],
      });
      // NRD with high confidence is "high" severity, not "critical"
      const alert = await manager.alertNRD({
        domain: "test.com",
        domainAge: 5,
        registrationDate: null,
        confidence: "high",
      });
      expect(alert).toBeNull();
    });
  });

  describe("alertNRD", () => {
    it("creates NRD alert with high confidence", async () => {
      const manager = createAlertManager({
        enabled: true,
        showNotifications: false,
        playSound: false,
        rules: [],
        severityFilter: ["high"],
      });
      const alert = await manager.alertNRD({
        domain: "suspicious.xyz",
        domainAge: 5,
        registrationDate: "2024-01-01",
        confidence: "high",
      });
      expect(alert).not.toBeNull();
      expect(alert?.category).toBe("nrd");
      expect(alert?.severity).toBe("high");
      expect(alert?.domain).toBe("suspicious.xyz");
      expect(alert?.title).toContain("suspicious.xyz");
    });

    it("creates NRD alert with medium confidence", async () => {
      const manager = createAlertManager({
        enabled: true,
        showNotifications: false,
        playSound: false,
        rules: [],
        severityFilter: ["medium"],
      });
      const alert = await manager.alertNRD({
        domain: "test.com",
        domainAge: 15,
        registrationDate: null,
        confidence: "medium",
      });
      expect(alert).not.toBeNull();
      expect(alert?.severity).toBe("medium");
    });

    it("handles null domain age", async () => {
      const manager = createAlertManager({
        enabled: true,
        showNotifications: false,
        playSound: false,
        rules: [],
        severityFilter: ["high"],
      });
      const alert = await manager.alertNRD({
        domain: "test.com",
        domainAge: null,
        registrationDate: null,
        confidence: "high",
      });
      expect(alert?.description).toContain("日数不明");
    });
  });

  describe("alertTyposquat", () => {
    it("creates typosquat alert with high confidence", async () => {
      const manager = createAlertManager({
        enabled: true,
        showNotifications: false,
        playSound: false,
        rules: [],
        severityFilter: ["critical"],
      });
      const alert = await manager.alertTyposquat({
        domain: "g00gle.com",
        targetDomain: "google.com",
        homoglyphCount: 2,
        confidence: "high",
      });
      expect(alert).not.toBeNull();
      expect(alert?.category).toBe("typosquat");
      expect(alert?.severity).toBe("critical");
    });

    it("creates typosquat alert with medium confidence", async () => {
      const manager = createAlertManager({
        enabled: true,
        showNotifications: false,
        playSound: false,
        rules: [],
        severityFilter: ["high"],
      });
      const alert = await manager.alertTyposquat({
        domain: "gogle.com",
        homoglyphCount: 0,
        confidence: "medium",
      });
      expect(alert?.severity).toBe("high");
    });

    it("does not create alert with no confidence", async () => {
      const manager = createAlertManager({
        enabled: true,
        showNotifications: false,
        playSound: false,
        rules: [],
        severityFilter: ["critical"],
      });
      const alert = await manager.alertTyposquat({
        domain: "example.com",
        homoglyphCount: 0,
        confidence: "none",
      });
      expect(alert).toBeNull();
    });
  });

  describe("alertAISensitive", () => {
    it("creates critical alert for credentials", async () => {
      const manager = createAlertManager({
        enabled: true,
        showNotifications: false,
        playSound: false,
        rules: [],
        severityFilter: ["critical"],
      });
      const alert = await manager.alertAISensitive({
        domain: "chat.openai.com",
        provider: "OpenAI",
        model: "gpt-4",
        dataTypes: ["credentials", "api_key"],
      });
      expect(alert?.severity).toBe("critical");
    });

    it("creates high alert for other sensitive data", async () => {
      const manager = createAlertManager({
        enabled: true,
        showNotifications: false,
        playSound: false,
        rules: [],
        severityFilter: ["high"],
      });
      const alert = await manager.alertAISensitive({
        domain: "chat.openai.com",
        provider: "OpenAI",
        dataTypes: ["email", "phone"],
      });
      expect(alert?.severity).toBe("high");
    });
  });

  describe("alertShadowAI", () => {
    it("creates alert for unknown AI service", async () => {
      const manager = createAlertManager({
        enabled: true,
        showNotifications: false,
        playSound: false,
        rules: [],
        severityFilter: ["high"],
      });
      const alert = await manager.alertShadowAI({
        domain: "unknown-ai.com",
        provider: "unknown",
        providerDisplayName: "Unknown AI",
        category: "specialized",
        riskLevel: "high",
        confidence: "high",
      });
      expect(alert?.severity).toBe("high");
      expect(alert?.title).toContain("未知のAIサービス");
    });

    it("creates alert for regional AI service", async () => {
      const manager = createAlertManager({
        enabled: true,
        showNotifications: false,
        playSound: false,
        rules: [],
        severityFilter: ["medium"],
      });
      const alert = await manager.alertShadowAI({
        domain: "deepseek.com",
        provider: "deepseek",
        providerDisplayName: "DeepSeek",
        category: "regional",
        riskLevel: "medium",
        confidence: "high",
      });
      expect(alert?.title).toContain("Shadow AI");
    });
  });

  describe("alertExtension", () => {
    it("creates critical alert for critical risk level", async () => {
      const manager = createAlertManager({
        enabled: true,
        showNotifications: false,
        playSound: false,
        rules: [],
        severityFilter: ["critical"],
      });
      const alert = await manager.alertExtension({
        extensionId: "abc123",
        extensionName: "Malicious Extension",
        riskLevel: "critical",
        riskScore: 95,
        flags: ["excessive_permissions", "network_activity"],
        requestCount: 1000,
        targetDomains: ["evil.com"],
      });
      expect(alert?.severity).toBe("critical");
      expect(alert?.domain).toBe("chrome-extension://abc123");
    });

    it("creates low alert for low risk level", async () => {
      const manager = createAlertManager({
        enabled: true,
        showNotifications: false,
        playSound: false,
        rules: [],
        severityFilter: ["low"],
      });
      const alert = await manager.alertExtension({
        extensionId: "xyz789",
        extensionName: "Safe Extension",
        riskLevel: "low",
        riskScore: 10,
        flags: [],
        requestCount: 10,
        targetDomains: [],
      });
      expect(alert?.severity).toBe("low");
    });
  });

  describe("alertDataExfiltration", () => {
    it("creates critical alert for large data transfer", async () => {
      const manager = createAlertManager({
        enabled: true,
        showNotifications: false,
        playSound: false,
        rules: [],
        severityFilter: ["critical"],
      });
      const alert = await manager.alertDataExfiltration({
        sourceDomain: "internal.company.com",
        targetDomain: "external.com",
        bodySize: 600 * 1024, // 600KB
        method: "POST",
        initiator: "fetch",
      });
      expect(alert?.severity).toBe("critical");
    });

    it("creates high alert for smaller data transfer", async () => {
      const manager = createAlertManager({
        enabled: true,
        showNotifications: false,
        playSound: false,
        rules: [],
        severityFilter: ["high"],
      });
      const alert = await manager.alertDataExfiltration({
        sourceDomain: "internal.company.com",
        targetDomain: "external.com",
        bodySize: 200 * 1024, // 200KB
        method: "POST",
        initiator: "fetch",
      });
      expect(alert?.severity).toBe("high");
    });
  });

  describe("alertCredentialTheft", () => {
    it("creates critical alert for insecure protocol", async () => {
      const manager = createAlertManager({
        enabled: true,
        showNotifications: false,
        playSound: false,
        rules: [],
        severityFilter: ["critical"],
      });
      const alert = await manager.alertCredentialTheft({
        sourceDomain: "mysite.com",
        targetDomain: "phishing.com",
        formAction: "http://phishing.com/login",
        isSecure: false,
        isCrossOrigin: true,
        fieldType: "password",
        risks: ["insecure_protocol", "cross_origin"],
      });
      expect(alert?.severity).toBe("critical");
    });

    it("creates high alert for cross-origin only", async () => {
      const manager = createAlertManager({
        enabled: true,
        showNotifications: false,
        playSound: false,
        rules: [],
        severityFilter: ["high"],
      });
      const alert = await manager.alertCredentialTheft({
        sourceDomain: "mysite.com",
        targetDomain: "auth.mysite.com",
        formAction: "https://auth.mysite.com/login",
        isSecure: true,
        isCrossOrigin: true,
        fieldType: "password",
        risks: ["cross_origin"],
      });
      expect(alert?.severity).toBe("high");
    });
  });

  describe("alertSupplyChainRisk", () => {
    it("creates high alert for CDN without SRI", async () => {
      const manager = createAlertManager({
        enabled: true,
        showNotifications: false,
        playSound: false,
        rules: [],
        severityFilter: ["high"],
      });
      const alert = await manager.alertSupplyChainRisk({
        pageDomain: "mysite.com",
        resourceUrl: "https://cdn.example.com/lib.js",
        resourceDomain: "cdn.example.com",
        resourceType: "script",
        hasIntegrity: false,
        hasCrossorigin: false,
        isCDN: true,
        risks: ["no_sri", "cdn"],
      });
      expect(alert?.severity).toBe("high");
    });

    it("creates medium alert for non-CDN without SRI", async () => {
      const manager = createAlertManager({
        enabled: true,
        showNotifications: false,
        playSound: false,
        rules: [],
        severityFilter: ["medium"],
      });
      const alert = await manager.alertSupplyChainRisk({
        pageDomain: "mysite.com",
        resourceUrl: "https://partner.com/lib.js",
        resourceDomain: "partner.com",
        resourceType: "script",
        hasIntegrity: false,
        hasCrossorigin: true,
        isCDN: false,
        risks: ["no_sri"],
      });
      expect(alert?.severity).toBe("medium");
    });
  });

  describe("alertCompliance", () => {
    it("creates high alert for login without privacy policy", async () => {
      const manager = createAlertManager({
        enabled: true,
        showNotifications: false,
        playSound: false,
        rules: [],
        severityFilter: ["high"],
      });
      const alert = await manager.alertCompliance({
        pageDomain: "suspicious.com",
        hasPrivacyPolicy: false,
        hasTermsOfService: true,
        hasCookiePolicy: true,
        hasCookieBanner: true,
        isCookieBannerGDPRCompliant: true,
        hasLoginForm: true,
      });
      expect(alert?.severity).toBe("high");
      expect(alert?.description).toContain("プライバシーポリシーなし");
    });

    it("creates medium alert for missing cookie policy", async () => {
      const manager = createAlertManager({
        enabled: true,
        showNotifications: false,
        playSound: false,
        rules: [],
        severityFilter: ["medium"],
      });
      const alert = await manager.alertCompliance({
        pageDomain: "site.com",
        hasPrivacyPolicy: true,
        hasTermsOfService: true,
        hasCookiePolicy: false,
        hasCookieBanner: true,
        isCookieBannerGDPRCompliant: true,
        hasLoginForm: false,
      });
      expect(alert?.severity).toBe("medium");
    });

    it("does not create alert when compliant", async () => {
      const manager = createAlertManager({
        enabled: true,
        showNotifications: false,
        playSound: false,
        rules: [],
        severityFilter: ["high"],
      });
      const alert = await manager.alertCompliance({
        pageDomain: "compliant.com",
        hasPrivacyPolicy: true,
        hasTermsOfService: true,
        hasCookiePolicy: true,
        hasCookieBanner: true,
        isCookieBannerGDPRCompliant: true,
        hasLoginForm: true,
      });
      expect(alert).toBeNull();
    });
  });

  describe("alertPolicyViolation", () => {
    it("creates high alert for block action", async () => {
      const manager = createAlertManager({
        enabled: true,
        showNotifications: false,
        playSound: false,
        rules: [],
        severityFilter: ["high"],
      });
      const alert = await manager.alertPolicyViolation({
        domain: "blocked.com",
        ruleId: "rule-1",
        ruleName: "Block Social Media",
        ruleType: "domain",
        action: "block",
        matchedPattern: "*.social.com",
        target: "social.com",
      });
      expect(alert?.severity).toBe("high");
      expect(alert?.title).toContain("ブロック");
    });

    it("creates medium alert for warn action", async () => {
      const manager = createAlertManager({
        enabled: true,
        showNotifications: false,
        playSound: false,
        rules: [],
        severityFilter: ["medium"],
      });
      const alert = await manager.alertPolicyViolation({
        domain: "warned.com",
        ruleId: "rule-2",
        ruleName: "Warn on AI Usage",
        ruleType: "ai",
        action: "warn",
        matchedPattern: "*",
        target: "chatgpt.com",
      });
      expect(alert?.severity).toBe("medium");
      expect(alert?.title).toContain("警告");
    });

    it("does not create alert for allow action", async () => {
      const manager = createAlertManager({
        enabled: true,
        showNotifications: false,
        playSound: false,
        rules: [],
        severityFilter: ["high"],
      });
      const alert = await manager.alertPolicyViolation({
        domain: "allowed.com",
        ruleId: "rule-3",
        ruleName: "Allow Internal",
        ruleType: "domain",
        action: "allow",
        matchedPattern: "*.company.com",
        target: "internal.company.com",
      });
      expect(alert).toBeNull();
    });
  });

  describe("alert lifecycle", () => {
    it("updates alert status", async () => {
      const manager = createAlertManager({
        enabled: true,
        showNotifications: false,
        playSound: false,
        rules: [],
        severityFilter: ["high"],
      });
      const alert = await manager.alertNRD({
        domain: "test.com",
        domainAge: 5,
        registrationDate: null,
        confidence: "high",
      });
      await manager.updateAlertStatus(alert!.id, "acknowledged");
      const alerts = await manager.getAlerts();
      expect(alerts.find((a) => a.id === alert!.id)?.status).toBe("acknowledged");
    });

    it("acknowledges all new alerts", async () => {
      const manager = createAlertManager({
        enabled: true,
        showNotifications: false,
        playSound: false,
        rules: [],
        severityFilter: ["high"],
      });
      await manager.alertNRD({ domain: "a.com", domainAge: 1, registrationDate: null, confidence: "high" });
      await manager.alertNRD({ domain: "b.com", domainAge: 2, registrationDate: null, confidence: "high" });
      await manager.acknowledgeAll();
      const alerts = await manager.getAlerts();
      expect(alerts.every((a) => a.status === "acknowledged")).toBe(true);
    });

    it("clears resolved alerts", async () => {
      const store = createInMemoryAlertStore();
      const manager = createAlertManager({
        enabled: true,
        showNotifications: false,
        playSound: false,
        rules: [],
        severityFilter: ["high"],
      }, store);
      const alert = await manager.alertNRD({ domain: "a.com", domainAge: 1, registrationDate: null, confidence: "high" });
      await manager.updateAlertStatus(alert!.id, "resolved");
      await manager.clearResolved();
      const alerts = await manager.getAlerts();
      expect(alerts.length).toBe(0);
    });
  });

  describe("subscriptions", () => {
    it("notifies listeners on new alert", async () => {
      const manager = createAlertManager({
        enabled: true,
        showNotifications: false,
        playSound: false,
        rules: [],
        severityFilter: ["high"],
      });
      const listener = vi.fn();
      manager.subscribe(listener);
      await manager.alertNRD({ domain: "test.com", domainAge: 1, registrationDate: null, confidence: "high" });
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].domain).toBe("test.com");
    });

    it("allows unsubscribing", async () => {
      const manager = createAlertManager({
        enabled: true,
        showNotifications: false,
        playSound: false,
        rules: [],
        severityFilter: ["high"],
      });
      const listener = vi.fn();
      const unsubscribe = manager.subscribe(listener);
      unsubscribe();
      await manager.alertNRD({ domain: "test.com", domainAge: 1, registrationDate: null, confidence: "high" });
      expect(listener).not.toHaveBeenCalled();
    });

    it("handles listener errors gracefully", async () => {
      const manager = createAlertManager({
        enabled: true,
        showNotifications: false,
        playSound: false,
        rules: [],
        severityFilter: ["high"],
      });
      const errorListener = vi.fn(() => {
        throw new Error("Listener error");
      });
      const normalListener = vi.fn();
      manager.subscribe(errorListener);
      manager.subscribe(normalListener);
      await manager.alertNRD({ domain: "test.com", domainAge: 1, registrationDate: null, confidence: "high" });
      expect(normalListener).toHaveBeenCalledTimes(1);
    });
  });

  describe("getAlerts and getAlertCount", () => {
    it("returns alerts with options", async () => {
      const manager = createAlertManager({
        enabled: true,
        showNotifications: false,
        playSound: false,
        rules: [],
        severityFilter: ["high"],
      });
      await manager.alertNRD({ domain: "a.com", domainAge: 1, registrationDate: null, confidence: "high" });
      await manager.alertNRD({ domain: "b.com", domainAge: 2, registrationDate: null, confidence: "high" });
      const alerts = await manager.getAlerts({ limit: 1 });
      expect(alerts.length).toBe(1);
    });

    it("returns alert count", async () => {
      const manager = createAlertManager({
        enabled: true,
        showNotifications: false,
        playSound: false,
        rules: [],
        severityFilter: ["high"],
      });
      await manager.alertNRD({ domain: "a.com", domainAge: 1, registrationDate: null, confidence: "high" });
      await manager.alertNRD({ domain: "b.com", domainAge: 2, registrationDate: null, confidence: "high" });
      const count = await manager.getAlertCount();
      expect(count).toBe(2);
    });

    it("returns alert count by status", async () => {
      const manager = createAlertManager({
        enabled: true,
        showNotifications: false,
        playSound: false,
        rules: [],
        severityFilter: ["high"],
      });
      const alert1 = await manager.alertNRD({ domain: "a.com", domainAge: 1, registrationDate: null, confidence: "high" });
      await manager.alertNRD({ domain: "b.com", domainAge: 2, registrationDate: null, confidence: "high" });
      await manager.updateAlertStatus(alert1!.id, "acknowledged");
      const newCount = await manager.getAlertCount(["new"]);
      expect(newCount).toBe(1);
    });
  });
});

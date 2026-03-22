import { describe, expect, it } from "vitest";
import {
  THREAT_EVENT_TYPES,
  getEventBadgeVariant,
  getEventColor,
  getEventLabel,
  getThreatNotification,
  isThreatEventType,
} from "./events";

describe("getEventLabel", () => {
  it("returns Japanese label for known type", () => {
    expect(getEventLabel("login_detected")).toBe("ログイン検出");
    expect(getEventLabel("csp_violation")).toBe("CSP違反");
  });

  it("returns type string itself for unknown type", () => {
    expect(getEventLabel("unknown_event")).toBe("unknown_event");
  });
});

describe("getEventColor", () => {
  it("returns hex color for known type", () => {
    expect(getEventColor("login_detected")).toBe("#3b82f6");
    expect(getEventColor("csp_violation")).toBe("#ef4444");
  });

  it("returns undefined for unknown type", () => {
    expect(getEventColor("unknown_event")).toBeUndefined();
  });
});

describe("getEventBadgeVariant", () => {
  it('returns "danger" for violation types', () => {
    expect(getEventBadgeVariant("csp_violation")).toBe("danger");
  });

  it('returns "danger" for nrd types', () => {
    expect(getEventBadgeVariant("nrd_detected")).toBe("danger");
  });

  it('returns "warning" for ai types', () => {
    expect(getEventBadgeVariant("ai_prompt_sent")).toBe("warning");
  });

  it('returns "warning" for login types', () => {
    expect(getEventBadgeVariant("login_detected")).toBe("warning");
  });

  it('returns "default" for other types', () => {
    expect(getEventBadgeVariant("network_request")).toBe("default");
  });
});

describe("isThreatEventType", () => {
  it.each([...THREAT_EVENT_TYPES])("returns true for %s", (type) => {
    expect(isThreatEventType(type)).toBe(true);
  });

  it("returns false for non-threat types", () => {
    expect(isThreatEventType("login_detected")).toBe(false);
    expect(isThreatEventType("network_request")).toBe(false);
  });
});

describe("getThreatNotification", () => {
  it("returns notification object for threat types", () => {
    const result = getThreatNotification("nrd_detected");
    expect(result).toEqual({ severity: "warning", title: "新規登録ドメイン検出" });
  });

  it("returns critical severity for data exfiltration", () => {
    const result = getThreatNotification("DATA_EXFILTRATION_DETECTED");
    expect(result).toEqual({ severity: "critical", title: "データ漏洩の可能性" });
  });

  it("returns null for non-threat types", () => {
    expect(getThreatNotification("login_detected")).toBeNull();
    expect(getThreatNotification("unknown")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  detectBulkRequests,
  detectLateNightActivity,
  detectEncodedParameters,
  detectDomainDiversity,
  detectAllSuspiciousPatterns,
  DEFAULT_SUSPICIOUS_PATTERN_CONFIG,
} from "./suspicious-pattern-detector.js";
import type { ExtensionRequestRecord } from "./storage-types.js";

function createRecord(
  overrides: Partial<ExtensionRequestRecord> = {}
): ExtensionRequestRecord {
  return {
    id: `record-${Math.random().toString(36).substr(2, 9)}`,
    extensionId: "ext-1",
    extensionName: "Test Extension",
    timestamp: Date.now(),
    url: "https://example.com/api",
    method: "GET",
    resourceType: "fetch",
    domain: "example.com",
    ...overrides,
  };
}

describe("suspicious-pattern-detector", () => {
  describe("detectBulkRequests", () => {
    it("detects bulk requests when threshold is exceeded", () => {
      const now = Date.now();
      const config = { ...DEFAULT_SUSPICIOUS_PATTERN_CONFIG };

      // 60リクエストを1分以内に生成（閾値50を超える）
      const records: ExtensionRequestRecord[] = [];
      for (let i = 0; i < 60; i++) {
        records.push(
          createRecord({
            timestamp: now + i * 500, // 500ms間隔 = 1分で60件
          })
        );
      }

      const patterns = detectBulkRequests(records, config);

      expect(patterns.length).toBe(1);
      expect(patterns[0].type).toBe("bulk_requests");
      expect(patterns[0].severity).toBe("high");
      expect(patterns[0].details.requestCount).toBeGreaterThanOrEqual(50);
    });

    it("does not detect when below threshold", () => {
      const now = Date.now();
      const config = { ...DEFAULT_SUSPICIOUS_PATTERN_CONFIG };

      // 30リクエスト（閾値50未満）
      const records: ExtensionRequestRecord[] = [];
      for (let i = 0; i < 30; i++) {
        records.push(
          createRecord({
            timestamp: now + i * 1000,
          })
        );
      }

      const patterns = detectBulkRequests(records, config);

      expect(patterns.length).toBe(0);
    });

    it("marks as critical when double threshold is exceeded", () => {
      const now = Date.now();
      const config = { ...DEFAULT_SUSPICIOUS_PATTERN_CONFIG };

      // 110リクエスト（閾値50の2倍超）
      const records: ExtensionRequestRecord[] = [];
      for (let i = 0; i < 110; i++) {
        records.push(
          createRecord({
            timestamp: now + i * 200, // 200ms間隔
          })
        );
      }

      const patterns = detectBulkRequests(records, config);

      expect(patterns.length).toBe(1);
      expect(patterns[0].severity).toBe("critical");
    });
  });

  describe("detectLateNightActivity", () => {
    it("detects late night activity (2:00-5:00)", () => {
      const config = { ...DEFAULT_SUSPICIOUS_PATTERN_CONFIG };

      // 深夜3時のタイムスタンプを作成
      const lateNightDate = new Date();
      lateNightDate.setHours(3, 0, 0, 0);

      const records: ExtensionRequestRecord[] = [];
      for (let i = 0; i < 5; i++) {
        records.push(
          createRecord({
            timestamp: lateNightDate.getTime() + i * 60000,
          })
        );
      }

      const patterns = detectLateNightActivity(records, config);

      expect(patterns.length).toBe(1);
      expect(patterns[0].type).toBe("late_night_activity");
      expect(patterns[0].details.requestCount).toBe(5);
    });

    it("does not detect daytime activity", () => {
      const config = { ...DEFAULT_SUSPICIOUS_PATTERN_CONFIG };

      // 日中10時のタイムスタンプ（深夜時間帯2:00-5:00の外）
      const daytimeDate = new Date();
      daytimeDate.setHours(10, 0, 0, 0);

      const records: ExtensionRequestRecord[] = [];
      for (let i = 0; i < 10; i++) {
        records.push(
          createRecord({
            timestamp: daytimeDate.getTime() + i * 60000,
          })
        );
      }

      const patterns = detectLateNightActivity(records, config);

      expect(patterns.length).toBe(0);
    });

    it("requires at least 3 requests for detection", () => {
      const config = { ...DEFAULT_SUSPICIOUS_PATTERN_CONFIG };

      const lateNightDate = new Date();
      lateNightDate.setHours(3, 0, 0, 0);

      const records: ExtensionRequestRecord[] = [
        createRecord({ timestamp: lateNightDate.getTime() }),
        createRecord({ timestamp: lateNightDate.getTime() + 1000 }),
      ];

      const patterns = detectLateNightActivity(records, config);

      expect(patterns.length).toBe(0);
    });
  });

  describe("detectEncodedParameters", () => {
    it("detects base64 encoded parameters", () => {
      const config = { ...DEFAULT_SUSPICIOUS_PATTERN_CONFIG };

      // 有効なbase64パラメータ（20文字以上、4の倍数）
      const base64Value = "SGVsbG9Xb3JsZFRlc3REYXRhMTIzNDU2Nzg5MA=="; // 40文字
      const records: ExtensionRequestRecord[] = [
        createRecord({
          url: `https://example.com/api?data=${base64Value}`,
        }),
      ];

      const patterns = detectEncodedParameters(records, config);

      expect(patterns.length).toBe(1);
      expect(patterns[0].type).toBe("encoded_params");
      expect(patterns[0].severity).toBe("high");
      expect(patterns[0].details.parameterKey).toBe("data");
    });

    it("detects abnormally long parameters", () => {
      const config = { ...DEFAULT_SUSPICIOUS_PATTERN_CONFIG };

      // 600文字のパラメータ（閾値500超、base64ではない文字を含む）
      const longValue = "hello_world_test_".repeat(36); // 612文字、base64ではない
      const records: ExtensionRequestRecord[] = [
        createRecord({
          url: `https://example.com/api?payload=${longValue}`,
        }),
      ];

      const patterns = detectEncodedParameters(records, config);

      expect(patterns.length).toBe(1);
      expect(patterns[0].type).toBe("encoded_params");
      expect(patterns[0].severity).toBe("medium");
      expect(patterns[0].details.parameterLength).toBe(612);
    });

    it("does not detect short normal parameters", () => {
      const config = { ...DEFAULT_SUSPICIOUS_PATTERN_CONFIG };

      const records: ExtensionRequestRecord[] = [
        createRecord({
          url: "https://example.com/api?page=1&sort=name",
        }),
      ];

      const patterns = detectEncodedParameters(records, config);

      expect(patterns.length).toBe(0);
    });
  });

  describe("detectDomainDiversity", () => {
    it("detects high domain diversity (DGA possibility)", () => {
      const now = Date.now();
      const config = { ...DEFAULT_SUSPICIOUS_PATTERN_CONFIG };

      // 10分以内に12個の異なるドメインへアクセス
      const records: ExtensionRequestRecord[] = [];
      for (let i = 0; i < 12; i++) {
        records.push(
          createRecord({
            timestamp: now + i * 10000, // 10秒間隔
            url: `https://domain${i}.com/api`,
            domain: `domain${i}.com`,
          })
        );
      }

      const patterns = detectDomainDiversity(records, config);

      expect(patterns.length).toBe(1);
      expect(patterns[0].type).toBe("domain_diversity");
      expect(patterns[0].severity).toBe("high");
      expect(patterns[0].details.uniqueDomainCount).toBeGreaterThanOrEqual(10);
    });

    it("does not detect when domain count is below threshold", () => {
      const now = Date.now();
      const config = { ...DEFAULT_SUSPICIOUS_PATTERN_CONFIG };

      // 5個のドメインへアクセス（閾値10未満）
      const records: ExtensionRequestRecord[] = [];
      for (let i = 0; i < 5; i++) {
        records.push(
          createRecord({
            timestamp: now + i * 1000,
            url: `https://domain${i}.com/api`,
            domain: `domain${i}.com`,
          })
        );
      }

      const patterns = detectDomainDiversity(records, config);

      expect(patterns.length).toBe(0);
    });

    it("does not detect when same domain is accessed multiple times", () => {
      const now = Date.now();
      const config = { ...DEFAULT_SUSPICIOUS_PATTERN_CONFIG };

      // 同じドメインに20回アクセス
      const records: ExtensionRequestRecord[] = [];
      for (let i = 0; i < 20; i++) {
        records.push(
          createRecord({
            timestamp: now + i * 1000,
            url: "https://example.com/api",
            domain: "example.com",
          })
        );
      }

      const patterns = detectDomainDiversity(records, config);

      expect(patterns.length).toBe(0);
    });
  });

  describe("detectAllSuspiciousPatterns", () => {
    it("combines all detection results", () => {
      const now = Date.now();
      const config = { ...DEFAULT_SUSPICIOUS_PATTERN_CONFIG };

      // 深夜3時のタイムスタンプ
      const lateNightDate = new Date();
      lateNightDate.setHours(3, 0, 0, 0);

      const records: ExtensionRequestRecord[] = [
        // 深夜アクセス
        createRecord({
          timestamp: lateNightDate.getTime(),
          extensionId: "ext-night",
          extensionName: "Night Extension",
        }),
        createRecord({
          timestamp: lateNightDate.getTime() + 1000,
          extensionId: "ext-night",
          extensionName: "Night Extension",
        }),
        createRecord({
          timestamp: lateNightDate.getTime() + 2000,
          extensionId: "ext-night",
          extensionName: "Night Extension",
        }),
        // Base64パラメータ
        createRecord({
          timestamp: now,
          extensionId: "ext-b64",
          extensionName: "Base64 Extension",
          url: "https://example.com/api?data=SGVsbG9Xb3JsZFRlc3REYXRhMTIzNDU2Nzg5MA==",
        }),
      ];

      const patterns = detectAllSuspiciousPatterns(records, config);

      expect(patterns.length).toBeGreaterThanOrEqual(2);
      const types = patterns.map((p) => p.type);
      expect(types).toContain("late_night_activity");
      expect(types).toContain("encoded_params");
    });

    it("returns empty array when no suspicious patterns found", () => {
      const config = { ...DEFAULT_SUSPICIOUS_PATTERN_CONFIG };

      const records: ExtensionRequestRecord[] = [
        createRecord({
          url: "https://example.com/api?page=1",
        }),
      ];

      const patterns = detectAllSuspiciousPatterns(records, config);

      expect(patterns.length).toBe(0);
    });
  });
});

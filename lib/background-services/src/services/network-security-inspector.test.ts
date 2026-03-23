import { describe, expect, it, vi } from "vitest";
import {
  createNetworkSecurityInspector,
  detectSensitiveData,
} from "./network-security-inspector.js";

describe("createNetworkSecurityInspector", () => {
  it("閾値超過でデータ漏洩判定を返す", async () => {
    const handleDataExfiltration = vi.fn(async () => ({ success: true }));
    const handleTrackingBeacon = vi.fn(async () => ({ success: true }));
    const inspector = createNetworkSecurityInspector({
      handleDataExfiltration,
      handleTrackingBeacon,
    });

    const result = await inspector.handleNetworkInspection({
      pageUrl: "https://example.com/page",
      url: "/api/upload",
      method: "POST",
      initiator: "fetch",
      bodySize: 12 * 1024,
      bodySample: "",
      timestamp: 1700000000000,
    }, {} as chrome.runtime.MessageSender);

    expect(result.success).toBe(true);
    expect(result.detected).toBe(1);
    expect(handleDataExfiltration).toHaveBeenCalledTimes(1);
    expect(handleTrackingBeacon).not.toHaveBeenCalled();
    expect(handleDataExfiltration.mock.calls[0][0]).toMatchObject({
      targetUrl: "https://example.com/api/upload",
      targetDomain: "example.com",
      method: "POST",
      bodySize: 12 * 1024,
    });
  });

  it("機密文字列でデータ漏洩判定を返す", async () => {
    const handleDataExfiltration = vi.fn(async () => ({ success: true }));
    const handleTrackingBeacon = vi.fn(async () => ({ success: true }));
    const inspector = createNetworkSecurityInspector({
      handleDataExfiltration,
      handleTrackingBeacon,
    });

    const result = await inspector.handleNetworkInspection({
      pageUrl: "https://example.com",
      url: "https://api.example.net/submit",
      method: "POST",
      initiator: "xhr",
      bodySize: 512,
      bodySample: "{\"password\":\"secret123\"}",
      timestamp: 1700000001000,
    }, {} as chrome.runtime.MessageSender);

    expect(result.success).toBe(true);
    expect(result.detected).toBe(1);
    expect(handleDataExfiltration).toHaveBeenCalledTimes(1);
    expect(handleTrackingBeacon).not.toHaveBeenCalled();
    expect(handleDataExfiltration.mock.calls[0][0]).toMatchObject({
      targetDomain: "api.example.net",
      sensitiveDataTypes: ["password"],
    });
  });

  it("tracking beacon を判定する", async () => {
    const handleDataExfiltration = vi.fn(async () => ({ success: true }));
    const handleTrackingBeacon = vi.fn(async () => ({ success: true }));
    const inspector = createNetworkSecurityInspector({
      handleDataExfiltration,
      handleTrackingBeacon,
    });

    const result = await inspector.handleNetworkInspection({
      pageUrl: "https://example.com",
      url: "https://analytics.example.net/collect",
      method: "POST",
      initiator: "sendBeacon",
      bodySize: 128,
      bodySample: "{\"event\":\"pageview\"}",
      timestamp: 1700000002000,
    }, {} as chrome.runtime.MessageSender);

    expect(result.success).toBe(true);
    expect(result.detected).toBe(1);
    expect(handleTrackingBeacon).toHaveBeenCalledTimes(1);
    expect(handleDataExfiltration).not.toHaveBeenCalled();
    expect(handleTrackingBeacon.mock.calls[0][0]).toMatchObject({
      url: "https://analytics.example.net/collect",
      targetDomain: "analytics.example.net",
    });
  });

  it("GET は検査しても検知しない", async () => {
    const handleDataExfiltration = vi.fn(async () => ({ success: true }));
    const handleTrackingBeacon = vi.fn(async () => ({ success: true }));
    const inspector = createNetworkSecurityInspector({
      handleDataExfiltration,
      handleTrackingBeacon,
    });

    const result = await inspector.handleNetworkInspection({
      pageUrl: "https://example.com",
      url: "/api/data",
      method: "GET",
      initiator: "fetch",
      bodySize: 0,
    }, {} as chrome.runtime.MessageSender);

    expect(result).toEqual({ success: true, detected: 0 });
    expect(handleDataExfiltration).not.toHaveBeenCalled();
    expect(handleTrackingBeacon).not.toHaveBeenCalled();
  });

  it("GET でも tracking beacon は判定する", async () => {
    const handleDataExfiltration = vi.fn(async () => ({ success: true }));
    const handleTrackingBeacon = vi.fn(async () => ({ success: true }));
    const inspector = createNetworkSecurityInspector({
      handleDataExfiltration,
      handleTrackingBeacon,
    });

    const result = await inspector.handleNetworkInspection({
      pageUrl: "https://example.com",
      url: "/analytics/collect",
      method: "GET",
      initiator: "img",
      bodySize: 0,
      bodySample: "",
    }, {} as chrome.runtime.MessageSender);

    expect(result.success).toBe(true);
    expect(result.detected).toBe(1);
    expect(handleDataExfiltration).not.toHaveBeenCalled();
    expect(handleTrackingBeacon).toHaveBeenCalledTimes(1);
    expect(handleTrackingBeacon.mock.calls[0][0]).toMatchObject({
      url: "https://example.com/analytics/collect",
      targetDomain: "example.com",
      initiator: "img",
    });
  });

  it("不正な payload は失敗を返す", async () => {
    const inspector = createNetworkSecurityInspector({
      handleDataExfiltration: async () => ({ success: true }),
      handleTrackingBeacon: async () => ({ success: true }),
    });

    const result = await inspector.handleNetworkInspection(null, {} as chrome.runtime.MessageSender);
    expect(result).toEqual({ success: false, reason: "invalid_data" });
  });

  it("url が欠落している場合 missing_url_or_page を返す", async () => {
    const inspector = createNetworkSecurityInspector({
      handleDataExfiltration: async () => ({ success: true }),
      handleTrackingBeacon: async () => ({ success: true }),
    });

    const result = await inspector.handleNetworkInspection(
      { pageUrl: "https://example.com", method: "GET", initiator: "fetch" },
      {} as chrome.runtime.MessageSender,
    );
    expect(result).toEqual({ success: false, reason: "missing_url_or_page" });
  });

  it("pageUrl が欠落している場合 missing_url_or_page を返す", async () => {
    const inspector = createNetworkSecurityInspector({
      handleDataExfiltration: async () => ({ success: true }),
      handleTrackingBeacon: async () => ({ success: true }),
    });

    const result = await inspector.handleNetworkInspection(
      { url: "/api/data", method: "GET", initiator: "fetch" },
      {} as chrome.runtime.MessageSender,
    );
    expect(result).toEqual({ success: false, reason: "missing_url_or_page" });
  });

  it("HEAD リクエストはデータ漏洩を検知しない", async () => {
    const handleDataExfiltration = vi.fn(async () => ({ success: true }));
    const handleTrackingBeacon = vi.fn(async () => ({ success: true }));
    const inspector = createNetworkSecurityInspector({
      handleDataExfiltration,
      handleTrackingBeacon,
    });

    const result = await inspector.handleNetworkInspection({
      pageUrl: "https://example.com",
      url: "/api/data",
      method: "HEAD",
      initiator: "fetch",
      bodySize: 20 * 1024,
    }, {} as chrome.runtime.MessageSender);

    expect(result).toEqual({ success: true, detected: 0 });
    expect(handleDataExfiltration).not.toHaveBeenCalled();
  });

  it("tracking beacon とデータ漏洩を同時に検知する", async () => {
    const handleDataExfiltration = vi.fn(async () => ({ success: true }));
    const handleTrackingBeacon = vi.fn(async () => ({ success: true }));
    const inspector = createNetworkSecurityInspector({
      handleDataExfiltration,
      handleTrackingBeacon,
    });

    const result = await inspector.handleNetworkInspection({
      pageUrl: "https://example.com",
      url: "https://tracking.example.net/collect",
      method: "POST",
      initiator: "fetch",
      bodySize: 512,
      bodySample: '{"token": "secret_tok_123", "event": "click"}',
      timestamp: 1700000003000,
    }, {} as chrome.runtime.MessageSender);

    expect(result.success).toBe(true);
    expect(result.detected).toBe(2);
    expect(handleTrackingBeacon).toHaveBeenCalledTimes(1);
    expect(handleDataExfiltration).toHaveBeenCalledTimes(1);
  });

  it("同一リクエストをキャッシュして再利用する", async () => {
    const handleTrackingBeacon = vi.fn(async () => ({ success: true }));
    const inspector = createNetworkSecurityInspector({
      handleDataExfiltration: async () => ({ success: true }),
      handleTrackingBeacon,
    });

    const request = {
      pageUrl: "https://example.com",
      url: "https://analytics.example.net/pixel",
      method: "GET",
      initiator: "img",
      bodySize: 0,
      bodySample: "",
    };
    const sender = {} as chrome.runtime.MessageSender;

    await inspector.handleNetworkInspection(request, sender);
    await inspector.handleNetworkInspection(request, sender);

    // Both calls should trigger the handler because cached outcome still fires handlers
    expect(handleTrackingBeacon).toHaveBeenCalledTimes(2);
  });

  it("method が空文字列の場合 GET として正規化される", async () => {
    const handleDataExfiltration = vi.fn(async () => ({ success: true }));
    const inspector = createNetworkSecurityInspector({
      handleDataExfiltration,
      handleTrackingBeacon: async () => ({ success: true }),
    });

    const result = await inspector.handleNetworkInspection({
      pageUrl: "https://example.com",
      url: "/api/data",
      method: "",
      initiator: "fetch",
      bodySize: 20 * 1024,
      bodySample: "",
    }, {} as chrome.runtime.MessageSender);

    // Empty method normalized to GET, so no exfiltration detection
    expect(handleDataExfiltration).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it("不正な相対URLで pageUrl が無効な場合 detected: 0 を返す", async () => {
    const inspector = createNetworkSecurityInspector({
      handleDataExfiltration: async () => ({ success: true }),
      handleTrackingBeacon: async () => ({ success: true }),
    });

    const result = await inspector.handleNetworkInspection({
      pageUrl: "not-a-valid-url",
      url: "also-not-valid",
      method: "POST",
      initiator: "fetch",
      bodySize: 20 * 1024,
    }, {} as chrome.runtime.MessageSender);

    expect(result).toEqual({ success: true, detected: 0 });
  });

  it("bodySample が maxSampleLength を超える場合は切り詰められる", async () => {
    const handleDataExfiltration = vi.fn(async () => ({ success: true }));
    const inspector = createNetworkSecurityInspector({
      handleDataExfiltration,
      handleTrackingBeacon: async () => ({ success: true }),
      maxSampleLength: 10,
    });

    // The sensitive data ("token") is past the truncation point
    const result = await inspector.handleNetworkInspection({
      pageUrl: "https://example.com",
      url: "/api/submit",
      method: "POST",
      initiator: "fetch",
      bodySize: 512,
      bodySample: 'xxxxxxxxxx"token": "abc"',
    }, {} as chrome.runtime.MessageSender);

    // bodySample truncated to 10 chars -> "xxxxxxxxxx", no sensitive data detected
    expect(handleDataExfiltration).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true, detected: 0 });
  });

  it("inspectRequest で直接検査結果を取得できる", () => {
    const inspector = createNetworkSecurityInspector({
      handleDataExfiltration: async () => ({ success: true }),
      handleTrackingBeacon: async () => ({ success: true }),
    });

    const outcome = inspector.inspectRequest({
      pageUrl: "https://example.com",
      url: "/api/upload",
      method: "POST",
      initiator: "fetch",
      bodySize: 512,
      bodySample: '{"api_key": "sk-1234"}',
    });

    expect(outcome.hasDataExfiltration).toBe(true);
    expect(outcome.sensitiveDataTypes).toContain("api_key");
    expect(outcome.normalizedUrl).toBe("https://example.com/api/upload");
    expect(outcome.targetDomain).toBe("example.com");
    expect(outcome.method).toBe("POST");
  });
});

describe("detectSensitiveData", () => {
  it("各パターンを正しく検出する", () => {
    expect(detectSensitiveData("user@example.com")).toContain("email");
    expect(detectSensitiveData("4111 1111 1111 1111")).toContain("credit_card");
    expect(detectSensitiveData("5211-1111-1111-1111")).toContain("credit_card");
    expect(detectSensitiveData("123-45-6789")).toContain("ssn");
    expect(detectSensitiveData('"password": "hunter2"')).toContain("password");
    expect(detectSensitiveData('"api_key": "abc123"')).toContain("api_key");
    expect(detectSensitiveData('"secret": "s3cr3t"')).toContain("secret");
    expect(detectSensitiveData('"token": "tok_xyz"')).toContain("token");
  });

  it("ガードに引っかからない文字列は高速にスキップされる", () => {
    expect(detectSensitiveData("hello world no sensitive data here")).toEqual([]);
  });

  it("空文字列で空配列を返す", () => {
    expect(detectSensitiveData("")).toEqual([]);
  });

  it("同じタイプは重複しない", () => {
    const result = detectSensitiveData("4111111111111111 and 4222222222222222");
    expect(result.filter((t) => t === "credit_card")).toHaveLength(1);
  });

  it("Visa カード番号 (4xxx) を検出する", () => {
    expect(detectSensitiveData("card: 4539578763621486")).toContain("credit_card");
  });

  it("Mastercard カード番号 (51xx-55xx) を検出する", () => {
    expect(detectSensitiveData("card: 5425233430109903")).toContain("credit_card");
  });

  it("ハイフン区切りのクレジットカード番号を検出する", () => {
    expect(detectSensitiveData("4539-5787-6362-1486")).toContain("credit_card");
  });

  it("SSNパターン (xxx-xx-xxxx) を検出する", () => {
    expect(detectSensitiveData("ssn: 123-45-6789")).toContain("ssn");
  });

  it("JSON内の api-key (ハイフン区切り) を検出する", () => {
    expect(detectSensitiveData('"api-key": "my-key-value"')).toContain("api_key");
  });

  it("通常のテキストで偽陽性を出さない", () => {
    const normalTexts = [
      "Hello, this is a normal message about our product.",
      "The temperature is 42 degrees today.",
      "Please visit our website for more information.",
      "Order number: ABC-12345",
    ];
    for (const text of normalTexts) {
      expect(detectSensitiveData(text)).toEqual([]);
    }
  });

  it("複数の機密データタイプを同時に検出する", () => {
    const body = 'user@example.com sent "password": "hunter2" with card 4111111111111111';
    const result = detectSensitiveData(body);
    expect(result).toContain("email");
    expect(result).toContain("password");
    expect(result).toContain("credit_card");
    expect(result.length).toBe(3);
  });

  describe("パフォーマンス: ReDoS耐性", () => {
    const BUDGET_MS = 50;

    // ReDoSを誘発しやすい悪意ある入力パターン
    // email正規表現: @の後に大量のドットとアルファベットの繰り返し
    it(`email正規表現が悪意ある入力で ${BUDGET_MS}ms 以内に完了する`, () => {
      // "aaa...@bbb.bbb.bbb...bbb" — 旧正規表現ではバックトラッキング爆発
      const malicious = "a".repeat(50) + "@" + "b.".repeat(500) + "c";
      const start = performance.now();
      detectSensitiveData(malicious);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(BUDGET_MS);
    });

    it(`@を含む大量テキストで ${BUDGET_MS}ms 以内に完了する`, () => {
      // x.com等のリクエストボディを模したもの: @混じりの100KB文字列
      const chunk = "data@field.value&key=".repeat(5000);
      const start = performance.now();
      detectSensitiveData(chunk);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(BUDGET_MS);
    });

    it(`全パターンのガード文字を含む100KBテキストで ${BUDGET_MS}ms 以内に完了する`, () => {
      // 全ガードを含むがマッチしない大量テキスト
      const base = "4x5x-@password api secret token ";
      const big = base.repeat(Math.ceil(100_000 / base.length));
      const start = performance.now();
      detectSensitiveData(big);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(BUDGET_MS);
    });
  });
});

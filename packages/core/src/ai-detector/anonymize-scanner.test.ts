import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAnonymizeScanner, DEFAULT_DLP_ANONYMIZE_CONFIG, getEntityLabel } from "./anonymize-scanner.js";

// Mock the anonymize-client module
vi.mock("./anonymize-client.js", () => ({
  createAnonymizeClient: vi.fn(() => ({
    checkHealth: vi.fn().mockResolvedValue(true),
    checkReady: vi.fn().mockResolvedValue(true),
    analyze: vi.fn().mockResolvedValue([]),
    updateConfig: vi.fn(),
  })),
}));

import { createAnonymizeClient } from "./anonymize-client.js";

const mockClient = () => {
  const client = {
    checkHealth: vi.fn().mockResolvedValue(true),
    checkReady: vi.fn().mockResolvedValue(true),
    analyze: vi.fn().mockResolvedValue([]),
    updateConfig: vi.fn(),
  };
  vi.mocked(createAnonymizeClient).mockReturnValue(client);
  return client;
};

describe("createAnonymizeScanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("default config is disabled", () => {
    const scanner = createAnonymizeScanner();
    const config = scanner.getConfig();
    expect(config.enabled).toBe(false);
    expect(config.serverUrl).toBe("http://localhost:8080");
    expect(config.language).toBe("ja");
  });

  it("scan returns null when disabled", async () => {
    const scanner = createAnonymizeScanner();
    const result = await scanner.scan("田中太郎", "clipboard", "example.com");
    expect(result).toBeNull();
  });

  it("scan returns null when not connected", async () => {
    const scanner = createAnonymizeScanner({ enabled: true, serverConnected: false });
    const result = await scanner.scan("田中太郎", "clipboard", "example.com");
    expect(result).toBeNull();
  });

  it("scan returns null for empty text", async () => {
    const client = mockClient();
    const scanner = createAnonymizeScanner({ enabled: true, serverConnected: true });
    const result = await scanner.scan("   ", "clipboard", "example.com");
    expect(result).toBeNull();
    expect(client.analyze).not.toHaveBeenCalled();
  });

  it("scan returns null when no entities detected", async () => {
    const client = mockClient();
    client.analyze.mockResolvedValue([]);
    const scanner = createAnonymizeScanner({ enabled: true, serverConnected: true });
    const result = await scanner.scan("hello world", "clipboard", "example.com");
    expect(result).toBeNull();
  });

  it("scan returns result when entities detected", async () => {
    const client = mockClient();
    const entities = [
      { entity_type: "PERSON", start: 0, end: 4, score: 0.95, text: "田中太郎" },
      { entity_type: "EMAIL_ADDRESS", start: 5, end: 25, score: 0.99, text: "tanaka@example.com" },
    ];
    client.analyze.mockResolvedValue(entities);

    const scanner = createAnonymizeScanner({ enabled: true, serverConnected: true });
    const result = await scanner.scan("田中太郎 tanaka@example.com", "clipboard", "example.com", "https://example.com/page");

    expect(result).not.toBeNull();
    expect(result!.context).toBe("clipboard");
    expect(result!.domain).toBe("example.com");
    expect(result!.url).toBe("https://example.com/page");
    expect(result!.entities).toEqual(entities);
    expect(result!.language).toBe("ja");
  });

  it("scan truncates long text", async () => {
    const client = mockClient();
    client.analyze.mockResolvedValue([]);

    const scanner = createAnonymizeScanner({ enabled: true, serverConnected: true });
    const longText = "a".repeat(20000);
    await scanner.scan(longText, "form", "example.com");

    expect(client.analyze).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.any(String),
      }),
    );
    const calledText = client.analyze.mock.calls[0]![0].text;
    expect(calledText.length).toBeLessThanOrEqual(10000);
  });

  it("verifyConnection checks health and ready", async () => {
    const client = mockClient();
    const scanner = createAnonymizeScanner();

    const connected = await scanner.verifyConnection();
    expect(connected).toBe(true);
    expect(client.checkHealth).toHaveBeenCalled();
    expect(client.checkReady).toHaveBeenCalled();
    expect(scanner.getConfig().serverConnected).toBe(true);
  });

  it("verifyConnection returns false on health failure", async () => {
    const client = mockClient();
    client.checkHealth.mockResolvedValue(false);
    const scanner = createAnonymizeScanner();

    const connected = await scanner.verifyConnection();
    expect(connected).toBe(false);
    expect(scanner.getConfig().serverConnected).toBe(false);
  });

  it("updateConfig recreates client on server URL change", () => {
    mockClient();
    const scanner = createAnonymizeScanner({ serverUrl: "http://localhost:8080" });
    scanner.updateConfig({ serverUrl: "http://localhost:9090" });

    expect(createAnonymizeClient).toHaveBeenCalledTimes(2);
    expect(scanner.getConfig().serverUrl).toBe("http://localhost:9090");
    expect(scanner.getConfig().serverConnected).toBe(false);
  });

  it("updateConfig does not recreate client on non-URL change", () => {
    mockClient();
    const scanner = createAnonymizeScanner();
    scanner.updateConfig({ language: "en" });

    // Initial creation + no recreation = 1 call
    expect(createAnonymizeClient).toHaveBeenCalledTimes(1);
    expect(scanner.getConfig().language).toBe("en");
  });
});

describe("getEntityLabel", () => {
  it("returns Japanese labels for known types", () => {
    expect(getEntityLabel("PERSON")).toBe("氏名");
    expect(getEntityLabel("EMAIL_ADDRESS")).toBe("メールアドレス");
    expect(getEntityLabel("MY_NUMBER")).toBe("マイナンバー");
    expect(getEntityLabel("CREDIT_CARD")).toBe("クレジットカード");
  });

  it("returns raw type for unknown types", () => {
    expect(getEntityLabel("UNKNOWN_TYPE")).toBe("UNKNOWN_TYPE");
  });
});

describe("DEFAULT_DLP_ANONYMIZE_CONFIG", () => {
  it("has expected defaults", () => {
    expect(DEFAULT_DLP_ANONYMIZE_CONFIG.enabled).toBe(false);
    expect(DEFAULT_DLP_ANONYMIZE_CONFIG.serverUrl).toBe("http://localhost:8080");
    expect(DEFAULT_DLP_ANONYMIZE_CONFIG.language).toBe("ja");
    expect(DEFAULT_DLP_ANONYMIZE_CONFIG.serverConnected).toBe(false);
  });
});

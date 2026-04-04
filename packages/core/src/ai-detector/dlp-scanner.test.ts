import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDLPScanner, DEFAULT_DLP_SERVER_CONFIG, getEntityLabel } from "./dlp-scanner.js";

const mockPipeline = vi.fn().mockResolvedValue([]);

vi.mock("@huggingface/transformers", () => ({
  pipeline: vi.fn().mockResolvedValue(mockPipeline),
  env: { backends: { onnx: { wasm: {} } } },
}));

describe("createDLPScanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPipeline.mockResolvedValue([]);
  });

  it("default config is disabled", () => {
    const scanner = createDLPScanner();
    const config = scanner.getConfig();
    expect(config.enabled).toBe(false);
    expect(config.language).toBe("ja");
    expect(config.modelReady).toBe(false);
  });

  it("scan returns null when disabled", async () => {
    const scanner = createDLPScanner();
    const result = await scanner.scan("田中太郎", "clipboard", "example.com");
    expect(result).toBeNull();
  });

  it("scan returns null when pipeline not initialized", async () => {
    const scanner = createDLPScanner({ enabled: true });
    const result = await scanner.scan("田中太郎", "clipboard", "example.com");
    expect(result).toBeNull();
  });

  it("scan returns null for empty text", async () => {
    const scanner = createDLPScanner({ enabled: true });
    await scanner.initPipeline();
    const result = await scanner.scan("   ", "clipboard", "example.com");
    expect(result).toBeNull();
    expect(mockPipeline).not.toHaveBeenCalled();
  });

  it("scan returns null when no entities detected", async () => {
    mockPipeline.mockResolvedValue([]);
    const scanner = createDLPScanner({ enabled: true });
    await scanner.initPipeline();
    const result = await scanner.scan("hello world", "clipboard", "example.com");
    expect(result).toBeNull();
  });

  it("scan returns result when entities detected", async () => {
    const pipelineResults = [
      { entity_group: "PERSON", start: 0, end: 4, score: 0.95, word: "田中太郎" },
      { entity_group: "EMAIL_ADDRESS", start: 5, end: 25, score: 0.99, word: "tanaka@example.com" },
    ];
    mockPipeline.mockResolvedValue(pipelineResults);

    const scanner = createDLPScanner({ enabled: true });
    await scanner.initPipeline();
    const text = "田中太郎 tanaka@example.com";
    const result = await scanner.scan(text, "clipboard", "example.com", "https://example.com/page");

    expect(result).not.toBeNull();
    expect(result!.context).toBe("clipboard");
    expect(result!.domain).toBe("example.com");
    expect(result!.url).toBe("https://example.com/page");
    expect(result!.entities).toHaveLength(2);
    expect(result!.entities[0]!.entity_type).toBe("PERSON");
    expect(result!.entities[1]!.entity_type).toBe("EMAIL_ADDRESS");
    expect(result!.language).toBe("ja");
  });

  it("scan truncates long text", async () => {
    mockPipeline.mockResolvedValue([]);
    const scanner = createDLPScanner({ enabled: true });
    await scanner.initPipeline();

    const longText = "a".repeat(20000);
    await scanner.scan(longText, "form", "example.com");

    expect(mockPipeline).toHaveBeenCalledWith(
      expect.any(String),
      { aggregation_strategy: "simple" },
    );
    const calledText = mockPipeline.mock.calls[0]![0] as string;
    expect(calledText.length).toBeLessThanOrEqual(10000);
  });

  it("initPipeline sets modelReady to true", async () => {
    const scanner = createDLPScanner();
    expect(scanner.getConfig().modelReady).toBe(false);
    await scanner.initPipeline();
    expect(scanner.getConfig().modelReady).toBe(true);
  });

  it("disposePipeline resets modelReady", async () => {
    const scanner = createDLPScanner();
    await scanner.initPipeline();
    expect(scanner.getConfig().modelReady).toBe(true);
    await scanner.disposePipeline();
    expect(scanner.getConfig().modelReady).toBe(false);
  });

  it("updateConfig merges config", () => {
    const scanner = createDLPScanner();
    scanner.updateConfig({ language: "en" });
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

describe("DEFAULT_DLP_SERVER_CONFIG", () => {
  it("has expected defaults", () => {
    expect(DEFAULT_DLP_SERVER_CONFIG.enabled).toBe(false);
    expect(DEFAULT_DLP_SERVER_CONFIG.language).toBe("ja");
    expect(DEFAULT_DLP_SERVER_CONFIG.modelReady).toBe(false);
  });
});

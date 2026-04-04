import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDLPClient } from "./dlp-client.js";

describe("createDLPClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("checkHealth returns false on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Connection refused")));
    const client = createDLPClient({ serverUrl: "http://localhost:9999" });
    expect(await client.checkHealth()).toBe(false);
  });

  it("checkHealth returns true on 200", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    const client = createDLPClient();
    expect(await client.checkHealth()).toBe(true);
  });

  it("checkReady returns false on non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    const client = createDLPClient();
    expect(await client.checkReady()).toBe(false);
  });

  it("analyze sends correct request", async () => {
    const mockEntities = [{ entity_type: "PERSON", start: 0, end: 4, score: 0.95, text: "田中太郎" }];
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockEntities),
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = createDLPClient({ serverUrl: "http://localhost:8080" });
    const result = await client.analyze({ text: "田中太郎です", language: "ja" });

    expect(result).toEqual(mockEntities);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8080/api/analyze",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ text: "田中太郎です", language: "ja" }),
      }),
    );
  });

  it("analyze throws on non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const client = createDLPClient();
    await expect(client.analyze({ text: "test", language: "en" })).rejects.toThrow("DLP analyze failed: 500");
  });

  it("updateConfig changes server URL", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const client = createDLPClient({ serverUrl: "http://localhost:8080" });
    client.updateConfig({ serverUrl: "http://localhost:9090" });
    await client.checkHealth();

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:9090/health",
      expect.anything(),
    );
  });
});

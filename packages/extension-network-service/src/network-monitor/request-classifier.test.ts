import { describe, it, expect } from "vitest";
import {
  classifyInitiator,
  extractExtensionId,
  extractDomain,
  classifyWebRequest,
  type RequestClassificationContext,
  type WebRequestDetails,
} from "./request-classifier.js";

describe("classifyInitiator", () => {
  it("returns 'browser' for undefined", () => {
    expect(classifyInitiator(undefined)).toBe("browser");
  });

  it("returns 'extension' for chrome-extension:// URL", () => {
    expect(
      classifyInitiator(
        "chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef",
      ),
    ).toBe("extension");
  });

  it("returns 'page' for http:// URL", () => {
    expect(classifyInitiator("http://example.com")).toBe("page");
  });

  it("returns 'page' for https:// URL", () => {
    expect(classifyInitiator("https://example.com")).toBe("page");
  });

  it("returns 'unknown' for 'null' string", () => {
    expect(classifyInitiator("null")).toBe("unknown");
  });

  it("returns 'unknown' for about:blank", () => {
    expect(classifyInitiator("about:blank")).toBe("unknown");
  });
});

describe("extractExtensionId", () => {
  it("extracts 32-char lowercase ID from chrome-extension:// URL", () => {
    expect(
      extractExtensionId(
        "chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef/page.html",
      ),
    ).toBe("abcdefghijklmnopqrstuvwxyzabcdef");
  });

  it("returns null for non-matching URLs", () => {
    expect(extractExtensionId("https://example.com")).toBeNull();
  });

  it("returns null for IDs with wrong length", () => {
    expect(extractExtensionId("chrome-extension://abc")).toBeNull();
  });

  it("returns null for IDs with uppercase characters", () => {
    expect(
      extractExtensionId(
        "chrome-extension://ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEF",
      ),
    ).toBeNull();
  });
});

describe("extractDomain", () => {
  it("extracts hostname from valid URL", () => {
    expect(extractDomain("https://api.example.com/path?q=1")).toBe(
      "api.example.com",
    );
  });

  it("returns 'unknown' for invalid URL", () => {
    expect(extractDomain("not-a-url")).toBe("unknown");
  });
});

describe("classifyWebRequest", () => {
  const OWN_ID = "ownextensionidaaaaaaaaaaaaaaaaaa"; // 32 chars
  const OTHER_ID = "otherextensionidaaaaaaaaaaaaaaaa"; // 32 chars
  const EXCLUDED_ID = "excludedextensionidaaaaaaaaaaaaa"; // 32 chars

  function makeContext(
    overrides: Partial<RequestClassificationContext> = {},
  ): RequestClassificationContext {
    return {
      ownExtensionId: OWN_ID,
      excludeOwnExtension: true,
      excludedExtensions: new Set<string>(),
      excludedDomains: new Set<string>(),
      captureAllRequests: false,
      resolveExtensionName: () => undefined,
      ...overrides,
    };
  }

  function makeDetails(
    overrides: Partial<WebRequestDetails> = {},
  ): WebRequestDetails {
    return {
      url: "https://api.example.com/data",
      method: "GET",
      type: "xmlhttprequest",
      initiator: `chrome-extension://${OTHER_ID}`,
      tabId: 1,
      frameId: 0,
      ...overrides,
    };
  }

  const NOW = 1700000000000;

  it("returns record for extension-initiated request", () => {
    const result = classifyWebRequest(makeDetails(), makeContext(), NOW);

    expect(result.action).toBe("record");
    if (result.action !== "record") return;
    expect(result.record.initiatorType).toBe("extension");
    expect(result.record.extensionId).toBe(OTHER_ID);
    expect(result.record.domain).toBe("api.example.com");
    expect(result.record.timestamp).toBe(NOW);
    expect(result.record.detectedBy).toBe("webRequest");
  });

  it("skips non-extension request when captureAllRequests is false", () => {
    const details = makeDetails({ initiator: "https://example.com" });
    const result = classifyWebRequest(
      details,
      makeContext({ captureAllRequests: false }),
      NOW,
    );

    expect(result.action).toBe("skip");
  });

  it("captures non-extension request when captureAllRequests is true", () => {
    const details = makeDetails({ initiator: "https://example.com" });
    const result = classifyWebRequest(
      details,
      makeContext({ captureAllRequests: true }),
      NOW,
    );

    expect(result.action).toBe("record");
    if (result.action !== "record") return;
    expect(result.record.initiatorType).toBe("page");
  });

  it("skips own extension when excludeOwnExtension is true", () => {
    const details = makeDetails({
      initiator: `chrome-extension://${OWN_ID}`,
    });
    const result = classifyWebRequest(
      details,
      makeContext({ excludeOwnExtension: true }),
      NOW,
    );

    expect(result.action).toBe("skip");
  });

  it("skips excluded extension", () => {
    const details = makeDetails({
      initiator: `chrome-extension://${EXCLUDED_ID}`,
    });
    const result = classifyWebRequest(
      details,
      makeContext({ excludedExtensions: new Set([EXCLUDED_ID]) }),
      NOW,
    );

    expect(result.action).toBe("skip");
  });

  it("skips excluded domain", () => {
    const details = makeDetails({ url: "https://blocked.example.com/api" });
    const result = classifyWebRequest(
      details,
      makeContext({ excludedDomains: new Set(["blocked.example.com"]) }),
      NOW,
    );

    expect(result.action).toBe("skip");
  });

  it("resolves extension name from context", () => {
    const result = classifyWebRequest(
      makeDetails(),
      makeContext({
        resolveExtensionName: (id) =>
          id === OTHER_ID ? "Other Extension" : undefined,
      }),
      NOW,
    );

    expect(result.action).toBe("record");
    if (result.action !== "record") return;
    expect(result.record.extensionName).toBe("Other Extension");
  });
});

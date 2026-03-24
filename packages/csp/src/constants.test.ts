import { describe, it, expect } from "vitest";
import {
  INITIATOR_TO_DIRECTIVE,
  STRICT_DIRECTIVES,
  REQUIRED_DIRECTIVES,
  MAX_STORED_CSP_REPORTS,
} from "./constants.js";

describe("INITIATOR_TO_DIRECTIVE", () => {
  describe("fetch/XHR requests", () => {
    it("maps fetch to connect-src", () => {
      expect(INITIATOR_TO_DIRECTIVE["fetch"]).toBe("connect-src");
    });

    it("maps xhr to connect-src", () => {
      expect(INITIATOR_TO_DIRECTIVE["xhr"]).toBe("connect-src");
    });

    it("maps websocket to connect-src", () => {
      expect(INITIATOR_TO_DIRECTIVE["websocket"]).toBe("connect-src");
    });

    it("maps beacon to connect-src", () => {
      expect(INITIATOR_TO_DIRECTIVE["beacon"]).toBe("connect-src");
    });
  });

  describe("script and style requests", () => {
    it("maps script to script-src", () => {
      expect(INITIATOR_TO_DIRECTIVE["script"]).toBe("script-src");
    });

    it("maps style to style-src", () => {
      expect(INITIATOR_TO_DIRECTIVE["style"]).toBe("style-src");
    });
  });

  describe("media requests", () => {
    it("maps img to img-src", () => {
      expect(INITIATOR_TO_DIRECTIVE["img"]).toBe("img-src");
    });

    it("maps font to font-src", () => {
      expect(INITIATOR_TO_DIRECTIVE["font"]).toBe("font-src");
    });

    it("maps media to media-src", () => {
      expect(INITIATOR_TO_DIRECTIVE["media"]).toBe("media-src");
    });
  });

  describe("object and frame requests", () => {
    it("maps object to object-src", () => {
      expect(INITIATOR_TO_DIRECTIVE["object"]).toBe("object-src");
    });

    it("maps frame to frame-src", () => {
      expect(INITIATOR_TO_DIRECTIVE["frame"]).toBe("frame-src");
    });

    it("maps iframe to frame-src", () => {
      expect(INITIATOR_TO_DIRECTIVE["iframe"]).toBe("frame-src");
    });
  });

  describe("worker and manifest requests", () => {
    it("maps worker to worker-src", () => {
      expect(INITIATOR_TO_DIRECTIVE["worker"]).toBe("worker-src");
    });

    it("maps manifest to manifest-src", () => {
      expect(INITIATOR_TO_DIRECTIVE["manifest"]).toBe("manifest-src");
    });
  });

  it("covers all common request types", () => {
    const expectedTypes = [
      "fetch",
      "xhr",
      "websocket",
      "beacon",
      "script",
      "style",
      "img",
      "font",
      "media",
      "object",
      "frame",
      "iframe",
      "worker",
      "manifest",
    ];

    for (const type of expectedTypes) {
      expect(INITIATOR_TO_DIRECTIVE[type]).toBeDefined();
    }
  });
});

describe("STRICT_DIRECTIVES", () => {
  it("contains script-src", () => {
    expect(STRICT_DIRECTIVES).toContain("script-src");
  });

  it("contains style-src", () => {
    expect(STRICT_DIRECTIVES).toContain("style-src");
  });

  it("contains default-src", () => {
    expect(STRICT_DIRECTIVES).toContain("default-src");
  });

  it("has correct length", () => {
    expect(STRICT_DIRECTIVES).toHaveLength(3);
  });

  it("contains only security-critical directives", () => {
    for (const directive of STRICT_DIRECTIVES) {
      expect(["script-src", "style-src", "default-src"]).toContain(directive);
    }
  });
});

describe("REQUIRED_DIRECTIVES", () => {
  it("contains default-src", () => {
    expect(REQUIRED_DIRECTIVES).toContain("default-src");
  });

  it("contains script-src", () => {
    expect(REQUIRED_DIRECTIVES).toContain("script-src");
  });

  it("contains object-src", () => {
    expect(REQUIRED_DIRECTIVES).toContain("object-src");
  });

  it("contains base-uri", () => {
    expect(REQUIRED_DIRECTIVES).toContain("base-uri");
  });

  it("contains frame-ancestors", () => {
    expect(REQUIRED_DIRECTIVES).toContain("frame-ancestors");
  });

  it("has correct length", () => {
    expect(REQUIRED_DIRECTIVES).toHaveLength(5);
  });

  it("follows OWASP recommendations", () => {
    // OWASP recommends at minimum: default-src, script-src, object-src
    expect(REQUIRED_DIRECTIVES).toContain("default-src");
    expect(REQUIRED_DIRECTIVES).toContain("script-src");
    expect(REQUIRED_DIRECTIVES).toContain("object-src");
  });
});

describe("MAX_STORED_CSP_REPORTS", () => {
  it("has reasonable value", () => {
    expect(MAX_STORED_CSP_REPORTS).toBe(1000);
    expect(MAX_STORED_CSP_REPORTS).toBeGreaterThan(0);
  });
});

describe("directive mappings consistency", () => {
  it("all mapped directives are valid CSP directives", () => {
    const validDirectives = [
      "default-src",
      "script-src",
      "style-src",
      "img-src",
      "font-src",
      "connect-src",
      "media-src",
      "object-src",
      "frame-src",
      "child-src",
      "worker-src",
      "manifest-src",
      "base-uri",
      "form-action",
      "frame-ancestors",
      "report-uri",
      "report-to",
      "upgrade-insecure-requests",
    ];

    for (const directive of Object.values(INITIATOR_TO_DIRECTIVE)) {
      expect(validDirectives).toContain(directive);
    }
  });

  it("required directives are valid CSP directives", () => {
    const validDirectives = [
      "default-src",
      "script-src",
      "style-src",
      "img-src",
      "font-src",
      "connect-src",
      "media-src",
      "object-src",
      "frame-src",
      "child-src",
      "worker-src",
      "manifest-src",
      "base-uri",
      "form-action",
      "frame-ancestors",
      "report-uri",
      "report-to",
      "upgrade-insecure-requests",
    ];

    for (const directive of REQUIRED_DIRECTIVES) {
      expect(validDirectives).toContain(directive);
    }
  });
});

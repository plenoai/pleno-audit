import { describe, it, expect } from "vitest";
import {
  hasSensitiveField,
  detectCryptoAddress,
  containsXSSPattern,
  isSuspiciousFileExtension,
  isKnownCDN,
} from "./security-patterns.js";

function input(overrides: Partial<{ type: string; name: string; id: string; autocomplete: string }> = {}) {
  return { type: "", name: "", id: "", autocomplete: "", ...overrides };
}

describe("hasSensitiveField", () => {
  describe("true positives: fields that MUST be detected", () => {
    it("detects password input by type", () => {
      const result = hasSensitiveField([input({ type: "password" })]);
      expect(result).toEqual({ hasSensitive: true, fieldType: "password" });
    });

    it("detects email input by type", () => {
      const result = hasSensitiveField([input({ type: "email" })]);
      expect(result.hasSensitive).toBe(true);
    });

    it("detects credit card field by name", () => {
      const result = hasSensitiveField([input({ name: "credit-card-number" })]);
      expect(result.hasSensitive).toBe(true);
    });

    it("detects CVV field by id", () => {
      const result = hasSensitiveField([input({ id: "cvv-input" })]);
      expect(result.hasSensitive).toBe(true);
    });

    it("detects autocomplete cc-number", () => {
      const result = hasSensitiveField([input({ autocomplete: "cc-number" })]);
      expect(result.hasSensitive).toBe(true);
    });

    it("detects autocomplete password", () => {
      const result = hasSensitiveField([input({ autocomplete: "current-password" })]);
      expect(result.hasSensitive).toBe(true);
    });

    it("detects api_key in name", () => {
      const result = hasSensitiveField([input({ name: "api_key" })]);
      expect(result.hasSensitive).toBe(true);
    });

    it("detects OTP field", () => {
      const result = hasSensitiveField([input({ name: "otp-code" })]);
      expect(result.hasSensitive).toBe(true);
    });

    it("is case-insensitive", () => {
      const result = hasSensitiveField([input({ type: "PASSWORD" })]);
      expect(result.hasSensitive).toBe(true);
    });

    it("finds sensitive field among many non-sensitive ones", () => {
      const result = hasSensitiveField([
        input({ type: "text", name: "username" }),
        input({ type: "text", name: "search" }),
        input({ type: "password", name: "pwd" }),
      ]);
      expect(result.hasSensitive).toBe(true);
    });
  });

  describe("true negatives: fields that MUST NOT trigger", () => {
    it("ignores plain text search field", () => {
      const result = hasSensitiveField([input({ type: "text", name: "search" })]);
      expect(result).toEqual({ hasSensitive: false, fieldType: null });
    });

    it("ignores submit button", () => {
      const result = hasSensitiveField([input({ type: "submit", name: "go" })]);
      expect(result.hasSensitive).toBe(false);
    });

    it("returns false for empty inputs", () => {
      expect(hasSensitiveField([]).hasSensitive).toBe(false);
    });
  });
});

describe("detectCryptoAddress", () => {
  describe("valid addresses", () => {
    it("detects Bitcoin address (1-prefix)", () => {
      const result = detectCryptoAddress("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa");
      expect(result).toEqual({ match: true, type: "bitcoin" });
    });

    it("detects Ethereum address", () => {
      const result = detectCryptoAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18");
      expect(result).toEqual({ match: true, type: "ethereum" });
    });

    it("detects Litecoin address", () => {
      const result = detectCryptoAddress("LQTpS3QaKMGCt2nJ3LkHUz2gKMk8UKedVK");
      expect(result).toEqual({ match: true, type: "litecoin" });
    });

    it("detects Ripple address", () => {
      const result = detectCryptoAddress("rN7Rp9dNMnKFyHC4j3cMaUAuXzFYNvNPcY");
      expect(result).toEqual({ match: true, type: "ripple" });
    });
  });

  describe("rejection: must not match", () => {
    it("rejects short string", () => {
      expect(detectCryptoAddress("1A1z").match).toBe(false);
    });

    it("rejects empty string", () => {
      expect(detectCryptoAddress("").match).toBe(false);
    });

    it("rejects UUID", () => {
      expect(detectCryptoAddress("550e8400-e29b-41d4-a716-446655440000").match).toBe(false);
    });

    it("rejects hex string without 0x prefix", () => {
      expect(detectCryptoAddress("742d35Cc6634C0532925a3b844Bc9e7595f2bD18").match).toBe(false);
    });

    it("rejects normal URL path", () => {
      expect(detectCryptoAddress("https://example.com/path").match).toBe(false);
    });
  });
});

describe("containsXSSPattern", () => {
  describe("attack patterns that MUST be caught", () => {
    it("detects script tag with content", () => {
      expect(containsXSSPattern('<script>alert(1)</script>')).toBe(true);
    });

    it("detects javascript: URI", () => {
      expect(containsXSSPattern('javascript: alert(1)')).toBe(true);
    });

    it("detects onerror=eval", () => {
      expect(containsXSSPattern('onerror="eval(atob(\'...\'))"')).toBe(true);
    });

    it("detects iframe with javascript src", () => {
      expect(containsXSSPattern('<iframe src="javascript:alert(1)">')).toBe(true);
    });

    it("is case-insensitive", () => {
      expect(containsXSSPattern('<SCRIPT>alert(1)</SCRIPT>')).toBe(true);
    });
  });

  describe("benign content that MUST NOT trigger", () => {
    it("allows plain text mentioning scripts", () => {
      expect(containsXSSPattern("I wrote a script yesterday")).toBe(false);
    });

    it("allows empty script tag", () => {
      // <script>のみ（内容なし）はXSSではない
      expect(containsXSSPattern("<script></script>")).toBe(false);
    });

    it("allows normal text", () => {
      expect(containsXSSPattern("Hello, world!")).toBe(false);
    });

    it("allows javascript: without code", () => {
      // javascript:のあとに空白のみ or 引用符 → 攻撃ではない
      expect(containsXSSPattern('javascript: "')).toBe(false);
    });
  });
});

describe("isSuspiciousFileExtension", () => {
  it("flags .exe", () => {
    expect(isSuspiciousFileExtension("setup.exe")).toBe(true);
  });

  it("flags .ps1", () => {
    expect(isSuspiciousFileExtension("deploy.ps1")).toBe(true);
  });

  it("flags .bat", () => {
    expect(isSuspiciousFileExtension("run.bat")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isSuspiciousFileExtension("SETUP.EXE")).toBe(true);
  });

  it("allows .pdf", () => {
    expect(isSuspiciousFileExtension("doc.pdf")).toBe(false);
  });

  it("allows .png", () => {
    expect(isSuspiciousFileExtension("image.png")).toBe(false);
  });

  it("allows .txt", () => {
    expect(isSuspiciousFileExtension("notes.txt")).toBe(false);
  });
});

describe("isKnownCDN", () => {
  it("recognizes cdnjs.cloudflare.com", () => {
    expect(isKnownCDN("cdnjs.cloudflare.com")).toBe(true);
  });

  it("recognizes cdn.jsdelivr.net", () => {
    expect(isKnownCDN("cdn.jsdelivr.net")).toBe(true);
  });

  it("recognizes unpkg.com", () => {
    expect(isKnownCDN("unpkg.com")).toBe(true);
  });

  it("rejects random domain", () => {
    expect(isKnownCDN("evil.com")).toBe(false);
  });

  it("rejects domain that looks similar", () => {
    expect(isKnownCDN("cdn.evil.com")).toBe(false);
  });
});

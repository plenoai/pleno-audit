/**
 * Property-based tests for security pattern detection
 *
 * XSS検出パターンの誤検知防止を重点的にファジングする。
 * - 通常テキストでの false positive 検出
 * - 代数的プロパティ（冪等性）
 */
import { describe, it } from "vitest";
import * as fc from "fast-check";
import {
  containsXSSPattern,
  hasSensitiveField,
  SENSITIVE_FIELD_NAMES,
  detectCryptoAddress,
  isSuspiciousFileExtension,
  isKnownCDN,
} from "./security-patterns.js";

describe("containsXSSPattern - property tests", () => {
  it("is idempotent: same input always gives same result", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 200 }), (text) => {
        return containsXSSPattern(text) === containsXSSPattern(text);
      }),
      { numRuns: 500 },
    );
  });

  it("does not false-positive on alphanumeric-only strings", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9 ]{0,100}$/),
        (text) => {
          return containsXSSPattern(text) === false;
        },
      ),
      { numRuns: 500 },
    );
  });

  it("does not false-positive on typical prose text", () => {
    const proseArb = fc.array(
      fc.constantFrom(
        "The", "quick", "brown", "fox", "jumps", "over", "the", "lazy", "dog",
        "Hello", "world", "this", "is", "a", "test", "message", "about", "security",
        "script", "writing", "was", "fun", "today", "I", "learned", "something",
        "new", "and", "interesting", "from", "the", "documentation",
        "price", "is", "$42.99", "order", "#12345", "status:", "pending",
      ),
      { minLength: 1, maxLength: 20 },
    ).map((words) => words.join(" "));

    fc.assert(
      fc.property(proseArb, (text) => {
        return containsXSSPattern(text) === false;
      }),
      { numRuns: 300 },
    );
  });

  it("always detects <script>...</script> with content", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9()]{1,20}$/),
        (payload) => {
          return containsXSSPattern(`<script>${payload}</script>`) === true;
        },
      ),
      { numRuns: 200 },
    );
  });

  it("always detects javascript: with non-whitespace content", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9()]{1,20}$/),
        (payload) => {
          return containsXSSPattern(`javascript: ${payload}`) === true;
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe("hasSensitiveField - property tests", () => {
  const nonSensitiveTypeArb = fc.constantFrom("text", "number", "checkbox", "radio", "submit", "hidden", "date", "range");
  const nonSensitiveNameArb = fc.stringMatching(/^[a-z]{3,10}$/).filter(
    (name) => !SENSITIVE_FIELD_NAMES.some((p) => name.includes(p)),
  );

  it("returns false for non-sensitive field combinations", () => {
    fc.assert(
      fc.property(nonSensitiveTypeArb, nonSensitiveNameArb, (type, name) => {
        const result = hasSensitiveField([{ type, name, id: name, autocomplete: "" }]);
        return result.hasSensitive === false;
      }),
      { numRuns: 300 },
    );
  });

  it("is idempotent", () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 20 }),
        fc.string({ maxLength: 20 }),
        (type, name) => {
          const input = [{ type, name, id: "", autocomplete: "" }];
          return hasSensitiveField(input).hasSensitive === hasSensitiveField(input).hasSensitive;
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe("detectCryptoAddress - property tests", () => {
  it("returns consistent result type", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 100 }), (text) => {
        const result = detectCryptoAddress(text);
        return typeof result.match === "boolean" && (result.type === null || typeof result.type === "string");
      }),
      { numRuns: 500 },
    );
  });

  it("does not match short strings", () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 10 }),
        (text) => detectCryptoAddress(text).match === false,
      ),
      { numRuns: 300 },
    );
  });
});

describe("isSuspiciousFileExtension - property tests", () => {
  it("does not flag common safe extensions", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(".pdf", ".png", ".jpg", ".gif", ".svg", ".txt", ".md", ".html", ".css", ".json", ".xml", ".csv", ".zip", ".tar"),
        fc.stringMatching(/^[a-z]{3,10}$/),
        (ext, name) => isSuspiciousFileExtension(name + ext) === false,
      ),
      { numRuns: 200 },
    );
  });

  it("always flags dangerous extensions", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(".exe", ".msi", ".bat", ".ps1", ".cmd", ".scr", ".vbs", ".js", ".jar", ".dll"),
        fc.stringMatching(/^[a-z]{3,10}$/),
        (ext, name) => isSuspiciousFileExtension(name + ext) === true,
      ),
      { numRuns: 200 },
    );
  });
});

describe("isKnownCDN - property tests", () => {
  it("does not match random domains", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z]{5,15}\.(com|net|org|io)$/),
        (domain) => {
          // Filter out domains that accidentally contain CDN substrings
          if (domain.includes("unpkg") || domain.includes("jsdelivr") || domain.includes("cloudflare") || domain.includes("bootcdn") || domain.includes("baomitu") || domain.includes("staticfile") || domain.includes("googleapis") || domain.includes("jquery") || domain.includes("bootstrapcdn")) return true;
          return isKnownCDN(domain) === false;
        },
      ),
      { numRuns: 300 },
    );
  });
});

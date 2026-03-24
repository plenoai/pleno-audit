import { isLoginUrl, SOCIAL_LOGIN_TEXT_PATTERNS } from "./patterns.js";
import type { DOMAdapter, LoginDetectionResult } from "./types.js";

export function createLoginDetector(dom: DOMAdapter) {
  function detectSocialLogin(): boolean {
    // ボタン要素からソーシャルログイン検出
    const buttons = dom.querySelectorAll(
      'button, a[role="button"], [class*="login"], [class*="signin"]'
    );

    for (const btn of buttons) {
      const text = btn.textContent || "";
      if (SOCIAL_LOGIN_TEXT_PATTERNS.some((pattern) => pattern.test(text))) {
        return true;
      }
    }

    // data属性からOAuth/SSO検出
    const oauthElements = dom.querySelectorAll(
      '[data-oauth], [data-sso], [data-provider], [class*="oauth"], [class*="social-login"]'
    );
    return oauthElements.length > 0;
  }

  function detectWebAuthn(): boolean {
    // WebAuthn対応ページの検出
    const webAuthnIndicators = dom.querySelectorAll(
      '[autocomplete*="webauthn"], [data-webauthn], [class*="webauthn"], [class*="passkey"]'
    );
    return webAuthnIndicators.length > 0;
  }

  function detectLoginPage(): LoginDetectionResult {
    const passwordInputs = dom.querySelectorAll('input[type="password"]');
    const hasPasswordInput = passwordInputs.length > 0;

    let formAction: string | null = null;
    let hasLoginForm = false;

    if (hasPasswordInput) {
      const form = passwordInputs[0]?.closest("form");
      if (form) {
        hasLoginForm = true;
        formAction = (form as HTMLFormElement).action || null;
      }
    }

    const currentUrl = dom.getLocation().href;
    const urlIndicatesLogin = isLoginUrl(currentUrl);

    const hasSocialLogin = detectSocialLogin();
    const hasWebAuthn = detectWebAuthn();

    return {
      hasLoginForm,
      hasPasswordInput,
      isLoginUrl: urlIndicatesLogin,
      formAction,
      hasSocialLogin,
      hasWebAuthn,
    };
  }

  function isLoginPage(): boolean {
    const result = detectLoginPage();
    return (
      result.hasPasswordInput ||
      result.isLoginUrl ||
      result.hasSocialLogin ||
      result.hasWebAuthn
    );
  }

  return {
    detectLoginPage,
    isLoginPage,
  };
}

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

  function detectPasskey(): boolean {
    // Passkey / WebAuthn対応ページの検出
    const passkeyIndicators = dom.querySelectorAll(
      '[autocomplete*="webauthn"], [data-webauthn], [class*="webauthn"], [class*="passkey"], [data-passkey]'
    );
    return passkeyIndicators.length > 0;
  }

  function detectSAML(): boolean {
    // SAML アサーションフォームフィールドの検出（IdP/SP-initiated SSO）
    const samlFormFields = dom.querySelectorAll(
      '[name="SAMLResponse"], [name="SAMLRequest"], [name="RelayState"]'
    );
    if (samlFormFields.length > 0) return true;

    // SAML固有のclass/data属性
    const samlElements = dom.querySelectorAll(
      '[class*="saml"], [data-saml], [id*="saml"]'
    );
    if (samlElements.length > 0) return true;

    // URLクエリパラメータでのSAML検出
    const currentUrl = dom.getLocation().href;
    if (/[?&]SAMLRequest=/i.test(currentUrl) || /[?&]SAMLResponse=/i.test(currentUrl)) {
      return true;
    }

    return false;
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
    const hasPasskey = detectPasskey();
    const hasSAML = detectSAML();

    return {
      hasLoginForm,
      hasPasswordInput,
      isLoginUrl: urlIndicatesLogin,
      formAction,
      hasSocialLogin,
      hasPasskey,
      hasSAML,
    };
  }

  function isLoginPage(): boolean {
    const result = detectLoginPage();
    return (
      result.hasPasswordInput ||
      result.isLoginUrl ||
      result.hasSocialLogin ||
      result.hasPasskey ||
      result.hasSAML
    );
  }

  return {
    detectLoginPage,
    isLoginPage,
  };
}

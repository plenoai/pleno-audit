# Chrome Web Store Specific Privacy Information

## 単一用途の説明

Pleno Audit is a personal browser security tool that monitors network requests, detects security threats (phishing, typosquatting, newly registered domains), audits Content Security Policy violations, and identifies Shadow AI usage — all processed locally on the user's device without sending data to external servers.

## 権限が必要な理由

### cookies

Required to detect third-party tracking cookies and identify authentication cookies on SaaS services for CASB (Cloud Access Security Broker) functionality. Cookie attributes (Secure, SameSite, HttpOnly) are analyzed locally to assess security posture. No cookie data is sent externally.

### storage

Required to store security configuration, detected services, alert history, and user preferences locally on the device using chrome.storage.local. All data remains on the user's device.

### unlimitedStorage

Security audit trails (CSP violation logs, network request logs, alert history) require persistent storage beyond the default 10MB quota to maintain a complete audit history. Users can configure retention periods (up to 365 days) and delete all data at any time.

### activeTab

Required to inject content scripts that detect security threats on the currently active page, including fingerprinting attempts, CSP violations, and AI service usage. Only activates on the tab the user is currently viewing.

### alarms

Required to schedule periodic security tasks such as rotating audit logs, checking data retention policies, and refreshing security posture assessments at configurable intervals.

### webRequest

Required to monitor HTTP request/response headers for security analysis, including detecting insecure connections, analyzing Content Security Policy headers, and identifying potentially malicious network patterns. All analysis is performed locally.

### webNavigation

Required to track page navigation events for detecting phishing redirects, suspicious redirect chains, and newly registered domain access. Navigation data is analyzed locally for threat detection.

### management

Required to analyze installed browser extensions for security risks, including excessive permissions, suspicious update patterns, and known vulnerable extensions. Extension metadata is evaluated locally using heuristic algorithms.

### notifications

Required to alert users about detected security threats such as phishing attempts, CSP violations, typosquatting domains, and Shadow AI usage. Notifications are triggered by locally processed security events.

### scripting

Required (Manifest V3) to dynamically inject content scripts for security monitoring, including API hook scripts that detect fingerprinting, WebSocket interception for data exfiltration detection, and CSP bridge scripts for violation reporting.

### offscreen

Required (Manifest V3) to run computationally intensive tasks in an offscreen document, specifically the on-device NER (Named Entity Recognition) ML model for DLP (Data Loss Prevention) PII detection using Transformers.js. This keeps the main thread responsive.

### declarativeNetRequest

Required to enforce security rules via Manifest V3's declarativeNetRequest API, including blocking requests to known malicious patterns, upgrading insecure HTTP connections, and enforcing Content Security Policy rules.

### declarativeNetRequestWithHostAccess

Required to apply host-specific network rules for security enforcement, such as blocking cross-origin requests that violate CSP policies and preventing data exfiltration to suspicious domains detected by the typosquatting/NRD algorithms.

### declarativeNetRequestFeedback

Required to receive feedback on matched declarativeNetRequest rules for security audit logging. This allows the extension to log which security rules were triggered, providing users with a complete audit trail of blocked threats.

### identity

Required for optional enterprise SSO (Single Sign-On) authentication via OIDC/SAML when organizations deploy Pleno Audit with centralized policy management. This feature is disabled by default and only activated by enterprise administrators.

### ホスト権限 (`<all_urls>`)

Required because browser security monitoring must operate on all websites to detect threats. Security analysis (CSP violations, fingerprinting, phishing, typosquatting) cannot be limited to specific domains — threats can originate from any website. All page content analysis is performed locally on the device.

## リモートコード

**いいえ、リモートコードを使用していません**

All JavaScript and WebAssembly (Transformers.js ONNX runtime for on-device ML inference) are bundled within the extension package. No external scripts are loaded at runtime. The extension enforces a strict Content Security Policy and the codebase uses oxlint rules to prohibit `fetch`, `XMLHttpRequest`, and `WebSocket` by default, with explicit exceptions only for user-initiated opt-in features.

## データ使用

### 収集するデータカテゴリ

| カテゴリ | 収集 | 説明 |
|---------|------|------|
| 個人を特定できる情報 | **No** | PII は DLP 機能でローカル検出のみ。収集・保存しない |
| 健康に関する情報 | **No** | — |
| 財務状況や支払いに関する情報 | **No** | — |
| 認証に関する情報 | **No** | SSO トークンはセッション中のみ保持。パスワードは一切収集しない |
| 個人的コミュニケーション | **No** | — |
| 位置情報 | **No** | — |
| ウェブ履歴 | **Yes** | ユーザーがアクセスしたドメイン名を脅威検出（NRD、タイポスクワット、フィッシング）の目的でローカルに保存。外部送信しない |
| ユーザーのアクティビティ | **Yes** | ネットワークリクエストのメタデータ（URL、ヘッダー）をセキュリティ監視の目的でローカルに保存。外部送信しない |
| ウェブサイトのコンテンツ | **Yes** | CSP ヘッダー、スクリプト属性をセキュリティ分析の目的でローカルに保存。ページ本文は収集しない。外部送信しない |

### 開示表明

- [x] 承認されている以外の用途で第三者にユーザーデータを販売、転送しません
- [x] アイテムの唯一の目的と関係のない目的でユーザーデータを使用または転送しません
- [x] 信用力を判断する目的または融資目的でユーザーデータを使用または転送しません

### 補足

すべてのデータ処理はユーザーの端末内で完結します（Local First）。オプトイン機能（RDAP 問い合わせ、Webhook 連携、SSO 認証）を有効にした場合のみ、最小限のデータ（ドメイン名、アラート種別）がユーザー指定のエンドポイントに送信されます。

## プライバシーポリシー URL

https://plenoai.com/pleno-audit/privacy

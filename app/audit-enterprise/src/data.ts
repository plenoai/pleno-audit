export type Severity = "critical" | "high" | "medium" | "low" | "info" | "safe";

export interface OrgInfo {
  name: string;
  shortCode: string;
  regions: string[];
  managedBrowsers: number;
  managedUsers: number;
  activeSessions: number;
  lastUpdated: string;
}

export interface RiskBreakdown {
  label: string;
  key: string;
  score: number;
  weight: number;
}

export interface RiskData {
  score: number;
  scoreDelta: number;
  grade: string;
  bands: { critical: number; high: number; medium: number; low: number; info: number };
  breakdown: RiskBreakdown[];
  trend: number[];
}

export interface Stats {
  alerts24h: number;
  alertsDelta: number;
  blocked24h: number;
  blockedDelta: number;
  exfilEvents: number;
  exfilDelta: number;
  mttrMin: number;
  mttrDelta: number;
}

export interface Threat {
  id: string;
  sev: Severity;
  title: string;
  count: number;
  asset: string;
  trend: number[];
}

export interface Browser {
  id: string;
  host: string;
  user: string;
  os: string;
  browser: string;
  risk: Severity;
  alerts: number;
  ext: number;
  lastSeen: string;
  region: string;
  posture: string[];
}

export interface Alert {
  id: string;
  ts: string;
  sev: Severity;
  cat: string;
  title: string;
  asset: string;
  dst: string;
  state: string;
}

export interface Extension {
  name: string;
  id: string;
  installs: number;
  perms: string[];
  risk: Severity;
  status: string;
  publisher: string;
  firstSeen: string;
  note: string;
}

export interface SaasApp {
  name: string;
  cat: string;
  sanction: string;
  users: number;
  sensitivity: Severity;
  exfil: number;
  aiIngress: number;
  risk: Severity;
  trend: number[];
}

export interface IdentityEvent {
  user: string;
  risk: Severity;
  event: string;
  app: string;
  ts: string;
  detail: string;
}

export interface ExfilEvent {
  ts: string;
  actor: string;
  channel: string;
  dst: string;
  kind: string;
  bytes: string;
  classes: string[];
  action: string;
}

export interface Policy {
  id: string;
  name: string;
  scope: string;
  action: string;
  hits24h: number;
  last: string;
  state: string;
}

export interface Integration {
  name: string;
  cat: string;
  status: string;
  events: string;
  since: string;
  icon: string;
}

export interface Compliance {
  framework: string;
  score: number;
  controls: number;
  passing: number;
  failing: number;
  partial: number;
  audit: string;
}

export interface DashboardData {
  org: OrgInfo;
  risk: RiskData;
  stats: Stats;
  topThreats: Threat[];
  browsers: Browser[];
  alerts: Alert[];
  extensions: Extension[];
  saasApps: SaasApp[];
  identity: IdentityEvent[];
  exfilEvents: ExfilEvent[];
  policies: Policy[];
  integrations: Integration[];
  compliance: Compliance[];
}

export const DATA: DashboardData = {
  org: {
    name: "Shinrai Holdings株式会社",
    shortCode: "SH",
    regions: ["APAC-TYO", "APAC-SIN", "NA-IAD", "EU-FRA"],
    managedBrowsers: 58432,
    managedUsers: 51204,
    activeSessions: 41268,
    lastUpdated: "2026/4/23 09:14:22 JST",
  },

  risk: {
    score: 72,
    scoreDelta: +4,
    grade: "C+",
    bands: { critical: 14, high: 87, medium: 342, low: 1204, info: 2891 },
    breakdown: [
      { label: "ブラウザ脆弱性", key: "vuln", score: 68, weight: 20 },
      { label: "拡張機能リスク", key: "ext", score: 82, weight: 18 },
      { label: "データ漏洩", key: "exfil", score: 58, weight: 22 },
      { label: "アイデンティティ", key: "identity", score: 74, weight: 15 },
      { label: "シャドーSaaS", key: "saas", score: 79, weight: 12 },
      { label: "ポリシー違反", key: "policy", score: 71, weight: 13 },
    ],
    trend: [62, 64, 63, 65, 68, 67, 66, 68, 70, 71, 69, 70, 71, 72],
  },

  stats: {
    alerts24h: 1843,
    alertsDelta: -12,
    blocked24h: 287,
    blockedDelta: +34,
    exfilEvents: 64,
    exfilDelta: +8,
    mttrMin: 14,
    mttrDelta: -3,
  },

  topThreats: [
    { id: "T-8842", sev: "critical", title: "CVE-2026-3091 V8型混乱 未パッチ", count: 1284, asset: "Chrome 131.x fleet", trend: [3, 5, 8, 11, 14, 18, 22, 28] },
    { id: "T-8841", sev: "high", title: "OAuthトークン抜き出し: Notion → unknown-cdn.io", count: 47, asset: "notion.so", trend: [1, 2, 2, 3, 4, 6, 8, 11] },
    { id: "T-8840", sev: "high", title: "悪質拡張機能検出: \"SuperTabs Pro\"", count: 212, asset: "Chrome Web Store", trend: [0, 0, 0, 2, 8, 31, 88, 212] },
    { id: "T-8839", sev: "high", title: "機密情報をAIに送信: chatgpt.com (PII + 財務)", count: 318, asset: "chatgpt.com", trend: [12, 18, 25, 31, 38, 44, 52, 64] },
    { id: "T-8838", sev: "medium", title: "大量ダウンロード検出: salesforce.com → ローカル", count: 21, asset: "salesforce.com", trend: [2, 3, 4, 5, 6, 7, 10, 12] },
  ],

  browsers: [
    { id: "BR-0001", host: "takahashi-mbp.sh.jp", user: "takahashi.yui@sh.co.jp", os: "macOS 15.2", browser: "Chrome 131.0.6778.205", risk: "high", alerts: 18, ext: 32, lastSeen: "2分前", region: "APAC-TYO", posture: ["EDR✓", "ディスク暗号✓", "DLPエージェント✗"] },
    { id: "BR-0002", host: "SH-DESK-4421", user: "kim.jihoon@sh.co.kr", os: "Windows 11", browser: "Edge 132.0.2957.127", risk: "medium", alerts: 7, ext: 14, lastSeen: "8分前", region: "APAC-SIN", posture: ["EDR✓", "ディスク暗号✓", "DLPエージェント✓"] },
    { id: "BR-0003", host: "schmidt-dev.sh.de", user: "mara.schmidt@sh.de", os: "Ubuntu 24.04", browser: "Chrome 131.0.6778.205", risk: "high", alerts: 12, ext: 9, lastSeen: "15分前", region: "EU-FRA", posture: ["EDR✓", "ディスク暗号✗", "DLPエージェント✓"] },
    { id: "BR-0004", host: "iad-finops-08", user: "priya.ramanan@sh.com", os: "Windows 11", browser: "Chrome 132.0.6834.83", risk: "low", alerts: 0, ext: 6, lastSeen: "1分前", region: "NA-IAD", posture: ["EDR✓", "ディスク暗号✓", "DLPエージェント✓"] },
    { id: "BR-0005", host: "tyo-legal-03", user: "nakamura.kenji@sh.co.jp", os: "macOS 14.7", browser: "Chrome 130.0.6723.117", risk: "medium", alerts: 4, ext: 11, lastSeen: "22分前", region: "APAC-TYO", posture: ["EDR✓", "ディスク暗号✓", "DLPエージェント✓"] },
    { id: "BR-0006", host: "sin-eng-tw-laptop", user: "wong.chenxi@sh.com.sg", os: "macOS 15.2", browser: "Brave 1.72.123", risk: "critical", alerts: 29, ext: 41, lastSeen: "4時間前", region: "APAC-SIN", posture: ["EDR✗", "ディスク暗号✓", "DLPエージェント✗"] },
    { id: "BR-0007", host: "SH-DESK-1102", user: "o-brien.aisling@sh.com", os: "Windows 11", browser: "Chrome 131.0.6778.205", risk: "medium", alerts: 5, ext: 12, lastSeen: "6分前", region: "NA-IAD", posture: ["EDR✓", "ディスク暗号✓", "DLPエージェント✓"] },
    { id: "BR-0008", host: "fra-data-02", user: "dubois.camille@sh.fr", os: "Ubuntu 24.04", browser: "Firefox 134.0", risk: "low", alerts: 1, ext: 3, lastSeen: "3分前", region: "EU-FRA", posture: ["EDR✓", "ディスク暗号✓", "DLPエージェント✓"] },
  ],

  alerts: [
    { id: "A-14482", ts: "09:12:44", sev: "critical", cat: "BDR", title: "CVE-2026-3091 V8型混乱のエクスプロイト試行", asset: "BR-0006 · wong.chenxi@sh.com.sg", dst: "hxxps://unknown-cdn.io/sw.js", state: "新規" },
    { id: "A-14481", ts: "09:11:18", sev: "high", cat: "Exfil", title: "機密データをAIに送信 (PII × 4, 財務 × 2)", asset: "BR-0001 · takahashi.yui", dst: "chatgpt.com", state: "トリアージ中" },
    { id: "A-14480", ts: "09:10:52", sev: "high", cat: "Identity", title: "OAuth scope昇格: Notion Workspace Admin", asset: "BR-0007 · o-brien.aisling", dst: "notion.so", state: "新規" },
    { id: "A-14479", ts: "09:09:40", sev: "high", cat: "Ext", title: "悪質拡張機能インストール: SuperTabs Pro", asset: "BR-0003 · mara.schmidt", dst: "chromewebstore.google.com", state: "新規" },
    { id: "A-14478", ts: "09:08:12", sev: "medium", cat: "Policy", title: "DLPルール違反: PII貼り付け → claude.ai", asset: "BR-0002 · kim.jihoon", dst: "claude.ai", state: "ブロック済" },
    { id: "A-14477", ts: "09:06:58", sev: "medium", cat: "Session", title: "異常な地理ログイン: TYO → LAX (4分)", asset: "BR-0005 · nakamura.kenji", dst: "login.microsoftonline.com", state: "調査中" },
    { id: "A-14476", ts: "09:05:03", sev: "high", cat: "Exfil", title: "大量ダウンロード: salesforce.com (218MB)", asset: "BR-0006 · wong.chenxi", dst: "salesforce.com", state: "新規" },
    { id: "A-14475", ts: "09:04:41", sev: "info", cat: "BDR", title: "WebRTC経由のローカルIP列挙", asset: "BR-0004 · priya.ramanan", dst: "x.com", state: "クローズ" },
    { id: "A-14474", ts: "09:03:12", sev: "high", cat: "Ext", title: "<all_urls>権限の新規昇格: Grammarly", asset: "BR-0001 · takahashi.yui", dst: "grammarly.com", state: "トリアージ中" },
    { id: "A-14473", ts: "09:02:05", sev: "critical", cat: "BDR", title: "Cookie窃取: document.cookie 読取 → 外部送信", asset: "BR-0006 · wong.chenxi", dst: "hxxps://unknown-cdn.io/c.gif", state: "新規" },
  ],

  extensions: [
    { name: "SuperTabs Pro", id: "mpogaebdhgnbelh...", installs: 212, perms: ["<all_urls>", "cookies", "webRequest", "tabs", "storage"], risk: "critical", status: "禁止対象", publisher: "Unknown", firstSeen: "2026/4/21", note: "最近アップデートでマルウェア挙動追加" },
    { name: "Grammarly", id: "kbfnbcaeplbcioak...", installs: 11204, perms: ["<all_urls>", "storage", "activeTab"], risk: "medium", status: "承認済", publisher: "Grammarly, Inc.", firstSeen: "2024/6/2", note: "" },
    { name: "1Password", id: "aeblfdkhhhdcdjpi...", installs: 18332, perms: ["<all_urls>", "nativeMessaging", "storage"], risk: "low", status: "承認済", publisher: "AgileBits", firstSeen: "2023/11/18", note: "" },
    { name: "Honey", id: "bmnlcjabgnpnenek...", installs: 4421, perms: ["<all_urls>", "cookies", "webRequest"], risk: "high", status: "レビュー中", publisher: "PayPal, Inc.", firstSeen: "2024/2/14", note: "アフィリエイト書換え挙動" },
    { name: "Claude", id: "fmkadmapgofadopl...", installs: 8820, perms: ["<all_urls>", "debugger", "nativeMessaging"], risk: "medium", status: "条件付承認", publisher: "Anthropic", firstSeen: "2026/1/22", note: "debugger権限要注意" },
    { name: "LastPass", id: "hdokiejnpimakedh...", installs: 2204, perms: ["<all_urls>", "storage"], risk: "medium", status: "非推奨", publisher: "LastPass US LP", firstSeen: "2022/3/10", note: "2022年侵害事件あり" },
    { name: "Video DownloadHelper", id: "lmjnegcaeklhafol...", installs: 188, perms: ["<all_urls>", "downloads", "webRequest", "nativeMessaging"], risk: "high", status: "レビュー中", publisher: "mig", firstSeen: "2025/9/3", note: "" },
  ],

  saasApps: [
    { name: "Salesforce", cat: "CRM", sanction: "承認済", users: 8204, sensitivity: "high", exfil: 38, aiIngress: 0, risk: "medium", trend: [200, 210, 220, 218, 230, 240, 255] },
    { name: "Notion", cat: "Docs", sanction: "承認済", users: 22140, sensitivity: "high", exfil: 112, aiIngress: 48, risk: "high", trend: [180, 200, 220, 230, 240, 245, 250] },
    { name: "ChatGPT", cat: "AI", sanction: "条件付", users: 31882, sensitivity: "critical", exfil: 284, aiIngress: 1284, risk: "critical", trend: [100, 150, 220, 310, 420, 530, 640] },
    { name: "Claude", cat: "AI", sanction: "条件付", users: 18209, sensitivity: "critical", exfil: 182, aiIngress: 802, risk: "critical", trend: [80, 120, 180, 240, 320, 400, 480] },
    { name: "Perplexity", cat: "AI", sanction: "未承認", users: 4418, sensitivity: "high", exfil: 88, aiIngress: 204, risk: "high", trend: [10, 30, 50, 80, 110, 130, 160] },
    { name: "Figma", cat: "Design", sanction: "承認済", users: 2204, sensitivity: "medium", exfil: 14, aiIngress: 0, risk: "low", trend: [90, 92, 94, 96, 98, 100, 102] },
    { name: "Dropbox", cat: "Storage", sanction: "承認済", users: 1018, sensitivity: "high", exfil: 42, aiIngress: 0, risk: "medium", trend: [40, 42, 44, 43, 45, 47, 48] },
    { name: "Granola", cat: "AI Meet", sanction: "未承認", users: 188, sensitivity: "high", exfil: 24, aiIngress: 88, risk: "high", trend: [0, 2, 8, 14, 22, 30, 40] },
    { name: "Personal Gmail", cat: "Email", sanction: "禁止", users: 442, sensitivity: "critical", exfil: 61, aiIngress: 0, risk: "critical", trend: [20, 22, 30, 38, 42, 48, 52] },
  ],

  identity: [
    { user: "wong.chenxi@sh.com.sg", risk: "critical", event: "OAuth scope昇格", app: "Notion", ts: "09:10:52", detail: "read → workspace.admin" },
    { user: "nakamura.kenji@sh.co.jp", risk: "high", event: "不可能な移動", app: "M365", ts: "09:06:58", detail: "TYO → LAX / 4分間" },
    { user: "takahashi.yui@sh.co.jp", risk: "high", event: "MFAバイパス試行", app: "Okta", ts: "08:58:24", detail: "3回連続プッシュ疲労" },
    { user: "priya.ramanan@sh.com", risk: "medium", event: "旧デバイスからのログイン", app: "Google", ts: "08:44:12", detail: "unknown-device-id-2281" },
    { user: "kim.jihoon@sh.co.kr", risk: "medium", event: "セッショントークン更新", app: "GitHub", ts: "08:40:08", detail: "PAT拡張" },
  ],

  exfilEvents: [
    { ts: "09:11:18", actor: "takahashi.yui", channel: "AIプロンプト", dst: "chatgpt.com", kind: "貼り付け", bytes: "2.4KB", classes: ["PII", "財務"], action: "許可 (監視)" },
    { ts: "09:06:12", actor: "wong.chenxi", channel: "ダウンロード", dst: "salesforce.com→local", kind: "一括エクスポート", bytes: "218MB", classes: ["顧客"], action: "ブロック" },
    { ts: "09:02:34", actor: "mara.schmidt", channel: "アップロード", dst: "dropbox.com", kind: "ファイル", bytes: "44MB", classes: ["ソース"], action: "ブロック" },
    { ts: "08:58:02", actor: "kim.jihoon", channel: "貼り付け", dst: "claude.ai", kind: "貼り付け", bytes: "812B", classes: ["PII"], action: "ブロック" },
    { ts: "08:52:44", actor: "o-brien", channel: "フォーム送信", dst: "unknown-cdn.io", kind: "POST", bytes: "1.2KB", classes: ["トークン"], action: "ブロック" },
    { ts: "08:48:18", actor: "priya.ramanan", channel: "印刷", dst: "local", kind: "PDF化", bytes: "8.8MB", classes: ["顧客"], action: "許可 (監視)" },
  ],

  policies: [
    { id: "P-001", name: "AI経由のPII漏洩防止", scope: "全ユーザー", action: "ブロック+通知", hits24h: 284, last: "09:11:18", state: "有効" },
    { id: "P-002", name: "未承認SaaSへのログイン禁止", scope: "財務部", action: "ブロック", hits24h: 42, last: "08:44:21", state: "有効" },
    { id: "P-003", name: "Salesforceからの一括エクスポート", scope: "営業部", action: "ブロック+承認", hits24h: 21, last: "09:05:03", state: "有効" },
    { id: "P-004", name: "Cookie読取の監視", scope: "全ユーザー", action: "アラートのみ", hits24h: 182, last: "09:02:05", state: "有効" },
    { id: "P-005", name: "危険権限拡張機能のブロック", scope: "全ユーザー", action: "ブロック", hits24h: 8, last: "08:20:11", state: "有効" },
    { id: "P-006", name: "暗号資産取引所のブロック", scope: "財務部以外", action: "ブロック", hits24h: 3, last: "07:12:02", state: "有効" },
    { id: "P-007", name: "個人メールへのリンク共有", scope: "全ユーザー", action: "警告+監視", hits24h: 61, last: "09:01:44", state: "下書き" },
  ],

  integrations: [
    { name: "Splunk Enterprise", cat: "SIEM", status: "接続", events: "4.2M/日", since: "2024/8/2", icon: "Activity" },
    { name: "CrowdStrike Falcon", cat: "EDR", status: "接続", events: "1.1M/日", since: "2024/11/18", icon: "Shield" },
    { name: "Okta", cat: "IdP", status: "接続", events: "382K/日", since: "2024/6/10", icon: "Key" },
    { name: "Palo Alto XSOAR", cat: "SOAR", status: "接続", events: "28K/日", since: "2025/3/22", icon: "Workflow" },
    { name: "Microsoft Sentinel", cat: "SIEM", status: "接続", events: "2.1M/日", since: "2025/1/8", icon: "Activity" },
    { name: "Azure AD (Entra)", cat: "IdP", status: "接続", events: "201K/日", since: "2024/4/1", icon: "Key" },
    { name: "Jamf Pro", cat: "MDM", status: "接続", events: "12K/日", since: "2024/9/3", icon: "Smartphone" },
    { name: "Slack", cat: "通知", status: "接続", events: "—", since: "2024/5/5", icon: "MessageSquare" },
    { name: "PagerDuty", cat: "通知", status: "接続", events: "—", since: "2024/5/5", icon: "Bell" },
    { name: "ServiceNow", cat: "ITSM", status: "未接続", events: "—", since: "—", icon: "Settings" },
  ],

  compliance: [
    { framework: "SOC 2 Type II", score: 94, controls: 64, passing: 60, failing: 2, partial: 2, audit: "2026/6/15" },
    { framework: "ISO 27001:2022", score: 89, controls: 93, passing: 82, failing: 4, partial: 7, audit: "2026/9/02" },
    { framework: "GDPR", score: 91, controls: 48, passing: 43, failing: 1, partial: 4, audit: "継続" },
    { framework: "NIST CSF 2.0", score: 81, controls: 108, passing: 88, failing: 6, partial: 14, audit: "継続" },
    { framework: "HIPAA", score: 76, controls: 54, passing: 41, failing: 4, partial: 9, audit: "2026/8/10" },
    { framework: "APPI (改正個人情報保護法)", score: 88, controls: 42, passing: 37, failing: 1, partial: 4, audit: "2026/5/30" },
  ],
};

import {
  Shield,
  Eye,
  AlertTriangle,
  Zap,
  Lock,
  LayoutDashboard,
  Download,
  Server,
  Database,
  Chrome,
  Globe,
  FileText,
  Scan,
  Activity,
  FileOutput,
  Network,
  Fingerprint,
  Puzzle,
} from 'lucide-react';
import type {
  ArchitectureCallout,
  DocSection,
  FeatureCard,
  GettingStartedStep,
  OverviewHighlight,
  PackageItem,
  PrivacyItem,
  TechStackRow,
} from './types';

export const DOC_SECTIONS: DocSection[] = [
  {
    id: 'overview',
    title: '概要',
    icon: FileText,
  },
  {
    id: 'getting-started',
    title: 'インストール',
    icon: Download,
  },
  {
    id: 'casb',
    title: 'CASB',
    icon: Eye,
    subsections: [
      { id: 'shadow-it', title: 'Shadow IT検出' },
      { id: 'auth', title: '認証フロー検出' },
    ],
  },
  {
    id: 'threat-protection',
    title: 'Threat Protection',
    icon: Shield,
    subsections: [
      { id: 'phishing', title: 'フィッシング検出' },
      { id: 'csp', title: 'CSP監視' },
      { id: 'security-hooks', title: 'セキュリティフック' },
    ],
  },
  {
    id: 'dlp-domain',
    title: 'DLP',
    icon: Scan,
    subsections: [
      { id: 'dlp', title: 'PII・機密データ検出' },
      { id: 'ai-prompt', title: 'AIプロンプト監視' },
      { id: 'network-monitoring', title: 'ネットワーク監視' },
    ],
  },
  {
    id: 'device-posture',
    title: 'Device Posture',
    icon: Activity,
    subsections: [
      { id: 'battacker', title: 'ブラウザ防御テスト' },
      { id: 'extension-analysis', title: '拡張機能分析' },
    ],
  },
  {
    id: 'visibility',
    title: 'Visibility',
    icon: LayoutDashboard,
    subsections: [
      { id: 'dashboard', title: 'ダッシュボード' },
      { id: 'data-export', title: 'データエクスポート' },
    ],
  },
  {
    id: 'architecture',
    title: 'アーキテクチャ',
    icon: Server,
    subsections: [
      { id: 'browser-only', title: 'ブラウザ完結型設計' },
      { id: 'detection-only', title: '検出のみアプローチ' },
      { id: 'tech-stack', title: '技術スタック' },
    ],
  },
  {
    id: 'privacy',
    title: 'プライバシー',
    icon: Lock,
  },
];

export const DEFAULT_EXPANDED_SECTION_IDS = new Set([
  'casb',
  'threat-protection',
  'dlp-domain',
  'device-posture',
  'visibility',
  'architecture',
]);

export const SUBSECTION_IDS = new Set(
  DOC_SECTIONS.flatMap((section) => section.subsections?.map((sub) => sub.id) ?? [])
);

export const MAIN_SECTION_BY_SUBSECTION = new Map(
  DOC_SECTIONS.flatMap((section) =>
    (section.subsections ?? []).map((sub) => [sub.id, section.id] as const)
  )
);

export const DOMAIN_METADATA: Record<string, { title: string; description: string; featureIds: string[] }> = {
  casb: {
    title: 'CASB',
    description: '未許可SaaSの検出と認証フローの可視化により、クラウドサービスの利用状況を把握。',
    featureIds: ['shadow-it', 'auth'],
  },
  'threat-protection': {
    title: 'Threat Protection',
    description: 'フィッシング、CSP違反、サプライチェーン攻撃などの脅威をリアルタイムに検出。',
    featureIds: ['phishing', 'csp', 'security-hooks'],
  },
  'dlp-domain': {
    title: 'DLP',
    description: 'PII検出、AIプロンプト監視、ネットワーク監視でデータ漏洩を防止。',
    featureIds: ['dlp', 'ai-prompt', 'network-monitoring'],
  },
  'device-posture': {
    title: 'Device Posture',
    description: 'ブラウザの防御力評価と拡張機能のリスク分析でデバイスセキュリティを確保。',
    featureIds: ['battacker', 'extension-analysis'],
  },
  visibility: {
    title: 'Visibility',
    description: 'セキュリティイベントの一元管理とデータエクスポートで可視性を確保。',
    featureIds: ['dashboard', 'data-export'],
  },
};

export const OVERVIEW_HIGHLIGHTS: OverviewHighlight[] = [
  {
    icon: Globe,
    title: 'ブラウザ完結型',
    description:
      'サーバー不要。インストールするだけで即座に利用開始。外部通信ゼロのゼロトラスト設計。',
  },
  {
    icon: Lock,
    title: 'プライバシー重視',
    description:
      'ブラウジングデータは端末のchrome.storage.localに留まり、外部に一切送信されません。',
  },
  {
    icon: Shield,
    title: '75+アラートカテゴリ',
    description:
      'Shadow IT、フィッシング、DLP、CSP違反など75以上のアラートカテゴリでブラウザセキュリティを包括的に監視。',
  },
];

export const OVERVIEW_FEATURES = [
  'Shadow IT（未許可SaaS）の検出と可視化',
  'Content Security Policy（CSP）違反のリアルタイム監視',
  'フィッシングサイト・NRD・Typosquatting検出',
  '15+プロバイダ対応のAIプロンプト監視とShadow AI検出',
  'OAuth/SAMLなどの認証フロー検出',
  'PII検出・機密データスキャンによるDLP保護',
  '100+攻撃シミュレーションによるブラウザ防御テスト（Battacker）',
  '拡張機能のリスクスコアリングと不審パターン検出',
  'メインワールドセキュリティフックによる深層検出',
  'ネットワーク監視とデータ漏洩検出',
  '複数フォーマット対応のデータエクスポート',
  'セキュリティイベントの一元管理ダッシュボード',
];

export const GETTING_STARTED_STEPS: GettingStartedStep[] = [
  {
    step: 1,
    title: 'Chrome拡張機能をインストール',
    description:
      'GitHubリリースページから最新版をダウンロードしてインストールします。Chrome・Firefoxに対応（WXTによるクロスブラウザビルド）。',
    cta: {
      href: 'https://github.com/plenoai/pleno-audit/releases',
      label: 'GitHubリリースを開く',
      icon: Chrome,
    },
  },
  {
    step: 2,
    title: '拡張機能を有効化',
    description:
      'インストール後、ブラウザのツールバーにシールドアイコンが表示されます。クリックしてポップアップを開き、初期設定を完了してください。',
  },
  {
    step: 3,
    title: 'ダッシュボードを確認',
    description:
      'ポップアップから「ダッシュボードを開く」をクリックすると、検出されたセキュリティイベントを一覧で確認できます。',
  },
];

export const FEATURE_CARDS: FeatureCard[] = [
  {
    id: 'shadow-it',
    icon: Eye,
    title: 'Shadow IT検出',
    description: 'IT部門が把握していないSaaSの利用状況を可視化。',
    details: [
      'ログインページの検出（URLパターン、フォーム構造、Passkeys、SAML対応）',
      'セッションCookieの検出',
      'プライバシーポリシー・利用規約・Cookieポリシーの発見',
      'サービス分類（AI、ストレージ、コミュニケーション等）',
      'Favicon抽出によるサービス識別',
    ],
  },
  {
    id: 'csp',
    icon: Shield,
    title: 'CSP監視',
    description: 'CSP違反イベントをリアルタイムに記録し、ポリシー改善に役立てる。',
    details: [
      'CSP違反イベントのリアルタイム検出',
      '違反タイプ別の分類（script-src、img-src等）',
      'ポリシー生成サポート',
      'ドメインレベルの違反集約',
      'セキュリティ推奨事項の提示',
    ],
  },
  {
    id: 'phishing',
    icon: AlertTriangle,
    title: 'フィッシング検出',
    description: 'NRD・Typosquatting・IDNホモグラフ攻撃をヒューリスティクスで検出。',
    details: [
      'NRD検出（RDAP＋ヒューリスティクス：エントロピー、ハイフン/数字過多、DDNS検出）',
      'Typosquat検出（IDNホモグラフ：ラテン、キリル、ギリシャ、日本語の同形文字）',
      '混合スクリプト検出、Punycode分析',
      '信頼度スコアリング（high/medium/low/unknown）',
    ],
  },
  {
    id: 'ai-prompt',
    icon: Zap,
    title: 'AIプロンプト監視',
    description:
      '15+プロバイダ対応。Shadow AI検出とAIポリシー自動生成でAI利用を包括管理。',
    details: [
      '15+AIプロバイダの検出（OpenAI、Anthropic、Google、Azure、Cohere、Mistral等）',
      '未許可AIサービスのShadow AI検出',
      'リクエスト構造による汎用検出（URLパターン非依存）',
      'プロンプト送信・レスポンス受信のログ記録',
      '利用パターンに基づくAIポリシー自動生成',
    ],
  },
  {
    id: 'auth',
    icon: Lock,
    title: '認証フロー検出',
    description: 'OAuth/SAML等の認証イベントを記録し、SSOの利用状況を把握。',
    details: [
      'OAuthフローの検出（authorization_code、implicit等）',
      'SAMLアサーションの検出',
      'SSOログインの追跡',
    ],
  },
  {
    id: 'dlp',
    icon: Scan,
    title: 'DLP・データ保護',
    description: 'PII検出と機密データスキャンにより、データ漏洩リスクを未然に防止。',
    details: [
      '25+データタイプにわたるPII検出',
      'クレジットカード番号のLuhnアルゴリズム検証',
      'シャノンエントロピー分析によるシークレット検出',
      'DLPルール：クレジットカード、APIキー、パスワード、トークン、SSN、メールアドレス',
      '拡張DLP：医療、金融、企業データ',
      'AIプロンプト内の機密データスキャン',
      'クリップボード・フォームスキャン',
      'pleno-anonymize連携（オプションのローカルDLPサーバー）',
    ],
  },
  {
    id: 'battacker',
    icon: Activity,
    title: 'ブラウザ防御テスト（Battacker）',
    description:
      '100+攻撃シミュレーションでブラウザの防御力を定量評価。',
    details: [
      '22+カテゴリにわたる100+攻撃シミュレーション',
      'カテゴリ：ネットワーク、フィッシング、クライアントサイド、永続化、サイドチャネル等',
      'フィンガープリント、クリプトジャッキング、隠蔽チャネル、インジェクション検出',
      'サンドボックスエスケープ、ゼロデイシミュレーション',
      '防御グレードスコアリング（A/B/C/D/F）',
      'テスト履歴追跡',
      '専用拡張機能およびWebインターフェース',
    ],
  },
  {
    id: 'extension-analysis',
    icon: Puzzle,
    title: '拡張機能分析',
    description:
      'インストール済み拡張機能のリスクスコアリングと不審パターン検出。',
    details: [
      'パーミッション分析に基づくリスクスコアリング',
      '不審パターン検出（大量リクエスト、深夜アクティビティ、エンコードパラメータ、ドメイン多様性）',
      'DoH（DNS over HTTPS）トラフィック監視',
      'Cookie動作追跡',
      '拡張機能ごとのネットワークアクティビティ分析',
    ],
  },
  {
    id: 'security-hooks',
    icon: Fingerprint,
    title: 'セキュリティフック',
    description:
      'メインワールドJavaScript注入による深層セキュリティ検出。',
    details: [
      'フィンガープリント検出（Canvas、WebGL、AudioContext）',
      'サプライチェーン攻撃検出（SRI欠落）',
      '隠蔽チャネル検出（WebSocket、WebRTC、Broadcast Channel）',
      '動的コード実行検出',
      'CSSキーロギング、プロトタイプ汚染、オープンリダイレクト検出',
    ],
  },
  {
    id: 'network-monitoring',
    icon: Network,
    title: 'ネットワーク監視',
    description:
      'DNRルール管理とネットワークアクティビティ監視でデータ漏洩を検出。',
    details: [
      'Declarative Net Request（DNR）ルール管理',
      'リダイレクトチェーンの検出と分析',
      '拡張機能ネットワークアクティビティ監視',
      'データ漏洩検出（大容量POSTリクエスト）',
      'トラッキングビーコン検出',
    ],
  },
  {
    id: 'data-export',
    icon: FileOutput,
    title: 'データエクスポート',
    description:
      'セキュリティデータを複数フォーマットでエクスポート。レポート生成に対応。',
    details: [
      '複数フォーマット対応：JSON、CSV、Markdown、HTML',
      'サービス・違反・アラートのエクスポート',
      'AIプロンプトと検出サービスを含む監査ログ',
      'メタデータ付きレポート生成',
    ],
  },
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    title: 'ダッシュボード',
    description: '検出イベントの一覧表示、セキュリティポスチャスコアリング。',
    details: [
      'リアルタイムのイベント表示',
      'フィルタリング・検索機能',
      'セキュリティポスチャスコアリング',
      'ダークモード対応',
      'chrome.storage.localによるデータ管理',
    ],
  },
];

export const ARCHITECTURE_CALLOUTS: ArchitectureCallout[] = [
  {
    id: 'browser-only',
    title: 'ブラウザ完結型設計',
    description:
      'サーバー連携不要。データはchrome.storage.localに保存され外部に送信されない。libztbs（Zero Trust Browser Security）アーキテクチャにより、セキュリティ機能はモジュラーパッケージとして構成。',
  },
  {
    id: 'detection-only',
    title: '検出のみ',
    description: 'デフォルトではブロックしないため、誤検知を気にせずに気軽に導入できます。',
    chips: [
      {
        icon: Eye,
        label: '検出',
        className:
          'flex items-center gap-2 px-4 py-2 rounded-full bg-[#e6f4ff] dark:bg-[#0a2a3d] text-[#0050b3] dark:text-[#60a5fa]',
        iconClassName: 'h-4 w-4',
      },
      {
        icon: LayoutDashboard,
        label: '可視化',
        className:
          'flex items-center gap-2 px-4 py-2 rounded-full bg-[#d3f9d8] dark:bg-[#0a3d1a] text-[#0a7227] dark:text-[#4ade80]',
        iconClassName: 'h-4 w-4',
      },
      {
        icon: FileText,
        label: 'レポート',
        className:
          'flex items-center gap-2 px-4 py-2 rounded-full bg-[#fff8e6] dark:bg-[#3d2e0a] text-[#915b00] dark:text-[#fbbf24]',
        iconClassName: 'h-4 w-4',
      },
    ],
  },
];

export const TECH_STACK_ROWS: TechStackRow[] = [
  { label: '拡張機能', value: 'Chrome Manifest V3（+ Firefox via WXT）' },
  { label: 'ビルド', value: 'WXT' },
  { label: 'UI', value: 'Preact（拡張機能）/ React（Website・Battacker Web）' },
  { label: 'ストレージ', value: 'chrome.storage.local' },
  { label: '言語', value: 'TypeScript' },
  { label: 'テスト', value: 'Playwright（E2E）/ Vitest（ユニット）' },
];

export const PACKAGE_ITEMS: PackageItem[] = [
  {
    icon: Database,
    title: '@libztbs/types',
    description: 'コア型定義',
  },
  {
    icon: Database,
    title: '@libztbs/detectors',
    description: 'CASBドメイン（サービス検出、認証検出）',
  },
  {
    icon: Shield,
    title: '@libztbs/csp',
    description: 'CSP監査（違反検出、ポリシー生成）',
  },
  {
    icon: AlertTriangle,
    title: '@libztbs/nrd, @libztbs/typosquat',
    description: 'NRD・Typosquatting検出アルゴリズム',
  },
  {
    icon: Zap,
    title: '@libztbs/ai-detector',
    description: 'AI検出・DLPアルゴリズム',
  },
  {
    icon: Shield,
    title: '@libztbs/alerts',
    description: 'Posture/Policy/Alertセキュリティ基盤（75+カテゴリ）',
  },
  {
    icon: Activity,
    title: '@libztbs/battacker',
    description: 'ブラウザ防御耐性テスト（100+攻撃シミュレーション）',
  },
  {
    icon: FileOutput,
    title: '@libztbs/data-export',
    description: 'セキュリティデータエクスポート（JSON/CSV/Markdown/HTML）',
  },
  {
    icon: Puzzle,
    title: '@libztbs/extension-analyzers',
    description: '拡張機能分析（リスク評価・統計分析・DoH監視）',
  },
  {
    icon: Fingerprint,
    title: '@libztbs/main-world-hooks',
    description: 'メインワールドセキュリティフック（API監視・フィンガープリント検出）',
  },
  {
    icon: Network,
    title: '@libztbs/extension-network-service',
    description: 'ネットワーク監視・DNRルール管理',
  },
  {
    icon: Server,
    title: '@libztbs/extension-runtime',
    description: '拡張機能ランタイム（ロガー・メッセージング・ストレージ）',
  },
  {
    icon: Lock,
    title: '@libztbs/extension-enterprise',
    description: 'エンタープライズ機能（OIDC・SAML SSO、管理構成）',
  },
  {
    icon: Chrome,
    title: 'app/audit-extension',
    description: 'Chrome/Firefox拡張機能（WXT + Preact）',
  },
  {
    icon: Activity,
    title: 'app/battacker-extension, app/battacker-web',
    description: 'Battacker拡張機能・Webインターフェース',
  },
];

export const PRIVACY_ITEMS: PrivacyItem[] = [
  {
    icon: Lock,
    title: '端末内完結',
    description: 'データはchrome.storage.localに保存。外部送信ゼロ。',
    badgeClassName: 'bg-[#d3f9d8] dark:bg-[#0a3d1a]',
    iconClassName: 'h-3 w-3 text-[#0a7227] dark:text-[#4ade80]',
  },
  {
    icon: Lock,
    title: 'ユーザー管理',
    description: 'アンインストール時にデータ削除。',
    badgeClassName: 'bg-[#d3f9d8] dark:bg-[#0a3d1a]',
    iconClassName: 'h-3 w-3 text-[#0a7227] dark:text-[#4ade80]',
  },
  {
    icon: Shield,
    title: '外部通信ポリシー',
    description:
      'プロダクトポリシーにより外部通信は禁止。oxlintで違反を自動検出。',
    badgeClassName: 'bg-[#d3f9d8] dark:bg-[#0a3d1a]',
    iconClassName: 'h-3 w-3 text-[#0a7227] dark:text-[#4ade80]',
  },
  {
    icon: Eye,
    title: 'エンタープライズ連携（オプション）',
    description:
      '企業向けにOIDC/SAML SSO・管理構成をオプション提供。ユーザーの同意を経て有効化。',
    badgeClassName: 'bg-[#e6f4ff] dark:bg-[#0a2a3d]',
    iconClassName: 'h-3 w-3 text-[#0050b3] dark:text-[#60a5fa]',
  },
];

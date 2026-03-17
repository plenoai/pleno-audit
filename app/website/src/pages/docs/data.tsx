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
    id: 'features',
    title: '機能',
    icon: Zap,
    subsections: [
      { id: 'shadow-it', title: 'Shadow IT検出' },
      { id: 'csp', title: 'CSP監視' },
      { id: 'phishing', title: 'フィッシング検出' },
      { id: 'ai-prompt', title: 'AIプロンプト監視' },
      { id: 'auth', title: '認証フロー検出' },
      { id: 'dashboard', title: 'ダッシュボード' },
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

export const DEFAULT_EXPANDED_SECTION_IDS = new Set(['features', 'architecture']);

export const SUBSECTION_IDS = new Set(
  DOC_SECTIONS.flatMap((section) => section.subsections?.map((sub) => sub.id) ?? [])
);

export const MAIN_SECTION_BY_SUBSECTION = new Map(
  DOC_SECTIONS.flatMap((section) =>
    (section.subsections ?? []).map((sub) => [sub.id, section.id] as const)
  )
);

export const OVERVIEW_HIGHLIGHTS: OverviewHighlight[] = [
  {
    icon: Globe,
    title: 'ブラウザ完結型',
    description: 'サーバー不要。インストールするだけで即座に利用開始できます。',
  },
  {
    icon: Lock,
    title: 'プライバシー重視',
    description: 'ブラウジングデータは端末に留まり、外部に送信されません。',
  },
];

export const OVERVIEW_FEATURES = [
  'Shadow IT（未許可SaaS）の検出と可視化',
  'Content Security Policy（CSP）違反の監視',
  'フィッシングサイト・悪意あるドメインの検出',
  'AIサービスへのプロンプト送信の監視',
  'OAuth/SAMLなどの認証フローの検出',
  'セキュリティイベントの一元管理ダッシュボード',
];

export const GETTING_STARTED_STEPS: GettingStartedStep[] = [
  {
    step: 1,
    title: 'Chrome拡張機能をインストール',
    description: 'Chrome Web Storeから拡張機能をインストールします。',
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
      'ログインページの検出（URLパターン、フォーム構造）',
      'セッションCookieの検出',
      'プライバシーポリシー・利用規約のリンク検出',
      'サービス分類（AI、ストレージ、コミュニケーション等）',
    ],
  },
  {
    id: 'csp',
    icon: Shield,
    title: 'CSP監視',
    description: 'CSP違反イベントを記録し、ポリシー改善に役立てる。',
    details: [
      'CSP違反イベントのリアルタイム検出',
      '違反タイプ別の分類（script-src、img-src等）',
      'ポリシー生成のサポート',
      'parquet-storageによるローカルストレージで高速な分析',
    ],
  },
  {
    id: 'phishing',
    icon: AlertTriangle,
    title: 'フィッシング検出',
    description: '新規登録ドメインやTyposquattingを検出。',
    details: [
      'NRD（Newly Registered Domain）検出',
      'Typosquatting検出（有名サービスの類似ドメイン）',
      'URLパターンマッチング',
    ],
  },
  {
    id: 'ai-prompt',
    icon: Zap,
    title: 'AIプロンプト監視',
    description: 'ChatGPT等へのプロンプト送信を記録。機密情報の流出リスクを把握。',
    details: [
      'ChatGPT、Claude、Gemini等のAIサービスを自動検出',
      'リクエスト構造による汎用検出（URLパターン非依存）',
      'プロンプト送信・レスポンス受信のログ記録',
    ],
  },
  {
    id: 'auth',
    icon: Lock,
    title: '認証フロー検出',
    description: 'OAuth/SAML等の認証イベントを記録。',
    details: [
      'OAuthフローの検出（authorization_code、implicit等）',
      'SAMLアサーションの検出',
      'SSOログインの追跡',
    ],
  },
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    title: 'ダッシュボード',
    description: '検出イベントの一覧表示とフィルタリング。',
    details: [
      'リアルタイムのイベント表示',
      'フィルタリング・検索機能',
      'parquet-storageによる高速なクエリ処理',
      'ダークモード対応',
    ],
  },
];

export const ARCHITECTURE_CALLOUTS: ArchitectureCallout[] = [
  {
    id: 'browser-only',
    title: 'ブラウザ完結型設計',
    description:
      'サーバー連携不要のため、インストールするだけで使い始められる。データは端末のIndexedDB/SQLiteに保存され、外部に送信されない。',
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
  { label: '拡張機能', value: 'Chrome Manifest V3' },
  { label: 'ビルド', value: 'WXT' },
  { label: 'UI', value: 'Preact' },
  { label: 'DB', value: 'parquet-storage (IndexedDB)' },
  { label: '言語', value: 'TypeScript' },
];

export const PACKAGE_ITEMS: PackageItem[] = [
  {
    icon: Database,
    title: 'packages/detectors',
    description: 'CASBドメイン（サービス検出、認証検出）',
  },
  {
    icon: Shield,
    title: 'packages/csp',
    description: 'CSP監査（違反検出、ポリシー生成）',
  },
  {
    icon: AlertTriangle,
    title: 'packages/nrd, typosquat',
    description: 'ドメイン検出アルゴリズム',
  },
  {
    icon: Zap,
    title: 'packages/ai-detector',
    description: 'AIサービス検出アルゴリズム',
  },
  {
    icon: Server,
    title: 'packages/api',
    description: 'REST API（Hono + parquet-storage）',
  },
  {
    icon: Chrome,
    title: 'app/audit-extension',
    description: 'Chrome拡張機能（WXT + Preact）',
  },
];

export const PRIVACY_ITEMS: PrivacyItem[] = [
  {
    icon: Lock,
    title: '端末内完結',
    description: 'データは端末内のIndexedDB/SQLiteに保存。外部送信なし。',
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
    icon: Eye,
    title: 'サーバー連携（予定）',
    description: '企業向けにオプションで提供予定。送信データはユーザー確認を経る。',
    badgeClassName: 'bg-[#e6f4ff] dark:bg-[#0a2a3d]',
    iconClassName: 'h-3 w-3 text-[#0050b3] dark:text-[#60a5fa]',
  },
];

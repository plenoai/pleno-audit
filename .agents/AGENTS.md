CASB/Browser Security

## 構造

### パッケージ

- `packages/detectors/` - CASBドメイン（サービス検出、認証検出）
- `packages/csp/` - CSP監査（違反検出、ポリシー生成、レポーター）
- `packages/nrd/` - NRDアルゴリズム
- `packages/typosquat/` - typosquattingアルゴリズム
- `packages/ai-detector/` - AI検出アルゴリズム
- `packages/alerts/` - リアルタイムセキュリティアラート基盤
- `packages/battacker/` - ブラウザ防御耐性テスト用コアライブラリ
- `packages/data-export/` - セキュリティデータエクスポート（JSON/CSV/Markdown/HTML）
- `packages/storage/` - イベントストア基盤
- `packages/extension-runtime/` - 拡張機能ランタイム（ストレージ、APIクライアント、同期）
- `packages/background-services/` - 拡張機能バックグラウンドサービスのファサード
- `packages/debug-bridge/` - デバッグサーバーとの通信ブリッジ
- `packages/extension-network-service/` - ネットワーク監視・DNR管理
- `packages/event-queue/` - 非同期イベント処理キュー

### アプリケーション

- `app/audit-extension/` - Chrome拡張（WXT + Preact）
- `app/battacker-extension/` - Battacker Chrome/Firefox拡張
- `app/battacker-web/` - Battackerスコア可視化Webアプリ
- `app/battacker-e2e/` - Battacker E2Eテスト（Playwright）
- `app/web-dashboard/` - CSP違反・ポリシーダッシュボード
- `app/website/` - プロダクトWebサイト
- `app/debugger/` - 拡張機能デバッガーCLI

詳細は各パッケージの`index.ts`を参照。

## ロギング

`console.*`の代わりに`createLogger`を使用する

```typescript
import { createLogger } from "@pleno-audit/extension-runtime";

const logger = createLogger("module-name");

logger.debug("開発時のみ出力");
logger.info("情報ログ");
logger.warn("警告");
logger.error("エラー", error);
```

開発モードでは`pleno-debug logs`でリアルタイム監視可能。
dashboard.html, popup.htmlはbrowser操作不可。

## 動作確認

```bash
# Backgroundで開発環境を起動
pnpm dev

# 別プロセスでブラウザ操作
pnpm --filter @pleno-audit/debugger start browser open example.com
pnpm --filter @pleno-audit/debugger start status
```

## Prodct Policy

### 外部通信禁止
- プライバシー保護のため、外部サーバーとの通信は禁止する
- oxlintにて違反を検出しています
- ユーザーの同意を経て、デフォルトで無効化するなどの措置を取る上でoxlintrcでの除外設定とプライバシーポリシーの更新が必要です

### 外部DB禁止
- GETではあるが、通信しないというポリシーに従って外部DB（脆弱性DB、Blacklist）へのアクセスは禁止する
- ローカルで完結するアルゴリズムを考案すること。（例：typosquattingはヒューリスティックアルゴリズムのみ適用されています）
- ローカルであろうと、特定のサービスのみに適用可能なパターン検出も基本禁止です。
- 未知のサービスへの柔軟性を高める意味があります。
- 新しいサービスが生まれた場合の継続的なアップデート負荷軽減を考えた上での軽量DB導入はユーザーの同意を得た上でバンドル可能です。

## ブランチ運用

- `main` - 開発ブランチ（pushごとにrelease作成）

### 開発フロー

1. mainからfeatureブランチを作成
2. featureブランチで開発・テスト
3. mainにPR作成 → マージ → release自動作成

## ADR

@docs/adr/README.md

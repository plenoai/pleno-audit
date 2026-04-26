CASB/Browser Security

## 構造

### libztbs — Zero Trust Browser Security（`packages/`）

ゼロトラストブラウザセキュリティの完全な基盤ライブラリ。
libztbsだけでブラウザセキュリティ拡張機能を構築可能。

#### コアドメイン
- `packages/types/` - コア型定義（@libztbs/types）
- `packages/detectors/` - CASBドメイン：サービス検出、認証検出（@libztbs/detectors）
- `packages/csp/` - CSP監査：違反検出、ポリシー生成（@libztbs/csp）
- `packages/nrd/` - NRD検出アルゴリズム（@libztbs/nrd）
- `packages/typosquat/` - タイポスクワット検出アルゴリズム（@libztbs/typosquat）
- `packages/ai-detector/` - AI検出・DLPアルゴリズム（@libztbs/ai-detector）
- `packages/alerts/` - Posture/Policy/Alertセキュリティ基盤（@libztbs/alerts）
- `packages/battacker/` - ブラウザ防御耐性テスト（@libztbs/battacker）
- `packages/data-export/` - セキュリティデータエクスポート（@libztbs/data-export）
- `packages/extension-analyzers/` - 拡張機能分析：リスク評価・統計分析・DoH監視（@libztbs/extension-analyzers）
- `packages/main-world-hooks/` - メインワールドセキュリティフック：API監視・フィンガープリント検出（@libztbs/main-world-hooks）

#### 拡張機能ランタイム
- `packages/extension-runtime/` - 拡張機能ランタイム（@libztbs/extension-runtime）
- `packages/background-services/` - バックグラウンドサービス（@libztbs/background-services）
- `packages/extension-network-service/` - ネットワーク監視・DNR管理（@libztbs/extension-network-service）
- `packages/extension-enterprise/` - エンタープライズ機能（@libztbs/extension-enterprise）
- `packages/debug-bridge/` - デバッグブリッジ（@libztbs/debug-bridge）

### pleno-audit アプリケーション（`app/`）

libztbsのフロントエンド実装。UIのみ。

- `app/audit-extension/` - Chrome拡張（WXT + Preact）
- `app/battacker-extension/` - Battacker Chrome/Firefox拡張
- `app/battacker-web/` - Battackerスコア可視化Webアプリ
- `app/battacker-e2e/` - Battacker E2Eテスト（Playwright）
- `app/website/` - プロダクトWebサイト
- `app/debugger/` - 拡張機能デバッガーCLI

詳細は各パッケージの`index.ts`を参照。

## ロギング

`console.*`の代わりに`createLogger`を使用する

```typescript
import { createLogger } from "@libztbs/extension-runtime";

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

実装完了後は必ず `pnpm build` でビルド確認すること。

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

## テスト

@docs/TESTING.md

## 品質評価

### Mutation Testing
テストスイートの実効性を評価する手法として Stryker による mutation testing を導入している。
コードに意図的な変異（mutant）を注入し、テストが検知できるかを測定することで、カバレッジでは見えないテストの「中身」の品質を評価する。

```bash
pnpm test:mutation
```

CI では実行コストが大きいため除外しており、品質改善時にローカルもしくは手動で実行する運用とする。
設定は `stryker.config.json` / `vitest.stryker.config.ts` を参照。

## ADR

@docs/adr/README.md

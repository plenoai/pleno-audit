# Testing Guide

## テスト戦略

テストは4層構造で設計されている。

| 層 | フレームワーク | 対象 | 実行頻度 |
|---|---|---|---|
| Unit | Vitest | packages/\* の純粋関数 | 毎CI |
| Property-Based | Vitest + fast-check | 検出アルゴリズムの不変条件 | 毎CI |
| Component | Vitest + Testing Library | app/audit-extension UI | 毎CI |
| E2E | Playwright | 拡張機能の統合動作 | 手動 |

## テスト実行

```bash
# 全ユニットテスト
pnpm test

# UIコンポーネントテスト
pnpm test:ui

# 全テスト（unit + UI）
pnpm test:all

# ウォッチモード
pnpm test:watch

# カバレッジレポート
pnpm test:coverage

# Mutation Testing（nrd, typosquat）
pnpm test:mutation

# E2Eテスト（要ビルド済み拡張）
pnpm -C app/battacker-e2e test
```

## ファイル命名規則

| パターン | 用途 |
|---|---|
| `*.test.ts` | ユニットテスト・統合テスト |
| `*.test.tsx` | UIコンポーネントテスト |
| `*.property.ts` | Property-Based テスト |
| `*.realworld.test.ts` | 実世界データでのTP/FP検証 |
| `*.snapshot.test.ts` | スナップショットテスト |

テストファイルはソースと同じディレクトリに配置する（colocated pattern）。

## カバレッジ閾値

リスクに応じた段階的閾値を設定している。

| パッケージ | Lines | Functions | Branches | 理由 |
|---|---|---|---|---|
| nrd | 95% | 95% | 95% | セキュリティ検出の根幹 |
| typosquat | 95% | 95% | 95% | セキュリティ検出の根幹 |
| detectors | 90% | 90% | 85% | 検出ロジック |
| ai-detector | 70% | 70% | 60% | 複雑なML隣接ロジック |
| data-export | 75% | 65% | 65% | エクスポート機能 |
| extension-runtime | 65% | 70% | 65% | ランタイムユーティリティ |

## Mutation Testing

Stryker.jsを使用して、nrdとtyposquatパッケージのテスト品質を検証する。

```bash
pnpm test:mutation
```

閾値:
- **break**: 80% — これを下回るとCIが失敗
- **low**: 85% — 警告レベル
- **high**: 95% — 目標レベル

レポートは `reports/mutation/index.html` に生成される。

## 共有テストユーティリティ

`@libztbs/test-utils` パッケージで共通ヘルパーを提供:

- `setupChromeMock()` — Chrome Extension APIのモック
- `resetChromeMock()` — モック状態のリセット
- `createMockLogger()` — ロガーモック
- `createNetworkRequestRecord()` — テスト用ネットワークリクエスト生成
- `createService()` — テスト用サービスデータ生成

## E2Eテスト

Playwrightで拡張機能の統合テストを実行する。プロジェクトごとにタイムアウトを設定:

| プロジェクト | タイムアウト | 理由 |
|---|---|---|
| fp-smoke | 1分 | 軽量、外部依存なし |
| audit-integration | 3分 | 拡張ロード + フラッシュサイクル |
| dnr-monitor | 3分 | 同上 |
| defense-score | 3分 | 同上 |
| browsertotal | 10分 | 外部ページのポーリング |
| battacker | 10分 | 同上 |

## テスト追加ガイドライン

1. **セキュリティ検出ロジック**: 正常系 + 異常系（malformed入力） + property-basedの3点セット
2. **構造化出力**: スナップショットテストで意図しない変更を検知
3. **UIコンポーネント**: `renderWithTheme()` ラッパーを使用
4. **Chrome APIモック**: `@libztbs/test-utils` の `setupChromeMock()` を使用

# ADR-054: libztbs — ゼロトラストブラウザ基盤の分離

## Status

Accepted (Supersedes ADR-048)

## Context

libghostty（Ghosttyのターミナルエミュレーション基盤ライブラリ）の思想に触発された設計判断である。

> "Rather than having hundreds of applications reinvent terminal emulation independently,
> libghostty provides a cross-platform, minimal dependency library."

pleno-auditは、ゼロトラストブラウザセキュリティのコアロジック（Posture/Policy/Alert、サービス検出、CSP分析、NRD検出、タイポスクワット検出、AI検出、拡張機能ランタイム等）とChrome拡張機能のフロントエンド実装が同一リポジトリ内で混在していた。

libghosttyが「ターミナルエミュレーション基盤」を提供しフロントエンドは薄いラッパーとするように、libztbsは「ゼロトラストブラウザセキュリティ基盤」を完全に提供し、pleno-auditはそのフロントエンド実装にすぎない状態を目指す。

## Decision

### 全ライブラリを`@libztbs/*`スコープとして`lib/`に配置する

```
lib/                                   # libztbs — Zero Trust Browser Security
├── types/                             # @libztbs/types (コア型定義)
├── detectors/                         # @libztbs/detectors (サービス検出)
├── csp/                               # @libztbs/csp (CSP分析)
├── nrd/                               # @libztbs/nrd (NRD検出)
├── typosquat/                         # @libztbs/typosquat (タイポスクワット)
├── ai-detector/                       # @libztbs/ai-detector (AI検出・DLP)
├── alerts/                            # @libztbs/alerts (Posture/Policy/Alert)
├── battacker/                         # @libztbs/battacker (防御耐性テスト)
├── data-export/                       # @libztbs/data-export (データエクスポート)
├── extension-runtime/                 # @libztbs/extension-runtime (拡張機能ランタイム)
├── extension-network-service/         # @libztbs/extension-network-service (ネットワーク監視)
├── extension-enterprise/              # @libztbs/extension-enterprise (エンタープライズ)
├── background-services/               # @libztbs/background-services (バックグラウンドサービス)
└── debug-bridge/                      # @libztbs/debug-bridge (デバッグブリッジ)

app/                                   # pleno-audit — フロントエンド実装
├── audit-extension/                   # @pleno-audit/audit-extension
├── battacker-extension/               # Battacker拡張
├── battacker-web/                     # Battacker Web
├── debugger/                          # @pleno-audit/debugger
└── ...
```

### 移行対象

旧`@pleno-audit/*`パッケージは全て`@libztbs/*`に移行。`packages/`ディレクトリは廃止。

| 元パッケージ | 移行先 |
|---|---|
| `@pleno-audit/casb-types` + `@pleno-audit/storage` | `@libztbs/types` |
| `@pleno-audit/detectors` | `@libztbs/detectors` |
| `@pleno-audit/csp` | `@libztbs/csp` |
| `@pleno-audit/nrd` | `@libztbs/nrd` |
| `@pleno-audit/typosquat` | `@libztbs/typosquat` |
| `@pleno-audit/ai-detector` | `@libztbs/ai-detector` |
| `@pleno-audit/alerts` | `@libztbs/alerts` |
| `@pleno-audit/battacker` | `@libztbs/battacker` |
| `@pleno-audit/data-export` | `@libztbs/data-export` |
| `@pleno-audit/extension-runtime` | `@libztbs/extension-runtime` |
| `@pleno-audit/extension-network-service` | `@libztbs/extension-network-service` |
| `@pleno-audit/extension-enterprise` | `@libztbs/extension-enterprise` |
| `@pleno-audit/background-services` | `@libztbs/background-services` |
| `@pleno-audit/debug-bridge` | `@libztbs/debug-bridge` |

### 設計原則（libghosttyに倣う）

1. **完全な基盤**: libztbsだけでゼロトラストブラウザセキュリティ拡張機能を構築可能
2. **ファミリー・オブ・ライブラリ**: 各パッケージは独立して使用可能
3. **実戦で証明済み**: pleno-auditで実運用中のロジックをそのまま抽出
4. **フロントエンドは薄いラッパー**: `app/`にはUI実装のみ、ドメインロジックはゼロ

### ADR-048との関係

ADR-048は`app/audit-extension/lib/`（アプリ内lib）の禁止方針。本ADRはその精神を発展させ、全ドメインロジックを`lib/`に`@libztbs/*`として配置する方針に昇格させた。`packages/`ディレクトリは廃止。

## Consequences

### Positive

- libztbsを使えば、pleno-audit以外のフロントエンド（CLI監査ツール、Webアプリ、他のブラウザ拡張等）を構築可能
- pleno-auditはlibztbsの「ショーケース実装」として位置づけられる
- `@libztbs/*`スコープにより、ライブラリとしてのアイデンティティが確立
- 将来的にlibztbsを別リポジトリに分離することも容易

### Negative

- 全importパスの書き換えが必要（機械的だが広範囲）
- CI/CD設定の更新が必要

### Risks

- 移行中のビルド破損（typecheck/test/lintで段階的に検証済み）

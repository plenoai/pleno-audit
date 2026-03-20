# ADR 051: parquet-storage廃止とposture/policy/alertストレージモデル

## ステータス

Accepted（ADR-031をSupersede）

## コンテキスト

### 現状の問題

ADR-031でsql.jsからparquet-storageへ移行し、バンドルサイズを62%削減した。しかし運用を通じて以下の問題が明らかになった:

1. **過剰なスキーマ**: 11テーブル定義中、実際に書き込まれるのは3テーブル（events, network-requests, csp-violations）のみ。残り8テーブル（nrd-detections, typosquat-detections, cookies, login-detections, privacy-policies, terms-of-service, domain-risk-profiles, service-inventory）は未使用
2. **不要な複雑性**: IndexedDB上のParquetエンコーディング、WriteBuffer、DynamicIndexCache等の仕組みが、実際のデータ量に対して過剰
3. **サーバー側の形骸化**: `app/server`のServerParquetAdapterはJSON直列化であり、Parquetバイナリ形式を使用していない
4. **責務の逸脱**: ブラウザ拡張機能が大量の時系列データを保存・管理することは本質的な責務ではない

### 本来保存すべきデータ

拡張機能が永続化すべきデータは以下の3概念に集約される:

- **Posture（態勢）**: ドメインごとのセキュリティ態勢の集計スナップショット
- **Policy（ポリシー）**: セキュリティポリシー定義とルール
- **Alert（アラート）**: 検出されたセキュリティアラートの履歴

これらはいずれも件数が限定的であり、chrome.storage.localで十分に管理できる。

## 決定

### ストレージモデル

chrome.storage.localに以下の3概念のみを保存する。件数が少ないため**無期限保存**とする（`unlimitedStorage`権限は維持）。

| 概念 | 説明 | 既存資産 |
|------|------|---------|
| **Posture** | ドメインごとのセキュリティ態勢（NRD/typosquat判定、ポリシー有無、Cookie状態等）の集計 | `services: Record<string, DetectedService>` を拡張 |
| **Policy** | ドメイン/ツール/AI/データ転送に関するセキュリティポリシールール | `PolicyConfig`をそのまま活用 |
| **Alert** | セキュリティアラートの永続化履歴（現在はメモリのみで揮発） | `SecurityAlert`型を永続化 |

### 廃止対象

| パッケージ/ファイル | 理由 |
|-------------------|------|
| `packages/parquet-storage/` | パッケージ全体を削除 |
| `packages/api/` | REST API（parquet-storage依存） |
| `app/server/src/server-parquet-adapter.ts` | サーバー用Parquetアダプター |
| `app/server/src/filesystem-adapter.ts` | ファイルシステムストレージ |
| `packages/storage/src/event-store/migration.ts` | chrome.storage→parquet移行コード |

### 影響を受けるパッケージ

| パッケージ | 必要な変更 |
|-----------|-----------|
| `packages/background-services/` | events.tsのparquet書き込みを削除。アラート永続化に変更 |
| `packages/extension-network-service/` | parquetクエリ（network-requests）を削除 |
| `packages/debug-bridge/` | parquet introspection機能を削除 |
| `packages/extension-runtime/` | `StorageData`をposture/policy/alertモデルに再設計 |
| `app/audit-extension/` | wxt.config.tsのparquet関連設定を削除 |

### 時系列データの扱い

以下のデータは**保存しない**:

- イベントログ（events）→ 検出時にアラートとして発火し、アラート履歴のみ保存
- ネットワークリクエスト（network-requests）→ リアルタイム監視のみ。集計結果はPostureに反映
- CSP違反詳細（csp-violations）→ アラートとして発火。Postureにviolation countを集計

### ADR-033との関係

ADR-033（unlimitedStorage）は**維持**する。権限は残すが、保存対象をposture/policy/alertに縮小する。大量の時系列データではなく、少量の集計データを無期限保存するために使用する。

## 結果

- parquet-storageパッケージと関連コードの削除によるバンドルサイズ削減
- ストレージモデルの単純化（IndexedDB不要、chrome.storage.localのみ）
- アラートの永続化により、ブラウザ再起動後もアラート履歴を参照可能
- 保存データ量の大幅削減（時系列データ → 集計データ）

## 関連

- ADR-031: parquet-storageへの完全移行 → **本ADRによりSuperseded**
- ADR-033: ZTA監査証跡のためのunlimitedStorage採用 → 維持（保存対象を変更）

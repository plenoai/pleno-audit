# ADR-053: EventLog廃止 — Posture/Policy/Alertモデルへの転換

## ステータス

Accepted

## コンテキスト

現在のシステムはEventLog（時系列イベントログ）を中心に設計されている:

- **EventStore (IndexedDB)**: 14種類のイベントをタイムスタンプ付きで全件保存
- **Event Queue (chrome.storage.local)**: タブごとの一時キュー（150件/タブ）
- **重複排除なし**: 同じドメインへの同じnetwork_requestが何百件も蓄積
- **件数・個数データ**: UIで毎回再集計しているが、活用されていない

この設計には以下の問題がある:

1. **ストレージ肥大化**: 重複イベントが際限なく蓄積
2. **概念の混乱**: 時系列ログとPosture（セキュリティ態勢）が未分離
3. **不要な複雑性**: EventStore, event-queue, producer/consumerパターンの維持コスト
4. **既にPostureが存在**: `DetectedService`が事実上のPostureとして機能している

## 決定

### EventLogを全廃し、3つの概念のみで再構成する

```
Posture (観測された事実)
├─ DetectedService: ドメインごとの観測事実
│   ├─ ログインページの有無
│   ├─ ポリシー文書の有無（Privacy/ToS/Cookie）
│   ├─ NRD/Typosquat判定結果
│   ├─ AI利用の観測（provider, model）
│   └─ 通信先ドメインの集合（重複なし）
└─ Extensions: インストール済み拡張機能の情報

Policy (あるべき姿)
├─ CSP Policy: どのoriginからのリソース読み込みを許可するか
└─ Enterprise Policy: 組織のセキュリティポリシー

Alert (時系列 = Policy × Posture のギャップ)
└─ SecurityAlert: PolicyとPostureの乖離が検出された瞬間のみ記録
    例: CSP違反（CSP Policy vs 実際の通信先）
        NRDドメインへのログイン（NRD判定 × ログイン検出）
        Sensitive data送信（AI利用 × PII検出）
```

時系列性を持つのはAlertのみ。PostureとPolicyは現在の状態を表す。

### 削除対象

| パッケージ/モジュール | 理由 |
|---|---|
| `packages/storage/src/event-store/` | EventStore全体。IndexedDBスキーマ含む |
| `packages/event-queue/` | Producer/Consumerパターン不要 |
| `casb-types`の`EventLog`型 | 時系列イベント型の廃止 |
| Dashboard EventsTab | イベント一覧表示の廃止 |
| `background.ts`のeventStore関連ハンドラ | GET_EVENTS, GET_EVENTS_COUNT等 |

### 変更対象

| 現在の処理 | 変更後 |
|---|---|
| `login_detected`イベント発行 | `DetectedService.hasLoginPage`を更新 |
| `network_request`イベント発行 | `DetectedService`の通信先集合にマージ（重複なし） |
| `csp_violation`イベント発行 | Alert発火のみ（CSPはPolicy、違反はAlert） |
| `ai_prompt_sent`イベント発行 | `DetectedService.aiDetected`を更新 + Policy違反時Alert |
| `nrd_detected` / `typosquat_detected` | `DetectedService`の判定結果を更新 + Policy違反時Alert |
| EventsTab | Alertsビューに置換 |

### Alert永続化

現在のAlertStoreはin-memory（`Map`）のため、IndexedDBまたはchrome.storage.localへの永続化が必要。EventStore削除で空くIndexedDBをAlertStoreに転用する。

## 代替案の検討

### A. EventLogにdedup機能を追加

EventStoreを維持しつつ重複排除を入れる案。根本的に「時系列ログが不要」という問題を解決しないため棄却。

### B. EventLogをEvidence Storeにリネーム

スキーマ変更のみで対応する案。event-queueやproducer/consumerの複雑性が残り、中間概念が増えるだけのため棄却。

## 結果

### Positive

- **ストレージ効率**: 重複排除により桁違いに削減
- **概念の明確化**: Posture（事実）、Policy（あるべき姿）、Alert（ギャップ）の3軸のみ
- **コード削減**: EventStore, event-queue, producer/consumer全廃
- **パフォーマンス**: UI側の毎回の再集計が不要

### Negative

- **破壊的変更**: EventsTabに依存するユーザーワークフローの変更
- **マイグレーション**: 既存IndexedDBデータの破棄が必要
- **data-exportパッケージ**: イベントエクスポート機能の見直しが必要

### Risks

- Alert永続化の実装がPosture更新と同期的に動作する必要がある
- DetectedServiceの肥大化を避けるため、通信先集合のサイズ上限設計が必要

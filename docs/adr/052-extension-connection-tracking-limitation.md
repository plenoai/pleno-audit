# ADR-052: 他の拡張機能のネットワーク通信は観測不可

## ステータス

Accepted

## コンテキスト

ConnectionsTabで拡張機能の通信先を可視化する機能を実装した。検出方式として以下を試みた:

1. **webRequest.onBeforeRequest** — `<all_urls>`フィルタで全リクエストを監視し、`details.initiator`が`chrome-extension://`で始まるものを拡張機能リクエストとして分類
2. **declarativeNetRequest (DNR)** — `initiatorDomains: [extensionId]`条件のルールを登録し、`getMatchedRules()`で定期的にマッチを取得

## 検証結果

- **自身の拡張機能のSWリクエスト**: webRequestで`initiatorType: "extension"`として検出可能。`extensionConnections`への永続化も動作確認済み。
- **他の拡張機能のリクエスト**: ユーザーの通常プロファイルで長期運用した結果、`extensionConnections`は空。`serviceConnections`（ページ間通信）は豊富なデータが蓄積されている一方、拡張機能起点の通信は一切記録されなかった。

## 決定

Chrome MV3では、ある拡張機能が別の拡張機能のネットワークリクエストを観測することはできない。これはChromeのセキュリティ境界による制約である。

現在のConnectionsTabは以下のデータを表示する:

- **サービス間通信（実測）**: ページが発信元の外部通信（webRequest経由）
- **拡張機能通信（実測）**: 自身の拡張機能の通信のみ（`excludeOwnExtension: true`のため通常は非表示）

## 技術詳細

### webRequest API

Chrome MV3の`webRequest.onBeforeRequest`は情報取得のみ（非ブロッキング）。`<all_urls>`フィルタはリクエストURLにマッチするが、他の拡張機能のService Workerからのリクエストに対してイベントが発火しない。

### declarativeNetRequest API

`initiatorDomains`に拡張機能IDを指定したルールを登録可能。ただし`action: { type: "allow" }`は`getMatchedRules()`にレポートされないため、`modifyHeaders`アクションに変更済み。このパスが他の拡張機能に対して機能するかは未証明。

## 影響

- 拡張機能の通信先可視化はChromeプラットフォームの制約により完全な実現は不可能
- サービス間通信の可視化は正常に機能する

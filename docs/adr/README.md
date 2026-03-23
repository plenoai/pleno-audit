# Architecture Decision Records

| ADR | タイトル | ステータス |
|-----|---------|-----------|
| [001](./001-browser-only-mvp.md) | MVPはサーバーレスのブラウザ拡張機能として実装する | Accepted |
| [002](./002-detection-only.md) | MVPではブロック機能を実装せず検出・可視化のみとする | Accepted |
| [003](./003-tech-stack.md) | Chrome Manifest V3 + WXT + Preactで実装する | Accepted |
| [004](./004-privacy-policy-detection.md) | プライバシーポリシーはURLパターンとリンクテキストで特定する | Accepted |
| [005](./005-design-system.md) | Vercel風ミニマルデザインシステム | Accepted |
| [006](./006-tos-detection.md) | 利用規約検出機能 | Accepted |
| [008](./008-core-domain-model.md) | Coreパッケージの廃止とドメイン分割 | Accepted |
| [010](./010-extension-runtime-package.md) | Extension Runtimeパッケージの分離 | Accepted |
| [011](./011-ai-prompt-monitoring.md) | AIプロンプト監視機能 | Accepted |
| [012](./012-dashboard-data-fetching.md) | Dashboardデータ取得の設計原則 | Accepted |
| [013](./013-debug-cli.md) | デバッグCLI (pleno-debug) | Accepted |
| [014](./014-doh-monitoring.md) | DoH（DNS over HTTPS）監視機能 | Accepted |
| [015](./015-pleno-battacker.md) | Pleno Battacker - ブラウザ防御耐性テストツール | Accepted |
| [030](./030-firefox-support.md) | Firefox Support | Accepted |
| [031](./031-parquet-storage-migration.md) | parquet-storageへの完全移行 | Superseded by ADR-051 |
| [032](./032-extensions-analysis-tab.md) | 拡張機能分析タブのOSS移行 | Accepted |
| [033](./033-unlimited-storage-for-zta.md) | ZTA監査証跡のためのunlimitedStorage採用 | Accepted |
| [034](./034-network-monitor.md) | Network Monitor - 全ネットワークリクエスト監視 | Accepted |
| [048](./048-lib-to-packages-migration.md) | lib/原則禁止とpackages/移行方針 | Accepted |
| [049](./049-disable-main-world-hooks.md) | Main Worldを最小化し非同期キュー制御で負荷を抑える | Accepted |
| [050](./050-event-timestamp-source-of-truth.md) | イベント時刻の単一責務化 | Accepted |
| [051](./051-deprecate-parquet-storage.md) | parquet-storage廃止とposture/policy/alertストレージモデル | Accepted |
| [052](./052-extension-connection-tracking-limitation.md) | 他の拡張機能のネットワーク通信は観測不可 | Accepted |
| [054](./054-libztbs-extraction.md) | libztbs — ゼロトラストブラウザ基盤の分離 | Accepted |

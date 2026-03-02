# Pleno Audit

[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/plenoai/pleno-audit/badge)](https://securityscorecards.dev/viewer/?uri=github.com/plenoai/pleno-audit)

Personal `#Browser Security` `#BDR` `#CASB`

## Principles

- Local First: すべてのデータ処理はブラウザ内で完結します。個人情報を大量に扱うため、プライバシー保護を最優先に設計されています
- No DB: 外部から収集したブラックリスト等のDBは使用しません。基本的にヒューリスティックアルゴリズムを用います
- Opt-in: デフォルトではブロックや通知などのアクションは行いません。影響を最小限に導入及び可視化が可能です

## Screenshots

### Dashboard

![Dashboard](./docs/assets/dashboard.png)

### Popup

| Sessions | Domains | Requests |
|----------|---------|----------|
| ![Sessions](./docs/assets/popup-sessions.png) | ![Domains](./docs/assets/popup-domains.png) | ![Requests](./docs/assets/popup-requests.png) |

## インストール

1. [Releases](https://github.com/plenoai/pleno-audit/releases)から最新版をダウンロード
   - pleno-audit.zip: メイン拡張機能
   - pleno-battacker.zip: 防御耐性テストツール
2. ダウンロードしたzipファイルを展開
3. Chrome で `chrome://extensions` を開く
4. 右上の「デベロッパーモード」を有効にする
5. 「パッケージ化されていない拡張機能を読み込む」をクリック
6. 展開したフォルダを選択

## Documentation

詳細な設計判断については [ADR (Architecture Decision Records)](./docs/adr/README.md) を参照してください。

## License

AGPL 3.0

# ADR-055: FP削減戦略

## ステータス

Accepted

## コンテキスト

main-world hooksによるセキュリティ検出は、正当なWebサイト利用でも大量のfalse positive（FP）を発生させていた。ユーザーの指摘「誤検知が多いです。誤検知を無視して検知をするというのは、それは意味がないです。」を受け、精度重視の検出戦略に転換した。

## 決定

### 1. FPスモークテスト基盤

`app/battacker-e2e/src/fp-smoke.test.ts` — 正当なWebパターン（28種）をE2Eテストし、アラート0件を保証する。新しいフック追加時は必ずbenignパターンも追加する。

### 2. フックレベルのdedup

各フックに重複排除を実装:
- `eval/Function`: Set<codeSample first 100 chars>、短いJSON-likeスキップ
- `AudioContext/RTCPeerConnection`: ページ毎1回のみ
- `Worker/SharedWorker`: URL毎1回のみ
- `ServiceWorker`: scope毎1回のみ
- `DeviceSensor`: eventType毎1回のみ

### 3. AlertManager dedup

`(category, domain, title)` キーで60秒ウィンドウ内の重複アラートをcount集約。UIにcount表示。

### 4. ブラウザ権限ゲートAPIは非検出

ブラウザ自身が権限ダイアログを表示するAPIはフック対象外:
- geolocation, Notification, clipboard.readText, getUserMedia, getDisplayMedia, navigator.credentials.get

### 5. severity体系

| severity | 基準 |
|----------|------|
| critical | 明確な攻撃パターン（XSS, prototype pollution, credential theft） |
| high | 高い攻撃確率（eval, WebGL fingerprint, supply chain） |
| medium | 攻撃の可能性あり（cookie mass access, DNS prefetch leak） |
| info | 正当利用でも発火するAPI（AudioContext, RTCPeerConnection） |

### 6. ネットワーク検出のFP耐性

- tracking_beacon: same-origin除外、厳格なURL/ペイロードパターン
- compliance: localhost/127.x/::1/.local除外

## 結果

- FPスモークテスト: 0 alerts / 28パターン
- defense-score: 105テストパス / 15カテゴリ検出
- 攻撃検知能力を維持しつつFPを排除

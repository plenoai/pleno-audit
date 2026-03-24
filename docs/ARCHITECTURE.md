# アラート検出

## main-world hooks経路

```
ページ内のJS API呼び出し
    → hooks/*.js (MAIN world) がCustomEvent発火
    → security-bridge.content.ts がキューイング
    → chrome.runtime.sendMessage → background.ts
    → security-event-handlers → alertManager.alertXxx()
```

## ネットワーク監視経路

```
ブラウザのネットワークリクエスト
    → chrome.webRequest.onBeforeRequest (background)
    → network-security-inspector.ts が直接分析
    → 10KB超POST → data_exfiltration検出
    → tracking URL → tracking_beacon検出
```

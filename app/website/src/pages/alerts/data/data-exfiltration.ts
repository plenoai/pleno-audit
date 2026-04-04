import type { PlaybookData } from '../types';

export const dataExfiltrationPlaybooks: PlaybookData[] = [
  // =========================================================================
  // 1. data_exfiltration — 大量データ転送（ネットワーク層検知）
  // =========================================================================
  {
    id: 'data_exfiltration',
    title: '大量データ転送（データ窃取）',
    severity: 'high',
    description:
      '外部ドメインへ10KB超のデータがPOST/PUT等で送信されたことを検知します。ネットワーク層（webRequest API）でリクエストボディサイズと宛先ドメインを監視し、クロスオリジンへの大量データ送信をリアルタイムで捕捉します。機密データ（クレジットカード番号等）が含まれる場合は重大度がcriticalに昇格します。',
    mitreAttack: ['T1041', 'T1048.003'],
    detection: {
      mechanism:
        'chrome.webRequest.onBeforeRequest でリクエストボディを検査し、クロスオリジンかつボディサイズが10KB（DATA_EXFILTRATION_THRESHOLD = 10 * 1024）以上、またはボディサンプルに機密データパターン（クレジットカード番号等）が含まれる場合にアラートを発火します。GET/HEADメソッドは評価対象外です。',
      monitoredAPIs: [
        'chrome.webRequest.onBeforeRequest',
        'XMLHttpRequest',
        'fetch()',
        'form submit (POST)',
      ],
      triggerConditions: [
        'リクエストメソッドがGET/HEAD以外',
        'リクエストボディサイズが10KB以上（DATA_EXFILTRATION_THRESHOLD）',
        'または、ボディサンプルに機密データパターン（クレジットカード番号等）を検出',
        '送信先が異なるドメイン（クロスオリジン）',
      ],
      severityLogic:
        '機密データ（sensitiveDataTypes）を含む場合 → critical、ボディサイズが500KB超 → critical、それ以外 → high',
    },
    response: [
      {
        title: 'アラート内容の確認',
        description:
          'sourceDomain、targetDomain、sizeKB、methodを確認し、どのページからどこへどれだけのデータが送信されたかを把握します。',
      },
      {
        title: '送信先ドメインの調査',
        description:
          '送信先ドメインが正規のサービス（API、CDN、SaaS）であるか、または未知の外部ドメインであるかを確認します。WHOIS情報やドメイン登録日も参照してください。',
      },
      {
        title: '送信データの内容分析',
        description:
          'sensitiveDataTypesフィールドを確認し、クレジットカード番号やPII等の機密データが含まれていないかを精査します。必要に応じてネットワークログからペイロードの詳細を取得します。',
      },
      {
        title: '発火元スクリプトの特定',
        description:
          'initiatorフィールドから送信を発生させたスクリプトを特定し、サードパーティスクリプトや改ざんされたファーストパーティコードでないかを確認します。',
      },
      {
        title: '影響範囲の評価と封じ込め',
        description:
          '同一送信先への他のリクエストがないかログを調査し、データ漏洩の規模を評価します。問題が確認された場合はCSPで送信先ドメインをブロックするか、該当スクリプトを無効化します。',
      },
    ],
    prevention: [
      'Content-Security-Policy の connect-src ディレクティブで許可する送信先を制限する',
      'サードパーティスクリプトのSRI（Subresource Integrity）を設定する',
      'フォーム送信先のホワイトリストを管理し、クロスオリジンPOSTを制限する',
      'DLP（Data Loss Prevention）ポリシーでPII・機密データの外部送信を検知・ブロックする',
    ],
    falsePositives:
      '正規のフォーム送信、ファイルアップロード、APIコール（SaaS連携等）で大量データを送信する場合に検知されることがあります。送信先ドメインが既知の正規サービスであれば誤検知と判断できます。',
    relatedAlerts: ['fetch_exfiltration', 'send_beacon', 'tracking_beacon', 'postmessage_exfil'],
  },

  // =========================================================================
  // 2. fetch_exfiltration — fetch()によるクロスオリジン大量送信
  // =========================================================================
  {
    id: 'fetch_exfiltration',
    title: 'fetch()によるクロスオリジン大量送信',
    severity: 'medium',
    description:
      'fetch() APIを使用したクロスオリジンリクエストで、10KB以上のボディペイロードを含む送信を検知します。メインワールドでfetch()をフックし、送信先がクロスオリジンかつボディサイズが閾値を超えた場合にアラートを発火します。',
    mitreAttack: ['T1041', 'T1071.001'],
    detection: {
      mechanism:
        'window.fetchをプロキシし、引数のinput URLからクロスオリジン判定を行います。init.bodyが存在する場合、string.lengthまたはArrayBuffer.byteLengthで軽量にサイズを推定し、FETCH_BODY_THRESHOLD（10KB = 10 * 1024）を超えた場合にイベントを発火します。no-corsモードの場合はサイズに関係なくhighに昇格します。',
      monitoredAPIs: ['window.fetch'],
      triggerConditions: [
        '送信先URLがクロスオリジン（originが異なる）',
        'init.bodyが存在する（nullでない）',
        'ボディサイズ推定値が10KB以上（FETCH_BODY_THRESHOLD）',
        'または、modeがno-corsの場合（cross_origin_no_cors）',
      ],
      severityLogic:
        'reasonがcross_origin_no_cors → high、それ以外（cross_origin_large_body）→ medium',
    },
    response: [
      {
        title: 'リクエスト詳細の確認',
        description:
          '送信先URL、モード（cors/no-cors）、ボディサイズ、発火元ドメインを確認し、正規のAPIコールかデータ窃取かを判別します。',
      },
      {
        title: 'no-corsモードの調査',
        description:
          'no-corsモードはレスポンスが読めない代わりに送信は成功するため、データ窃取の一般的な手法です。no-corsが使われている場合は特に慎重に調査してください。',
      },
      {
        title: '発火元コードの特定',
        description:
          'DevToolsのNetworkパネルやInitiator列から、fetch()を呼び出しているスクリプトを特定します。サードパーティスクリプトの場合はインジェクションの可能性を検討します。',
      },
      {
        title: '送信データの内容確認',
        description:
          'リクエストボディの内容を確認し、PII、セッショントークン、APIキー等の機密情報が含まれていないかを精査します。',
      },
      {
        title: '対策の実施',
        description:
          'CSPのconnect-srcで不正な送信先をブロックし、問題のスクリプトを特定・除去します。',
      },
    ],
    prevention: [
      'CSP connect-src で許可するfetch送信先を明示的に制限する',
      'サードパーティスクリプトはサンドボックス化されたiframeで実行する',
      'Service Workerでfetchリクエストを監査し、不正な送信先をブロックする',
      'no-corsモードのfetchリクエストを監視対象として重点的に管理する',
    ],
    falsePositives:
      'SaaS連携やAPIクライアントが大量のJSONデータをクロスオリジンに送信する場合に検知されます。既知のAPIエンドポイントへの通信であれば誤検知です。',
    relatedAlerts: ['data_exfiltration', 'send_beacon', 'postmessage_exfil'],
  },

  // =========================================================================
  // 3. send_beacon — navigator.sendBeaconによる秘密裏のデータ送信
  // =========================================================================
  {
    id: 'send_beacon',
    title: 'navigator.sendBeaconによるデータ送信',
    severity: 'medium',
    description:
      'navigator.sendBeacon() APIを使用した外部ドメインへのデータ送信を検知します。sendBeaconはページ離脱時にも確実にデータを送信できるため、ユーザーに気づかれにくい窃取チャネルとして悪用される可能性があります。',
    mitreAttack: ['T1041', 'T1071.001'],
    detection: {
      mechanism:
        'navigator.sendBeaconをプロキシし、送信先URLとデータサイズを監視します。データサイズはstring.length、ArrayBuffer.byteLength、Blob.sizeで軽量に推定します。送信先が同一サイト（ルートドメインが同じ）でない場合かつ、データサイズが1KB超の場合にイベントを発火します。',
      monitoredAPIs: ['navigator.sendBeacon'],
      triggerConditions: [
        'データサイズが1024バイト超',
        '送信先がクロスサイト（ルートドメインが異なる）',
      ],
      severityLogic:
        'データサイズが1024バイト超 → high、それ以外 → medium',
    },
    response: [
      {
        title: '送信内容の確認',
        description:
          'sendBeaconの送信先URL、データサイズを確認します。アナリティクス系のURLパターン（/collect, /beacon等）かどうかを判別します。',
      },
      {
        title: '送信タイミングの調査',
        description:
          'sendBeaconはunload/beforeunloadイベントで多用されます。ページ離脱時の送信か、ページ滞在中の定期送信かを確認します。',
      },
      {
        title: '送信元スクリプトの特定',
        description:
          'DevToolsのNetworkパネルでbeaconリクエストのInitiatorを確認し、トラッキングスクリプトか悪意のあるスクリプトかを判別します。',
      },
      {
        title: '送信データの分析',
        description:
          'ペイロードにPII、セッション情報、認証トークン等が含まれていないか確認します。エンコードされている場合はデコードして内容を精査します。',
      },
      {
        title: 'ブロック措置の検討',
        description:
          '不正な送信が確認された場合、CSPのconnect-srcで送信先をブロックするか、該当スクリプトを除去します。',
      },
    ],
    prevention: [
      'CSP connect-src でsendBeaconの送信先を制限する',
      'トラッキングスクリプトの導入を審査・管理し、不要なbeacon送信を排除する',
      'ページ離脱時の通信をモニタリングし、想定外の送信先がないか定期的に監査する',
    ],
    falsePositives:
      'Google Analytics、Adobe Analytics等のアナリティクスツールはsendBeaconでデータを送信します。既知のアナリティクスサービスへの送信であれば誤検知です。',
    relatedAlerts: ['data_exfiltration', 'fetch_exfiltration', 'tracking_beacon'],
  },

  // =========================================================================
  // 4. postmessage_exfil — postMessageによるクロスオリジンデータ送信
  // =========================================================================
  {
    id: 'postmessage_exfil',
    title: 'postMessageによるクロスオリジンデータ送信',
    severity: 'high',
    description:
      'window.postMessage() APIを使用した別オリジンへのデータ送信を検知します。postMessageはiframe間やwindow.open()で開いたウィンドウとの通信に使用されますが、攻撃者が制御するiframeへ機密データを送信する窃取チャネルとしても悪用されます。',
    mitreAttack: ['T1071.001', 'T1041'],
    detection: {
      mechanism:
        'window.postMessageの呼び出しを監視し、targetOriginが異なるオリジンである場合にアラートを発火します。バックグラウンドサービスのセキュリティイベントハンドラで処理され、アラートが生成されます。',
      monitoredAPIs: ['window.postMessage'],
      triggerConditions: [
        'postMessageのtargetOriginが現在のオリジンと異なる',
        'クロスオリジンへのメッセージ送信が検出された場合',
      ],
      severityLogic:
        '常にhigh（クロスオリジンへのpostMessageは常にリスクが高い）',
    },
    response: [
      {
        title: 'ターゲットオリジンの確認',
        description:
          'targetOriginが「*」（ワイルドカード）の場合は特に危険です。具体的なオリジンが指定されている場合はその正当性を確認します。',
      },
      {
        title: 'iframe/ウィンドウの調査',
        description:
          'メッセージの送信先iframeまたはウィンドウを特定し、そのsrcが正規のドメインかどうかを確認します。攻撃者が動的に挿入したiframeでないかを調べます。',
      },
      {
        title: '送信データの内容確認',
        description:
          'postMessageで送信されるデータにセッショントークン、認証情報、PII等の機密データが含まれていないかを確認します。',
      },
      {
        title: 'メッセージリスナーの監査',
        description:
          'window.addEventListener("message", ...)のハンドラを確認し、origin検証が適切に行われているか、受信側でのバリデーションが十分かを監査します。',
      },
      {
        title: '不正なiframeの除去',
        description:
          '攻撃者が挿入したiframeが発見された場合は即座に除去し、CSPのframe-srcで挿入を防止します。',
      },
    ],
    prevention: [
      'postMessage送信時は必ずtargetOriginを具体的に指定し、「*」の使用を避ける',
      'messageイベントリスナーでevent.originを検証し、信頼できるオリジンのみ受け付ける',
      'CSP frame-src で許可するiframeの埋め込み元を制限する',
      'サードパーティiframeとの通信を最小限にし、送信データを必要最小限に絞る',
    ],
    falsePositives:
      'OAuth認証フロー、ウィジェット埋め込み（地図、動画プレーヤー等）、サードパーティSDKが正常にpostMessageを使用するケースがあります。targetOriginが既知のサービスであれば誤検知です。',
    relatedAlerts: ['data_exfiltration', 'fetch_exfiltration', 'broadcast_channel', 'message_channel'],
  },

  // =========================================================================
  // 5. dns_prefetch_leak — DNS prefetchによる秘密チャネル
  // =========================================================================
  {
    id: 'dns_prefetch_leak',
    title: 'DNSプリフェッチによる情報漏洩',
    severity: 'medium',
    description:
      '動的に追加された<link rel="dns-prefetch">等のリソースヒント要素を利用した外部ドメインへの情報漏洩を検知します。攻撃者はDNSクエリのサブドメイン部分にデータをエンコードして送信するDNSトンネリング手法を使用することがあります。',
    mitreAttack: ['T1048.003', 'T1071.004'],
    detection: {
      mechanism:
        'MutationObserverでDOMへの<link>要素の動的追加を監視します。rel属性がdns-prefetch、preconnect、prefetch、preload、prerenderのいずれかで、hrefが外部ドメイン（ルートドメインが異なる）を指す場合にアラートを発火します。同一ルートドメインのサブドメインは除外されます。',
      monitoredAPIs: [
        'MutationObserver（document.head, document.body）',
        'HTMLLinkElement',
      ],
      triggerConditions: [
        '<link>要素が動的にDOMに追加される',
        'rel属性がdns-prefetch / preconnect / prefetch / preload / prerenderのいずれか',
        'href先のホスト名が現在のページと異なるルートドメインである',
      ],
      severityLogic:
        '常にmedium（DNS prefetchは直接的なデータ送信ではないが、秘密チャネルとして利用可能）',
    },
    response: [
      {
        title: 'リンク要素の確認',
        description:
          '検知されたrel属性（dns-prefetch等）とhref先ドメインを確認します。サブドメイン部分にデータがエンコードされていないか（例: base64文字列.attacker.com）を調べます。',
      },
      {
        title: '挿入元スクリプトの特定',
        description:
          'DevToolsのElementsパネルでBreak on subtree modificationsを設定し、link要素を動的に追加しているスクリプトを特定します。',
      },
      {
        title: 'DNSクエリログの分析',
        description:
          'ネットワークレベルでDNSクエリを確認し、不審なサブドメインパターン（ランダム文字列、Base64エンコード等）が含まれていないか分析します。',
      },
      {
        title: '関連する通信パターンの調査',
        description:
          '同一ドメインへの他の通信（fetch、XHR等）がないか確認し、DNSチャネルが唯一の窃取経路かどうかを評価します。',
      },
    ],
    prevention: [
      'CSP default-src / connect-src でリソースヒントの対象ドメインを制限する',
      'Content-Security-Policyのprefetch-srcディレクティブでprefetch先を制限する',
      'サードパーティスクリプトに対してDOMの<head>への書き込みを制限する',
      'DNSクエリをモニタリングし、異常なサブドメインパターンを検出する体制を整備する',
      'Trusted Typesを導入し、動的なDOM操作を制御する',
    ],
    falsePositives:
      'パフォーマンス最適化のためにdns-prefetchやpreconnectを動的に追加するWebアプリケーション（SPAのルーティング時等）では正常な動作として検知されます。href先が既知のCDNやAPIサーバーであれば誤検知です。',
    relatedAlerts: ['data_exfiltration', 'fetch_exfiltration', 'tracking_beacon'],
  },

  // =========================================================================
  // 6. storage_exfiltration — localStorage/sessionStorageの大量アクセス
  // =========================================================================
  {
    id: 'storage_exfiltration',
    title: 'ストレージ大量アクセス（データ窃取準備）',
    severity: 'high',
    description:
      'localStorage/sessionStorageのgetItem()が短時間で大量に呼び出されたことを検知します。攻撃者がストレージ内のセッショントークン、個人情報、設定値等を一括収集し、外部に送信する準備段階の可能性があります。',
    mitreAttack: ['T1005', 'T1552.001'],
    detection: {
      mechanism:
        'localStorage.getItemおよびsessionStorage.getItemをプロキシし、3秒間のスライディングウィンドウ内でのアクセス回数をカウントします。50回に達した時点でアラートを発火します。3秒経過するとカウンターはリセットされます。',
      monitoredAPIs: [
        'localStorage.getItem',
        'sessionStorage.getItem',
      ],
      triggerConditions: [
        'getItem()の呼び出しが3秒以内に50回に到達',
        'localStorage / sessionStorage のいずれかが対象',
      ],
      severityLogic:
        '常にhigh（短時間での大量ストレージアクセスは通常の利用パターンではない）',
    },
    response: [
      {
        title: 'アクセスパターンの確認',
        description:
          'storageType（localStorage/sessionStorage）とaccessCountを確認し、どのストレージに対してどの程度のアクセスがあったかを把握します。',
      },
      {
        title: 'ストレージ内容の棚卸し',
        description:
          'DevToolsのApplication > Local Storage / Session Storageでストレージに保存されている情報を確認し、機密データ（トークン、PII等）が含まれていないかを確認します。',
      },
      {
        title: 'アクセス元スクリプトの特定',
        description:
          'DevToolsでgetItemにブレークポイントを設定し、大量アクセスを行っているスクリプトを特定します。サードパーティスクリプトの場合は特に注意が必要です。',
      },
      {
        title: '後続の外部通信の確認',
        description:
          'ストレージアクセス後にfetch/XHR/sendBeacon等で外部に送信されていないかネットワークログを確認します。アクセスと送信が同一スクリプトから行われている場合はデータ窃取の可能性が高いです。',
      },
      {
        title: '対策の実施',
        description:
          '問題のスクリプトを特定・除去し、ストレージに保存する機密データを暗号化するか、httpOnly Cookieに移行することを検討します。',
      },
    ],
    prevention: [
      'セッショントークンや機密情報はlocalStorage/sessionStorageではなくhttpOnly Cookieに保存する',
      'ストレージに保存するデータはアプリケーション層で暗号化する',
      'サードパーティスクリプトのストレージアクセスを制限（サンドボックス化iframeの使用）する',
      'Storage Access APIを活用し、ストレージへのアクセスを明示的に制御する',
      '定期的にストレージの棚卸しを行い、不要な機密データが残存していないか確認する',
    ],
    falsePositives:
      'SPAフレームワークがストレージからキャッシュデータやユーザー設定を一括読み込みする場合に検知されることがあります。アプリケーション初期化時のバースト的なアクセスは正常動作の可能性があります。',
    relatedAlerts: ['data_exfiltration', 'fetch_exfiltration', 'send_beacon'],
  },
];

import type { PlaybookData } from '../types';

export const networkCommunicationPlaybooks: PlaybookData[] = [
  // =========================================================================
  // websocket_connection - 外部WebSocket接続
  // =========================================================================
  {
    id: 'websocket_connection',
    title: '外部WebSocket接続検出',
    severity: 'high',
    description:
      'WebSocketコンストラクタの呼び出しを監視し、外部ホストへの永続的な双方向通信チャネルの確立を検出します。WebSocketはHTTPと異なりリクエスト単位の監視が困難なため、C2（Command & Control）通信やデータ窃取の隠密チャネルとして悪用されるリスクがあります。',
    mitreAttack: ['T1071.001', 'T1573.002'],
    detection: {
      mechanism:
        'ネットワークレイヤー（chrome.webRequest / Declarative Net Request）でWebSocket接続を監視。メインワールドフックは正当なリアルタイムアプリケーション（チャット、ダッシュボード等）での偽陽性が多いため意図的にno-opとし、ネットワークレイヤーで外部接続を検出する設計。',
      monitoredAPIs: ['WebSocket', 'chrome.webRequest (ws:// / wss://)'],
      triggerConditions: [
        'WebSocket接続先ホスト名がページのオリジンと異なる場合（isExternal: true）',
        'ネットワークレイヤーで外部宛のws://またはwss://リクエストを検出した場合',
      ],
      severityLogic:
        '外部ホストへの接続（isExternal: true）の場合は high、同一オリジン内の接続は medium。resolveSeverity で条件分岐。',
    },
    response: [
      {
        title: '接続先ホストの確認',
        description:
          'アラート詳細の hostname フィールドを確認し、接続先が既知の正当なサービス（チャット、リアルタイムダッシュボード等）かどうかを判断します。',
      },
      {
        title: '通信パターンの分析',
        description:
          'WebSocket接続の開始タイミング、通信頻度、データ量を確認します。定期的なビーコンパターンはC2通信の兆候です。',
      },
      {
        title: 'ページコンテキストの確認',
        description:
          '接続元ページの機能にWebSocketが必要かどうかを確認します。静的ページからのWebSocket接続は不審です。',
      },
      {
        title: 'ネットワークログとの相関分析',
        description:
          '他のネットワークアラート（data_exfiltration, fetch_exfiltration等）と時間軸で相関を確認し、組織的な攻撃パターンを特定します。',
      },
      {
        title: '対処の実施',
        description:
          '不審な接続先と判断された場合、該当ドメインをブロックリストに追加し、影響を受けたセッションのデータ漏洩範囲を調査します。',
      },
    ],
    prevention: [
      'CSPの connect-src ディレクティブで許可するWebSocket接続先を明示的に制限する',
      'エンタープライズポリシーで許可済みWebSocket接続先のホワイトリストを管理する',
      'ネットワーク監視で ws:// / wss:// プロトコルの外部通信をログに記録する',
      'WebSocketを使用しない業務ページでは connect-src に wss: を含めない',
    ],
    falsePositives:
      'チャットツール（Slack、Teams等）、リアルタイムダッシュボード、協調編集ツール、通知システムなど、正当なリアルタイム通信を行うWebアプリケーションで発火します。メインワールドフックを意図的にno-opとし、ネットワークレイヤーで検出する設計により偽陽性を抑制しています。',
    relatedAlerts: ['data_exfiltration', 'fetch_exfiltration', 'eventsource_channel'],
  },

  // =========================================================================
  // webrtc_connection - WebRTCピア接続
  // =========================================================================
  {
    id: 'webrtc_connection',
    title: 'WebRTCピア接続検出',
    severity: 'info',
    description:
      'RTCPeerConnectionコンストラクタの呼び出しを監視します。WebRTCはブラウザ間の直接通信を可能にするため、内部IPアドレスの漏洩やファイアウォールバイパスによるデータ窃取に悪用される可能性があります。ただしビデオ通話等の正当な用途が多いため、情報レベルのアラートです。',
    mitreAttack: ['T1090.001', 'T1048.002'],
    detection: {
      mechanism:
        'メインワールドでRTCPeerConnectionコンストラクタをプロキシし、呼び出しを検出。ページごとに1回のみアラートを発火（rtcEmitted フラグで重複排除）。原本のプロトタイプチェーンは維持。',
      monitoredAPIs: ['RTCPeerConnection'],
      triggerConditions: [
        'RTCPeerConnectionコンストラクタが呼び出された場合（ページあたり1回のみ発火）',
      ],
      severityLogic:
        '常に info レベル。ビデオ通話・画面共有など正当な用途でも発火するため、重大度は一律で情報レベルに設定。',
    },
    response: [
      {
        title: 'ページ機能の確認',
        description:
          'WebRTCが検出されたページがビデオ通話、画面共有、P2Pファイル共有など正当な機能を持つかを確認します。',
      },
      {
        title: 'STUN/TURNサーバーの確認',
        description:
          'RTCPeerConnectionの設定（iceServers）を調査し、不審なSTUN/TURNサーバーが指定されていないか確認します。',
      },
      {
        title: '内部IP漏洩の評価',
        description:
          'WebRTCのICE候補を通じてプライベートIPアドレスが外部に漏洩していないか確認します。mdns候補が適切に使用されているか検証します。',
      },
      {
        title: 'データチャネルの用途確認',
        description:
          'RTCDataChannelが使用されている場合、転送されるデータの種類と量を確認し、不正なデータ窃取が行われていないか調査します。',
      },
    ],
    prevention: [
      'WebRTC機能が不要なページではCSPまたはブラウザポリシーでWebRTCを無効化する',
      'WebRTC Leak Shieldなどのブラウザ設定でプライベートIPの露出を防止する',
      'エンタープライズ環境ではWebRTC使用を許可するドメインをポリシーで管理する',
    ],
    falsePositives:
      'Google Meet、Zoom、Microsoft Teams等のビデオ会議サービス、WebRTCベースのP2Pファイル共有サービスで高頻度で発火します。情報レベルのため通常は対応不要です。',
    relatedAlerts: ['device_enumeration', 'media_capture'],
  },

  // =========================================================================
  // broadcast_channel - BroadcastChannelによるタブ間秘密通信
  // =========================================================================
  {
    id: 'broadcast_channel',
    title: 'BroadcastChannelによるタブ間通信検出',
    severity: 'medium',
    description:
      'BroadcastChannelコンストラクタの呼び出しを監視します。BroadcastChannelは同一オリジンのタブ・ウィンドウ間でメッセージを送受信できるAPIであり、攻撃者が複数タブ間で秘密裏にデータを共有したり、バックグラウンドタブから機密情報を収集するための隠密通信チャネルとして悪用される可能性があります。',
    mitreAttack: ['T1132.001', 'T1071.001'],
    detection: {
      mechanism:
        'メインワールドでBroadcastChannelコンストラクタをフックし、チャネル名とともにイベントを発火。バックグラウンドサービスでアラートを生成。なお、ログイン状態同期やテーマ切替など正当な用途が広いため、フィンガープリントフックからは除外されている。',
      monitoredAPIs: ['BroadcastChannel'],
      triggerConditions: [
        'BroadcastChannelコンストラクタが呼び出された場合',
        'チャネル名（channelName）がイベントデータに含まれる',
      ],
      severityLogic:
        '常に medium レベル。タブ間通信自体は正当な用途もあるが、隠密通信チャネルの可能性があるため中程度の重大度。',
    },
    response: [
      {
        title: 'チャネル名の分析',
        description:
          'channelName フィールドを確認します。「auth_sync」「theme」「session」等は正当な用途を示唆しますが、ランダム文字列や難読化された名前は不審です。',
      },
      {
        title: 'チャネル使用パターンの確認',
        description:
          '同一オリジンの複数タブで同じチャネルが使用されているか確認します。単一タブでの使用は異常です。',
      },
      {
        title: 'メッセージ内容の調査',
        description:
          '可能であればBroadcastChannelで送受信されるメッセージの内容を調査し、機密データ（認証トークン、個人情報等）が含まれていないか確認します。',
      },
      {
        title: 'オリジンの信頼性確認',
        description:
          'BroadcastChannelが検出されたオリジンが信頼済みのアプリケーションか確認し、未知または不審なドメインの場合は詳細調査を行います。',
      },
    ],
    prevention: [
      'CSPや拡張機能のコンテンツスクリプトでBroadcastChannelの使用を制限する',
      'エンタープライズポリシーで許可するオリジンを限定する',
      'セキュリティ監視でタブ間通信パターンの異常を検出するルールを設定する',
    ],
    falsePositives:
      'ログイン状態のタブ間同期、テーマ・言語設定の共有、マルチタブ対応Webアプリケーション（Google Docs、Notion等）で正当に使用されます。フィンガープリントフックからは意図的に除外されており、偽陽性の低減が図られています。',
    relatedAlerts: ['message_channel', 'postmessage_exfil', 'storage_exfiltration'],
  },

  // =========================================================================
  // message_channel - MessageChannelコンストラクタ
  // =========================================================================
  {
    id: 'message_channel',
    title: 'MessageChannel隠密通信検出',
    severity: 'medium',
    description:
      'MessageChannelコンストラクタの呼び出しを監視します。MessageChannelはポート間の双方向通信チャネルを作成し、iframe間やWorkerとの隠密通信に利用される可能性があります。正当なフレームワーク（React DevTools等）でも使用されるため、コンテキストに基づいた判断が必要です。',
    mitreAttack: ['T1132.001', 'T1071.001'],
    detection: {
      mechanism:
        'メインワールドでMessageChannelコンストラクタをフックし、呼び出しを検出。バックグラウンドサービスでドメイン情報とともにアラートを生成。パイプライン互換性のために保持されている検出。',
      monitoredAPIs: ['MessageChannel'],
      triggerConditions: [
        'MessageChannelコンストラクタが呼び出された場合',
      ],
      severityLogic:
        '常に medium レベル。隠密通信チャネルの可能性があるため中程度だが、正当な用途も多い。',
    },
    response: [
      {
        title: 'ポートの転送先確認',
        description:
          'MessageChannelで作成されたポート（port1, port2）がどこに転送されているかを確認します。postMessageでiframeやWorkerに渡されている場合、転送先のオリジンを特定します。',
      },
      {
        title: 'iframe通信の調査',
        description:
          'ページ内のiframeとMessagePort経由で通信が行われている場合、iframeのソースオリジンが信頼できるかを確認します。',
      },
      {
        title: '通信データの分析',
        description:
          'MessagePortを通じて送受信されるデータの種類を調査し、機密情報の漏洩やコマンド実行パターンがないか確認します。',
      },
      {
        title: '使用コンテキストの評価',
        description:
          '開発者ツール、フレームワークのホットリロード、Service Worker通信など正当な用途でないかをページのコンテキストから判断します。',
      },
    ],
    prevention: [
      'CSPの frame-src / child-src で許可するiframeオリジンを制限する',
      '不要なiframeの埋め込みをセキュリティポリシーで禁止する',
      'Worker/SharedWorkerの使用を必要最小限に制限する',
      'postMessageの受信ハンドラでオリジン検証を徹底する',
    ],
    falsePositives:
      'React DevTools、Vue DevTools等の開発者ツール、Service Worker通信、フレームワークのホットモジュールリプレイスメント（HMR）、広告SDK等で頻繁に使用されます。開発環境での発火が特に多い傾向があります。',
    relatedAlerts: ['broadcast_channel', 'postmessage_exfil'],
  },

  // =========================================================================
  // eventsource_channel - EventSourceによるC2チャネル
  // =========================================================================
  {
    id: 'eventsource_channel',
    title: 'EventSource隠密C2チャネル検出',
    severity: 'high',
    description:
      'EventSourceコンストラクタの呼び出しを監視します。EventSource（Server-Sent Events）はサーバーからクライアントへの一方向永続接続を確立するAPIであり、C2（Command & Control）サーバーからの指令受信チャネルとして悪用される可能性があります。通常のHTTPリクエストとは異なり、長時間の永続接続を維持するため検出が困難です。',
    mitreAttack: ['T1071.001', 'T1573.001', 'T1102'],
    detection: {
      mechanism:
        'メインワールドでEventSourceコンストラクタをフックし、接続先URLとともにイベントを発火。バックグラウンドサービスでドメインとURLを含むアラートを生成。パイプライン互換性のために保持されている検出。',
      monitoredAPIs: ['EventSource'],
      triggerConditions: [
        'EventSourceコンストラクタが呼び出された場合',
        '接続先URL（url）がイベントデータに含まれる',
      ],
      severityLogic:
        '常に high レベル。EventSourceの正当な用途はWebSocket等と比較して限定的であり、C2チャネルとしての悪用リスクが高いため。',
    },
    response: [
      {
        title: '接続先URLの検証',
        description:
          'url フィールドを確認し、接続先が正当なSSEエンドポイントか調査します。不審なドメインやIPアドレスへの接続は即座にブロックを検討します。',
      },
      {
        title: 'SSEイベントストリームの分析',
        description:
          'EventSourceが受信するイベントの内容・頻度を調査します。コマンドやスクリプトの受信パターンはC2通信の兆候です。',
      },
      {
        title: '接続の持続時間と再接続パターンの確認',
        description:
          'EventSourceは自動再接続機能を持ちます。長時間の接続維持や定期的な再接続パターンを確認し、永続的なC2チャネルの兆候を評価します。',
      },
      {
        title: 'ページ機能との整合性確認',
        description:
          'SSEが検出されたページにリアルタイム通知やライブフィードなどの正当なSSE使用理由があるか確認します。',
      },
      {
        title: '脅威インテリジェンスとの照合',
        description:
          '接続先ドメインを既知のC2インフラやマルウェア配布サイトのリストと照合し、脅威レベルを評価します。',
      },
    ],
    prevention: [
      'CSPの connect-src で許可するSSE接続先を明示的にホワイトリスト管理する',
      'ネットワーク監視でtext/event-streamレスポンスの外部接続を検出するルールを設定する',
      'エンタープライズポリシーでEventSourceの使用を許可するオリジンを制限する',
      'プロキシ/ファイアウォールでSSE接続の長時間維持を監視・制限する',
    ],
    falsePositives:
      'リアルタイム通知サービス、株価ティッカー、ライブフィード、CI/CDパイプラインのログストリーミング、ChatGPT等のAIサービスのストリーミングレスポンスで使用されます。ただしWebSocketと比較して正当な用途は限定的です。',
    relatedAlerts: ['websocket_connection', 'fetch_exfiltration', 'dns_prefetch_leak'],
  },

  // =========================================================================
  // tracking_beacon - トラッキングピクセル/ビーコン検出
  // =========================================================================
  {
    id: 'tracking_beacon',
    title: 'トラッキングビーコン検出',
    severity: 'medium',
    description:
      'ネットワークリクエストを監視し、サードパーティトラッキングピクセルやビーコンの送信を検出します。ユーザーの行動追跡やプライバシー侵害のリスクを可視化し、外部トラッキングサービスへのデータ送信を特定します。',
    mitreAttack: ['T1557', 'T1040'],
    detection: {
      mechanism:
        'ネットワークレイヤー（network-security-inspector）でリクエストを分析。URL パターン（/tracking, /beacon, /analytics, /pixel, /telemetry, utm_*, _ga=, fbclid= 等）とペイロードパターン（user_id, visitor_id, tracking_id, _ga, utm_source, fbclid, gclid 等）をマッチング。ボディサイズ2048バイト未満かつクロスサイト通信のみ対象。',
      monitoredAPIs: [
        'chrome.webRequest (onBeforeRequest)',
        'navigator.sendBeacon（別アラート send_beacon と連携）',
        'fetch / XMLHttpRequest',
      ],
      triggerConditions: [
        'リクエストURLがトラッキングURLパターン（TRACKING_URL_PATTERNS）にマッチする場合',
        'リクエストボディにトラッキング固有のキー（TRACKING_PAYLOAD_PATTERNS）が含まれる場合',
        'ボディサイズが TRACKING_BEACON_SIZE_LIMIT（2048バイト）未満であること',
        '送信元と送信先が異なるサイト（クロスサイト）であること（同一サイトのファーストパーティ分析は除外）',
      ],
      severityLogic:
        '常に medium レベル。プライバシー侵害のリスクはあるが、直接的なセキュリティ脅威ではないため中程度。',
    },
    response: [
      {
        title: 'トラッキングサービスの特定',
        description:
          'targetDomain と url フィールドからトラッキングサービスを特定します（Google Analytics, Facebook Pixel, Adobe Analytics等）。',
      },
      {
        title: '送信データの確認',
        description:
          'ビーコンのペイロードを分析し、送信されている情報の種類（ページURL、ユーザーID、行動データ等）を確認します。',
      },
      {
        title: 'プライバシーポリシーとの整合性確認',
        description:
          '組織のプライバシーポリシーおよび法的要件（GDPR、個人情報保護法等）に照らし、検出されたトラッキングが許容範囲かを評価します。',
      },
      {
        title: 'ブロック判断',
        description:
          '業務に不要なサードパーティトラッキングは、拡張機能のブロックリストまたはDNRルールで遮断を検討します。',
      },
    ],
    prevention: [
      'CSPの connect-src で許可する外部通信先を明示的に管理する',
      'サードパーティスクリプトのロードをCSPのscript-srcで制限する',
      'プライバシー保護のためトラッキングブロッカーの導入を検討する',
      'ファーストパーティ分析への移行を推奨し、サードパーティ依存を削減する',
      '同意管理プラットフォーム（CMP）でユーザーの同意を取得してからトラッキングを有効化する',
    ],
    falsePositives:
      'ファーストパーティ分析（同一サイトのコレクターサブドメイン）は isSameSite 判定で除外されます。ただし、A/Bテストツール、ヒートマップツール、エラー監視サービス（Sentry等）の一部リクエストがURLパターンに一致して検出される可能性があります。',
    relatedAlerts: ['send_beacon', 'data_exfiltration', 'dns_prefetch_leak'],
  },
];

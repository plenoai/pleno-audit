import type { PlaybookData } from '../types';

export const storageMediaPlaybooks: PlaybookData[] = [
  // =========================================================================
  // media_capture
  // =========================================================================
  {
    id: 'media_capture',
    title: 'メディアキャプチャ検出',
    severity: 'high',
    description:
      'getUserMedia または getDisplayMedia API を通じて、カメラ・マイク・画面共有へのアクセスが要求されました。正規のビデオ会議サービス以外からの呼び出しは、盗聴・盗撮・画面キャプチャによる情報窃取のリスクがあります。',
    mitreAttack: [
      'T1125',  // Video Capture
      'T1123',  // Audio Capture
      'T1113',  // Screen Capture
    ],
    detection: {
      mechanism:
        'navigator.mediaDevices.getUserMedia および navigator.mediaDevices.getDisplayMedia のフック。呼び出し時にメソッド名・要求メディア種別（audio/video）をイベントとして送信し、バックグラウンドでアラートを生成する。',
      monitoredAPIs: [
        'navigator.mediaDevices.getUserMedia()',
        'navigator.mediaDevices.getDisplayMedia()',
      ],
      triggerConditions: [
        'getUserMedia() または getDisplayMedia() が呼び出された時点で発火',
        'audio/video の要求パラメータを記録',
      ],
      severityLogic:
        'getDisplayMedia（画面共有）の場合は critical、getUserMedia（カメラ・マイク）の場合は high',
    },
    response: [
      {
        title: '要求元の確認',
        description:
          'アラートに記録されたドメインとページURLを確認し、メディアアクセスを要求したサイトが正規のビデオ会議・通話サービスであるか判定する。',
      },
      {
        title: 'メディア種別の確認',
        description:
          '要求されたメディア種別（カメラ・マイク・画面共有）を確認し、そのサイトの機能として妥当かどうかを評価する。',
      },
      {
        title: 'ブラウザ権限の確認',
        description:
          'ブラウザのサイト設定でカメラ・マイク権限が付与されていないか確認し、不要であれば権限を取り消す。',
      },
      {
        title: '画面共有の場合の追加調査',
        description:
          'getDisplayMedia による画面共有が検出された場合、共有中にどのような情報が表示されていたかを確認し、機密情報の漏洩がなかったか評価する。',
      },
      {
        title: 'セキュリティポリシーの見直し',
        description:
          '組織のメディアアクセスポリシーを確認し、許可されたサービス以外からのアクセスをブロックするルールの追加を検討する。',
      },
    ],
    prevention: [
      'ブラウザのサイト設定でカメラ・マイクのデフォルト権限を「ブロック」に設定し、信頼済みサイトのみ許可する',
      'Permissions-Policy ヘッダで camera, microphone, display-capture の利用をオリジン単位で制限する',
      '組織のポリシーで許可するビデオ会議サービスのドメインリストを管理する',
      'エンタープライズポリシーで chrome.contentSettings API を使い、メディア権限の自動付与を防止する',
    ],
    falsePositives:
      'Google Meet、Zoom、Microsoft Teams などの正規ビデオ会議サービスでは正常な動作として getUserMedia/getDisplayMedia が呼び出されます。WebRTC ベースのサービスや音声入力機能でも検出されることがあります。',
    relatedAlerts: ['device_enumeration', 'device_sensor', 'webrtc_connection'],
  },

  // =========================================================================
  // suspicious_download
  // =========================================================================
  {
    id: 'suspicious_download',
    title: '不審なファイルダウンロード検出',
    severity: 'high',
    description:
      '実行可能ファイル（.exe, .msi, .bat, .ps1 等）のダウンロードが検出されました。Blob URL や data: URL を使った動的生成ダウンロード、および不審な MIME タイプのファイル生成も監視対象です。マルウェア配布やドライブバイダウンロード攻撃の兆候である可能性があります。',
    mitreAttack: [
      'T1204.002',  // User Execution: Malicious File
      'T1105',      // Ingress Tool Transfer
      'T1189',      // Drive-by Compromise
    ],
    detection: {
      mechanism:
        '2つの検知経路で監視する。(1) URL.createObjectURL のフックにより、不審な MIME タイプ（application/x-msdownload, application/octet-stream 等）の Blob 生成を検出。(2) document の click イベントリスナーで、<a> タグの download 属性付きクリックを監視し、blob:/data: URL および不審な拡張子（.exe, .msi, .bat, .ps1, .cmd, .scr, .vbs, .js, .jar, .dll）を検出する。',
      monitoredAPIs: [
        'URL.createObjectURL()',
        'HTMLAnchorElement.click（download属性付き）',
      ],
      triggerConditions: [
        '不審な MIME タイプの Blob が URL.createObjectURL に渡された場合',
        'blob: または data: URL を持つリンクがクリックされた場合',
        '不審な拡張子（.exe, .msi, .bat, .ps1, .cmd, .scr, .vbs, .js, .jar, .dll）を持つファイルのダウンロードリンクがクリックされた場合',
      ],
      severityLogic:
        '実行可能ファイル（.exe, .msi, .bat, .ps1）の場合は critical、その他の不審な拡張子やBlob/data URLの場合は high',
    },
    response: [
      {
        title: 'ダウンロードの停止と隔離',
        description:
          'ダウンロードされたファイルを即座に隔離し、実行されていないことを確認する。既に実行された場合はエンドポイントの隔離を検討する。',
      },
      {
        title: 'ファイルの分析',
        description:
          'ダウンロードされたファイルのハッシュ値を取得し、VirusTotal 等で既知のマルウェアでないか確認する。',
      },
      {
        title: 'ダウンロード元の調査',
        description:
          'アラートに記録されたドメインとURLを確認し、正規のソフトウェア配布サイトであるか、改ざんされた正規サイトでないかを判定する。',
      },
      {
        title: 'Blob/data URL の場合の追加調査',
        description:
          'Blob URL や data: URL 経由のダウンロードはページ上のスクリプトが動的に生成したファイルであるため、どのスクリプトが生成元かを特定する。',
      },
      {
        title: '影響範囲の特定',
        description:
          '同一ドメインからのダウンロードアラートが他のユーザーにも発生していないか確認し、組織全体への影響を評価する。',
      },
    ],
    prevention: [
      'ブラウザのダウンロード設定で、実行可能ファイルのダウンロード時に常に確認ダイアログを表示させる',
      'グループポリシーで危険なファイルタイプのダウンロードをブロックする',
      'Content-Disposition ヘッダの検証により、不正なファイル名の付け替えを検知する',
      'エンドポイント保護ソフトウェアでダウンロードファイルのリアルタイムスキャンを有効にする',
      'Blob URL や data: URL からのダウンロードを組織ポリシーで制限する',
    ],
    falsePositives:
      '正規のソフトウェアダウンロードサイト（GitHub Releases、公式インストーラ配布ページ等）からの実行ファイルダウンロードで検出されます。Web アプリケーションが Blob URL を使ってエクスポートファイル（CSV、PDF等）を生成する場合も、MIME タイプによっては検出される場合があります。',
    relatedAlerts: ['dynamic_code_execution', 'wasm_execution'],
  },

  // =========================================================================
  // cache_api_abuse
  // =========================================================================
  {
    id: 'cache_api_abuse',
    title: 'Cache API 不正使用検出',
    severity: 'medium',
    description:
      'Cache API の open/put 操作が検出されました。Cache API はService Worker と組み合わせてオフラインキャッシュに利用されますが、悪意あるスクリプトによるデータ永続化やキャッシュポイズニング（レスポンスの書き換え）に悪用される可能性があります。',
    mitreAttack: [
      'T1185',      // Browser Session Hijacking
      'T1557.003',  // Adversary-in-the-Browser
    ],
    detection: {
      mechanism:
        'caches.open() および Cache.prototype.put() のフックにより、キャッシュの作成と書き込み操作を監視する。操作種別（open/put）、キャッシュ名、対象URLをイベントとしてバックグラウンドに送信する。',
      monitoredAPIs: [
        'caches.open()',
        'Cache.prototype.put()',
      ],
      triggerConditions: [
        'caches.open() でキャッシュストレージが開かれた場合',
        'Cache.prototype.put() でキャッシュにデータが書き込まれた場合',
      ],
      severityLogic:
        'put 操作（書き込み）の場合は high、open 操作（読み取り/作成）のみの場合は medium',
    },
    response: [
      {
        title: 'キャッシュ内容の確認',
        description:
          'DevTools の Application > Cache Storage からアラートに記録されたキャッシュ名を開き、格納されているリソースとその内容を確認する。',
      },
      {
        title: 'Service Worker の確認',
        description:
          '当該ドメインに登録されている Service Worker を確認し、キャッシュ操作が正規の Service Worker によるものかを判定する。',
      },
      {
        title: 'キャッシュポイズニングの調査',
        description:
          'put 操作で書き込まれたレスポンスが元のサーバーレスポンスと異なっていないか確認し、改ざんの有無を評価する。',
      },
      {
        title: '不審なキャッシュの削除',
        description:
          '不正と判断されたキャッシュを DevTools から削除し、関連する Service Worker も登録解除する。',
      },
      {
        title: 'ドメインのセキュリティ評価',
        description:
          '当該サイトが正規のPWA（Progressive Web App）であるか確認し、キャッシュ操作が設計上意図されたものかを評価する。',
      },
    ],
    prevention: [
      'Service Worker の登録を許可するドメインをエンタープライズポリシーで制限する',
      'Content-Security-Policy の worker-src ディレクティブで Service Worker のソースを制限する',
      'ブラウザの定期的なキャッシュクリアを設定し、永続化されたデータを削除する',
      '不審なサイトでは DevTools で Service Worker の登録状況を確認する習慣をつける',
    ],
    falsePositives:
      'PWA（Progressive Web App）として正しく実装されたサイトは、オフライン対応のために Cache API を正常に使用します。Google Docs、Twitter、Slack 等の大規模WebアプリケーションでもService Worker によるキャッシュ操作が日常的に行われます。',
    relatedAlerts: ['indexeddb_abuse', 'storage_exfiltration'],
  },

  // =========================================================================
  // indexeddb_abuse
  // =========================================================================
  {
    id: 'indexeddb_abuse',
    title: 'IndexedDB 不審アクセス検出',
    severity: 'medium',
    description:
      'IndexedDB.open() によるデータベースの作成・アクセスが検出されました。IndexedDB は大容量の構造化データをブラウザに永続保存でき、正規の用途も多いですが、秘密データの永続化やトラッキング情報の蓄積にも悪用される可能性があります。',
    mitreAttack: [
      'T1074.001',  // Data Staged: Local Data Staging
      'T1119',      // Automated Collection
    ],
    detection: {
      mechanism:
        'indexedDB.open() のフックにより、データベース名とバージョン番号を記録する。呼び出し時にイベントをバックグラウンドに送信し、アラートを生成する。',
      monitoredAPIs: [
        'indexedDB.open()',
      ],
      triggerConditions: [
        'indexedDB.open() が呼び出された時点で発火',
        'データベース名とバージョン番号を記録',
      ],
      severityLogic:
        '一律 medium。IndexedDB の使用自体は広範に行われるため、過度なアラート疲れを防ぐ設計。',
    },
    response: [
      {
        title: 'データベース内容の確認',
        description:
          'DevTools の Application > IndexedDB からアラートに記録されたデータベース名を開き、格納されているオブジェクトストアとデータ内容を確認する。',
      },
      {
        title: '格納データの機密性評価',
        description:
          '個人情報、認証トークン、トラッキングID等の機密データが平文で保存されていないか確認する。',
      },
      {
        title: 'データベースの正当性確認',
        description:
          '当該サイトの機能として IndexedDB の使用が妥当かを判定する。例えば、単純な情報提供サイトで大量のデータベースが作成されている場合は不審。',
      },
      {
        title: '不審なデータの削除',
        description:
          '不正と判断されたデータベースを DevTools から削除し、必要に応じてサイトデータ全体のクリアを実施する。',
      },
    ],
    prevention: [
      'ブラウザのサイトデータを定期的にクリアし、不要な永続データの蓄積を防ぐ',
      'プライベートブラウジングモードを使用して、セッション終了時にデータが自動削除されるようにする',
      '不審なサイトへのアクセス時は DevTools の Storage パネルでデータ蓄積状況を監視する',
      'エンタープライズポリシーでストレージクォータを制限し、大量データの保存を防止する',
    ],
    falsePositives:
      'Gmail、Google Drive、Notion 等のWebアプリケーションはオフラインデータ同期やパフォーマンス最適化のために IndexedDB を日常的に使用します。多くのSPAフレームワークや状態管理ライブラリも内部的に IndexedDB を利用しています。',
    relatedAlerts: ['cache_api_abuse', 'storage_exfiltration'],
  },

  // =========================================================================
  // history_manipulation
  // =========================================================================
  {
    id: 'history_manipulation',
    title: 'History API 操作検出',
    severity: 'low',
    description:
      'history.pushState() または history.replaceState() によるURL操作が検出されました。SPA（Single Page Application）では正常な画面遷移に使用されますが、アドレスバーの偽装やフィッシングページでの URL スプーフィングに悪用される可能性があります。',
    mitreAttack: [
      'T1036.005',  // Masquerading: Match Legitimate Name or Location
      'T1566.002',  // Phishing: Spearphishing Link
    ],
    detection: {
      mechanism:
        'history.pushState() および history.replaceState() のフックにより、メソッド名・変更先URL・state データの有無を記録する。イベントをバックグラウンドに送信し、URLの性質に応じた重大度でアラートを生成する。',
      monitoredAPIs: [
        'history.pushState()',
        'history.replaceState()',
      ],
      triggerConditions: [
        'history.pushState() または history.replaceState() が呼び出された時点で発火',
        '変更先URL と state データの有無を記録',
      ],
      severityLogic:
        '絶対URL（http:/https: スキーム）かつ state データありの場合は high、絶対URLのみの場合は medium、相対URLの場合は low',
    },
    response: [
      {
        title: 'URL変更内容の確認',
        description:
          'アラートに記録された変更先URLを確認し、アドレスバーに表示されるURLが実際のページ内容と一致しているか判定する。',
      },
      {
        title: 'フィッシングの可能性評価',
        description:
          '絶対URLへの変更が検出された場合、変更先のドメインが正規のドメインに偽装していないか（タイポスクワットやホモグリフ）を確認する。',
      },
      {
        title: 'SPAフレームワークの確認',
        description:
          '当該サイトがSPAフレームワーク（React Router、Vue Router 等）を使用している場合、ルーティングによる正常なURL変更である可能性を評価する。',
      },
      {
        title: 'state データの分析',
        description:
          'pushState/replaceState に渡された state データに不審な情報（トラッキングデータ、セッション情報等）が含まれていないか確認する。',
      },
      {
        title: '関連アラートの相関分析',
        description:
          'history manipulation が他のアラート（フィッシング、XSS 等）と同時に発生していないか確認し、複合攻撃の可能性を評価する。',
      },
    ],
    prevention: [
      'ブラウザのアドレスバーを常に確認し、表示されたURLと実際のページ内容が一致しているか注意する',
      'NRD/タイポスクワット検知と組み合わせて、偽装ドメインへのURL変更を検出する',
      'Content-Security-Policy の navigate-to ディレクティブ（実験的機能）でナビゲーション先を制限する',
      '組織のセキュリティ研修でアドレスバー偽装攻撃の手法と対策を周知する',
    ],
    falsePositives:
      'React、Vue、Angular 等のSPAフレームワークはページ遷移に history.pushState/replaceState を標準的に使用します。ほぼ全てのモダンWebアプリケーションで頻繁に呼び出されるため、単体での検出は情報レベルとして扱い、他のアラートとの相関で重要度を判断してください。',
    relatedAlerts: ['open_redirect', 'fullscreen_phishing', 'xss_injection'],
  },
];

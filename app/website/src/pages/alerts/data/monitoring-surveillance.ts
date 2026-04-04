import type { PlaybookData } from '../types';

export const monitoringSurveillancePlaybooks: PlaybookData[] = [
  // =========================================================================
  // dom_scraping
  // =========================================================================
  {
    id: 'dom_scraping',
    title: 'DOMスクレイピング検出',
    severity: 'medium',
    description:
      'document.querySelectorAll の呼び出し回数が短時間に異常な閾値を超えた場合に発火します。スクリプトがページ内の情報（メールアドレス、電話番号、価格など）を大量に抽出しようとしている可能性があります。',
    mitreAttack: ['T1005', 'T1213'],
    detection: {
      mechanism:
        'document.querySelectorAll をプロキシし、5秒間のスライディングウィンドウ内で呼び出し回数をカウントします。閾値に達した時点で __DOM_SCRAPING_DETECTED__ イベントを発行します。',
      monitoredAPIs: ['document.querySelectorAll'],
      triggerConditions: [
        '5秒間に querySelectorAll が300回呼び出された時点でアラート発火',
        '5秒経過後にカウンターはリセットされる',
      ],
      severityLogic: '固定で medium。呼び出し回数やセレクタの種類による動的変更なし。',
    },
    response: [
      {
        title: 'アラート内容の確認',
        description: 'セレクタ文字列と呼び出し回数を確認し、どのDOM要素が対象かを特定します。',
      },
      {
        title: '発生源スクリプトの特定',
        description: 'DevToolsのPerformanceタブまたはSourcesタブで、querySelectorAll を大量に呼び出しているスクリプトのオリジンを特定します。',
      },
      {
        title: 'サードパーティスクリプトの評価',
        description: '外部スクリプトが原因の場合、当該スクリプトの提供元・目的を調査し、正規のアナリティクスかスクレイピングかを判断します。',
      },
      {
        title: '対象データの影響評価',
        description: 'スクレイピング対象にPII（個人情報）や機密情報が含まれていないか確認します。',
      },
      {
        title: '必要に応じたブロック',
        description: '悪意あるスクリプトと判断した場合、CSPやコンテンツブロッカーで当該スクリプトを遮断します。',
      },
    ],
    prevention: [
      'CSP（Content Security Policy）で不要なサードパーティスクリプトの読み込みを制限する',
      'SRI（Subresource Integrity）で外部スクリプトの改ざんを検知する',
      '機密データはクライアントサイドDOMにレンダリングせず、サーバーサイドで制御する',
      'Bot対策やレートリミットをサーバーサイドで導入する',
    ],
    falsePositives:
      'SPAフレームワーク（React、Vue等）の仮想DOM差分処理やテストフレームワークが短時間に大量のDOM操作を行うケースで誤検知が発生しやすい。また、アクセシビリティツールや広告スクリプトも高頻度でDOMを走査する場合がある。',
    relatedAlerts: ['storage_exfiltration', 'data_exfiltration', 'fetch_exfiltration'],
  },

  // =========================================================================
  // intersection_observer
  // =========================================================================
  {
    id: 'intersection_observer',
    title: 'IntersectionObserverによるサーベイランス検出',
    severity: 'medium',
    description:
      'IntersectionObserver を使用して大量のDOM要素の可視性を一括監視するパターンを検出します。ユーザーの閲覧行動（どの要素を見たか、スクロール位置等）を詳細にトラッキングする目的で悪用される可能性があります。',
    mitreAttack: ['T1185'],
    detection: {
      mechanism:
        'IntersectionObserver コンストラクタをプロキシし、observe() で監視対象に追加された要素数をカウントします。閾値を超えた場合にアラートを発行します。',
      monitoredAPIs: ['IntersectionObserver', 'IntersectionObserver.prototype.observe'],
      triggerConditions: [
        'IntersectionObserver が生成されるとイベント発行',
        '監視対象要素が5個を超える場合、バルクサーベイランスパターンとして severity を medium に昇格',
      ],
      severityLogic: '監視対象が5要素以下の場合は low、5要素超の場合は medium。',
    },
    response: [
      {
        title: 'アラート詳細の確認',
        description: '監視対象要素数（observedCount）と発生ドメインを確認します。',
      },
      {
        title: '監視対象要素の特定',
        description: 'DevToolsで IntersectionObserver のコールバックにブレークポイントを設置し、どの要素が監視されているかを特定します。',
      },
      {
        title: 'トラッキング目的の評価',
        description: '広告インプレッション計測やレイジーロードなどの正当な用途か、ユーザー行動の詳細な追跡かを判別します。',
      },
      {
        title: 'データ送信先の確認',
        description: 'IntersectionObserver のコールバック内でネットワークリクエストが発生していないか、送信先を確認します。',
      },
    ],
    prevention: [
      'CSPで不要なサードパーティスクリプトの実行を制限する',
      'プライバシー保護ブラウザ拡張機能を導入してトラッキングスクリプトをブロックする',
      'サードパーティスクリプトの監査を定期的に実施する',
    ],
    falsePositives:
      '広告インプレッション計測、画像のレイジーロード、無限スクロールの実装など、正当な用途で多数の要素を監視するケースは一般的である。アナリティクスSDKやA/Bテストツールも同様のパターンを示す。',
    relatedAlerts: ['resize_observer', 'dom_scraping', 'tracking_beacon'],
  },

  // =========================================================================
  // performance_observer
  // =========================================================================
  {
    id: 'performance_observer',
    title: 'PerformanceObserverリソースタイミングサイドチャネル検出',
    severity: 'medium',
    description:
      'PerformanceObserver を使用してリソースタイミング情報を監視するパターンを検出します。Resource Timing API を通じて、ユーザーがアクセスしたリソースのURL、サイズ、読み込み時間などのメタデータを収集し、閲覧履歴やキャッシュ状態を推定するサイドチャネル攻撃に悪用される可能性があります。',
    mitreAttack: ['T1185', 'T1082'],
    detection: {
      mechanism:
        'PerformanceObserver コンストラクタをプロキシし、observe() で監視対象のエントリタイプ（特に "resource"）を検出します。リソースタイミング監視が登録された時点でイベントを発行します。',
      monitoredAPIs: ['PerformanceObserver', 'PerformanceObserver.prototype.observe'],
      triggerConditions: [
        'PerformanceObserver が "resource" エントリタイプを監視するよう設定された場合にアラート発火',
      ],
      severityLogic: '固定で medium。エントリタイプに関わらず一律の重大度。',
    },
    response: [
      {
        title: 'エントリタイプの確認',
        description: '監視対象のエントリタイプ（resource、navigation等）を確認し、攻撃の意図を推定します。',
      },
      {
        title: '発生源の特定',
        description: 'PerformanceObserver を登録しているスクリプトのオリジンを特定し、サードパーティかファーストパーティかを判別します。',
      },
      {
        title: 'コールバック内の処理の分析',
        description: 'コールバック内でリソースURLやタイミングデータを外部に送信していないかを調査します。',
      },
      {
        title: 'キャッシュプロービングの確認',
        description: 'transferSize や encodedBodySize の値を利用してキャッシュヒット判定を行っていないかを確認します。',
      },
      {
        title: 'リスク評価と対処',
        description: 'サイドチャネル攻撃と判断した場合、当該スクリプトのブロックまたは Timing-Allow-Origin ヘッダーの制限を検討します。',
      },
    ],
    prevention: [
      'Timing-Allow-Origin ヘッダーを適切に設定し、クロスオリジンのタイミング情報漏洩を防止する',
      'CSPでサードパーティスクリプトの実行を制限する',
      'Cache-Control ヘッダーを適切に設定してキャッシュプロービングを困難にする',
      'Cross-Origin-Resource-Policy ヘッダーでリソースのクロスオリジン読み込みを制限する',
    ],
    falsePositives:
      'RUM（Real User Monitoring）ツール、パフォーマンス計測SDK（Web Vitals等）、CDNのパフォーマンスモニタリングなど、正当なパフォーマンス監視目的での利用は広く普及している。',
    relatedAlerts: ['idle_callback_timing', 'tracking_beacon'],
  },

  // =========================================================================
  // selection_sniffing
  // =========================================================================
  {
    id: 'selection_sniffing',
    title: 'セレクションAPIキーロギング検出',
    severity: 'high',
    description:
      'document の selectionchange イベントリスナーが高頻度で登録されるパターンを検出します。Selection API を悪用してユーザーのテキスト選択操作を逐次的に監視し、選択内容（パスワード、機密テキスト等）をキーロガーのように窃取する攻撃手法です。',
    mitreAttack: ['T1056.001', 'T1185'],
    detection: {
      mechanism:
        'document.addEventListener をプロキシし、"selectionchange" イベントリスナーの登録をバーストウィンドウ内で検出します。5秒間のウィンドウ内で登録回数が閾値を超えた場合にアラートを発行します。',
      monitoredAPIs: ['document.addEventListener("selectionchange")'],
      triggerConditions: [
        '5秒間に selectionchange イベントリスナーが10回超登録された場合にアラート発火',
      ],
      severityLogic: '固定で high。テキスト選択内容の監視はキーロギングに準ずる高リスク行為として扱う。',
    },
    response: [
      {
        title: 'イベントリスナーの確認',
        description: 'DevToolsの Elements > Event Listeners で selectionchange のリスナー一覧を確認し、登録元スクリプトを特定します。',
      },
      {
        title: 'コールバック処理の分析',
        description: 'リスナーのコールバック内で window.getSelection() の結果を外部に送信していないかを確認します。',
      },
      {
        title: '影響範囲の評価',
        description: 'ユーザーがテキスト選択操作を行ったページにパスワードフィールドや機密情報が含まれているかを評価します。',
      },
      {
        title: 'スクリプトの遮断',
        description: '悪意ある監視と判断した場合、CSPまたはコンテンツブロッカーで当該スクリプトを遮断します。',
      },
      {
        title: 'パスワード変更の推奨',
        description: '機密情報が漏洩した可能性がある場合、ユーザーにパスワード変更やセッション無効化を推奨します。',
      },
    ],
    prevention: [
      'CSPで不要なサードパーティスクリプトの実行を厳格に制限する',
      '機密入力フィールドにはテキスト選択を無効化する CSS（user-select: none）を適用する',
      '入力フィールドの autocomplete 属性を適切に設定し、ブラウザの自動入力を活用する',
      'パスワードマネージャーの使用を推奨し、手動入力・コピーペーストを最小化する',
    ],
    falsePositives:
      'テキストエディタ、WYSIWYG エディタ、コード補完ツール、テキストハイライト機能など、テキスト選択変更を監視する正当なユースケースは存在する。ただしバースト的な登録（5秒間に10回超）は通常の実装では稀。',
    relatedAlerts: ['clipboard_event_sniffing', 'clipboard_read', 'css_keylogging', 'drag_event_sniffing'],
  },

  // =========================================================================
  // drag_event_sniffing
  // =========================================================================
  {
    id: 'drag_event_sniffing',
    title: 'ドラッグ&ドロップデータ窃取検出',
    severity: 'high',
    description:
      'dragstart および drop イベントリスナーが高頻度で登録されるパターンを検出します。ドラッグ&ドロップ操作時に dataTransfer オブジェクトからユーザーのデータ（ファイル、テキスト、URL等）を窃取する攻撃手法です。',
    mitreAttack: ['T1056', 'T1005'],
    detection: {
      mechanism:
        'document.addEventListener をプロキシし、"dragstart" および "drop" イベントリスナーの登録をバーストウィンドウ内で検出します。5秒間のウィンドウ内で登録回数が閾値を超えた場合にアラートを発行します。',
      monitoredAPIs: ['document.addEventListener("dragstart")', 'document.addEventListener("drop")'],
      triggerConditions: [
        '5秒間に dragstart/drop イベントリスナーが10回超登録された場合にアラート発火',
      ],
      severityLogic: '固定で high。ドラッグ&ドロップによるデータ窃取は能動的な攻撃行為として扱う。',
    },
    response: [
      {
        title: 'イベントリスナーの確認',
        description: 'DevToolsの Elements > Event Listeners で dragstart/drop のリスナー一覧を確認し、登録元スクリプトを特定します。',
      },
      {
        title: 'dataTransfer アクセスの分析',
        description: 'コールバック内で event.dataTransfer.getData() や event.dataTransfer.files にアクセスしていないかを確認します。',
      },
      {
        title: 'データ送信先の調査',
        description: 'コールバック内で取得したデータを外部サーバーに送信していないかを確認します。',
      },
      {
        title: '影響範囲の評価',
        description: 'ユーザーがドラッグ&ドロップで機密ファイル（証明書、鍵ファイル等）を操作した可能性を評価します。',
      },
      {
        title: '当該スクリプトの遮断',
        description: '悪意あるスクリプトと判断した場合、CSPまたはコンテンツブロッカーでブロックします。',
      },
    ],
    prevention: [
      'CSPでサードパーティスクリプトの実行を制限する',
      'ファイルアップロード機能がないページでは、ドラッグ&ドロップイベントの伝播を防止する',
      '機密ファイルの操作にはブラウザ以外の専用ツールを使用する',
      'サードパーティスクリプトの定期的な監査を実施する',
    ],
    falsePositives:
      'ファイルアップロード機能、Kanbanボード、ドラッグ&ドロップUIコンポーネント、ソート可能リストなど、ドラッグ&ドロップを活用する正当なUI実装は多い。ただしバースト的な登録（5秒間に10回超）は通常の実装では稀。',
    relatedAlerts: ['selection_sniffing', 'clipboard_event_sniffing', 'clipboard_hijack'],
  },

  // =========================================================================
  // idle_callback_timing
  // =========================================================================
  {
    id: 'idle_callback_timing',
    title: 'requestIdleCallbackタイミングサイドチャネル検出',
    severity: 'medium',
    description:
      'requestIdleCallback を短時間に大量に呼び出すパターンを検出します。アイドル時間のタイミング差分を計測することで、他のタブの負荷状況やバックグラウンド処理の有無を推定するサイドチャネル攻撃に悪用される可能性があります。',
    mitreAttack: ['T1082', 'T1185'],
    detection: {
      mechanism:
        'window.requestIdleCallback をプロキシし、2秒間のスライディングウィンドウ内で呼び出し回数をカウントします。閾値に達した場合にアラートを発行します。',
      monitoredAPIs: ['window.requestIdleCallback'],
      triggerConditions: [
        '2秒以内に requestIdleCallback が複数回呼び出された場合にアラート発火',
      ],
      severityLogic: '固定で medium。タイミングサイドチャネルは間接的な情報漏洩リスクとして扱う。',
    },
    response: [
      {
        title: 'アラート詳細の確認',
        description: '呼び出し回数（callCount）と発生ドメインを確認します。',
      },
      {
        title: '発生源スクリプトの特定',
        description: 'DevToolsのProfilerで requestIdleCallback の呼び出し元スクリプトを特定します。',
      },
      {
        title: 'コールバック内処理の分析',
        description: 'コールバック内で IdleDeadline.timeRemaining() の値を計測・蓄積していないかを確認します。',
      },
      {
        title: 'タイミング情報の送信確認',
        description: '計測されたタイミング情報が外部サーバーに送信されていないかを確認します。',
      },
      {
        title: 'リスク評価と対処',
        description: 'サイドチャネル攻撃と判断した場合、当該スクリプトのブロックを検討します。',
      },
    ],
    prevention: [
      'CSPでサードパーティスクリプトの実行を制限する',
      'Cross-Origin-Opener-Policy (COOP) を設定してクロスオリジンのタイミング推定を困難にする',
      'ブラウザのサイト分離（Site Isolation）機能を有効化する',
      'サードパーティスクリプトの定期的な監査を実施する',
    ],
    falsePositives:
      'パフォーマンス最適化のために requestIdleCallback を使用するスクリプト（遅延読み込み、プリフェッチ、アナリティクスの遅延送信等）は一般的である。バンドラーやフレームワークが内部的に使用するケースも多い。',
    relatedAlerts: ['performance_observer', 'tracking_beacon'],
  },

  // =========================================================================
  // geolocation_access
  // =========================================================================
  {
    id: 'geolocation_access',
    title: 'Geolocation APIアクセス検出',
    severity: 'medium',
    description:
      'Geolocation API（getCurrentPosition / watchPosition）の呼び出しを検出します。ユーザーの物理的な位置情報は高度なプライバシー情報であり、不正なスクリプトによる位置追跡やストーカーウェアに悪用される可能性があります。',
    mitreAttack: ['T1430', 'T1614'],
    detection: {
      mechanism:
        'navigator.geolocation.getCurrentPosition および navigator.geolocation.watchPosition をプロキシし、呼び出し時にメソッド名と高精度オプションの有無を含むイベントを発行します。',
      monitoredAPIs: [
        'navigator.geolocation.getCurrentPosition',
        'navigator.geolocation.watchPosition',
      ],
      triggerConditions: [
        'getCurrentPosition または watchPosition が呼び出された時点でアラート発火',
        'enableHighAccuracy: true が指定されている場合、severity が high に昇格',
      ],
      severityLogic:
        'enableHighAccuracy が true の場合は high（GPS精度の位置情報取得は高リスク）、それ以外は medium。',
    },
    response: [
      {
        title: 'アクセス目的の確認',
        description: '位置情報の取得がユーザーの明示的な操作（地図表示、店舗検索等）に基づくものかを確認します。',
      },
      {
        title: '高精度オプションの確認',
        description: 'enableHighAccuracy が true の場合、GPS精度の位置情報が要求されており、より高いプライバシーリスクがあります。',
      },
      {
        title: '位置情報の送信先調査',
        description: '取得した位置情報がどのサーバーに送信されているかをNetworkタブで確認します。',
      },
      {
        title: 'ブラウザ権限の確認',
        description: 'ブラウザの位置情報権限設定を確認し、不要なサイトへの許可を取り消します。',
      },
    ],
    prevention: [
      'ブラウザの位置情報権限をデフォルトで「毎回確認」に設定する',
      '位置情報が不要なサイトでは権限リクエストを拒否する',
      'Permissions-Policy ヘッダーで geolocation の使用を制限する',
      'VPNを使用してIPベースの位置推定精度を低下させる',
      '企業環境ではMDM/EMM経由でブラウザの位置情報権限ポリシーを一括管理する',
    ],
    falsePositives:
      '地図サービス、天気予報、店舗検索、配車アプリなど、位置情報の取得が本来の機能に必須なサイトでは正当なアクセスとなる。ユーザーが明示的に位置情報を許可した操作の直後に発火した場合は誤検知の可能性が高い。',
    relatedAlerts: ['device_sensor', 'tracking_beacon'],
  },
];

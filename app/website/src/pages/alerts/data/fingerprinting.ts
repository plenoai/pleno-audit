import type { PlaybookData } from '../types';

export const fingerprintingPlaybooks: PlaybookData[] = [
  // =========================================================================
  // canvas_fingerprint — Canvas APIフィンガープリント検出
  // =========================================================================
  {
    id: 'canvas_fingerprint',
    title: 'Canvas APIフィンガープリント検出',
    severity: 'high',
    description:
      'HTMLCanvasElement.toDataURL() を小さなキャンバス（256x64以下）で呼び出し、描画結果のハッシュからブラウザ・GPU固有の識別子を生成するフィンガープリント手法を検出します。広告トラッカーやアナリティクスSDKがCookieに依存しないユーザー追跡に利用します。',
    mitreAttack: ['T1082', 'T1217'],
    detection: {
      mechanism:
        'HTMLCanvasElement.prototype.toDataURL をフックし、呼び出し時のキャンバスサイズを検査。幅256px以下かつ高さ64px以下の小型キャンバスへの呼び出しのみをフィンガープリント目的と判定します。',
      monitoredAPIs: ['HTMLCanvasElement.prototype.toDataURL'],
      triggerConditions: [
        'toDataURL() 呼び出し時に canvas.width <= 256 かつ canvas.height <= 64',
        'ページロード後の即時呼び出し（ユーザー操作なし）',
      ],
      severityLogic:
        'サイズ条件を満たす場合は一律 high。大きなキャンバス（チャート描画、ゲーム、画像編集）は正規用途として除外されます。',
    },
    response: [
      {
        title: '発報元ドメインの確認',
        description:
          'アラートに記載されたドメインが、訪問中のサイト自体か、埋め込まれたサードパーティスクリプトかを確認します。',
      },
      {
        title: 'キャンバスサイズの検証',
        description:
          'canvasWidth / canvasHeight の値を確認し、1x1や16x16など極端に小さいキャンバスはフィンガープリント目的の可能性が高いと判断します。',
      },
      {
        title: 'スクリプトの出所調査',
        description:
          'DevToolsのNetworkタブやInitiatorカラムで、toDataURL()を呼び出しているスクリプトのURLを特定します。',
      },
      {
        title: 'トラッキング目的の評価',
        description:
          '同一ページでWebGLフィンガープリントやAudioContextフィンガープリントも併用されていないか確認し、包括的なフィンガープリント収集か判断します。',
      },
      {
        title: '対処方針の決定',
        description:
          'サードパーティスクリプトが原因の場合はCSPでスクリプト読み込みを制限するか、コンテンツブロッカーで当該ドメインをブロックします。',
      },
    ],
    prevention: [
      'Content-Security-Policy で不要なサードパーティスクリプトの読み込みを制限する',
      'ブラウザのフィンガープリント保護機能（Firefox resistFingerprinting 等）を有効化する',
      'Canvas APIのランダム化を行うブラウザ拡張機能を導入する',
      'プライバシーポリシーでフィンガープリント収集の有無を確認してからサードパーティSDKを導入する',
    ],
    falsePositives:
      'CAPTCHAレンダリング、小型アイコンの動的生成、テキスト幅計測など正規用途でも小型キャンバスのtoDataURL()が呼ばれる場合があります。描画内容やスクリプトの出所を確認して判断してください。',
    relatedAlerts: ['webgl_fingerprint', 'audio_fingerprint', 'font_fingerprint'],
  },

  // =========================================================================
  // webgl_fingerprint — WebGLパラメータ抽出検出
  // =========================================================================
  {
    id: 'webgl_fingerprint',
    title: 'WebGLパラメータ抽出検出',
    severity: 'high',
    description:
      'WebGLRenderingContext.getParameter() でGPUベンダー名・レンダラー名などハードウェア固有の情報を複数取得するフィンガープリント手法を検出します。RENDERER、VENDOR、およびWEBGL_debug_renderer_info拡張のパラメータを組み合わせることで、高精度なデバイス識別が可能になります。',
    mitreAttack: ['T1082', 'T1217'],
    detection: {
      mechanism:
        'HTMLCanvasElement.prototype.getContext をフックし、WebGL/WebGL2コンテキスト取得時にgetParameterを監視。500ms以内に2種類以上のフィンガープリント関連パラメータ（RENDERER 0x1F01、VENDOR 0x1F00、UNMASKED_RENDERER 0x9246、UNMASKED_VENDOR 0x9245）が読み取られた場合にアラートを発火します。',
      monitoredAPIs: [
        'HTMLCanvasElement.prototype.getContext',
        'WebGLRenderingContext.prototype.getParameter',
      ],
      triggerConditions: [
        '500msウィンドウ内に RENDERER(0x1F01)、VENDOR(0x1F00)、UNMASKED_RENDERER(0x9246)、UNMASKED_VENDOR(0x9245) のうち2種類以上を取得',
        'ページあたり1回のみ発火（重複抑制済み）',
      ],
      severityLogic:
        '閾値（2パラメータ以上）を超えた場合に一律 high。単一パラメータの読み取りは通常の3D描画で発生するため除外されます。',
    },
    response: [
      {
        title: 'パラメータ取得パターンの分析',
        description:
          'RENDERER/VENDORに加えてUNMASKED_*パラメータも取得されているか確認し、フィンガープリント目的の確度を判断します。',
      },
      {
        title: 'WebGLコンテキストの用途確認',
        description:
          'ページ上に3Dレンダリング（Three.js、WebGL可視化等）が存在するか確認し、正規のグラフィックス利用と区別します。',
      },
      {
        title: '呼び出し元スクリプトの特定',
        description:
          'DevToolsのPerformanceタブやBreakpointで、getParameterを呼び出しているスクリプトファイルとスタックトレースを調査します。',
      },
      {
        title: '他のフィンガープリント手法との併用確認',
        description:
          'Canvas、AudioContext、フォント列挙など他のフィンガープリントアラートが同一ドメインで発生していないか相関分析します。',
      },
      {
        title: '緩和策の適用',
        description:
          'WEBGL_debug_renderer_info拡張を無効化するブラウザ設定やプライバシー拡張の導入を検討します。',
      },
    ],
    prevention: [
      'ブラウザのWebGLフィンガープリント保護機能を有効化する',
      'WEBGL_debug_renderer_info拡張の提供を制限するブラウザ拡張を導入する',
      'サードパーティスクリプトの監査でWebGLパラメータ取得を行うSDKを特定・排除する',
      'Content-Security-Policy でWebGLを使用するサードパーティスクリプトを制限する',
    ],
    falsePositives:
      '3Dゲーム、データ可視化ライブラリ、WebGLベースのUI描画でRENDERER/VENDORパラメータを参照する場合があります。ただし通常は1パラメータの取得で十分なため、複数パラメータの同時取得はフィンガープリント目的の可能性が高いです。',
    relatedAlerts: ['canvas_fingerprint', 'audio_fingerprint', 'font_fingerprint'],
  },

  // =========================================================================
  // audio_fingerprint — AudioContextフィンガープリント検出
  // =========================================================================
  {
    id: 'audio_fingerprint',
    title: 'AudioContextフィンガープリント検出',
    severity: 'info',
    description:
      'AudioContextコンストラクタの呼び出しを検出します。OscillatorNodeとDynamicsCompressorNodeを組み合わせて音声信号を処理し、その出力の微小な差異からデバイスを識別するフィンガープリント手法に使用されます。ただし、音楽・動画再生やWeb Audio API利用でも発火するため情報レベルとしています。',
    mitreAttack: ['T1082'],
    detection: {
      mechanism:
        'window.AudioContext コンストラクタをラップし、新規インスタンス生成を検出。ページあたり1回のみ発火する重複抑制機構を備えています。',
      monitoredAPIs: ['AudioContext constructor'],
      triggerConditions: [
        'new AudioContext() の呼び出し（ページあたり初回のみ）',
      ],
      severityLogic:
        '一律 info。AudioContextは音楽再生、Web Audio APIを使った正規アプリケーションでも生成されるため、フィンガープリント目的との区別が困難です。他のフィンガープリントアラートとの相関で脅威度を判断してください。',
    },
    response: [
      {
        title: 'AudioContext生成の目的確認',
        description:
          'ページに音声・動画コンテンツが存在するか確認し、AudioContextの正規利用かフィンガープリント目的かを判断します。',
      },
      {
        title: '音声処理パイプラインの調査',
        description:
          'DevToolsのPerformanceタブで、OscillatorNodeやDynamicsCompressorNodeの生成・接続がないか確認します。これらの組み合わせはフィンガープリント特有のパターンです。',
      },
      {
        title: '他のフィンガープリントとの相関',
        description:
          '同一ドメインでCanvas/WebGL/フォントフィンガープリントも検出されている場合、包括的なトラッキングの一部である可能性が高まります。',
      },
      {
        title: 'OfflineAudioContextの確認',
        description:
          'OfflineAudioContextの使用はフィンガープリント目的の強い指標です。通常のオーディオ再生ではリアルタイムのAudioContextを使用します。',
      },
    ],
    prevention: [
      'ブラウザのフィンガープリント保護機能でAudioContext出力にノイズを追加する',
      'Web Audio APIの利用を制限するブラウザ拡張機能を導入する',
      'サードパーティスクリプトの監査でAudioContextフィンガープリントパターンを検出・排除する',
    ],
    falsePositives:
      '音楽プレイヤー、動画サイト、ゲーム、音声通話アプリなどWeb Audio APIを正規利用するサービスで必ず発火します。info レベルのため、単独では対処不要です。他のフィンガープリントアラートとの同時発生時に注意してください。',
    relatedAlerts: ['canvas_fingerprint', 'webgl_fingerprint', 'font_fingerprint'],
  },

  // =========================================================================
  // font_fingerprint — FontFaceSet.check()フォント列挙検出
  // =========================================================================
  {
    id: 'font_fingerprint',
    title: 'フォントフィンガープリント検出',
    severity: 'high',
    description:
      'FontFaceSet.check() を繰り返し呼び出してシステムにインストールされているフォントを列挙するフィンガープリント手法を検出します。インストール済みフォントの組み合わせはOS・言語環境によって異なるため、高精度なデバイス識別に利用されます。',
    mitreAttack: ['T1082', 'T1217'],
    detection: {
      mechanism:
        'FontFaceSet.check() の呼び出し回数を追跡し、短時間に大量呼び出しが発生した場合にフィンガープリント目的と判定。バックグラウンドサービスでcallCountとともにアラートを生成します。',
      monitoredAPIs: ['FontFaceSet.prototype.check'],
      triggerConditions: [
        'FontFaceSet.check() の大量連続呼び出し（フォントリスト列挙パターン）',
      ],
      severityLogic:
        '一律 high。FontFaceSet.check()の大量呼び出しはフォント列挙以外の正当な理由がほとんどなく、フィンガープリント目的の確度が高いため。',
    },
    response: [
      {
        title: '呼び出し回数の確認',
        description:
          'callCountの値を確認します。数百回以上の呼び出しは既知のフォントリストとの照合パターンであり、フィンガープリント目的の強い指標です。',
      },
      {
        title: '呼び出し元スクリプトの特定',
        description:
          'DevToolsのSourcesタブでFontFaceSet.check()にブレークポイントを設定し、呼び出し元のスクリプトとスタックトレースを特定します。',
      },
      {
        title: 'フォントリストパターンの分析',
        description:
          'check()に渡されるフォント名が、Arial、Courier New、Times New Roman など汎用フォントのリストを網羅的に走査するパターンか確認します。',
      },
      {
        title: 'サードパーティスクリプトの排除',
        description:
          '原因スクリプトがサードパーティの場合、CSPまたはコンテンツブロッカーで当該スクリプトの読み込みを遮断します。',
      },
    ],
    prevention: [
      'ブラウザのフォントフィンガープリント保護機能でシステムフォントリストを制限する',
      'Content-Security-Policy でサードパーティスクリプトのフォントAPI利用を制限する',
      'Firefox の resistFingerprinting でフォントリストをサンドボックス化する',
      'サードパーティSDK導入時にフォント列挙挙動の有無を事前検証する',
    ],
    falsePositives:
      'リッチテキストエディタのフォントピッカーや、Webフォントフォールバック検出で数回のcheck()呼び出しが発生する場合があります。ただし数十回以上の連続呼び出しはフィンガープリント目的と判断して問題ありません。',
    relatedAlerts: ['canvas_fingerprint', 'webgl_fingerprint', 'audio_fingerprint'],
  },

  // =========================================================================
  // device_sensor — デバイスモーション/オリエンテーションセンサーアクセス
  // =========================================================================
  {
    id: 'device_sensor',
    title: 'デバイスセンサーアクセス検出',
    severity: 'medium',
    description:
      'DeviceMotionEvent または DeviceOrientationEvent のイベントリスナー登録を検出します。加速度センサー・ジャイロスコープの出力値からデバイス固有の特性を抽出するフィンガープリント手法や、ユーザーの物理的な行動パターンの追跡に使用される可能性があります。',
    mitreAttack: ['T1082'],
    detection: {
      mechanism:
        'devicemotion / deviceorientation イベントリスナーの登録を検出し、バックグラウンドサービスでsensorTypeとともにアラートを生成します。',
      monitoredAPIs: [
        'window.addEventListener("devicemotion")',
        'window.addEventListener("deviceorientation")',
      ],
      triggerConditions: [
        'devicemotion または deviceorientation イベントのリスナーが登録された場合',
      ],
      severityLogic:
        '一律 medium。モバイルWebアプリ（ゲーム、地図、AR等）で正規利用されるケースもあるため、highではなくmediumに設定されています。',
    },
    response: [
      {
        title: 'センサータイプの確認',
        description:
          'sensorTypeフィールドでdevicemotionかdeviceorientationかを確認し、アプリケーションの機能に必要なセンサーかどうか判断します。',
      },
      {
        title: 'サイトの機能要件の確認',
        description:
          '地図アプリ、ゲーム、フィットネスアプリなどモーションセンサーを正規利用するコンテキストかどうか確認します。',
      },
      {
        title: 'データの送信先調査',
        description:
          'センサーデータがサーバーに送信されていないか、Networkタブで外向きリクエストのペイロードを確認します。',
      },
      {
        title: '権限ポリシーの確認',
        description:
          'Permissions-Policy ヘッダーで accelerometer / gyroscope の許可状態を確認し、不要であれば制限します。',
      },
      {
        title: 'フィンガープリント相関の確認',
        description:
          '他のフィンガープリントアラート（Canvas、WebGL等）が同一ドメインで発生していないか確認します。',
      },
    ],
    prevention: [
      'Permissions-Policy ヘッダーで accelerometer、gyroscope を必要なオリジンのみに制限する',
      'モバイルブラウザのモーションセンサー許可設定を確認・制限する',
      'サードパーティスクリプトにセンサーAPIアクセスが不要な場合はiframeのallow属性で制限する',
      'iOS Safari ではモーションセンサーへのアクセスにユーザー許可が必要であることを活用する',
    ],
    falsePositives:
      'モバイルゲーム、歩数計、コンパス、AR/VRアプリ、パララックススクロールなどモーションセンサーを正規利用するWebアプリで発火します。PCブラウザでの検出はフィンガープリント目的の可能性が高まります。',
    relatedAlerts: ['device_enumeration', 'canvas_fingerprint', 'geolocation_access'],
  },

  // =========================================================================
  // device_enumeration — メディアデバイス列挙
  // =========================================================================
  {
    id: 'device_enumeration',
    title: 'メディアデバイス列挙検出',
    severity: 'medium',
    description:
      'navigator.mediaDevices.enumerateDevices() の呼び出しを検出します。接続されたカメラ・マイク・スピーカーのデバイスID・ラベルを取得することで、デバイス構成に基づくフィンガープリントを生成する手法に利用されます。',
    mitreAttack: ['T1082', 'T1217'],
    detection: {
      mechanism:
        'navigator.mediaDevices.enumerateDevices をフックし、呼び出しを検出。バックグラウンドサービスでドメイン情報とともにアラートを生成します。',
      monitoredAPIs: ['navigator.mediaDevices.enumerateDevices'],
      triggerConditions: [
        'enumerateDevices() が呼び出された場合（呼び出しごとに検出）',
      ],
      severityLogic:
        '一律 medium。ビデオ会議や音声アプリでデバイス選択UIのために正規利用されるケースが多いため。',
    },
    response: [
      {
        title: 'サイトの機能要件確認',
        description:
          'ビデオ会議、音声通話、配信ツールなどメディアデバイス選択が必要なサービスかどうか確認します。',
      },
      {
        title: 'デバイスラベルの取得状況確認',
        description:
          'getUserMedia() による許可前はdeviceIdとラベルが制限されます。許可後にenumerateDevices()が呼ばれている場合、デバイス情報が完全に取得されている可能性があります。',
      },
      {
        title: '呼び出し元スクリプトの特定',
        description:
          'DevToolsでenumerateDevices()の呼び出しスタックを確認し、サードパーティスクリプトが原因でないか特定します。',
      },
      {
        title: 'データ送信先の確認',
        description:
          'デバイスID情報が外部サーバーに送信されていないか、Networkタブでリクエストペイロードを監視します。',
      },
    ],
    prevention: [
      'Permissions-Policy ヘッダーで camera、microphone を必要なオリジンのみに制限する',
      'ブラウザのプライバシー設定でメディアデバイスへのアクセスを制限する',
      'サードパーティiframeにはallow属性でcamera/microphoneを明示的に制限する',
      'getUserMedia未許可状態でのenumerateDevices()は情報が制限されることを活用し、不必要な許可付与を避ける',
    ],
    falsePositives:
      'ビデオ会議サービス（Zoom、Google Meet、Teams等）、ライブ配信プラットフォーム、音声録音アプリなどでデバイス選択UIを構築する際に必ず呼び出されます。メディア関連機能のないサイトでの検出は疑わしいと判断してください。',
    relatedAlerts: ['device_sensor', 'media_capture', 'webrtc_connection'],
  },

  // =========================================================================
  // resize_observer — ResizeObserverによるデバイスフィンガープリント
  // =========================================================================
  {
    id: 'resize_observer',
    title: 'ResizeObserverフィンガープリント検出',
    severity: 'low',
    description:
      'ResizeObserverコンストラクタの呼び出しを検出します。要素のサイズ変化を監視することで、画面解像度・ビューポートサイズ・ズームレベルなどデバイス固有の情報を推定し、フィンガープリントに利用される可能性があります。',
    mitreAttack: ['T1082'],
    detection: {
      mechanism:
        'ResizeObserverコンストラクタの呼び出しを検出し、バックグラウンドサービスでドメイン情報とともにアラートを生成します。',
      monitoredAPIs: ['ResizeObserver constructor'],
      triggerConditions: [
        'new ResizeObserver() が呼び出された場合',
      ],
      severityLogic:
        '一律 low。ResizeObserverはレスポンシブデザインの実装に広く使用される標準APIであり、フィンガープリント目的のみに使われるケースは稀です。',
    },
    response: [
      {
        title: '利用コンテキストの確認',
        description:
          'ResizeObserverがレスポンシブレイアウト、無限スクロール、グラフ描画などの正規用途で使用されているか確認します。',
      },
      {
        title: '監視対象要素の確認',
        description:
          '特定の要素（body、viewport indicator等）のサイズを継続的に監視し、そのデータを外部に送信するパターンがないか確認します。',
      },
      {
        title: '他のフィンガープリントとの相関確認',
        description:
          '単独でのResizeObserver使用は通常無害です。Canvas、WebGL等の他のフィンガープリントアラートと併発している場合のみ追加調査を行います。',
      },
      {
        title: '送信データの監視',
        description:
          'ResizeObserverから取得したサイズ情報がサーバーに送信されていないか確認します。',
      },
    ],
    prevention: [
      'ResizeObserverの使用自体は正規用途が多いため、ブロックではなく他のフィンガープリント手法と合わせて総合的に評価する',
      'サードパーティスクリプトの監査でResizeObserverとデータ送信の組み合わせを検出する',
      'Permissions-Policy等で画面情報の取得を制限する（将来的なブラウザ仕様の動向に注視）',
    ],
    falsePositives:
      'ほぼすべてのモダンWebサイトがレスポンシブデザインのためにResizeObserverを使用しています。React、Vue等のUIフレームワークや、Chart.js等の可視化ライブラリでも標準的に利用されます。単独での検出はほとんどの場合、誤検知です。',
    relatedAlerts: ['canvas_fingerprint', 'device_sensor', 'intersection_observer'],
  },
];

import type { PlaybookData } from '../types';

export const credentialClipboardPlaybooks: PlaybookData[] = [
  // =========================================================================
  // credential_theft — フォーム送信による資格情報窃取
  // =========================================================================
  {
    id: 'credential_theft',
    title: 'フォーム送信による資格情報窃取',
    severity: 'high',
    description:
      'パスワード・メールアドレス等の機密フィールドを含むフォームが、非セキュア（HTTP）またはクロスオリジンの宛先に送信されようとしています。中間者攻撃やフィッシングサイトへの資格情報漏洩のリスクがあります。',
    mitreAttack: ['T1056.003', 'T1557'],
    detection: {
      mechanism:
        'document の submit イベントをキャプチャフェーズで監視し、フォーム内の input 要素の type / name / id / autocomplete 属性から機密フィールドを検出。フォームの action URL のプロトコルとオリジンを検証する。',
      monitoredAPIs: [
        'HTMLFormElement.submit (submit イベント)',
        'HTMLInputElement.type / name / id / autocomplete',
        'URL コンストラクタ（action URL 解析）',
      ],
      triggerConditions: [
        'フォームに password / email / tel / credit-card 型の input、または名前に password / token / apikey 等を含む input が存在する',
        'フォームの action URL が HTTP（非HTTPS）プロトコルである',
        'フォームの action URL がページとは異なるオリジンである（クロスオリジン送信）',
      ],
      severityLogic:
        '非HTTPSプロトコル（insecure_protocol）の場合は critical、それ以外（クロスオリジンのみ等）は high。resolveSeverity で条件分岐。',
    },
    response: [
      {
        title: 'フォーム送信先の確認',
        description:
          'アラートに記録された formAction と targetDomain を確認し、正規のサービスドメインかどうかを判定する。',
      },
      {
        title: 'HTTPS 対応の検証',
        description:
          '送信先が HTTP の場合、該当サービスが HTTPS に対応しているかを確認する。対応していれば HTTPS URL への修正を推奨する。',
      },
      {
        title: '資格情報の変更',
        description:
          '非セキュアな経路で送信された可能性がある場合、該当アカウントのパスワードを速やかに変更する。',
      },
      {
        title: 'フィッシングサイトの報告',
        description:
          '送信先が不正なドメインであると判断された場合、Google Safe Browsing やフィッシング報告窓口に通報する。',
      },
      {
        title: 'ネットワークログの調査',
        description:
          '実際にフォームデータが送信されたかどうかを、ブラウザの開発者ツールやプロキシログで確認する。',
      },
    ],
    prevention: [
      'HSTS（HTTP Strict Transport Security）を全ドメインで有効化し、HTTP での資格情報送信を防止する',
      'CSP の form-action ディレクティブで許可する送信先を明示的にホワイトリスト指定する',
      'パスワードマネージャを使用し、正規ドメイン以外ではオートフィルが動作しないことを確認する',
      'MFA（多要素認証）を有効にし、資格情報漏洩時の被害を最小化する',
    ],
    falsePositives:
      '正規のクロスオリジン認証フロー（OAuth / SSO プロバイダへのリダイレクト）で検知される場合がある。送信先が信頼済み IdP のドメインであれば誤検知として dismissible。',
    relatedAlerts: ['form_hijack', 'credential_api', 'xss_injection'],
  },

  // =========================================================================
  // credential_api — Credential Management API 使用
  // =========================================================================
  {
    id: 'credential_api',
    title: 'Credential Management API 使用検出',
    severity: 'high',
    description:
      'Credential Management API（navigator.credentials.get / store / create）が呼び出されました。正規の認証フローで使用されるAPIですが、悪意あるスクリプトが保存済み資格情報をサイレントに取得するリスクがあります。',
    mitreAttack: ['T1555.003', 'T1056.003'],
    detection: {
      mechanism:
        'navigator.credentials オブジェクトの get / store / create メソッド呼び出しを検出し、バックグラウンドサービスにイベントを送信する。',
      monitoredAPIs: [
        'navigator.credentials.get()',
        'navigator.credentials.store()',
        'navigator.credentials.create()',
      ],
      triggerConditions: [
        'navigator.credentials の任意のメソッド（get / store / create）が呼び出された',
        'メソッド名と呼び出し元ドメインが記録される',
      ],
      severityLogic:
        '常に high。Credential Management API の呼び出し自体が機密操作であるため、条件分岐なしで高重大度を割り当てる。',
    },
    response: [
      {
        title: '呼び出し元スクリプトの特定',
        description:
          'アラートの domain と method を確認し、どのスクリプトが Credential Management API を呼び出したかを開発者ツールで特定する。',
      },
      {
        title: '正規利用かどうかの判断',
        description:
          '該当サイトがパスワードレス認証（WebAuthn）やパスワード保存機能を提供しているかを確認する。正規の認証フローであれば問題ない。',
      },
      {
        title: 'サードパーティスクリプトの監査',
        description:
          '呼び出し元がサードパーティスクリプトの場合、そのスクリプトの信頼性を評価し、不要であれば削除を検討する。',
      },
      {
        title: '保存済み資格情報の確認',
        description:
          'ブラウザのパスワードマネージャで該当ドメインの保存済み認証情報を確認し、不審なエントリがないかチェックする。',
      },
    ],
    prevention: [
      'Feature-Policy / Permissions-Policy ヘッダで credential API の利用を制限する',
      'サードパーティスクリプトの読み込みを最小限にし、SRI（Subresource Integrity）で改ざんを検出する',
      'CSP で信頼できるスクリプトソースのみを許可し、不正スクリプトの実行を防止する',
      'ブラウザのパスワード自動保存は信頼済みサイトのみに限定する',
    ],
    falsePositives:
      '正規のパスワードマネージャ統合、WebAuthn / FIDO2 認証フロー、SSO プロバイダのログイン処理で検知される。該当サイトの認証機能が既知であれば誤検知。',
    relatedAlerts: ['credential_theft', 'form_hijack'],
  },

  // =========================================================================
  // form_hijack — フォームアクションのリダイレクト
  // =========================================================================
  {
    id: 'form_hijack',
    title: 'フォームアクション ハイジャック',
    severity: 'critical',
    description:
      'フォームの action 属性が動的に変更され、送信先が別オリジンにリダイレクトされました。攻撃者がフォームの送信先を改ざんし、入力データを窃取する攻撃手法です。',
    mitreAttack: ['T1185', 'T1557'],
    detection: {
      mechanism:
        'HTMLFormElement.prototype.action の setter をフックし、action 属性が変更された際に元のオリジンと新しいオリジンを比較する。OAuth コールバック URL は誤検知防止のため除外。',
      monitoredAPIs: [
        'HTMLFormElement.prototype.action (setter)',
        'Object.getOwnPropertyDescriptor / Object.defineProperty',
      ],
      triggerConditions: [
        'フォームの action 属性が動的に変更された',
        '新しい action URL のオリジンが、変更前の action URL のオリジンと異なる',
        '新しい action URL が OAuth コールバック URL パターン（/callback, /auth, /oauth 等）に一致しない',
      ],
      severityLogic:
        '常に critical。フォーム送信先の動的改ざんは直接的な資格情報窃取に繋がるため、最高重大度を割り当てる。',
    },
    response: [
      {
        title: '改ざん内容の確認',
        description:
          'アラートの originalAction と newAction を比較し、送信先がどのドメインに変更されたかを特定する。',
      },
      {
        title: '送信データの影響範囲特定',
        description:
          '該当フォームにどのようなデータ（パスワード、個人情報等）が入力されていたかを確認する。',
      },
      {
        title: '改ざん元スクリプトの調査',
        description:
          '開発者ツールの Sources パネルやネットワークログで、action 属性を変更したスクリプトを特定する。',
      },
      {
        title: '資格情報の緊急変更',
        description:
          'フォーム送信が実行された可能性がある場合、関連するアカウントのパスワードを即時変更する。',
      },
      {
        title: '不正スクリプトのブロック',
        description:
          '特定された不正スクリプトのドメインを CSP や拡張機能のブロックリストに追加する。',
      },
    ],
    prevention: [
      'CSP の form-action ディレクティブで送信先ドメインを厳密にホワイトリスト指定する',
      'サードパーティスクリプトに SRI を適用し、改ざんされたスクリプトの実行を防止する',
      'フォーム送信時にサーバーサイドで Referer / Origin ヘッダを検証する',
      'MutationObserver でフォーム属性の変更を独自に監視し、不正変更をブロックするセキュリティスクリプトを導入する',
    ],
    falsePositives:
      'OAuth / SSO フローで正規のリダイレクト先へ action を動的に設定する場合がある。looksLikeOAuthCallback による除外ロジックで大半は除外されるが、カスタム認証フローでは誤検知の可能性がある。',
    relatedAlerts: ['credential_theft', 'xss_injection', 'dom_clobbering'],
  },

  // =========================================================================
  // clipboard_hijack — クリップボードへの不正書き込み（暗号アドレス）
  // =========================================================================
  {
    id: 'clipboard_hijack',
    title: 'クリップボード ハイジャック（暗号通貨アドレス）',
    severity: 'critical',
    description:
      'navigator.clipboard.writeText() により暗号通貨アドレスがクリップボードに書き込まれました。ユーザーがコピーした正規の送金アドレスを攻撃者のアドレスに置換する「クリップボードハイジャック」攻撃の可能性があります。',
    mitreAttack: ['T1115', 'T1565.001'],
    detection: {
      mechanism:
        'navigator.clipboard.writeText をフックし、書き込まれるテキストを Bitcoin / Ethereum / Litecoin / Ripple のアドレス正規表現パターンで照合する。',
      monitoredAPIs: ['navigator.clipboard.writeText()'],
      triggerConditions: [
        'navigator.clipboard.writeText() が呼び出された',
        '書き込みテキストが暗号通貨アドレスパターン（Bitcoin: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/, Ethereum: /^0x[a-fA-F0-9]{40}$/, Litecoin: /^[LM3].../, Ripple: /^r.../）に一致する',
      ],
      severityLogic:
        '常に critical。暗号通貨アドレスの置換は直接的な金銭被害に繋がるため、最高重大度を割り当てる。',
    },
    response: [
      {
        title: 'クリップボード内容の確認',
        description:
          '現在のクリップボードの内容を確認し、意図しない暗号通貨アドレスが含まれていないかチェックする。',
      },
      {
        title: '送金トランザクションの確認',
        description:
          '直近の暗号通貨送金トランザクションを確認し、送金先アドレスが意図したものかを検証する。',
      },
      {
        title: '感染源の特定',
        description:
          '開発者ツールで writeText を呼び出したスクリプトを特定する。ブラウザ拡張機能やサードパーティスクリプトが原因の場合が多い。',
      },
      {
        title: '拡張機能の監査',
        description:
          'インストール済みブラウザ拡張機能を確認し、不審な拡張機能を無効化または削除する。',
      },
      {
        title: 'マルウェアスキャンの実行',
        description:
          '端末にクリップボードハイジャッカー（マルウェア）がインストールされている可能性があるため、マルウェアスキャンを実施する。',
      },
    ],
    prevention: [
      '暗号通貨の送金時は、ペースト後に送金先アドレスを必ず目視で確認する習慣をつける',
      'Permissions-Policy ヘッダで clipboard-write を信頼済みオリジンのみに制限する',
      '不要なブラウザ拡張機能を定期的に棚卸しし、権限の過剰な拡張機能を削除する',
      'ハードウェアウォレットを使用し、デバイス上でアドレスを最終確認する',
    ],
    falsePositives:
      '暗号通貨取引所やウォレットアプリが正規の機能としてアドレスをクリップボードにコピーする場合に検知される。取引所ドメインからの書き込みであれば誤検知の可能性が高い。',
    relatedAlerts: ['clipboard_read', 'execcommand_clipboard', 'clipboard_event_sniffing'],
  },

  // =========================================================================
  // execcommand_clipboard — document.execCommand クリップボードバイパス
  // =========================================================================
  {
    id: 'execcommand_clipboard',
    title: 'document.execCommand クリップボードバイパス',
    severity: 'high',
    description:
      'document.execCommand() の inserthtml コマンドによるクリップボード操作が検出されました。Clipboard API の権限チェックをバイパスして HTML コンテンツを挿入する手法であり、XSS ペイロードの注入やフィッシングコンテンツの挿入に悪用される可能性があります。',
    mitreAttack: ['T1115', 'T1059.007'],
    detection: {
      mechanism:
        'document.execCommand をフックし、コマンドID が inserthtml の場合にイベントを発火する。',
      monitoredAPIs: ['document.execCommand()'],
      triggerConditions: [
        'document.execCommand() が呼び出された',
        'コマンドID が inserthtml である（SENSITIVE_EXEC_COMMANDS セットで管理）',
      ],
      severityLogic:
        '常に high。非推奨 API を使用したクリップボード操作は権限バイパスの意図がある可能性が高いが、レガシーコードでの正規利用もあるため critical ではなく high。',
    },
    response: [
      {
        title: '挿入コンテンツの確認',
        description:
          '開発者ツールで execCommand に渡された HTML コンテンツを確認し、悪意のあるスクリプトやリンクが含まれていないかチェックする。',
      },
      {
        title: '呼び出し元の特定',
        description:
          'コールスタックから execCommand を呼び出したスクリプトを特定し、正規のリッチテキストエディタかサードパーティスクリプトかを判断する。',
      },
      {
        title: 'DOM 改ざんの確認',
        description:
          'inserthtml によって挿入された要素が不正な iframe やスクリプトタグを含んでいないかを確認する。',
      },
      {
        title: 'CSP 違反の確認',
        description:
          '挿入された HTML がインラインスクリプトを含む場合、CSP が正しく機能してブロックしているかを確認する。',
      },
    ],
    prevention: [
      'CSP の script-src ディレクティブで unsafe-inline を禁止し、挿入された HTML 内のスクリプト実行を防止する',
      'リッチテキストエディタは document.execCommand ではなく、Clipboard API とサニタイザを使用する実装に移行する',
      'DOMPurify 等の HTML サニタイザを導入し、挿入コンテンツから危険なタグ・属性を除去する',
      'Trusted Types を有効にし、innerHTML / inserthtml による任意 HTML 挿入を制御する',
    ],
    falsePositives:
      'レガシーなリッチテキストエディタ（contenteditable ベース）が inserthtml を使用する場合がある。WYSIWYG エディタを提供するサイトでは正常な動作として検知される。',
    relatedAlerts: ['clipboard_hijack', 'clipboard_read', 'xss_injection'],
  },

  // =========================================================================
  // clipboard_read — navigator.clipboard.readText() 使用
  // =========================================================================
  {
    id: 'clipboard_read',
    title: 'クリップボード読み取り検出',
    severity: 'medium',
    description:
      'スクリプトが navigator.clipboard.readText() を使用してクリップボードの内容を読み取りました。クリップボードにはパスワード、認証トークン、個人情報等の機密データが含まれている可能性があり、不正な読み取りは情報漏洩のリスクがあります。',
    mitreAttack: ['T1115'],
    detection: {
      mechanism:
        'navigator.clipboard.readText() の呼び出しを検出し、バックグラウンドサービスにイベントを送信する。ブラウザはユーザー許可を要求するが、許可済みサイトでの不正利用を検出する。',
      monitoredAPIs: ['navigator.clipboard.readText()'],
      triggerConditions: [
        'navigator.clipboard.readText() が呼び出された',
        '呼び出し元ドメインが記録される',
      ],
      severityLogic:
        '常に medium。Clipboard API の readText はブラウザのパーミッションモデルで保護されており、ユーザー許可なしには実行できないため、中程度の重大度。',
    },
    response: [
      {
        title: '読み取り元サイトの確認',
        description:
          'アラートに記録されたドメインが信頼できるサイトかどうかを確認する。不明なサイトからの読み取りは即座にブロックを検討する。',
      },
      {
        title: 'クリップボード権限の確認',
        description:
          'ブラウザの設定で該当サイトにクリップボード読み取り権限が付与されているかを確認し、不要であれば取り消す。',
      },
      {
        title: 'クリップボード内容の確認',
        description:
          '読み取り時にクリップボードに機密データ（パスワード、トークン等）が含まれていた可能性がないかを確認する。',
      },
      {
        title: 'パスワード変更の検討',
        description:
          '機密データが読み取られた可能性がある場合、関連するアカウントの認証情報を変更する。',
      },
    ],
    prevention: [
      'ブラウザのクリップボード権限を必要なサイトのみに付与し、定期的に権限を棚卸しする',
      'パスワードマネージャのオートフィル機能を使用し、クリップボード経由でのパスワードコピーを避ける',
      'Permissions-Policy ヘッダで clipboard-read を信頼済みオリジンのみに制限する',
    ],
    falsePositives:
      '「ペーストして検索」機能、クリップボード履歴マネージャ、コードエディタのペースト支援機能等で正当に readText を使用する場合がある。ユーザーが明示的にペースト操作を行ったタイミングでの検知は誤検知の可能性が高い。',
    relatedAlerts: ['clipboard_hijack', 'execcommand_clipboard', 'clipboard_event_sniffing'],
  },

  // =========================================================================
  // clipboard_event_sniffing — copy/cut/paste イベントリスナー（バースト検出）
  // =========================================================================
  {
    id: 'clipboard_event_sniffing',
    title: 'クリップボードイベント スニッフィング',
    severity: 'high',
    description:
      'copy / cut / paste イベントのリスナーが登録されました。これらのイベントを監視することで、ユーザーのクリップボード操作を盗み見し、コピーされたテキストの窃取やペースト内容の改ざんが可能です。5秒間に10回を超えるバースト登録は特に悪意が高い。',
    mitreAttack: ['T1115', 'T1056'],
    detection: {
      mechanism:
        'copy / cut / paste イベントの addEventListener 呼び出しを監視し、イベント登録をバックグラウンドサービスに報告する。5秒間に10回を超えるバースト登録でアラートが発火する。',
      monitoredAPIs: [
        'EventTarget.prototype.addEventListener("copy")',
        'EventTarget.prototype.addEventListener("cut")',
        'EventTarget.prototype.addEventListener("paste")',
      ],
      triggerConditions: [
        'copy / cut / paste イベントに対する addEventListener が呼び出された',
        '5秒間に10回を超えるイベントリスナー登録のバーストが検出された',
        'イベントタイプ（copy / cut / paste）がアラートに記録される',
      ],
      severityLogic:
        '常に high。バーストレベルのイベントリスナー登録は通常のWebアプリケーションでは不要であり、クリップボード監視の意図が強いため高重大度。',
    },
    response: [
      {
        title: 'イベントリスナーの確認',
        description:
          '開発者ツールの Elements パネルで Event Listeners を確認し、copy / cut / paste に登録されたリスナーの数と発行元を特定する。',
      },
      {
        title: 'サードパーティスクリプトの調査',
        description:
          'リスナーを登録したスクリプトがサードパーティ由来の場合、そのスクリプトの目的と信頼性を評価する。',
      },
      {
        title: 'クリップボードデータの漏洩確認',
        description:
          'ネットワークログを確認し、イベントリスナーがキャプチャしたデータが外部サーバーに送信されていないかを調査する。',
      },
      {
        title: '不正スクリプトの無効化',
        description:
          '悪意あるスクリプトが特定された場合、CSP やコンテンツブロッカーで該当スクリプトをブロックする。',
      },
    ],
    prevention: [
      'CSP の script-src を厳格に設定し、信頼できないスクリプトの実行を防止する',
      'サードパーティスクリプトの権限と動作を定期的に監査する',
      'Permissions-Policy ヘッダで不要な API アクセスを制限する',
      'ブラウザ拡張機能でクリップボードイベントの過剰な監視をブロックするルールを適用する',
    ],
    falsePositives:
      'リッチテキストエディタ、スプレッドシートアプリケーション、コードエディタなど、ペースト処理をカスタマイズする正当なアプリケーションで検知される。SPA のルート変更時にリスナーを再登録するパターンでもバーストとして検出される場合がある。',
    relatedAlerts: ['clipboard_hijack', 'clipboard_read', 'execcommand_clipboard'],
  },
];

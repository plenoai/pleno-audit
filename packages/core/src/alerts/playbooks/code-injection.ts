import type { PlaybookData } from '../playbook-types.js';

export const codeInjectionPlaybooks: PlaybookData[] = [
  // ========================================================================
  // XSS Injection
  // ========================================================================
  {
    id: 'xss_injection',
    title: 'XSSペイロード検出',
    severity: 'critical',
    description:
      'URL のクエリパラメータやフラグメントに埋め込まれた反射型 XSS ペイロードを検出します。' +
      '<script> タグ、javascript: スキーム、onerror/onload イベントハンドラ内の eval、' +
      'iframe の javascript: src など、既知のインジェクションパターンをページロード時にチェックします。',
    mitreAttack: ['T1059.007'],
    detection: {
      mechanism:
        'ページロード時に location.search と location.hash を decodeURIComponent でデコードし、' +
        '4 種の正規表現パターン（<script>, javascript:, on(error|load)=eval, <iframe src=javascript:）で照合する。' +
        'いずれかにマッチした場合 __XSS_DETECTED__ イベントを emit する。',
      monitoredAPIs: [
        'location.search',
        'location.hash',
        'decodeURIComponent()',
      ],
      triggerConditions: [
        'URL クエリまたはフラグメントに <script>...</script> パターンが含まれる',
        'URL に javascript: スキーム（空白以外の文字が続く）が含まれる',
        'onerror/onload 属性値に eval() 呼び出しが含まれる',
        '<iframe> の src に javascript: スキームが含まれる',
      ],
      severityLogic:
        '全マッチが critical。反射型 XSS は任意コード実行に直結するため、' +
        'パターン種別による重大度の差は設けていない。',
    },
    response: [
      {
        title: '即時隔離',
        description:
          '該当タブのネットワーク接続を遮断し、対象 URL へのアクセスをブロックリストに追加する。',
      },
      {
        title: 'ペイロード分析',
        description:
          'payloadPreview フィールドのコードを確認し、攻撃の意図（Cookie 窃取、リダイレクト、キーロガー設置等）を特定する。',
      },
      {
        title: 'セッション無効化',
        description:
          '攻撃対象ドメインのセッション Cookie およびトークンを無効化し、不正アクセスを防止する。',
      },
      {
        title: '流入経路の特定',
        description:
          'リファラやメール／メッセージのリンクを確認し、ペイロードがどの経路で配信されたかを特定する。',
      },
      {
        title: '影響範囲の確認',
        description:
          '同一ドメインの他のエンドポイントが同様の脆弱性を持たないか確認し、必要に応じて管理者に報告する。',
      },
    ],
    prevention: [
      'サーバー側で入力値のサニタイズとエスケープを徹底する',
      'Content-Security-Policy を適切に設定し unsafe-inline / unsafe-eval を排除する',
      '信頼できないリンクをクリックしない（特にメールやメッセージ経由の URL）',
      'ブラウザの XSS Auditor や Trusted Types を有効化する',
    ],
    falsePositives:
      '正規の開発ツール（DevTools、ブラウザ拡張のコードインジェクション）や、' +
      'URL パラメータに HTML テンプレートを含む CMS のプレビュー機能で誤検知が発生する場合がある。' +
      'ドメインのホワイトリストで管理する。',
    relatedAlerts: ['csp_violation', 'dynamic_code_execution', 'dom_clobbering'],
  },

  // ========================================================================
  // Dynamic Code Execution
  // ========================================================================
  {
    id: 'dynamic_code_execution',
    title: '動的コード実行（eval / Function コンストラクタ）',
    severity: 'high',
    description:
      'eval() や Function コンストラクタによる動的コード実行を検出します。' +
      '攻撃者はこれらの API を利用して、文字列として渡された任意の JavaScript を実行できます。' +
      '銀行セキュリティ SDK との互換性のため、直接の API フックではなく CSP script-src violation を介して検出します。',
    mitreAttack: ['T1059.007', 'T1027'],
    detection: {
      mechanism:
        'CSP の script-src ディレクティブに対する violation イベント（unsafe-eval 相当の実行）を検知し、' +
        'バックグラウンドサービスへ DYNAMIC_CODE_EXECUTION_DETECTED メッセージとして転送する。' +
        'method（eval / Function）と codeLength をアラート詳細に含める。',
      monitoredAPIs: [
        'eval()',
        'new Function()',
        'CSP violation events（script-src）',
      ],
      triggerConditions: [
        'eval() が文字列引数付きで呼び出された',
        'Function コンストラクタが文字列引数で新しい関数を生成した',
        'CSP script-src violation が unsafe-eval コンテキストで発生した',
      ],
      severityLogic:
        '常に high。eval/Function は正当な用途（JSON パース等）もあるため critical ではなく high に設定。' +
        'codeLength が極端に大きい場合でも severity は変更しない。',
    },
    response: [
      {
        title: 'コード内容の確認',
        description:
          'codeLength と実行コンテキストを確認し、実行されたコードの意図を分析する。',
      },
      {
        title: '実行元スクリプトの特定',
        description:
          'スタックトレースやイニシエータ情報から、eval/Function を呼び出したスクリプトの出所を特定する。',
      },
      {
        title: 'サードパーティスクリプトの監査',
        description:
          '外部 CDN やサードパーティから読み込まれたスクリプトが原因でないか確認し、' +
          '不審な場合は SRI（Subresource Integrity）の欠如も併せて報告する。',
      },
      {
        title: 'CSP ポリシーの強化',
        description:
          'unsafe-eval が CSP に含まれている場合は除去を検討し、nonce ベースのポリシーへ移行する。',
      },
    ],
    prevention: [
      'CSP で unsafe-eval を禁止し、動的コード実行を原則ブロックする',
      'eval() の代わりに JSON.parse() や安全な代替手段を使用する',
      'Trusted Types を導入し、危険な文字列→コード変換を防止する',
      'サードパーティスクリプトを定期的に監査し、不要な eval 使用を排除する',
    ],
    falsePositives:
      'Google Analytics、広告タグ、レガシーライブラリ（jQuery の一部プラグイン等）が eval を使用するケースがある。' +
      'また、Webpack の devtool 設定（eval モード）が開発環境で検知される場合がある。' +
      '既知のサードパーティドメインをホワイトリストに追加して管理する。',
    relatedAlerts: ['xss_injection', 'csp_violation', 'supply_chain'],
  },

  // ========================================================================
  // Prototype Pollution
  // ========================================================================
  {
    id: 'prototype_pollution',
    title: 'プロトタイプ汚染攻撃',
    severity: 'critical',
    description:
      'Object.prototype など組み込みオブジェクトのプロトタイプが改変されたことを検出します。' +
      'プロトタイプ汚染はアプリケーション全体のオブジェクト動作を変更し、' +
      '認証バイパス、XSS、RCE などの深刻な脆弱性につながる可能性があります。' +
      '銀行セキュリティ SDK との互換性のため、Object.defineProperty フックではなく' +
      'バックグラウンドでの定期的なインテグリティチェックで検出します。',
    mitreAttack: ['T1059.007', 'T1574'],
    detection: {
      mechanism:
        'バックグラウンドサービスが定期的にプロトタイプのインテグリティを検証し、' +
        'Object.prototype への不正なプロパティ追加や改変を検出する。' +
        '検出時に PROTOTYPE_POLLUTION_DETECTED メッセージを発行し、' +
        'target（汚染対象）、property（追加/改変されたプロパティ名）、method（攻撃手法）をアラートに含める。',
      monitoredAPIs: [
        'Object.prototype（インテグリティ検証）',
        'Object.defineProperty()（検証対象）',
        'Object.setPrototypeOf()（検証対象）',
      ],
      triggerConditions: [
        'Object.prototype に本来存在しないプロパティが追加された',
        '組み込みプロトタイプ（Array.prototype, String.prototype 等）が改変された',
        '__proto__ 経由でプロトタイプチェーンが操作された',
      ],
      severityLogic:
        '常に critical。プロトタイプ汚染はアプリケーション全体に影響を及ぼし、' +
        '認証バイパスや任意コード実行に直結するため、最高レベルの重大度を設定。',
    },
    response: [
      {
        title: '汚染プロパティの特定',
        description:
          'target と property フィールドを確認し、どのプロトタイプのどのプロパティが改変されたかを特定する。',
      },
      {
        title: '攻撃ベクターの分析',
        description:
          'method フィールドと入力パラメータ（URL パラメータ、JSON ボディ等）を確認し、' +
          '攻撃がどの経路から注入されたかを特定する。',
      },
      {
        title: '影響範囲の評価',
        description:
          '汚染されたプロパティを参照しているコードパスを特定し、' +
          '認証ロジックやセキュリティチェックが迂回されていないか確認する。',
      },
      {
        title: 'セッション無効化と復旧',
        description:
          '汚染されたページのセッションを無効化し、ページをリロードしてプロトタイプを正常な状態に復元する。',
      },
      {
        title: 'サーバー側の入力検証強化',
        description:
          '__proto__、constructor、prototype をキーとして含む入力を拒否するサーバー側バリデーションを追加する。',
      },
    ],
    prevention: [
      'Object.freeze(Object.prototype) でプロトタイプの改変を禁止する',
      'ユーザー入力から __proto__、constructor、prototype キーをフィルタリングする',
      'Object.create(null) で汚染の影響を受けないオブジェクトを使用する',
      'Map を使用してオブジェクトリテラルの代わりに安全なキーバリューストアを利用する',
      'ライブラリのバージョンを最新に保ち、既知の汚染脆弱性を排除する',
    ],
    falsePositives:
      'Polyfill ライブラリ（core-js, es-shims 等）がブラウザ互換性のため' +
      'プロトタイプにメソッドを追加するケースがある。' +
      'また、一部のテストフレームワークがモック目的でプロトタイプを操作する場合がある。' +
      '既知の Polyfill パターンをホワイトリストに追加して管理する。',
    relatedAlerts: ['xss_injection', 'dynamic_code_execution', 'dom_clobbering'],
  },

  // ========================================================================
  // DOM Clobbering
  // ========================================================================
  {
    id: 'dom_clobbering',
    title: 'DOM クロッバリング（グローバル変数上書き）',
    severity: 'high',
    description:
      'HTML 要素の id または name 属性に危険なグローバル名（location, document, navigator 等）が' +
      '設定されたことを検出します。ブラウザの Named Access 仕様により、これらの要素は' +
      'window のプロパティとして暗黙的に公開され、既存のグローバル変数やビルトイン API を上書きする可能性があります。',
    mitreAttack: ['T1059.007'],
    detection: {
      mechanism:
        'MutationObserver で DOM への要素追加を監視し、追加された要素の id/name 属性が' +
        '危険なグローバル名のセット（location, document, eval, fetch 等 40 以上）に含まれるかチェックする。' +
        'マッチした場合 __DOM_CLOBBERING_DETECTED__ イベントを emit する。',
      monitoredAPIs: [
        'MutationObserver（childList, subtree）',
        'Element.getAttribute("id")',
        'Element.getAttribute("name")',
      ],
      triggerConditions: [
        'id 属性に location, document, navigator 等の危険なグローバル名が設定された要素が DOM に追加された',
        'name 属性に eval, Function, fetch 等のビルトイン API 名が設定された要素が DOM に追加された',
      ],
      severityLogic:
        '常に high。DOM クロッバリングは単体では任意コード実行に至らないが、' +
        'XSS や認証バイパスの前段階として利用されるため high を設定。' +
        'DANGEROUS_GLOBAL_NAMES セットに含まれる名前のみが対象。',
    },
    response: [
      {
        title: '上書き対象の確認',
        description:
          'attributeName と attributeValue を確認し、どのグローバル変数が上書きされたかを特定する。',
      },
      {
        title: '要素の出所の調査',
        description:
          '問題の要素がサーバーレンダリングか、クライアント側スクリプトによる動的挿入かを確認し、' +
          '攻撃者がコンテンツを注入した経路を特定する。',
      },
      {
        title: 'クロッバリングの影響評価',
        description:
          '上書きされたグローバル変数を参照しているセキュリティクリティカルなコードパス' +
          '（認証チェック、URL 検証等）がないか確認する。',
      },
      {
        title: '問題要素の除去',
        description:
          '不正な id/name 属性を持つ要素を DOM から除去し、影響を受けたグローバル変数が正常に復元されたことを確認する。',
      },
    ],
    prevention: [
      'HTML サニタイザーで id/name 属性に危険なグローバル名を許可しない',
      'JavaScript コードで window プロパティを直接参照せず、明示的なスコープ（globalThis 等）を使用する',
      'Content-Security-Policy でインラインスクリプトとインライン HTML を制限する',
      'DOMPurify 等のライブラリで DOM クロッバリング対策オプションを有効化する',
    ],
    falsePositives:
      'レガシーな HTML で id="location" や name="document" を意図的に使用しているページ、' +
      'フォーム要素の name 属性に偶発的にグローバル名と一致する値が設定されているケースで誤検知が発生しうる。' +
      '既知の安全なパターンを確認した上で dismiss する。',
    relatedAlerts: ['xss_injection', 'prototype_pollution', 'form_hijack'],
  },

  // ========================================================================
  // CSS Keylogging
  // ========================================================================
  {
    id: 'css_keylogging',
    title: 'CSS キーロギング',
    severity: 'critical',
    description:
      'input[value] 属性セレクタと background-image を組み合わせた CSS ベースのキーロギングを検出します。' +
      'この手法は、入力フィールドの各文字に対して一意の background-image URL を指定し、' +
      'ブラウザが画像をリクエストする際にサーバー側で入力内容を記録するものです。' +
      'JavaScript を使用しないため、スクリプトベースの検出を回避する巧妙な攻撃です。',
    mitreAttack: ['T1056.001'],
    detection: {
      mechanism:
        'MutationObserver で <style> 要素の追加を監視し、テキスト内容に' +
        '"input[value" と "background-image" の両方が含まれるかを軽量な文字列チェックで判定する。' +
        '条件を満たす場合 __CSS_KEYLOGGING_DETECTED__ イベントを emit する。',
      monitoredAPIs: [
        'MutationObserver（childList, subtree — head/body）',
        'Element.textContent（<style> 要素）',
      ],
      triggerConditions: [
        '<style> 要素のテキストに "input[value" が含まれている',
        '同じ <style> 要素のテキストに "background-image" が含まれている',
        '上記の両方の条件が同時に満たされた場合にアラートが発火する',
      ],
      severityLogic:
        '常に critical。CSS キーロギングはパスワードやクレジットカード番号等の' +
        '機密入力を窃取可能であり、ユーザーが気づきにくいため最高レベルの重大度を設定。',
    },
    response: [
      {
        title: 'CSS ルールの分析',
        description:
          'sampleRule フィールド（最大 200 文字）を確認し、どの入力フィールドが対象か、' +
          'background-image の送信先 URL を特定する。',
      },
      {
        title: '外部通信先の確認',
        description:
          'background-image で指定された URL のドメインを調査し、攻撃者のインフラを特定する。',
      },
      {
        title: '影響を受けた入力の特定',
        description:
          'CSS セレクタが対象とするフォームフィールド（パスワード、クレジットカード等）を特定し、' +
          '入力された可能性のある機密データの範囲を評価する。',
      },
      {
        title: '認証情報のリセット',
        description:
          '影響を受けた可能性のあるパスワードやトークンを変更し、クレジットカード情報が漏洩した場合はカード会社に連絡する。',
      },
      {
        title: 'CSS インジェクション経路の封鎖',
        description:
          'スタイルがどの経路で注入されたか（サードパーティ CSS、UGC、XSS 経由等）を特定し、根本原因を修正する。',
      },
    ],
    prevention: [
      'CSP の style-src で信頼できるソースのみを許可し、unsafe-inline を排除する',
      'サードパーティ CSS の SRI（Subresource Integrity）を必須にする',
      'ユーザー生成コンテンツからの CSS インジェクションを防止するサニタイズを実装する',
      'パスワードフィールドに autocomplete="new-password" を設定し value 属性への反映を抑制する',
    ],
    falsePositives:
      'UI フレームワークやカスタムテーマが input[value] セレクタと background-image を' +
      'スタイリング目的（入力状態の視覚的フィードバック等）で組み合わせている場合に誤検知が発生しうる。' +
      'background-image の URL が外部ドメインかローカルアセットかを確認して判断する。',
    relatedAlerts: ['credential_theft', 'xss_injection', 'dns_prefetch_leak'],
  },

  // ========================================================================
  // WASM Execution
  // ========================================================================
  {
    id: 'wasm_execution',
    title: 'WebAssembly 大規模モジュール実行',
    severity: 'high',
    description:
      '1MB を超える WebAssembly モジュールのインスタンス化またはコンパイルを検出します。' +
      'WebAssembly は正当な用途（ゲームエンジン、暗号計算等）がある一方、' +
      'クリプトマイナーや難読化された悪意あるコードの実行基盤としても利用されます。' +
      'サイズ閾値により、小規模な正当利用との区別を図ります。',
    mitreAttack: ['T1496', 'T1059'],
    detection: {
      mechanism:
        'WebAssembly.instantiate() と WebAssembly.compile() をフックし、' +
        '引数の BufferSource の byteLength が 1MB（1,048,576 バイト）を超える場合に' +
        '__WASM_EXECUTION_DETECTED__ イベントを emit する。' +
        'Module オブジェクトが渡された場合はサイズ不明（byteLength: null）として扱う。',
      monitoredAPIs: [
        'WebAssembly.instantiate()',
        'WebAssembly.compile()',
      ],
      triggerConditions: [
        'WebAssembly.instantiate() に 1MB 超の ArrayBuffer/TypedArray が渡された',
        'WebAssembly.compile() に 1MB 超の BufferSource が渡された',
      ],
      severityLogic:
        '常に high。1MB 超の WASM モジュールはクリプトマイナーの可能性があるが、' +
        '正当な用途（Unity WebGL ビルド等）も多いため critical ではなく high に設定。' +
        'byteLength が null（Module オブジェクト渡し）の場合はアラートを発行しない。',
    },
    response: [
      {
        title: 'WASM モジュールの出所確認',
        description:
          'method フィールド（instantiate/compile）と読み込み元スクリプトの URL を確認し、' +
          'モジュールがどのドメインから提供されたかを特定する。',
      },
      {
        title: 'リソース消費の監視',
        description:
          'CPU 使用率とメモリ消費量を確認し、クリプトマイナーの兆候（持続的な高 CPU 使用率）がないか監視する。',
      },
      {
        title: 'ネットワーク通信の確認',
        description:
          'WASM 実行後に WebSocket やマイニングプール特有の通信パターンが発生していないか確認する。',
      },
      {
        title: '正当性の判断',
        description:
          'サイトの用途（ゲーム、画像処理、CAD 等）と照合し、WASM の使用が正当かどうかを判断する。' +
          '不正と判断した場合はタブを閉じる。',
      },
    ],
    prevention: [
      'CSP の script-src で wasm-unsafe-eval を制限し、意図しない WASM 実行をブロックする',
      '信頼できないサイトでの長時間滞在を避け、バックグラウンドマイニングのリスクを低減する',
      'ブラウザのタスクマネージャで各タブの CPU 使用率を定期的に確認する',
    ],
    falsePositives:
      'ゲームエンジン（Unity, Unreal Engine の WebGL ビルド）、画像・動画編集ツール（Photopea 等）、' +
      'CAD ソフト、科学計算ライブラリなどは正当に 1MB 超の WASM を使用する。' +
      'サイトの機能と照合し、正当な用途であれば dismiss する。',
    relatedAlerts: ['dynamic_code_execution', 'tracking_beacon'],
  },
];

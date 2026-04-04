import type { PlaybookData } from '../types';

export const phishingDomainPlaybooks: PlaybookData[] = [
  // =========================================================================
  // NRD - 新規登録ドメイン検出
  // =========================================================================
  {
    id: 'nrd',
    title: '新規登録ドメイン検出',
    severity: 'high',
    description:
      'RDAP (Registration Data Access Protocol) を使用してドメインの登録日を照会し、設定された閾値（デフォルト30日）以内に登録されたドメインを検出します。新規登録ドメインはフィッシング、マルウェア配布、C2サーバーなどの悪意ある目的で使用される確率が高く、早期警告として機能します。',
    mitreAttack: ['T1583.001', 'T1566.002'],
    detection: {
      mechanism:
        'RDAP APIへのクエリによりドメインの登録日を取得し、現在日時との差分からドメイン年齢を算出します。ドメイン年齢がthresholdDays（デフォルト30日）以下の場合にNRDと判定します。結果はキャッシュされ、24時間有効です。DDNS利用の検出および不審なドメインパターンスコア（エントロピー、過剰ハイフン、過剰数字、ランダム性、不審TLD）も参考情報として付与されます。',
      monitoredAPIs: ['RDAP API (queryRDAP)', 'chrome.webNavigation'],
      triggerConditions: [
        'RDAPクエリでドメイン登録日が取得でき、ドメイン年齢がthresholdDays以下（デフォルト30日）',
        'RDAP取得成功時のconfidenceはhigh',
        'RDAP取得失敗時はNRD判定不能（isNRD: false, confidence: unknown）',
      ],
      severityLogic:
        'confidenceがhighの場合はseverity: high、mediumの場合はmedium。severityFromConfidence()ヘルパーにより判定。',
    },
    response: [
      {
        title: '即時アクセス評価',
        description:
          'アラートが発火したドメインへのアクセスが意図的かどうかを確認します。リンク経由のアクセスであれば、リンク元の信頼性も評価します。',
      },
      {
        title: 'ドメイン情報の詳細調査',
        description:
          'WHOISまたはRDAP情報でRegistrant、DNS設定、SSL証明書の発行元を確認します。無料SSL（Let\'s Encrypt等）のみで組織情報が不明な場合は追加警戒が必要です。',
      },
      {
        title: 'コンテンツの安全性確認',
        description:
          'ページの内容がログインフォーム、ファイルダウンロード、個人情報入力を求めるものでないか確認します。正規サービスを模倣していないか検証します。',
      },
      {
        title: 'アクセス制御の適用',
        description:
          '不審と判断した場合、当該ドメインへのアクセスをブロックまたは警告レベルに設定します。組織内での周知も検討します。',
      },
      {
        title: '継続監視の設定',
        description:
          '判断を保留する場合は、一定期間後に再評価するためのリマインダーを設定します。ドメインの信頼性は時間の経過とともに変化します。',
      },
    ],
    prevention: [
      'メール・メッセージ内の不審なリンクを安易にクリックしない',
      'ブックマークまたは直接URL入力で重要なサイトにアクセスする',
      '組織のDNSフィルタリングでNRDカテゴリをブロックする',
      'Webプロキシでドメイン年齢ベースのポリシーを設定する',
    ],
    falsePositives:
      '新規に立ち上げられた正規サービスや、企業のキャンペーン用新規ドメインが検出される場合があります。RDAP取得に失敗した場合はアラートが発火しないため、偽陰性が発生する可能性もあります。',
    relatedAlerts: ['typosquat', 'login', 'credential_theft'],
  },

  // =========================================================================
  // Typosquat - タイポスクワット検出
  // =========================================================================
  {
    id: 'typosquat',
    title: 'タイポスクワット検出',
    severity: 'critical',
    description:
      'ドメイン名の文字特性をヒューリスティック分析し、ホモグリフ攻撃（視覚的に類似した文字の置換）によるタイポスクワッティングを検出します。キリル文字・ギリシャ文字・日本語全角文字のホモグリフ、ラテン文字シーケンス（rn->m等）、数字置換（0->O等）、Punycode、混合スクリプトを総合的にスコアリングし、閾値を超えた場合にアラートを発火します。',
    mitreAttack: ['T1583.001', 'T1566.002', 'T1036.003'],
    detection: {
      mechanism:
        '外部DBを使用せず、純粋にドメイン名の文字特性から判定します。スコアリングルール: キリル文字ホモグリフ25点/文字(上限50)、ギリシャ文字ホモグリフ25点/文字(上限50)、日本語全角15点/文字(上限30)、ラテンシーケンス(rn->m, vv->w等)はラベル先頭のみ30点(上限50)、数字置換は両側文字挟み30点/片側15点(上限30)、混合スクリプト(Latin+Cyrillic/Greek)40点、Punycode10点。合計100点上限で、デフォルト閾値30点以上で検出。confidenceはスコア70以上でhigh、40以上でmedium、20以上でlow。',
      monitoredAPIs: ['chrome.webNavigation', 'URL解析'],
      triggerConditions: [
        'ヒューリスティックスコアがheuristicThreshold（デフォルト30）以上',
        'confidenceがnone以外（スコア20以上）の場合にアラート生成',
        'Punycodeドメイン（xn--プレフィックス）はデコード後に分析',
        'Latin+Cyrillic または Latin+Greek の混合スクリプトで40点加算',
      ],
      severityLogic:
        'confidenceがhighの場合はseverity: critical、mediumの場合はhigh。severityFromConfidence()ヘルパーにより判定。confidenceがnoneの場合はアラートを生成しない（null返却）。',
    },
    response: [
      {
        title: '即時アクセス遮断の検討',
        description:
          'タイポスクワットが高確度で検出された場合、該当ドメインへの通信を即座にブロックすることを検討します。特にconfidenceがhighの場合は優先的に対応します。',
      },
      {
        title: 'ターゲットドメインの特定',
        description:
          '検出されたホモグリフパターンから、攻撃者が模倣しようとしている正規ドメインを特定します。targetDomainが提供されている場合はそれを参照します。',
      },
      {
        title: '認証情報の漏洩確認',
        description:
          '該当ドメインでログインフォームへの入力やパスワードの送信が行われていないか確認します。認証情報が入力された可能性がある場合は、即座にパスワード変更を実施します。',
      },
      {
        title: '組織内での影響範囲調査',
        description:
          '同一ドメインにアクセスした他のユーザーがいないか調査します。フィッシングキャンペーンの一部である可能性を考慮し、横展開を確認します。',
      },
      {
        title: 'ドメインの報告',
        description:
          'フィッシングドメインとしてGoogle Safe Browsing、PhishTank等の公的データベースに報告します。ドメインレジストラへのabuse報告も実施します。',
      },
    ],
    prevention: [
      'ブラウザのIDN表示ポリシーを厳格に設定する（Punycode表示を有効化）',
      'DNS Securityソリューションでホモグリフドメインをブロックする',
      '組織のブランドドメインに類似するドメインを定期的に監視する',
      '従業員向けにフィッシングURL識別のセキュリティ研修を実施する',
      'パスワードマネージャーを使用しドメイン一致時のみ自動入力する',
    ],
    falsePositives:
      '国際化ドメイン名（IDN）を正当に使用するサイトや、多言語対応サイトで誤検知が発生する場合があります。特にキリル文字圏・ギリシャ語圏のサイトでは混合スクリプト判定により高スコアとなる可能性があります。ラテンシーケンス（rn等）を含む正規英単語ドメインはラベル先頭のみスコアリングすることで低減しています。',
    relatedAlerts: ['nrd', 'login', 'credential_theft', 'open_redirect'],
  },

  // =========================================================================
  // Open Redirect - オープンリダイレクト検出
  // =========================================================================
  {
    id: 'open_redirect',
    title: 'オープンリダイレクト検出',
    severity: 'high',
    description:
      'URLパラメータに含まれるリダイレクト先URLを解析し、外部ドメインへのオープンリダイレクトを検出します。オープンリダイレクトはフィッシング攻撃の中継地点として悪用され、信頼されたドメインのURLを経由して悪意あるサイトへ誘導するために利用されます。',
    mitreAttack: ['T1566.002', 'T1204.001'],
    detection: {
      mechanism:
        'ページロード時にURLのクエリパラメータを解析し、リダイレクト用途として知られる20種のパラメータ名（redirect, redirect_url, redirect_uri, return, return_url, returnto, return_to, next, url, goto, target, dest, destination, continue, forward, callback, cb, rurl, out, link）の値を検査します。パラメータ値をURLとしてパースし、現在のホスト名と異なる外部ドメインへのリダイレクトを検出します。プロトコル相対URL（//evil.com）やjavascript:/data:/vbscript:スキームも検出対象です。1ページにつき最初の検出のみアラートを発火します。',
      monitoredAPIs: [
        'window.location.href',
        'URL.searchParams',
        'decodeURIComponent()',
      ],
      triggerConditions: [
        'URLパラメータのリダイレクト先が外部ドメイン（hostname不一致）',
        'プロトコル相対URL（//で始まる値）が検出された場合',
        'javascript:, data:, vbscript: スキームが検出された場合',
        'ページロードごとに最初の一致のみ発火（first match wins）',
      ],
      severityLogic:
        '外部ドメインへのリダイレクト（isExternal: true）の場合はseverity: high、それ以外はmedium。resolveSeverity()ヘルパーにより判定。',
    },
    response: [
      {
        title: 'リダイレクト先の確認',
        description:
          'redirectUrlに記録されたリダイレクト先URLを確認し、そのドメインの信頼性を評価します。フィッシングサイトや既知のマルウェア配布サイトでないか確認します。',
      },
      {
        title: 'リダイレクト元の脆弱性評価',
        description:
          'オープンリダイレクトが発生しているドメインがサードパーティサービスか自組織のアプリケーションかを判定します。自組織の場合はリダイレクト先のホワイトリスト検証の実装を検討します。',
      },
      {
        title: 'アクセス経路の追跡',
        description:
          'このURLがどのような経路でアクセスされたか（メール、チャット、Web検索等）を特定し、フィッシングキャンペーンの一部でないか確認します。',
      },
      {
        title: 'ユーザーへの注意喚起',
        description:
          '該当URLにアクセスしたユーザーに対し、リダイレクト先で認証情報や個人情報を入力していないか確認します。入力済みの場合は即座にパスワード変更等の対応を実施します。',
      },
      {
        title: '脆弱性報告',
        description:
          'オープンリダイレクトの脆弱性が確認された場合、該当サービスの開発チームまたはセキュリティチームに報告します。外部サービスの場合は責任ある脆弱性開示を行います。',
      },
    ],
    prevention: [
      'リダイレクトURLのホワイトリスト検証をサーバーサイドで実装する',
      'リダイレクトパラメータにはトークンベースの間接参照を使用する',
      '外部URLへのリダイレクト時は中間確認ページを表示する',
      'Content Security Policyのnavigation-toディレクティブを検討する',
    ],
    falsePositives:
      'OAuth認証フロー等で正規のリダイレクトパラメータが使用される場合に検出される可能性があります。SSOやサードパーティ認証で外部ドメインへの正当なリダイレクトが発生するケースでは誤検知となります。',
    relatedAlerts: ['nrd', 'typosquat', 'credential_theft', 'login'],
  },

  // =========================================================================
  // Fullscreen Phishing - フルスクリーンフィッシング検出
  // =========================================================================
  {
    id: 'fullscreen_phishing',
    title: 'フルスクリーンフィッシング検出',
    severity: 'critical',
    description:
      'Webページがフルスクリーン表示を要求した際に、フィッシング目的の可能性を検出します。攻撃者はフルスクリーンモードを利用してブラウザのアドレスバーを隠し、偽のアドレスバーを表示することで、ユーザーに正規サイトにアクセスしていると誤認させます。',
    mitreAttack: ['T1566.002', 'T1204.001'],
    detection: {
      mechanism:
        'Element.prototype.requestFullscreen および webkitRequestFullscreen をフックし、フルスクリーン要求が発生した要素のタグ名を記録します。VIDEO、CANVAS、IFRAME要素からのフルスクリーン要求は正当な使用と判断し除外します（FULLSCREEN_SAFE_TAGS）。それ以外の要素（DIV、BODY等）からのフルスクリーン要求はフィッシングの疑いとしてアラートを発火します。',
      monitoredAPIs: [
        'Element.prototype.requestFullscreen',
        'Element.prototype.webkitRequestFullscreen',
      ],
      triggerConditions: [
        'VIDEO, CANVAS, IFRAME以外の要素がrequestFullscreen()を呼び出した場合',
        'webkitRequestFullscreen()（Webkit互換）が呼び出された場合',
        '要素のtagName、id、classNameがメタデータとして記録される',
      ],
      severityLogic:
        '常にseverity: critical。フルスクリーンフィッシングはアドレスバーを隠蔽する直接的な攻撃手法であるため、条件に関わらず最高重大度が設定される。',
    },
    response: [
      {
        title: 'フルスクリーン解除',
        description:
          '即座にEscキーを押下してフルスクリーンモードを解除します。ブラウザのアドレスバーが表示された状態で、現在のURLが想定通りか確認します。',
      },
      {
        title: '偽UIの有無を確認',
        description:
          'フルスクリーン表示中にブラウザのアドレスバーや通知バーを模倣した偽のUI要素が存在していなかったか確認します。スクリーンショットが残っている場合は証拠として保全します。',
      },
      {
        title: '入力済みデータの確認',
        description:
          'フルスクリーン状態で認証情報やクレジットカード情報等の機密データを入力していないか確認します。入力済みの場合は即座に該当アカウントのパスワード変更を実施します。',
      },
      {
        title: 'ページの分析',
        description:
          'フルスクリーンを要求したページのソースコードを調査し、偽のアドレスバーUIやログインフォームの送信先を特定します。',
      },
    ],
    prevention: [
      'ブラウザのフルスクリーン権限を信頼されたサイトのみに許可する',
      'フルスクリーン遷移時にブラウザが表示する通知メッセージを確認する',
      'パスワードマネージャーを使用してドメイン検証を自動化する',
      '不審なサイトでは動画再生以外のフルスクリーン要求を拒否する',
    ],
    falsePositives:
      'Webアプリケーション（プレゼンテーションツール、ゲーム、インタラクティブコンテンツ等）がDIVやBODY要素でフルスクリーンを要求する正当なケースで誤検知が発生します。VIDEO/CANVAS/IFRAME要素は除外されていますが、カスタムメディアプレーヤー等で異なる要素が使用される場合もあります。',
    relatedAlerts: ['credential_theft', 'login', 'notification_phishing'],
  },

  // =========================================================================
  // Notification Phishing - 通知フィッシング検出
  // =========================================================================
  {
    id: 'notification_phishing',
    title: '通知フィッシング検出',
    severity: 'high',
    description:
      'Webサイトがブラウザの Notification API を使用して通知を表示する際に、フィッシング目的の可能性を検出します。悪意あるサイトは、ウイルス感染警告、セキュリティアラート、懸賞当選通知などの偽の通知を表示し、ユーザーを不正なサイトへ誘導したり、マルウェアのインストールを促したりします。',
    mitreAttack: ['T1566.002', 'T1204.001'],
    detection: {
      mechanism:
        'Notification APIの使用を監視し、Webページが通知を生成した際にそのタイトルとドメイン情報を記録してアラートを発火します。バックグラウンドサービスのセキュリティイベントハンドラがNOTIFICATION_PHISHING_DETECTEDメッセージを処理し、アラートマネージャーを通じてアラートを生成します。',
      monitoredAPIs: [
        'Notification API (new Notification())',
        'Notification.requestPermission()',
      ],
      triggerConditions: [
        'Webページが Notification API を使用して通知を表示した場合',
        '通知のタイトルとドメインがアラート詳細として記録される',
        'content scriptからバックグラウンドへのメッセージ経由で検出',
      ],
      severityLogic:
        '常にseverity: high。Notification APIの悪用は直接的なソーシャルエンジニアリング攻撃であるため、高い重大度が設定される。',
    },
    response: [
      {
        title: '通知の無視と権限確認',
        description:
          '表示された通知の内容をクリックせず、ブラウザの設定から当該サイトの通知権限を即座に「ブロック」に変更します。',
      },
      {
        title: '通知内容の評価',
        description:
          '通知のタイトルや内容が恐怖心を煽るもの（ウイルス検出、アカウント停止等）や、不自然な報酬を提示するもの（懸賞当選等）でないか評価します。これらはソーシャルエンジニアリングの典型的パターンです。',
      },
      {
        title: '誘導先の確認',
        description:
          '通知をクリックしてしまった場合、遷移先のURLとドメインを確認します。個人情報やクレジットカード情報の入力を求められた場合は、即座にページを閉じます。',
      },
      {
        title: 'ブラウザ通知設定の棚卸し',
        description:
          'ブラウザの設定画面から通知を許可しているサイトの一覧を確認し、不要なサイトの権限を削除します。',
      },
      {
        title: '組織全体での通知ポリシー見直し',
        description:
          'エンタープライズ環境では、グループポリシーまたはMDMを使用して通知権限のホワイトリストを設定し、未承認サイトからの通知を一括ブロックします。',
      },
    ],
    prevention: [
      'ブラウザのデフォルト通知設定を「ブロック」に変更する',
      '通知権限の要求は信頼できるサイトからのみ許可する',
      'グループポリシーで許可する通知サイトのホワイトリストを管理する',
      '通知内容に含まれるリンクを直接クリックせず、別途正規サイトにアクセスする',
    ],
    falsePositives:
      'メール通知、チャットアプリ、カレンダーリマインダーなど、正当な目的で Notification API を使用するWebアプリケーションが検出される場合があります。業務で使用するSaaS等の通知は許可リストへの追加を検討してください。',
    relatedAlerts: ['fullscreen_phishing', 'login', 'credential_theft'],
  },
];

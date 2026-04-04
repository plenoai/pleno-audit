import type { PlaybookData } from '../types';

export const aiPolicyPlaybooks: PlaybookData[] = [
  // =========================================================================
  // ai_sensitive - AIプロバイダーへの機密データ送信
  // =========================================================================
  {
    id: 'ai_sensitive',
    title: 'AIプロバイダーへの機密データ送信',
    severity: 'critical',
    description:
      'AIサービス（ChatGPT、Claude、Gemini等）へのリクエストに、APIキー・パスワード・PII（個人識別情報）・クレジットカード番号などの機密データが含まれていることを検出します。DLPルールエンジンがプロンプト内容をリアルタイムでスキャンし、credentials/pii/financial/health等の分類に基づいてアラートを発火します。',
    mitreAttack: ['T1530', 'T1048.002'],
    detection: {
      mechanism:
        'ネットワークリクエストのボディをAIリクエスト構造（Chat Completion形式、Gemini形式、ChatGPT Web形式等）として検出後、DLPルールエンジン（dlp-rules.ts）で機密データパターンマッチングを実行。Shannon entropyによる誤検知低減、Luhnアルゴリズムによるクレジットカード番号検証を併用。',
      monitoredAPIs: [
        'fetch() / XMLHttpRequest（AIエンドポイントへのPOSTリクエスト）',
        'isAIRequestBody() によるリクエスト構造判定',
        'detectSensitiveData() / DLPManager.analyze() による機密データスキャン',
      ],
      triggerConditions: [
        'AIリクエストボディ内でDLPルールにマッチするパターンを検出',
        'credentials分類（APIキー、パスワード、秘密鍵、JWT等）の検出',
        'pii分類（メールアドレス、電話番号、マイナンバー等）の検出',
        'financial分類（クレジットカード番号、口座番号等）の検出',
      ],
      severityLogic:
        'dataTypesに"credentials"が含まれる場合はcritical、それ以外はhigh。DLPリスクレベルではcredentials+high confidenceでcritical、financial+high confidenceでhigh。',
    },
    response: [
      {
        title: '即時確認',
        description:
          'アラート詳細からプロバイダー名、モデル名、検出されたデータ分類（credentials/pii/financial等）を確認します。',
      },
      {
        title: '送信データの特定',
        description:
          'DLP検出結果のマスク済みサンプルを確認し、実際に機密データが送信されたか、誤検知かを判断します。',
      },
      {
        title: '影響範囲の評価',
        description:
          '送信先AIプロバイダーのデータ保持ポリシーを確認し、送信された機密情報の種類に応じてクレデンシャルのローテーションやPII漏洩対応を検討します。',
      },
      {
        title: 'クレデンシャルのローテーション',
        description:
          'APIキー・トークン・パスワードが送信された場合は、該当するクレデンシャルを即座に無効化・再発行します。',
      },
      {
        title: 'AIプロバイダーへの削除依頼',
        description:
          'プロバイダーのデータ削除APIまたはサポートを通じて、送信された機密データの削除をリクエストします。',
      },
    ],
    prevention: [
      'DLPポリシーでblockOnHighRiskを有効化し、credentials/financial分類のhigh confidence検出時に送信をブロック',
      'エンタープライズポリシーで承認済みAIサービスのみ許可リストに登録',
      '機密情報を含むプロンプトテンプレートの社内ガイドライン策定',
      'AIサービス利用前のデータ分類ラベリング教育の実施',
    ],
    falsePositives:
      'ソースコードのサンプル（import文、関数定義等）がcode分類で検出される場合があります。低entropy文字列がAPIキーパターンにマッチする場合はentropyThresholdにより自動除外されますが、プレースホルダー値が検出されることがあります。',
    relatedAlerts: ['shadow_ai', 'data_exfiltration', 'policy_violation'],
  },

  // =========================================================================
  // shadow_ai - 未承認/不明なAIサービスへのアクセス
  // =========================================================================
  {
    id: 'shadow_ai',
    title: 'Shadow AI（未承認AIサービス）検出',
    severity: 'high',
    description:
      '組織で承認されていないAIサービスや、分類不能な未知のAIサービスへのアクセスを検出します。provider-classifier.tsがモデル名・URLパターン・レスポンス構造の3段階でプロバイダーを分類し、regional（地域特化型）カテゴリやunknownプロバイダーをShadow AIとして識別します。',
    mitreAttack: ['T1567.002', 'T1071.001'],
    detection: {
      mechanism:
        'AIリクエストを検出後、classifyProvider()が3段階の分類を実行: (1) モデル名パターンマッチ（gpt-4, claude-3, gemini-等）、(2) URLパターンマッチ（api.openai.com, api.anthropic.com等の既知ドメイン）、(3) レスポンス構造分析（choices[], content[], candidates[]等）。isShadowAI()がunknown/regional/riskLevel medium以上をShadow AIと判定。',
      monitoredAPIs: [
        'fetch() / XMLHttpRequest（AIリクエスト構造を持つPOSTリクエスト）',
        'classifyByModelName() - モデル名からのプロバイダー推定',
        'classifyByUrl() - URLパターンからのプロバイダー推定',
        'classifyByResponseStructure() - レスポンス構造からのプロバイダー推定',
      ],
      triggerConditions: [
        'プロバイダーが"unknown"と分類された場合',
        'プロバイダーがregionalカテゴリ（DeepSeek、Moonshot、智谱AI、百度、阿里巴巴等）に分類された場合',
        'プロバイダーのriskLevelが"medium"または"high"の場合',
      ],
      severityLogic:
        'provider が "unknown" の場合はhigh、riskLevel が "high" の場合もhigh、それ以外はmedium。',
    },
    response: [
      {
        title: 'プロバイダーの特定',
        description:
          'アラート詳細のprovider、providerDisplayName、categoryを確認し、どのAIサービスにアクセスしたかを特定します。',
      },
      {
        title: 'ビジネス正当性の確認',
        description:
          '利用者に対してAIサービス利用の業務上の必要性を確認し、承認済みサービスで代替可能かを評価します。',
      },
      {
        title: 'データ送信内容の確認',
        description:
          '関連するai_sensitiveアラートがないか確認し、機密データが未承認サービスに送信されていないか検証します。',
      },
      {
        title: 'ポリシーの更新',
        description:
          '正当な利用であれば承認リストに追加、不正な利用であればエンタープライズポリシーでブロックルールを設定します。',
      },
    ],
    prevention: [
      'エンタープライズポリシーでAIサービスの許可リスト/拒否リストを定義',
      '未知のAIサービスへのアクセスを自動ブロックするポリシールール設定',
      '承認済みAIサービス一覧の社内周知と定期的な見直し',
      'regionalカテゴリのAIサービスに関するデータ主権リスクの教育',
    ],
    falsePositives:
      'OpenAI互換APIを提供するセルフホステッドサービス（LocalAI、Ollama等）がunknownとして検出される場合があります。社内プロキシ経由のAIアクセスもURLパターンが一致せずunknownになることがあります。',
    relatedAlerts: ['ai_sensitive', 'policy_violation', 'data_exfiltration'],
  },

  // =========================================================================
  // csp_violation - Content Security Policy違反
  // =========================================================================
  {
    id: 'csp_violation',
    title: 'Content Security Policy違反',
    severity: 'high',
    description:
      'ウェブページのContent Security Policy（CSP）に違反するリソース読み込みやスクリプト実行を検出します。CSP違反はXSS攻撃、不正なスクリプトインジェクション、データ窃取の兆候である可能性があります。CSPAnalyzerがviolationレポートを収集・分析し、ドメインごとのポリシー生成も行います。',
    mitreAttack: ['T1059.007', 'T1189'],
    detection: {
      mechanism:
        'SecurityPolicyViolationEventをリスニングし、CSPレポートを収集。violated directive、blocked URL、violation countをもとにアラートを生成。CSPAnalyzerがドメインごとの統計分析とポリシー自動生成を提供。',
      monitoredAPIs: [
        'SecurityPolicyViolationEvent（CSP違反イベント）',
        'CSPAnalyzer.generatePolicy() - 違反ベースのCSPポリシー生成',
        'INITIATOR_TO_DIRECTIVE マッピングによるディレクティブ分類',
      ],
      triggerConditions: [
        'CSP違反イベントが発生しviolated directiveとblocked URLが記録された場合',
        'script-srcまたはdefault-srcディレクティブの違反',
        'img-src、style-src、connect-src等のリソースディレクティブ違反',
      ],
      severityLogic:
        'script-srcまたはdefault-srcの違反はhigh（スクリプト実行に直結するため）、それ以外のディレクティブ違反はmedium。',
    },
    response: [
      {
        title: '違反内容の確認',
        description:
          'アラート詳細のdirective（違反ディレクティブ）とblockedURL（ブロックされたURL）を確認し、どのリソースがポリシーに違反したかを特定します。',
      },
      {
        title: '正当性の評価',
        description:
          'ブロックされたリソースが正当なサードパーティサービス（アナリティクス、CDN等）かどうかを確認します。',
      },
      {
        title: '攻撃の可能性の調査',
        description:
          'script-src違反の場合、XSSインジェクションや不正スクリプト注入の痕跡がないかページのDOMとネットワークログを調査します。',
      },
      {
        title: 'CSPポリシーの調整',
        description:
          '正当なリソースであればCSPポリシーにホワイトリスト追加、不正なリソースであればポリシーを強化します。CSPAnalyzerの自動生成ポリシーを参考にできます。',
      },
      {
        title: '違反パターンの監視',
        description:
          'violationCountを監視し、同一ドメインからの繰り返し違反がないか確認します。繰り返しの場合は攻撃の継続を示唆します。',
      },
    ],
    prevention: [
      'strict-dynamic または nonce ベースの厳格なCSPポリシーを導入',
      'report-uri / report-to ディレクティブによるCSP違反の継続的モニタリング',
      'CSPAnalyzerの自動生成ポリシーを活用した段階的なポリシー強化',
      'サードパーティスクリプトの棚卸しと不要なリソースの削除',
      'Content-Security-Policy-Report-Only ヘッダーでの事前テスト',
    ],
    falsePositives:
      'ブラウザ拡張機能が注入するスクリプトやスタイルがCSP違反として検出される場合があります。また、正当なサードパーティウィジェット（チャット、アナリティクス等）のCSP未対応による違反も発生します。',
    relatedAlerts: ['xss_injection', 'supply_chain', 'dynamic_code_execution'],
  },

  // =========================================================================
  // policy_violation - エンタープライズポリシー違反
  // =========================================================================
  {
    id: 'policy_violation',
    title: 'エンタープライズポリシー違反',
    severity: 'medium',
    description:
      '組織が定義したエンタープライズセキュリティポリシー（ドメイン制限、ツール制限、AI利用制限、データ転送制限）への違反を検出します。管理者が設定したルールに対してドメインアクセスやツール利用をリアルタイムで照合し、warnアクションのルールに一致した場合にアラートを発火します。',
    mitreAttack: ['T1078', 'T1567'],
    detection: {
      mechanism:
        'エンタープライズポリシーエンジンが定義するルール（ruleType: domain/tool/ai/data_transfer）に対し、ユーザーの行動をリアルタイムで照合。matchedPatternとtargetを記録し、actionが"warn"の場合にアラート生成。"allow"の場合はアラートを生成しない。',
      monitoredAPIs: [
        'ポリシーエンジン - ドメインアクセスルール照合',
        'ポリシーエンジン - ツール利用ルール照合',
        'ポリシーエンジン - AI利用ルール照合',
        'ポリシーエンジン - データ転送ルール照合',
      ],
      triggerConditions: [
        'ドメインルール違反: 制限対象ドメインへのアクセス',
        'ツールルール違反: 禁止されたウェブツールの利用',
        'AIルール違反: 未承認AIサービスの利用',
        'データ転送ルール違反: 制限されたデータ転送パターンの検出',
      ],
      severityLogic:
        'actionが"allow"の場合はアラートを生成しない。"warn"の場合は一律medium。ルールタイプによる重大度の変動はなし。',
    },
    response: [
      {
        title: 'ルール詳細の確認',
        description:
          'アラート詳細のruleName、ruleType、matchedPatternを確認し、どのポリシールールに違反したかを特定します。',
      },
      {
        title: '違反の意図確認',
        description:
          'ユーザーに違反の理由をヒアリングし、業務上の正当な理由があるか確認します。',
      },
      {
        title: 'ポリシーの適切性評価',
        description:
          '違反が頻発する場合、ポリシー自体の妥当性を見直し、業務に支障がない範囲でルールを調整します。',
      },
      {
        title: '例外申請プロセス',
        description:
          '正当な理由がある場合は、ポリシー例外申請として記録し、一時的または恒久的な許可設定を行います。',
      },
    ],
    prevention: [
      'エンタープライズポリシーの定期的な棚卸しと業務実態への適合性確認',
      'ポリシールールの段階的導入（まずwarnモードで運用し、影響を確認後にblockへ移行）',
      'ユーザー向けのポリシー教育と承認済みツール・サービスの周知',
      'ポリシー違反の傾向分析に基づくルールの最適化',
    ],
    falsePositives:
      'ワイルドカードパターンが広すぎると正当なドメインやツールが誤検知されます。また、リダイレクト先のドメインがルールにマッチする場合に意図しないアラートが発生することがあります。',
    relatedAlerts: ['shadow_ai', 'ai_sensitive', 'data_exfiltration'],
  },

  // =========================================================================
  // extension - 不審な拡張機能アクティビティ
  // =========================================================================
  {
    id: 'extension',
    title: '不審な拡張機能アクティビティ',
    severity: 'high',
    description:
      '危険なパーミッションを持つ拡張機能や、異常なネットワーク活動パターンを示す拡張機能を検出します。extension-risk-analyzer.tsがパーミッションリスク分析（data_access/code_execution/network/privacy/system）とネットワーク活動パターン分析を組み合わせてリスクスコアを算出し、リスクレベルに応じたアラートを生成します。',
    mitreAttack: ['T1176', 'T1059.007'],
    detection: {
      mechanism:
        'extension-risk-analyzer.tsが拡張機能のパーミッション（<all_urls>, cookies, history等）を危険度分類し、ネットワークリクエスト数・対象ドメイン数からリスクスコアを算出。riskLevel（critical/high/medium/low）がアラートのseverityに直接マッピングされる。リスクフラグ（flags）がアラート説明に表示される。',
      monitoredAPIs: [
        'chrome.management.getAll() - インストール済み拡張機能の一覧取得',
        'chrome.webRequest - 拡張機能のネットワークリクエスト監視',
        'DANGEROUS_PERMISSIONS マッピングによるパーミッションリスク分析',
      ],
      triggerConditions: [
        '<all_urls>、http://*/*、https://*/*等の広範なデータアクセスパーミッション',
        'cookies、history、bookmarks等のプライバシー関連パーミッション',
        'webRequest、webRequestBlocking等のネットワーク傍受パーミッション',
        '異常に多いネットワークリクエスト数や広範なターゲットドメイン',
      ],
      severityLogic:
        'リスクレベルがアラートseverityに直接マッピング: critical -> critical, high -> high, medium -> medium, low -> low。パーミッションの危険度とネットワーク活動の両方がスコアに影響。',
    },
    response: [
      {
        title: '拡張機能の確認',
        description:
          'アラート詳細のextensionName、extensionIdを確認し、Chrome Web Storeでの評価・レビュー・更新頻度を確認します。',
      },
      {
        title: 'パーミッションの精査',
        description:
          '拡張機能が要求するパーミッションが機能に対して過剰でないか確認します。特に<all_urls>やcookiesは注意が必要です。',
      },
      {
        title: 'ネットワーク活動の調査',
        description:
          'requestCountとtargetDomainsを確認し、拡張機能が不審な外部サーバーと通信していないか調査します。',
      },
      {
        title: '無効化・削除の判断',
        description:
          '不審な拡張機能は即座に無効化し、代替拡張機能への切り替えまたは削除を検討します。',
      },
      {
        title: '影響範囲の評価',
        description:
          '該当拡張機能がアクセス可能だったデータ（Cookie、閲覧履歴、フォーム入力等）に基づき、データ漏洩の影響範囲を評価します。',
      },
    ],
    prevention: [
      'エンタープライズポリシーで拡張機能の許可リスト/拒否リストを管理',
      '拡張機能のインストール前にパーミッション要求の妥当性を確認する運用フローの確立',
      'Chrome管理コンソールでの拡張機能管理の一元化',
      'サイドロード拡張機能（開発者モード）の制限',
      '定期的な拡張機能棚卸しと未使用拡張機能の削除',
    ],
    falsePositives:
      'パスワードマネージャーやセキュリティツールなど、正当な理由で広範なパーミッションを必要とする拡張機能がhigh/criticalとして検出される場合があります。広告ブロッカー等のwebRequestパーミッションも高リスクとして評価されます。',
    relatedAlerts: ['supply_chain', 'data_exfiltration', 'credential_theft'],
  },

  // =========================================================================
  // supply_chain - サプライチェーンリスク（SRI/crossorigin欠落）
  // =========================================================================
  {
    id: 'supply_chain',
    title: 'サプライチェーンリスク（SRI/crossorigin欠落）',
    severity: 'high',
    description:
      '外部CDNから読み込まれるスクリプトやスタイルシートにSubresource Integrity（SRI）属性またはcrossorigin属性が欠落していることを検出します。SRIがない場合、CDNが侵害された際に改ざんされたコードがそのまま実行されるサプライチェーン攻撃のリスクがあります。MutationObserverでDOMに動的追加される外部リソースもリアルタイムで監視します。',
    mitreAttack: ['T1195.002', 'T1059.007'],
    detection: {
      mechanism:
        'MutationObserverがdocument.headとdocument.bodyの子要素追加を監視。追加された<script src>と<link rel="stylesheet" href>要素に対し、checkSupplyChainRisk()が外部ドメイン判定・integrity属性チェック・crossorigin属性チェック・既知CDNリスト（KNOWN_CDNS）照合を実行。CDNからの読み込みでSRIが欠落している場合にイベントを発火。',
      monitoredAPIs: [
        'MutationObserver（document.head / document.body の childList 監視）',
        'HTMLScriptElement.src / HTMLLinkElement.href - リソースURL取得',
        'Element.hasAttribute("integrity") - SRI属性チェック',
        'Element.hasAttribute("crossorigin") - crossorigin属性チェック',
        'KNOWN_CDNS リスト照合（cdnjs.cloudflare.com, cdn.jsdelivr.net, unpkg.com等）',
      ],
      triggerConditions: [
        '外部CDN（KNOWN_CDNSリスト）からのスクリプト/スタイルシートでintegrity属性が欠落',
        'CDNリソースにcrossorigin属性が欠落（SRIとの併用が必要）',
        '動的に追加された外部リソース（DOM mutation経由）',
      ],
      severityLogic:
        'CDNからの読み込みでSRIが欠落している場合はhigh（cdn_without_sri）、それ以外はmedium。crossorigin属性の欠落は追加リスクフラグ（missing_crossorigin）として記録。',
    },
    response: [
      {
        title: 'リソースの確認',
        description:
          'アラート詳細のresourceUrl、resourceDomain、resourceTypeを確認し、どのCDNリソースにSRIが欠落しているか特定します。',
      },
      {
        title: 'リソースの正当性確認',
        description:
          '対象リソースが正規のライブラリ（jQuery、React等）であるか、バージョンが意図したものであるかを確認します。',
      },
      {
        title: 'SRIハッシュの生成',
        description:
          '正規リソースのSRIハッシュ（sha384等）を生成し、integrity属性として追加します。openssl dgst -sha384 -binary | openssl base64 で生成可能です。',
      },
      {
        title: 'crossorigin属性の追加',
        description:
          'SRIと併用するためcrossorigin="anonymous"属性を追加します。CORS対応のCDNであることを確認してください。',
      },
    ],
    prevention: [
      'すべてのCDNリソースにintegrity属性とcrossorigin="anonymous"を付与',
      'CSPのrequire-sri-forディレクティブでSRIを強制（対応ブラウザ限定）',
      'npm/yarn等のパッケージマネージャーでバンドルし、セルフホスティングを検討',
      'CDNリソースのバージョン固定（latest等の浮動バージョンを避ける）',
      'サプライチェーンセキュリティツール（Socket、Snyk等）による依存関係監査',
    ],
    falsePositives:
      'CDNリソースが静的HTMLに記述されているケースでは、ページ読み込み時のMutationObserver開始前に読み込まれるリソースは検出されないことがあります。また、自社ドメインと同一組織が運営するCDNが外部ドメインとして誤判定される場合があります。',
    relatedAlerts: ['csp_violation', 'xss_injection', 'extension'],
  },
];

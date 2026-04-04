export type PlaybookSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface DetectionLogic {
  /** 検知メカニズムの概要 */
  mechanism: string;
  /** 監視対象のブラウザAPI */
  monitoredAPIs: string[];
  /** アラート発火条件 */
  triggerConditions: string[];
  /** 重大度の決定ロジック */
  severityLogic: string;
}

export interface PlaybookStep {
  title: string;
  description: string;
}

export interface PlaybookData {
  /** アラートカテゴリID (AlertCategory と一致) */
  id: string;
  /** 表示名 */
  title: string;
  /** デフォルト重大度 */
  severity: PlaybookSeverity;
  /** 脅威の概要説明 */
  description: string;
  /** MITRE ATT&CK テクニックID (該当する場合) */
  mitreAttack?: string[];
  /** 検知ロジックの詳細 */
  detection: DetectionLogic;
  /** インシデント対応プレイブック */
  response: PlaybookStep[];
  /** 予防策 */
  prevention: string[];
  /** 誤検知の可能性と対処 */
  falsePositives: string;
  /** 関連アラートID */
  relatedAlerts?: string[];
}

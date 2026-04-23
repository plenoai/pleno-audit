import type { DashboardData } from "../data";
import { Badge, Dot, Icon, PageHeader, RiskBarScore } from "../components/ui";

export const CompliancePage = ({ data }: { data: DashboardData }) => (
  <>
    <PageHeader
      title="コンプライアンス"
      kicker="EVIDENCE & FRAMEWORKS"
      sub="ZTBS/BDR/CASB制御をフレームワークにマッピング。監査証跡を自動収集しエビデンスを常時整合。"
      actions={<>
        <button type="button" className="btn"><Icon name="download" size={12} /> 監査パッケージ</button>
        <button type="button" className="btn accent"><Icon name="file-check" size={12} /> エビデンス同期</button>
      </>}
    />
    <div className="page-body">
      <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 16 }}>
        {data.compliance.map(c => {
          const sev: "success" | "info" | "warning" = c.score >= 90 ? "success" : c.score >= 80 ? "info" : "warning";
          return (
            <div key={c.framework} className="card">
              <div className="card-hd">
                <h3>{c.framework}</h3>
                <Badge variant={sev}>{c.score}%</Badge>
              </div>
              <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <RiskBarScore value={c.score} color={`var(--${sev})`} />
                <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", gap: 6, fontSize: 11 }}>
                  <div className="col" style={{ gap: 2 }}>
                    <span className="metric-label">制御</span>
                    <span className="mono tabular" style={{ fontSize: 14 }}>{c.controls}</span>
                  </div>
                  <div className="col" style={{ gap: 2 }}>
                    <span className="metric-label" style={{ color: "var(--success-foreground)" }}>合格</span>
                    <span className="mono tabular" style={{ fontSize: 14 }}>{c.passing}</span>
                  </div>
                  <div className="col" style={{ gap: 2 }}>
                    <span className="metric-label" style={{ color: "var(--warning-foreground)" }}>部分</span>
                    <span className="mono tabular" style={{ fontSize: 14 }}>{c.partial}</span>
                  </div>
                  <div className="col" style={{ gap: 2 }}>
                    <span className="metric-label" style={{ color: "var(--danger-foreground)" }}>不合格</span>
                    <span className="mono tabular" style={{ fontSize: 14 }}>{c.failing}</span>
                  </div>
                </div>
                <div className="row" style={{ justifyContent: "space-between", fontSize: 11, color: "var(--muted-foreground)", borderTop: "1px solid var(--border-light)", paddingTop: 8 }}>
                  <span>次回監査</span>
                  <span className="mono">{c.audit}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="card-hd"><h3>制御マッピング (SOC 2 Type II · 抜粋)</h3><span className="hd-meta">AUTO-EVIDENCE</span></div>
        <div className="list-hd" style={{ gridTemplateColumns: "100px 1.5fr 1fr 90px 120px 90px", borderRadius: 0 }}>
          <span>制御ID</span><span>要件</span><span>Pleno機能</span><span>状態</span><span>最終検証</span><span>エビデンス</span>
        </div>
        {([
          ["CC6.1", "論理アクセス制御", "アイデンティティ + MFA強制", "success", "2026/4/22", 14],
          ["CC6.6", "エンドポイント保護", "BDRエージェント + EDR連携", "success", "2026/4/22", 82],
          ["CC6.7", "データ転送中の保護", "DLPルール + ブラウザ隔離", "success", "2026/4/23", 38],
          ["CC7.2", "異常検出", "BDR + 行動分析", "warning", "2026/4/21", 24],
          ["CC7.3", "インシデント対応", "XSOAR連携 + 自動隔離", "success", "2026/4/23", 12],
        ] as const).map((r, i) => (
          <div key={i} className="list-row" style={{ gridTemplateColumns: "100px 1.5fr 1fr 90px 120px 90px" }}>
            <span className="mono">{r[0]}</span>
            <span style={{ fontWeight: 500, fontSize: 12 }}>{r[1]}</span>
            <span className="muted" style={{ fontSize: 12 }}>{r[2]}</span>
            <Badge variant={r[3] as "success" | "warning"}>{r[3] === "success" ? "合格" : "要対応"}</Badge>
            <span className="mono muted" style={{ fontSize: 11 }}>{r[4]}</span>
            <span className="row" style={{ gap: 4 }}><Icon name="file-text" size={11} color="muted" /><span className="mono tabular">{r[5]}</span></span>
          </div>
        ))}
      </div>
    </div>
  </>
);

export const IntegrationsPage = ({ data }: { data: DashboardData }) => (
  <>
    <PageHeader
      title="統合 & コネクタ"
      kicker="INTEGRATIONS"
      sub="SIEM、SOAR、EDR、IdP、MDM、通知チャネルへの双方向連携。イベントはローカル処理後、メタデータのみ同期。"
      actions={<>
        <button type="button" className="btn"><Icon name="book" size={12} /> APIドキュメント</button>
        <button type="button" className="btn accent"><Icon name="plug" size={12} /> 新規接続</button>
      </>}
    />
    <div className="page-body">
      <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {data.integrations.map(it => (
          <div key={it.name} className="card">
            <div style={{ padding: 14, display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--tertiary)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name={intIcon(it.icon)} size={18} />
              </div>
              <div className="grow">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 500 }}>{it.name}</span>
                  <Badge variant={it.status === "接続" ? "success" : "default"}>
                    {it.status === "接続" && <Dot color="var(--success)" size={5} />}
                    {it.status}
                  </Badge>
                </div>
                <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{it.cat}</div>
                <div className="row" style={{ justifyContent: "space-between", marginTop: 10, fontSize: 11 }}>
                  <span className="muted">イベント/日</span>
                  <span className="mono tabular">{it.events}</span>
                </div>
                <div className="row" style={{ justifyContent: "space-between", marginTop: 2, fontSize: 11 }}>
                  <span className="muted">接続日</span>
                  <span className="mono">{it.since}</span>
                </div>
              </div>
            </div>
          </div>
        ))}

        <div className="card" style={{ padding: 14, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 130, border: "1px dashed var(--border)", background: "transparent", cursor: "pointer" }}>
          <div className="col" style={{ alignItems: "center", gap: 6 }}>
            <Icon name="plus" size={20} color="muted" />
            <span className="muted" style={{ fontSize: 12 }}>統合を追加</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-hd"><h3>データフロー</h3><span className="hd-meta">LOCAL-FIRST · METADATA ONLY</span></div>
        <div className="card-body">
          <div className="row" style={{ justifyContent: "space-between", gap: 20, padding: "10px 0" }}>
            <div className="col" style={{ alignItems: "center", gap: 6, flex: 1 }}>
              <div style={{ width: 52, height: 52, borderRadius: 10, background: "var(--accent-bg)", border: "1px solid var(--accent-border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="monitor" size={22} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>ブラウザ (拡張機能)</div>
              <div className="muted" style={{ fontSize: 11 }}>ローカル解析 · 暗号化</div>
            </div>
            <Icon name="arrow-right" size={16} color="muted" />
            <div className="col" style={{ alignItems: "center", gap: 6, flex: 1 }}>
              <div style={{ width: 52, height: 52, borderRadius: 10, background: "var(--tertiary)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="server" size={22} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>Plenoコントロールプレーン</div>
              <div className="muted" style={{ fontSize: 11 }}>メタデータのみ · 生データ非保存</div>
            </div>
            <Icon name="arrow-right" size={16} color="muted" />
            <div className="col" style={{ alignItems: "center", gap: 6, flex: 1 }}>
              <div style={{ width: 52, height: 52, borderRadius: 10, background: "var(--tertiary)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="activity" size={22} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>SIEM / SOAR / EDR</div>
              <div className="muted" style={{ fontSize: 11 }}>双方向連携 · エンリッチメント</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </>
);

function intIcon(pascal: string): string {
  const map: Record<string, string> = {
    Activity: "activity",
    Shield: "shield",
    Key: "key",
    Workflow: "workflow",
    Smartphone: "smartphone",
    MessageSquare: "message-square",
    Bell: "bell",
    Settings: "settings",
  };
  return map[pascal] ?? "plug";
}

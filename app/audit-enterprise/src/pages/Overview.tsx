import type { DashboardData } from "../data";
import { Badge, Dot, Heatmap, Icon, Metric, PageHeader, RiskBarScore, Sev, Sparkline } from "../components/ui";

export type RiskViz = "bar" | "heatmap";

export const OverviewPage = ({ data, riskViz }: { data: DashboardData; riskViz: RiskViz }) => {
  const d = data;
  return (
    <>
      <PageHeader
        title="セキュリティ概要"
        kicker="OVERVIEW"
        sub="ゼロトラスト・ブラウザセキュリティのリアルタイム姿勢。BDR / CASB / 拡張機能リスクを統合した経営ダッシュボード。"
        actions={
          <>
            <div className="seg">
              <button type="button" className="active">24時間</button>
              <button type="button">7日</button>
              <button type="button">30日</button>
            </div>
            <button type="button" className="btn"><Icon name="download" size={12} /> エクスポート</button>
            <button type="button" className="btn accent"><Icon name="file-text" size={12} /> 経営レポート</button>
          </>
        }
      />
      <div className="page-body">
        <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 16 }}>
          <Metric label="24h アラート" value={d.stats.alerts24h} delta={d.stats.alertsDelta} sub="前日比" spark={[12, 14, 11, 9, 18, 22, 15, 19, 14, 11, 8, 12]} />
          <Metric label="ブロック済" value={d.stats.blocked24h} delta={d.stats.blockedDelta} sub="ポリシー+BDR" spark={[4, 6, 8, 11, 9, 14, 18, 22, 19, 24, 28, 34]} />
          <Metric label="漏洩疑い" value={d.stats.exfilEvents} delta={d.stats.exfilDelta} sub="PII/機密" spark={[3, 4, 6, 5, 8, 7, 9, 11, 8, 10, 9, 11]} />
          <Metric label="MTTR" value={d.stats.mttrMin} unit="分" delta={d.stats.mttrDelta} sub="平均対応時間" spark={[22, 19, 18, 20, 17, 15, 16, 14, 15, 13, 14, 14]} />
        </div>

        <div className="grid" style={{ gridTemplateColumns: "320px 1fr 1fr", marginBottom: 16 }}>
          <div className="card">
            <div className="card-hd">
              <h3>組織リスクスコア</h3>
              <span className="hd-meta">{riskViz.toUpperCase()}</span>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <RiskViz kind={riskViz} value={d.risk.score} data={d.risk.trend} />
              <div style={{ textAlign: "center" }}>
                <div className="row" style={{ gap: 6, justifyContent: "center" }}>
                  <Badge variant="warning">{d.risk.grade}</Badge>
                  <span className="metric-delta up">▲ {d.risk.scoreDelta} (24h)</span>
                </div>
                <div className="pleno-small" style={{ marginTop: 6 }}>
                  14 critical · 87 high · 342 medium
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-hd">
              <h3>リスク分解</h3>
              <span className="hd-meta">重み付きスコア</span>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {d.risk.breakdown.map(b => (
                <div key={b.key} className="col" style={{ gap: 4 }}>
                  <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
                    <span>{b.label}</span>
                    <span className="mono muted">w {b.weight}% · <span style={{ color: "var(--foreground)" }}>{b.score}</span></span>
                  </div>
                  <RiskBarScore value={b.score} />
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-hd">
              <h3>14日間トレンド</h3>
              <span className="hd-meta">LAST UPDATED 09:14</span>
            </div>
            <div className="card-body" style={{ padding: 10 }}>
              <TrendChart data={d.risk.trend} />
              <div className="row" style={{ marginTop: 12, gap: 16, flexWrap: "wrap", fontSize: 11 }}>
                <Legend color="var(--danger)" label="critical + high" />
                <Legend color="var(--warning)" label="medium" />
                <Legend color="var(--info)" label="info" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
          <div className="card">
            <div className="card-hd">
              <h3>優先度の高い脅威</h3>
              <span className="hd-meta">CVSS × 到達性 × 資産価値</span>
            </div>
            <div>
              {d.topThreats.map((t, i) => (
                <div key={t.id} className="list-row" style={{ gridTemplateColumns: "80px 70px 1fr 160px 90px 30px", borderBottom: i === d.topThreats.length - 1 ? "none" : undefined }}>
                  <span className="mono muted" style={{ fontSize: 11 }}>{t.id}</span>
                  <Sev level={t.sev} />
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{t.title}</div>
                    <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{t.asset}</div>
                  </div>
                  <Sparkline data={t.trend} width={150} height={22} color="var(--danger)" fill />
                  <span className="mono tabular" style={{ fontSize: 12 }}>{t.count.toLocaleString()} 件</span>
                  <Icon name="chevron-right" size={14} color="muted" />
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-hd">
              <h3>フリート姿勢</h3>
              <span className="hd-meta">{d.org.managedBrowsers.toLocaleString()} ブラウザ</span>
            </div>
            <div className="card-body">
              <PostureSummary />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const RiskViz = ({ kind, value, data }: { kind: RiskViz; value: number; data: number[] }) => {
  if (kind === "bar") {
    return (
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 6, padding: "16px 8px" }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="metric-val tabular" style={{ fontSize: 44 }}>{value}</span>
          <span className="muted" style={{ fontSize: 11, alignSelf: "flex-end", paddingBottom: 8 }}>/ 100</span>
        </div>
        <div style={{ position: "relative", height: 14, background: "var(--tertiary)", borderRadius: 7, overflow: "hidden", border: "1px solid var(--border)" }}>
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0, width: `${value}%`,
            background: "linear-gradient(90deg, var(--success) 0%, var(--info) 40%, var(--warning) 70%, var(--danger) 100%)",
          }} />
          <div style={{ position: "absolute", left: `${value}%`, top: -4, bottom: -4, width: 2, background: "var(--foreground)" }} />
        </div>
        <div className="row" style={{ justifyContent: "space-between", fontSize: 10, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}>
          <span>0 SAFE</span><span>40</span><span>60</span><span>80</span><span>100 CRIT</span>
        </div>
      </div>
    );
  }
  const seed = data.map(v => v / 100);
  const cells = Array.from({ length: 84 }, (_, i) => {
    const s = seed[i % seed.length];
    return Math.min(1, s + ((i * 0.13) % 0.4) - 0.15 + (value / 100) * 0.3);
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "8px 0" }}>
      <div style={{ fontSize: 40, fontWeight: 400, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{value}</div>
      <Heatmap data={cells} cols={14} rows={6} cellSize={14} />
      <div className="muted" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>14日 × 6カテゴリ</div>
    </div>
  );
};

const TrendChart = ({ data }: { data: number[] }) => {
  const w = 320, h = 120, pad = 8;
  let max = data[0];
  let min = data[0];
  for (const v of data) {
    if (v > max) max = v;
    if (v < min) min = v;
  }
  min -= 5;
  const step = (w - pad * 2) / (data.length - 1);
  const pts = data.map((d, i) => [pad + i * step, h - pad - ((d - min) / (max - min)) * (h - pad * 2)] as const);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0]},${h - pad} L${pts[0][0]},${h - pad} Z`;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
      {[0.25, 0.5, 0.75].map(t => (
        <line key={t} x1={pad} x2={w - pad} y1={pad + (h - pad * 2) * t} y2={pad + (h - pad * 2) * t} stroke="var(--border-light)" />
      ))}
      <path d={area} fill="var(--accent)" opacity="0.1" />
      <path d={line} stroke="var(--accent)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {pts.map((p, i) => i === pts.length - 1 && (
        <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="var(--accent)" stroke="var(--background)" strokeWidth="1.5" />
      ))}
    </svg>
  );
};

const Legend = ({ color, label }: { color: string; label: string }) => (
  <span className="row" style={{ gap: 5 }}>
    <span className="dot" style={{ background: color }} />
    <span className="muted">{label}</span>
  </span>
);

const PostureSummary = () => {
  const rows = [
    { label: "最新バージョン", value: 48290, pct: 0.826, status: "success" },
    { label: "古いバージョン", value: 7842, pct: 0.134, status: "warning" },
    { label: "EoL / 未パッチ", value: 2300, pct: 0.04, status: "danger" },
  ];
  const extRows = [
    { label: "承認済み拡張", value: 41822, status: "success" },
    { label: "レビュー待ち", value: 208, status: "warning" },
    { label: "禁止対象", value: 14, status: "danger" },
  ];
  const regions: Array<[string, number, string]> = [
    ["APAC-TYO", 22140, "success"],
    ["APAC-SIN", 14428, "success"],
    ["NA-IAD", 12984, "warning"],
    ["EU-FRA", 8880, "success"],
  ];
  return (
    <div className="col" style={{ gap: 14 }}>
      <div>
        <div className="metric-label" style={{ marginBottom: 8 }}>ブラウザバージョン</div>
        <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", border: "1px solid var(--border)" }}>
          {rows.map(r => (
            <div key={r.label} style={{ flex: r.pct, background: `var(--${r.status})` }} />
          ))}
        </div>
        <div className="col" style={{ marginTop: 10, gap: 4 }}>
          {rows.map(r => (
            <div key={r.label} className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
              <span className="row" style={{ gap: 6 }}><Dot color={`var(--${r.status})`} /> {r.label}</span>
              <span className="mono tabular">{r.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: 12 }}>
        <div className="metric-label" style={{ marginBottom: 8 }}>拡張機能</div>
        <div className="col" style={{ gap: 4 }}>
          {extRows.map(r => (
            <div key={r.label} className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
              <span className="row" style={{ gap: 6 }}><Dot color={`var(--${r.status})`} /> {r.label}</span>
              <span className="mono tabular">{r.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: 12 }}>
        <div className="metric-label" style={{ marginBottom: 8 }}>リージョン分布</div>
        <div className="col" style={{ gap: 4 }}>
          {regions.map(([r, n, s]) => (
            <div key={r} className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
              <span className="mono" style={{ fontSize: 11 }}>{r}</span>
              <span className="row" style={{ gap: 6 }}>
                <span className="mono tabular muted">{n.toLocaleString()}</span>
                <Dot color={`var(--${s})`} size={6} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

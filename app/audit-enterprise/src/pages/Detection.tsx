import { useState } from "react";
import type { DashboardData, Severity } from "../data";
import { Badge, Dot, Icon, Metric, PageHeader, RiskBarScore, Sev } from "../components/ui";

export const AlertsPage = ({ data }: { data: DashboardData }) => {
  const [selected, setSelected] = useState(data.alerts[0].id);
  const [sev, setSev] = useState<"all" | Severity>("all");
  const sel = data.alerts.find(a => a.id === selected);
  const filtered = sev === "all" ? data.alerts : data.alerts.filter(a => a.sev === sev);
  const counts = data.alerts.reduce<Record<string, number>>((acc, a) => {
    acc[a.sev] = (acc[a.sev] || 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title="アラート & BDR"
        kicker="BROWSER DETECTION & RESPONSE"
        sub="ブラウザ内で発生した異常を一元化。Mandiant式のトリアージワークフローと対応アクションを統合。"
        actions={<>
          <button type="button" className="btn"><Icon name="filter" size={12} /> 高度フィルタ</button>
          <button type="button" className="btn"><Icon name="rss" size={12} /> ライブ</button>
          <button type="button" className="btn accent"><Icon name="plus" size={12} /> ケース作成</button>
        </>}
      />
      <div className="page-body" style={{ padding: 0, display: "flex", flex: 1, minHeight: 0 }}>
        <div style={{ width: 540, borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", background: "var(--background)" }}>
          <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" className={`chip ${sev === "all" ? "active" : ""}`} onClick={() => setSev("all")}>全て ({data.alerts.length})</button>
            <button type="button" className={`chip ${sev === "critical" ? "active" : ""}`} onClick={() => setSev("critical")}>
              <Dot color="var(--danger)" size={6} /> critical ({counts.critical || 0})
            </button>
            <button type="button" className={`chip ${sev === "high" ? "active" : ""}`} onClick={() => setSev("high")}>
              <Dot color="var(--warning)" size={6} /> high ({counts.high || 0})
            </button>
            <button type="button" className={`chip ${sev === "medium" ? "active" : ""}`} onClick={() => setSev("medium")}>medium ({counts.medium || 0})</button>
            <button type="button" className={`chip ${sev === "info" ? "active" : ""}`} onClick={() => setSev("info")}>info ({counts.info || 0})</button>
          </div>
          <div style={{ overflow: "auto", flex: 1 }}>
            {filtered.map(a => (
              <div key={a.id}
                onClick={() => setSelected(a.id)}
                style={{
                  padding: "12px 16px", borderBottom: "1px solid var(--border-light)", cursor: "pointer",
                  background: selected === a.id ? "var(--secondary)" : "var(--background)",
                  borderLeft: selected === a.id ? "2px solid var(--accent)" : "2px solid transparent",
                }}>
                <div className="row" style={{ gap: 6, marginBottom: 4 }}>
                  <Sev level={a.sev} />
                  <Badge variant="info">{a.cat}</Badge>
                  <span className="spacer" />
                  <span className="mono muted" style={{ fontSize: 11 }}>{a.id} · {a.ts}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3 }}>{a.title}</div>
                <div className="muted" style={{ fontSize: 11 }}>{a.asset}</div>
                <div className="row" style={{ marginTop: 6, gap: 6 }}>
                  <Badge variant={a.state === "ブロック済" ? "success" : a.state === "新規" ? "danger" : "default"}>{a.state}</Badge>
                  <span className="muted mono" style={{ fontSize: 11 }}>→ {a.dst}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
          {sel && <AlertDetail alert={sel} />}
        </div>
      </div>
    </>
  );
};

const AlertDetail = ({ alert: a }: { alert: DashboardData["alerts"][number] }) => (
  <div className="col" style={{ gap: 14 }}>
    <div className="row" style={{ gap: 8, alignItems: "flex-start" }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--danger-bg)", border: "1px solid var(--danger-border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon name="siren" size={18} />
      </div>
      <div className="grow">
        <div className="row" style={{ gap: 6, marginBottom: 4 }}>
          <Sev level={a.sev} /><Badge variant="info">{a.cat}</Badge>
          <span className="mono muted" style={{ fontSize: 11 }}>{a.id}</span>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 500, letterSpacing: "-0.01em" }}>{a.title}</h2>
        <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{a.asset} · {a.ts} · → <span className="mono">{a.dst}</span></div>
      </div>
      <div className="row" style={{ gap: 6 }}>
        <button type="button" className="btn"><Icon name="user-plus" size={12} /> アサイン</button>
        <button type="button" className="btn accent"><Icon name="play" size={12} /> 調査</button>
      </div>
    </div>

    <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
      {[
        ["MITRE ATT&CK", "T1059.007", "JavaScript"],
        ["信頼度", "94%", "高"],
        ["CVSS", "9.1", "Critical"],
        ["最初の検出", "09:12:44", "38秒前"],
      ].map(([l, v, s]) => (
        <div key={l} className="card" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 2, minHeight: 74 }}>
          <div className="metric-label" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l}</div>
          <div style={{ fontSize: 17, fontWeight: 400, letterSpacing: "-0.01em", lineHeight: 1.2, marginTop: "auto" }}>{v}</div>
          <div className="muted" style={{ fontSize: 11, lineHeight: 1.3 }}>{s}</div>
        </div>
      ))}
    </div>

    <div className="card">
      <div className="card-hd"><h3>証跡 (Evidence)</h3><span className="hd-meta">RAW EVENT</span></div>
      <pre style={{ padding: 14, fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.6, color: "var(--muted-foreground)", overflowX: "auto" }}>
{`{
  "alertId": "${a.id}",
  "timestamp": "2026-04-23T09:12:44.238Z",
  "severity": "${a.sev}",
  "category": "${a.cat}",
  "asset": { "id": "BR-0006", "user": "wong.chenxi@sh.com.sg", "browser": "Brave 1.72.123" },
  "detection": {
    "rule": "BDR-V8-TYPE-CONFUSION",
    "cve": "CVE-2026-3091",
    "technique": "T1059.007",
    "confidence": 0.94
  },
  "action": "isolate_session",
  "destination": "${a.dst}",
  "dataClasses": ["pii", "financial"],
  "enrichment": {
    "threatFeed": "mandiant-apt41-indicators",
    "firstSeenGlobal": "2026-04-12T14:22:00Z"
  }
}`}
      </pre>
    </div>

    <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <div className="card">
        <div className="card-hd"><h3>キルチェーン</h3></div>
        <div className="card-body">
          <div className="col" style={{ gap: 8 }}>
            {[
              { stage: "Recon", status: "done", ts: "09:10:21", detail: "サイト指紋採取 (WebGL)" },
              { stage: "Delivery", status: "done", ts: "09:11:42", detail: "悪質スクリプト配信" },
              { stage: "Exploit", status: "active", ts: "09:12:44", detail: "V8型混乱 (CVE-2026-3091)" },
              { stage: "C2", status: "pending", ts: "—", detail: "未確認" },
              { stage: "Exfil", status: "pending", ts: "—", detail: "未確認" },
            ].map(s => (
              <div key={s.stage} className="row" style={{ gap: 10 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: 50,
                  background: s.status === "active" ? "var(--danger)" : s.status === "done" ? "var(--muted-foreground)" : "var(--border)",
                }} />
                <div style={{ minWidth: 80, fontSize: 12, fontWeight: s.status === "active" ? 500 : 400 }}>{s.stage}</div>
                <div className="muted" style={{ fontSize: 11, flex: 1 }}>{s.detail}</div>
                <span className="mono muted" style={{ fontSize: 10 }}>{s.ts}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-hd"><h3>対応アクション</h3></div>
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button type="button" className="btn danger" style={{ justifyContent: "flex-start" }}><Icon name="shield-off" size={12} /> ブラウザセッションを隔離</button>
          <button type="button" className="btn" style={{ justifyContent: "flex-start" }}><Icon name="key-round" size={12} /> 全セッショントークンを失効</button>
          <button type="button" className="btn" style={{ justifyContent: "flex-start" }}><Icon name="ban" size={12} /> {a.dst} を組織全体でブロック</button>
          <button type="button" className="btn" style={{ justifyContent: "flex-start" }}><Icon name="user-x" size={12} /> ユーザーのSSOを強制ログアウト</button>
          <button type="button" className="btn" style={{ justifyContent: "flex-start" }}><Icon name="send" size={12} /> XSOARにエスカレーション</button>
          <div style={{ padding: "8px 10px", background: "var(--info-bg)", border: "1px solid var(--info-border)", borderRadius: 6, fontSize: 11, color: "var(--info-foreground)", marginTop: 4 }}>
            <Icon name="info" size={10} /> 自動プレイブック「V8-RCE-Contain」を実行可能
          </div>
        </div>
      </div>
    </div>
  </div>
);

export const InvestigationPage = () => {
  const [t, setT] = useState(34);
  const events: Array<{ ts: string; pos: number; sev: Severity; title: string; detail: string }> = [
    { ts: "09:09:10", pos: 5, sev: "info", title: "ユーザーがbrowserを起動", detail: "Brave 1.72.123 · BR-0006" },
    { ts: "09:10:21", pos: 14, sev: "info", title: "salesforce.comにログイン", detail: "SSO via Okta · OAuth grant" },
    { ts: "09:10:58", pos: 22, sev: "medium", title: "WebGL指紋採取検出", detail: "unknown-cdn.io/fp.js" },
    { ts: "09:11:42", pos: 28, sev: "high", title: "悪質スクリプト読込", detail: "unknown-cdn.io/sw.js · SHA: 4a8e...b2" },
    { ts: "09:12:44", pos: 34, sev: "critical", title: "V8型混乱のエクスプロイト試行", detail: "CVE-2026-3091 · document.body構造破壊" },
    { ts: "09:13:05", pos: 40, sev: "critical", title: "Cookie窃取: document.cookie", detail: "Salesforce + Notion sessionCookie" },
    { ts: "09:13:28", pos: 46, sev: "critical", title: "外部送信: hxxps://unknown-cdn.io/c.gif", detail: "4.2KB · Base64エンコード" },
    { ts: "09:14:02", pos: 55, sev: "high", title: "ダウンロード: accounts_q1.csv", detail: "218MB · salesforce.com" },
    { ts: "09:14:38", pos: 62, sev: "info", title: "Plenoが自動隔離を実行", detail: "セッション失効 · サイトブロック" },
  ];

  return (
    <>
      <PageHeader
        title="フォレンジック調査"
        kicker="SESSION REPLAY · CASE SH-2026-0423-001"
        sub="Mandiantスタイルのタイムライン再生。ブラウザ上で発生した全イベントを再構築し、証跡とキルチェーンを照合。"
        actions={<>
          <button type="button" className="btn"><Icon name="download" size={12} /> IOCエクスポート</button>
          <button type="button" className="btn"><Icon name="file-text" size={12} /> PDFレポート</button>
          <button type="button" className="btn accent"><Icon name="git-branch" size={12} /> グラフに表示</button>
        </>}
      />
      <div className="page-body">
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-hd">
            <h3>ケース: wong.chenxi@sh.com.sg · BR-0006 (Brave)</h3>
            <span className="row" style={{ gap: 8 }}>
              <Badge variant="danger">active</Badge>
              <Badge variant="accent">割当: J. Park (Tier2)</Badge>
              <span className="mono muted" style={{ fontSize: 11 }}>2026/4/23 09:09 - 09:15 (6分)</span>
            </span>
          </div>
          <div style={{ padding: 16 }}>
            <ReplayTimeline events={events} t={t} onT={setT} />
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: "1.2fr 1fr", gap: 14 }}>
          <div className="card">
            <div className="card-hd"><h3>イベントログ</h3><span className="hd-meta">{events.length} EVENTS</span></div>
            <div>
              {events.map((e, i) => {
                const active = Math.abs(e.pos - t) < 3;
                return (
                  <div key={i} className="list-row" onClick={() => setT(e.pos)}
                    style={{
                      gridTemplateColumns: "60px 70px 1fr", padding: "10px 14px", fontSize: 12,
                      background: active ? "var(--accent-bg)" : undefined,
                      borderBottom: i === events.length - 1 ? "none" : undefined,
                    }}>
                    <span className="mono muted" style={{ fontSize: 11 }}>{e.ts}</span>
                    <Sev level={e.sev} />
                    <div>
                      <div style={{ fontWeight: active ? 500 : 400 }}>{e.title}</div>
                      <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{e.detail}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="col" style={{ gap: 14 }}>
            <div className="card">
              <div className="card-hd"><h3>IOC (indicators of compromise)</h3></div>
              <div className="card-body" style={{ fontSize: 12, fontFamily: "var(--font-mono)", lineHeight: 1.8 }}>
                <div className="row" style={{ gap: 6 }}><Badge variant="danger">DOMAIN</Badge><span>unknown-cdn.io</span></div>
                <div className="row" style={{ gap: 6 }}><Badge variant="danger">URL</Badge><span>hxxps://unknown-cdn.io/sw.js</span></div>
                <div className="row" style={{ gap: 6 }}><Badge variant="danger">SHA256</Badge><span>4a8e...b2cf</span></div>
                <div className="row" style={{ gap: 6 }}><Badge variant="warning">CVE</Badge><span>CVE-2026-3091</span></div>
                <div className="row" style={{ gap: 6 }}><Badge variant="warning">TTP</Badge><span>T1059.007 · T1539</span></div>
              </div>
            </div>

            <div className="card">
              <div className="card-hd"><h3>関連アセット</h3></div>
              <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                {["wong.chenxi@sh.com.sg (user)", "BR-0006 (browser)", "salesforce.com (SaaS)", "notion.so (SaaS)", "unknown-cdn.io (threat)"].map(x => (
                  <div key={x} className="row" style={{ justifyContent: "space-between" }}>
                    <span>{x}</span>
                    <Icon name="external-link" size={11} color="muted" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const ReplayTimeline = ({
  events, t, onT,
}: {
  events: Array<{ ts: string; pos: number; sev: Severity; title: string }>;
  t: number;
  onT: (n: number) => void;
}) => (
  <div>
    <div style={{ position: "relative", height: 54, marginBottom: 10 }}>
      <div style={{ position: "absolute", inset: "20px 0 20px 0", background: "var(--tertiary)", borderRadius: 3, border: "1px solid var(--border)" }} />
      {events.map((e, i) => {
        const color = e.sev === "critical" ? "var(--danger)" : e.sev === "high" ? "var(--warning)" : e.sev === "medium" ? "var(--info)" : "var(--muted-foreground)";
        return (
          <div key={i} onClick={() => onT(e.pos)} title={`${e.ts} ${e.title}`}
            style={{ position: "absolute", left: `calc(${e.pos}% - 4px)`, top: 14, width: 8, height: 26, background: color, borderRadius: 2, cursor: "pointer", border: "1px solid var(--background)" }} />
        );
      })}
      <div style={{ position: "absolute", left: `calc(${t}% - 1px)`, top: 4, bottom: 4, width: 2, background: "var(--foreground)" }}>
        <div style={{ position: "absolute", top: -6, left: -5, width: 12, height: 12, background: "var(--foreground)", borderRadius: 2, transform: "rotate(45deg)" }} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}>
        <span>09:09:10</span><span>09:11:00</span><span>09:13:00</span><span>09:15:00</span>
      </div>
    </div>
    <div className="row" style={{ gap: 8 }}>
      <button type="button" className="btn sm"><Icon name="skip-back" size={11} /></button>
      <button type="button" className="btn sm primary"><Icon name="play" size={11} /></button>
      <button type="button" className="btn sm"><Icon name="skip-forward" size={11} /></button>
      <input type="range" min={0} max={100} value={t} onChange={e => onT(+e.target.value)} style={{ flex: 1 }} />
      <span className="mono" style={{ fontSize: 12 }}>09:{String(9 + Math.floor(t / 20)).padStart(2, "0")}:{String(Math.floor((t % 20) * 3)).padStart(2, "0")}</span>
    </div>
  </div>
);

export const ExfilPage = ({ data }: { data: DashboardData }) => (
  <>
    <PageHeader
      title="データ漏洩モニター"
      kicker="EXFIL MONITOR"
      sub="貼り付け、アップロード、フォーム送信、ダウンロードの全チャネルを監視。AIプロンプトへの機密投入を含む。"
      actions={<>
        <button type="button" className="btn"><Icon name="filter" size={12} /> フィルタ</button>
        <button type="button" className="btn accent"><Icon name="shield" size={12} /> DLPルール編集</button>
      </>}
    />
    <div className="page-body">
      <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 16 }}>
        <Metric label="24h 漏洩イベント" value={64} delta={+8} spark={[4, 6, 5, 8, 7, 9, 11, 12]} />
        <Metric label="ブロック済" value={42} delta={+14} spark={[2, 3, 4, 5, 6, 7, 8, 9]} />
        <Metric label="AI宛 (chatgpt/claude)" value={284} delta={+52} sub="前日比" spark={[20, 30, 45, 60, 88, 120, 180, 284]} />
        <Metric label="保護データ量" value="2.8" unit="GB" delta={+12} spark={[1, 2, 2, 3, 3, 4, 5, 6]} />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-hd"><h3>漏洩チャネル別分布 (24h)</h3><span className="hd-meta">LAST 24H</span></div>
        <div className="card-body" style={{ display: "flex", gap: 24, alignItems: "flex-end" }}>
          {[
            { ch: "AIプロンプト", n: 284, c: "var(--danger)" },
            { ch: "貼り付け", n: 112, c: "var(--warning)" },
            { ch: "ダウンロード", n: 68, c: "var(--warning)" },
            { ch: "フォーム送信", n: 42, c: "var(--info)" },
            { ch: "アップロード", n: 34, c: "var(--info)" },
            { ch: "印刷", n: 18, c: "var(--muted-foreground)" },
            { ch: "クリップボード", n: 14, c: "var(--muted-foreground)" },
          ].map(({ ch, n, c }) => (
            <div key={ch} style={{ flex: 1, textAlign: "center" }}>
              <div className="mono" style={{ fontSize: 18, fontWeight: 400, letterSpacing: "-0.01em" }}>{n}</div>
              <div style={{ height: 80, background: "var(--tertiary)", borderRadius: 4, position: "relative", overflow: "hidden", marginTop: 6, border: "1px solid var(--border)" }}>
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: c, height: `${Math.min(100, (n / 284) * 100)}%`, borderRadius: "0 0 3px 3px" }} />
              </div>
              <div className="muted" style={{ fontSize: 10, marginTop: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{ch}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="list">
        <div className="list-hd" style={{ gridTemplateColumns: "80px 100px 120px 140px 100px 100px 1fr 100px" }}>
          <span>時刻</span><span>ユーザー</span><span>チャネル</span><span>送信先</span><span>種別</span><span>サイズ</span><span>データクラス</span><span>アクション</span>
        </div>
        {data.exfilEvents.map((e, i) => (
          <div key={i} className="list-row" style={{ gridTemplateColumns: "80px 100px 120px 140px 100px 100px 1fr 100px" }}>
            <span className="mono" style={{ fontSize: 11 }}>{e.ts}</span>
            <span>{e.actor}</span>
            <Badge variant={e.channel === "AIプロンプト" ? "danger" : "warning"}>{e.channel}</Badge>
            <span className="mono" style={{ fontSize: 11 }}>{e.dst}</span>
            <span className="muted" style={{ fontSize: 12 }}>{e.kind}</span>
            <span className="mono tabular">{e.bytes}</span>
            <span className="row" style={{ gap: 4 }}>{e.classes.map(c => <Badge key={c} variant="warning">{c}</Badge>)}</span>
            <Badge variant={e.action === "ブロック" ? "danger" : "info"}>{e.action}</Badge>
          </div>
        ))}
      </div>
    </div>
  </>
);

export const IdentityPage = ({ data }: { data: DashboardData }) => (
  <>
    <PageHeader
      title="アイデンティティ & セッション"
      kicker="IDENTITY RISK"
      sub="OAuthスコープ昇格、不可能な移動、MFAバイパス、トークン抜き出しを監視。IdPとの双方向同期。"
      actions={<>
        <button type="button" className="btn"><Icon name="key" size={12} /> 全セッション表示</button>
        <button type="button" className="btn accent"><Icon name="user-x" size={12} /> 強制ログアウト</button>
      </>}
    />
    <div className="page-body">
      <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 16 }}>
        <Metric label="アクティブセッション" value={41268} delta={-2} sub="4リージョン" />
        <Metric label="高リスクユーザー" value={184} delta={+8} sub="スコア >70" />
        <Metric label="OAuth昇格 (24h)" value={12} delta={+4} sub="要確認" />
        <Metric label="不可能な移動" value={7} delta={+2} sub="地理異常" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.5fr 1fr", gap: 14 }}>
        <div className="card">
          <div className="card-hd"><h3>リスクイベント</h3><span className="hd-meta">ACTIVE CASES</span></div>
          <div className="list-hd" style={{ gridTemplateColumns: "minmax(0, 1.6fr) 80px minmax(0, 1.2fr) minmax(0, 0.8fr) 70px minmax(0, 1.4fr)", borderRadius: 0 }}>
            <span>ユーザー</span><span>重要度</span><span>イベント</span><span>アプリ</span><span>時刻</span><span>詳細</span>
          </div>
          {data.identity.map((r, i) => {
            const [local, domain] = r.user.split("@");
            return (
              <div key={i} className="list-row" style={{ gridTemplateColumns: "minmax(0, 1.6fr) 80px minmax(0, 1.2fr) minmax(0, 0.8fr) 70px minmax(0, 1.4fr)" }}>
                <span className="row" style={{ gap: 8, minWidth: 0 }}>
                  <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 5, background: "var(--accent)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 500 }}>
                    {local.charAt(0).toUpperCase()}
                  </span>
                  <span className="col" style={{ gap: 0, minWidth: 0 }}>
                    <span className="ellip" style={{ fontSize: 12, fontWeight: 500 }}>{local}</span>
                    <span className="ellip muted mono" style={{ fontSize: 10 }}>@{domain}</span>
                  </span>
                </span>
                <Sev level={r.risk} />
                <span className="ellip" style={{ fontWeight: 500, fontSize: 12 }} title={r.event}>{r.event}</span>
                <span className="ellip muted" style={{ fontSize: 12 }}>{r.app}</span>
                <span className="mono" style={{ fontSize: 11 }}>{r.ts}</span>
                <span className="ellip muted mono" style={{ fontSize: 11 }} title={r.detail}>{r.detail}</span>
              </div>
            );
          })}
        </div>

        <div className="col" style={{ gap: 14 }}>
          <div className="card">
            <div className="card-hd"><h3>OAuth付与</h3><span className="hd-meta">HIGH SCOPE</span></div>
            <div className="card-body" style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                ["Notion", "workspace.admin, users:read", 14, "high"] as const,
                ["Slack", "channels:history, files:read", 8, "medium"] as const,
                ["GitHub", "repo, admin:org", 4, "high"] as const,
                ["Google Drive", "drive.file, drive.metadata.readonly", 42, "medium"] as const,
              ].map(([app, scope, n, sev]) => (
                <div key={app} className="col" style={{ gap: 3 }}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 500 }}>{app}</span>
                    <span className="row" style={{ gap: 6 }}><Badge variant={sev === "high" ? "danger" : "warning"}>{sev}</Badge><span className="mono tabular">{n}</span></span>
                  </div>
                  <div className="muted mono" style={{ fontSize: 10 }}>{scope}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-hd"><h3>MFA姿勢</h3></div>
            <div className="card-body">
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
                <span className="metric-val tabular" style={{ fontSize: 32 }}>94.2%</span>
                <div style={{ textAlign: "right" }}>
                  <div className="metric-delta down">▼ 0.4%</div>
                  <div className="muted" style={{ fontSize: 11 }}>48,288 / 51,204</div>
                </div>
              </div>
              <RiskBarScore value={94.2} color="var(--success)" />
              <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>2,916名がMFA未設定 · <span className="pleno-link">強制登録を実行</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </>
);

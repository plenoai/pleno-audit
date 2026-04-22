import { useState } from "react";
import type { DashboardData, Severity } from "../data";
import { Badge, Dot, Icon, Metric, PageHeader, RiskBarScore, Sev, Sparkline } from "../components/ui";

export const FleetPage = ({ data }: { data: DashboardData }) => {
  const [region, setRegion] = useState<string>("all");
  const [risk, setRisk] = useState<string>("all");
  const filtered = data.browsers.filter(b =>
    (region === "all" || b.region === region) &&
    (risk === "all" || b.risk === risk),
  );
  return (
    <>
      <PageHeader
        title="ブラウザフリート"
        kicker="FLEET INVENTORY"
        sub={`${data.org.managedBrowsers.toLocaleString()} 台の管理ブラウザ・${data.org.managedUsers.toLocaleString()} ユーザー。姿勢、パッチ状況、EDRエージェント連携を可視化。`}
        actions={<>
          <button type="button" className="btn"><Icon name="download" size={12} /> CSVエクスポート</button>
          <button type="button" className="btn accent"><Icon name="refresh-cw" size={12} /> 同期</button>
        </>}
      />
      <div className="page-body">
        <div className="row" style={{ gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <div className="seg">
            {["all", ...data.org.regions].map(r => (
              <button type="button" key={r} className={region === r ? "active" : ""} onClick={() => setRegion(r)}>{r === "all" ? "全リージョン" : r}</button>
            ))}
          </div>
          <div className="seg">
            {["all", "critical", "high", "medium", "low"].map(r => (
              <button type="button" key={r} className={risk === r ? "active" : ""} onClick={() => setRisk(r)}>{r === "all" ? "全リスク" : r}</button>
            ))}
          </div>
          <span className="muted mono" style={{ fontSize: 11, marginLeft: "auto" }}>{filtered.length} / {data.browsers.length} 表示</span>
        </div>

        <div className="list">
          <div className="list-hd" style={{ gridTemplateColumns: "80px 1fr 1.2fr 140px 140px 70px 90px 60px 80px 90px" }}>
            <span>ID</span><span>ホスト</span><span>ユーザー</span><span>OS</span><span>ブラウザ</span><span>リスク</span><span>アラート</span><span>拡張</span><span>最終</span><span>リージョン</span>
          </div>
          {filtered.map(b => (
            <div key={b.id} className="list-row" style={{ gridTemplateColumns: "80px 1fr 1.2fr 140px 140px 70px 90px 60px 80px 90px" }}>
              <span className="mono" style={{ fontSize: 11 }}>{b.id}</span>
              <span style={{ fontWeight: 500, fontSize: 12 }}>{b.host}</span>
              <span style={{ fontSize: 12 }}>{b.user}</span>
              <span className="muted mono" style={{ fontSize: 11 }}>{b.os}</span>
              <span className="muted mono" style={{ fontSize: 11 }}>{b.browser}</span>
              <Sev level={b.risk} />
              <span className="mono tabular">{b.alerts}</span>
              <span className="mono tabular muted">{b.ext}</span>
              <span className="muted" style={{ fontSize: 11 }}>{b.lastSeen}</span>
              <span className="mono" style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{b.region}</span>
            </div>
          ))}
        </div>

        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginTop: 16 }}>
          <div className="card">
            <div className="card-hd"><h3>EDR連携</h3><span className="hd-meta">CROWDSTRIKE</span></div>
            <div className="card-body"><div className="metric-val tabular">98.2%</div><div className="muted" style={{ fontSize: 11 }}>57,384 / 58,432 報告中</div><div style={{ marginTop: 8 }}><RiskBarScore value={98.2} color="var(--success)" /></div></div>
          </div>
          <div className="card">
            <div className="card-hd"><h3>ディスク暗号化</h3></div>
            <div className="card-body"><div className="metric-val tabular">99.7%</div><div className="muted" style={{ fontSize: 11 }}>FileVault / BitLocker</div><div style={{ marginTop: 8 }}><RiskBarScore value={99.7} color="var(--success)" /></div></div>
          </div>
          <div className="card">
            <div className="card-hd"><h3>DLPエージェント</h3></div>
            <div className="card-body"><div className="metric-val tabular">76.4%</div><div className="muted" style={{ fontSize: 11 }}>未導入: 13,790台</div><div style={{ marginTop: 8 }}><RiskBarScore value={76.4} color="var(--warning)" /></div></div>
          </div>
        </div>
      </div>
    </>
  );
};

export const ExtensionsPage = ({ data }: { data: DashboardData }) => (
  <>
    <PageHeader
      title="拡張機能リスク"
      kicker="EXTENSION GOVERNANCE"
      sub="組織内の全Chrome拡張機能を監査。権限スコープ、パブリッシャー検証、Chrome Web Store異常挙動を分析。"
      actions={<>
        <button type="button" className="btn"><Icon name="upload" size={12} /> 許可リストをインポート</button>
        <button type="button" className="btn accent"><Icon name="shield-check" size={12} /> 承認ポリシー</button>
      </>}
    />
    <div className="page-body">
      <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 16 }}>
        <Metric label="検出された拡張" value={1842} sub="ユニーク" />
        <Metric label="承認済" value={1624} sub="88%" />
        <Metric label="禁止対象" value={14} delta={+2} sub="要削除" />
        <Metric label="レビュー待ち" value={204} delta={+18} />
      </div>

      <div className="list">
        <div className="list-hd" style={{ gridTemplateColumns: "1.4fr 80px 90px 1fr 1fr 1fr" }}>
          <span>拡張機能</span><span>インストール</span><span>リスク</span><span>権限</span><span>パブリッシャー</span><span>備考</span>
        </div>
        {data.extensions.map((e, i) => (
          <div key={i} className="list-row" style={{ gridTemplateColumns: "1.4fr 80px 90px 1fr 1fr 1fr", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: 13 }}>{e.name}</div>
              <div className="muted mono" style={{ fontSize: 10, marginTop: 2 }}>{e.id}</div>
              <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>初検出: {e.firstSeen}</div>
            </div>
            <span className="mono tabular">{e.installs.toLocaleString()}</span>
            <Sev level={e.risk} />
            <span className="row" style={{ gap: 4, flexWrap: "wrap" }}>
              {e.perms.map(p => (
                <Badge key={p} variant={p === "<all_urls>" || p === "debugger" || p === "nativeMessaging" ? "danger" : "default"}>{p}</Badge>
              ))}
            </span>
            <span style={{ fontSize: 12 }}>{e.publisher}</span>
            <div>
              <Badge variant={e.status === "禁止対象" ? "danger" : e.status === "承認済" ? "success" : "warning"}>{e.status}</Badge>
              {e.note && <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{e.note}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  </>
);

export const SaasPage = ({ data }: { data: DashboardData }) => (
  <>
    <PageHeader
      title="SaaS & AI ディスカバリ"
      kicker="SHADOW IT · GENAI"
      sub="ブラウザから検出した全SaaSと生成AI利用を可視化。承認状態、機密度、AI宛データ送信量を追跡。"
      actions={<>
        <button type="button" className="btn"><Icon name="filter" size={12} /> フィルタ</button>
        <button type="button" className="btn accent"><Icon name="book-open" size={12} /> AI利用ポリシー</button>
      </>}
    />
    <div className="page-body">
      <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 16 }}>
        <Metric label="検出されたSaaS" value={418} delta={+34} sub="シャドーIT含む" />
        <Metric label="GenAI利用者" value={38420} delta={+1200} sub="過去30日" spark={[18000, 22000, 26000, 30000, 33000, 36000, 38420]} />
        <Metric label="AI宛データ送信" value="1.8" unit="GB" delta={+62} sub="24h" />
        <Metric label="未承認SaaS" value={42} delta={+4} sub="要レビュー" />
      </div>

      <div className="list">
        <div className="list-hd" style={{ gridTemplateColumns: "1.3fr 80px 90px 90px 80px 80px 80px 100px 80px" }}>
          <span>サービス</span><span>カテゴリ</span><span>承認</span><span>ユーザー</span><span>機密度</span><span>リスク</span><span>漏洩</span><span>AI送信</span><span>トレンド</span>
        </div>
        {data.saasApps.map((s, i) => (
          <div key={i} className="list-row" style={{ gridTemplateColumns: "1.3fr 80px 90px 90px 80px 80px 80px 100px 80px" }}>
            <span className="row" style={{ gap: 8, minWidth: 0 }}>
              <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 5, background: "var(--tertiary)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 500 }}>
                {s.name.charAt(0)}
              </span>
              <span className="ellip" style={{ fontWeight: 500 }}>{s.name}</span>
            </span>
            <Badge variant="default">{s.cat}</Badge>
            <Badge variant={s.sanction === "承認済" ? "success" : s.sanction === "条件付" ? "warning" : s.sanction === "禁止" ? "danger" : "default"}>{s.sanction}</Badge>
            <span className="mono tabular">{s.users.toLocaleString()}</span>
            <Sev level={s.sensitivity as Severity} />
            <Sev level={s.risk as Severity} />
            <span className="mono tabular">{s.exfil}</span>
            <span className="mono tabular" style={{ color: s.aiIngress > 200 ? "var(--danger-foreground)" : "var(--foreground)" }}>{s.aiIngress.toLocaleString()}</span>
            <Sparkline data={s.trend} width={60} height={20} color={s.risk === "critical" ? "var(--danger)" : "var(--accent)"} fill />
          </div>
        ))}
      </div>
    </div>
  </>
);

export const PolicyPage = ({ data }: { data: DashboardData }) => (
  <>
    <PageHeader
      title="ポリシーエンジン"
      kicker="CASB · DLP RULES"
      sub="ユーザーアクションとデータフローに対するリアルタイム制御。貼り付け、アップロード、フォーム送信、URLカテゴリを含む。"
      actions={<>
        <button type="button" className="btn"><Icon name="file-text" size={12} /> テンプレート</button>
        <button type="button" className="btn accent"><Icon name="plus" size={12} /> 新規ルール</button>
      </>}
    />
    <div className="page-body">
      <div className="grid" style={{ gridTemplateColumns: "1fr 320px", gap: 14, marginBottom: 16 }}>
        <div className="card">
          <div className="card-hd"><h3>アクティブルール</h3><span className="hd-meta">{data.policies.length} RULES</span></div>
          <div className="list-hd" style={{ gridTemplateColumns: "80px 1.5fr 1fr 1fr 80px 90px 70px", borderRadius: 0 }}>
            <span>ID</span><span>ルール名</span><span>スコープ</span><span>アクション</span><span>24h</span><span>最終</span><span>状態</span>
          </div>
          {data.policies.map(p => (
            <div key={p.id} className="list-row" style={{ gridTemplateColumns: "80px 1.5fr 1fr 1fr 80px 90px 70px" }}>
              <span className="mono" style={{ fontSize: 11 }}>{p.id}</span>
              <span style={{ fontWeight: 500, fontSize: 12 }}>{p.name}</span>
              <span className="muted" style={{ fontSize: 12 }}>{p.scope}</span>
              <span className="row" style={{ gap: 4 }}>
                <Badge variant={p.action.includes("ブロック") ? "danger" : "info"}>{p.action.split("+")[0]}</Badge>
                {p.action.includes("+") && <span className="muted" style={{ fontSize: 10 }}>+{p.action.split("+")[1]}</span>}
              </span>
              <span className="mono tabular">{p.hits24h}</span>
              <span className="mono muted" style={{ fontSize: 11 }}>{p.last}</span>
              <Badge variant={p.state === "有効" ? "success" : "default"}>{p.state}</Badge>
            </div>
          ))}
        </div>

        <div className="col" style={{ gap: 14 }}>
          <div className="card">
            <div className="card-hd"><h3>データクラス</h3></div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
              {([
                ["PII (氏名/住所/電話)", 284, "danger"],
                ["財務 (口座/決算)", 112, "danger"],
                ["認証情報 (PW/トークン)", 68, "danger"],
                ["ソースコード", 44, "warning"],
                ["顧客データ", 202, "warning"],
                ["内部文書", 128, "info"],
              ] as const).map(([l, n, v]) => (
                <div key={l} className="row" style={{ justifyContent: "space-between" }}>
                  <span className="row" style={{ gap: 6 }}><Dot color={`var(--${v})`} /> {l}</span>
                  <span className="mono tabular">{n}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-hd"><h3>URLカテゴリ</h3></div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              {([
                ["AI / LLM", "条件付"],
                ["暗号資産", "ブロック"],
                ["ファイル共有", "監視"],
                ["個人メール", "警告"],
                ["ギャンブル", "ブロック"],
                ["ソーシャル", "監視"],
              ] as const).map(([c, a]) => (
                <div key={c} className="row" style={{ justifyContent: "space-between" }}>
                  <span>{c}</span>
                  <Badge variant={a === "ブロック" ? "danger" : a === "警告" ? "warning" : "info"}>{a}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-hd"><h3>ルール編集: P-001 "AI経由のPII漏洩防止"</h3><span className="hd-meta">EDITOR PREVIEW</span></div>
        <div style={{ padding: 20, display: "grid", gridTemplateColumns: "80px 1fr 80px 1fr 80px 1fr", gap: 10, alignItems: "center", fontSize: 12 }}>
          <span className="muted mono">WHEN</span>
          <div style={{ padding: "8px 12px", background: "var(--tertiary)", border: "1px solid var(--border)", borderRadius: 6 }}>
            チャネル = <span className="mono">貼り付け | POST | フォーム送信</span>
          </div>
          <span className="muted mono">AND</span>
          <div style={{ padding: "8px 12px", background: "var(--tertiary)", border: "1px solid var(--border)", borderRadius: 6 }}>
            送信先 ∈ <span className="mono">{"{chatgpt.com, claude.ai, perplexity.ai, gemini.google.com}"}</span>
          </div>
          <span className="muted mono">AND</span>
          <div style={{ padding: "8px 12px", background: "var(--tertiary)", border: "1px solid var(--border)", borderRadius: 6 }}>
            データクラス ⊃ <span className="mono">{"{PII, 財務, 認証}"}</span>
          </div>
          <span className="muted mono">THEN</span>
          <div style={{ padding: "8px 12px", background: "var(--danger-bg)", border: "1px solid var(--danger-border)", borderRadius: 6, color: "var(--danger-foreground)", gridColumn: "2 / span 5" }}>
            <Icon name="shield-off" size={12} /> ブロック + ユーザー通知 + SIEMへ送信 + ケース自動作成
          </div>
        </div>
      </div>
    </div>
  </>
);

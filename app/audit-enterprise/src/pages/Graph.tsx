import { useMemo, useState } from "react";
import type { Severity } from "../data";
import { Badge, Dot, Icon, PageHeader, Sev } from "../components/ui";

type NodeType = "user" | "browser" | "app" | "threat" | "data";

interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  risk: Severity;
  meta: string;
}

type GraphEdge = readonly [string, string, string];

const GRAPH: { nodes: GraphNode[]; edges: GraphEdge[] } = {
  nodes: [
    { id: "u:takahashi", type: "user", label: "takahashi.yui", risk: "high", meta: "法務部" },
    { id: "u:wong", type: "user", label: "wong.chenxi", risk: "critical", meta: "エンジニアリング" },
    { id: "u:kim", type: "user", label: "kim.jihoon", risk: "medium", meta: "財務部" },
    { id: "u:schmidt", type: "user", label: "mara.schmidt", risk: "high", meta: "開発" },
    { id: "b:0001", type: "browser", label: "takahashi-mbp", risk: "high", meta: "Chrome 131" },
    { id: "b:0006", type: "browser", label: "sin-eng-tw", risk: "critical", meta: "Brave 1.72" },
    { id: "b:0002", type: "browser", label: "SH-DESK-4421", risk: "medium", meta: "Edge 132" },
    { id: "b:0003", type: "browser", label: "schmidt-dev", risk: "high", meta: "Chrome 131" },
    { id: "a:chatgpt", type: "app", label: "ChatGPT", risk: "critical", meta: "AI" },
    { id: "a:claude", type: "app", label: "Claude", risk: "critical", meta: "AI" },
    { id: "a:notion", type: "app", label: "Notion", risk: "high", meta: "Docs" },
    { id: "a:salesforce", type: "app", label: "Salesforce", risk: "medium", meta: "CRM" },
    { id: "a:github", type: "app", label: "GitHub", risk: "medium", meta: "Code" },
    { id: "t:cve", type: "threat", label: "CVE-2026-3091", risk: "critical", meta: "V8 RCE" },
    { id: "t:ext", type: "threat", label: "SuperTabs Pro", risk: "critical", meta: "悪質拡張" },
    { id: "t:cdn", type: "threat", label: "unknown-cdn.io", risk: "critical", meta: "C2疑い" },
    { id: "d:pii", type: "data", label: "PII", risk: "high", meta: "顧客情報" },
    { id: "d:fin", type: "data", label: "財務", risk: "critical", meta: "売上" },
    { id: "d:src", type: "data", label: "ソース", risk: "high", meta: "リポジトリ" },
  ],
  edges: [
    ["u:takahashi", "b:0001", "使用"],
    ["u:wong", "b:0006", "使用"],
    ["u:kim", "b:0002", "使用"],
    ["u:schmidt", "b:0003", "使用"],
    ["b:0001", "a:chatgpt", "ログイン"],
    ["b:0001", "a:notion", "ログイン"],
    ["b:0006", "a:salesforce", "ログイン"],
    ["b:0006", "a:github", "ログイン"],
    ["b:0002", "a:claude", "ログイン"],
    ["b:0003", "a:chatgpt", "ログイン"],
    ["b:0003", "a:github", "ログイン"],
    ["b:0001", "t:ext", "インストール"],
    ["b:0006", "t:cve", "影響"],
    ["b:0006", "t:cdn", "通信"],
    ["b:0003", "t:ext", "インストール"],
    ["a:chatgpt", "d:pii", "送信"],
    ["a:chatgpt", "d:fin", "送信"],
    ["a:claude", "d:pii", "送信"],
    ["a:salesforce", "d:pii", "保存"],
    ["a:github", "d:src", "保存"],
    ["a:notion", "d:pii", "保存"],
  ],
};

type Shape = "circle" | "square" | "hex" | "diamond";
const TYPE_META: Record<NodeType, { shape: Shape; icon: string; size: number }> = {
  user: { shape: "circle", icon: "user-check", size: 18 },
  browser: { shape: "square", icon: "monitor", size: 20 },
  app: { shape: "hex", icon: "layers", size: 22 },
  threat: { shape: "circle", icon: "alert-triangle", size: 22 },
  data: { shape: "diamond", icon: "database", size: 20 },
};

const RISK_COLOR: Record<Severity, string> = {
  critical: "var(--danger)",
  high: "var(--warning)",
  medium: "var(--info)",
  low: "var(--success)",
  info: "var(--info)",
  safe: "var(--success)",
};

function layout(nodes: GraphNode[], w: number, h: number) {
  const cols: NodeType[] = ["user", "browser", "app", "threat", "data"];
  const grouped = cols.map(t => nodes.filter(n => n.type === t));
  const colW = w / cols.length;
  const out: Record<string, { x: number; y: number }> = {};
  grouped.forEach((group, ci) => {
    const cx = colW * ci + colW / 2;
    group.forEach((n, ri) => {
      const spacing = h / (group.length + 1);
      out[n.id] = { x: cx, y: spacing * (ri + 1) };
    });
  });
  return out;
}

function hexPoints(r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    pts.push(`${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

export const GraphPage = () => {
  const [selected, setSelected] = useState("b:0006");
  const [filter, setFilter] = useState<"all" | NodeType>("all");
  const [showLabels, setShowLabels] = useState(true);
  const w = 960, h = 520;
  const pos = useMemo(() => layout(GRAPH.nodes, w, h), []);

  const neighbors = useMemo(() => {
    const ns = new Set<string>([selected]);
    const es = new Set<number>();
    GRAPH.edges.forEach(([s, t], i) => {
      if (s === selected || t === selected) {
        ns.add(s);
        ns.add(t);
        es.add(i);
      }
    });
    GRAPH.edges.forEach(([s, t], i) => {
      if (ns.has(s) || ns.has(t)) es.add(i);
    });
    return { ns, es };
  }, [selected]);

  const filteredNodes = filter === "all" ? GRAPH.nodes : GRAPH.nodes.filter(n => n.type === filter || n.risk === "critical");
  const selectedNode = GRAPH.nodes.find(n => n.id === selected);

  return (
    <>
      <PageHeader
        title="アセットグラフ"
        kicker="ASSET GRAPH · HERO"
        sub="ユーザー → ブラウザ → アプリ → データの関係を可視化。1ノードを選択して影響範囲 (blast radius) を2ホップまで確認できます。"
        actions={
          <>
            <div className="seg">
              <button type="button" className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>全て</button>
              <button type="button" className={filter === "user" ? "active" : ""} onClick={() => setFilter("user")}>ユーザー</button>
              <button type="button" className={filter === "browser" ? "active" : ""} onClick={() => setFilter("browser")}>ブラウザ</button>
              <button type="button" className={filter === "app" ? "active" : ""} onClick={() => setFilter("app")}>アプリ</button>
              <button type="button" className={filter === "threat" ? "active" : ""} onClick={() => setFilter("threat")}>脅威</button>
            </div>
            <button type="button" className="btn" onClick={() => setShowLabels(v => !v)}>
              <Icon name="tag" size={12} /> ラベル {showLabels ? "ON" : "OFF"}
            </button>
            <button type="button" className="btn accent"><Icon name="share-2" size={12} /> グラフ共有</button>
          </>
        }
      />
      <div className="page-body" style={{ padding: 0, display: "flex", minHeight: 0, flex: 1 }}>
        <div style={{ flex: 1, position: "relative", background: "var(--background)", borderRight: "1px solid var(--border)", overflow: "hidden" }}>
          <div style={{
            position: "absolute", inset: "10px 0 auto 0", display: "grid", gridTemplateColumns: "repeat(5, 1fr)",
            pointerEvents: "none", fontSize: 10, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.1em",
            fontFamily: "var(--font-mono)", zIndex: 2,
          }}>
            <div style={{ textAlign: "center" }}>identity</div>
            <div style={{ textAlign: "center" }}>browser</div>
            <div style={{ textAlign: "center" }}>saas / ai</div>
            <div style={{ textAlign: "center" }}>threat</div>
            <div style={{ textAlign: "center" }}>data</div>
          </div>
          <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" style={{ display: "block" }}>
            {[1, 2, 3, 4].map(i => (
              <line key={i} x1={(w / 5) * i} x2={(w / 5) * i} y1={30} y2={h - 10} stroke="var(--border-light)" strokeDasharray="3 3" />
            ))}
            {GRAPH.edges.map(([s, t], i) => {
              const p1 = pos[s];
              const p2 = pos[t];
              if (!p1 || !p2) return null;
              const inFilter = filteredNodes.find(n => n.id === s) && filteredNodes.find(n => n.id === t);
              const isActive = neighbors.es.has(i);
              if (!inFilter) return null;
              const mx = (p1.x + p2.x) / 2;
              const d = `M${p1.x},${p1.y} C${mx},${p1.y} ${mx},${p2.y} ${p2.x},${p2.y}`;
              return (
                <path key={i} d={d}
                  stroke={isActive ? "var(--accent)" : "var(--border)"}
                  strokeWidth={isActive ? 1.5 : 1}
                  fill="none"
                  opacity={isActive ? 0.9 : (selected ? 0.18 : 0.45)}
                />
              );
            })}
            {filteredNodes.map(n => {
              const p = pos[n.id];
              if (!p) return null;
              const meta = TYPE_META[n.type];
              const rc = RISK_COLOR[n.risk];
              const isSelected = selected === n.id;
              const isNeighbor = neighbors.ns.has(n.id) && !isSelected;
              const dim = selected && !isSelected && !isNeighbor;
              const r = meta.size / 2;
              return (
                <g key={n.id} transform={`translate(${p.x}, ${p.y})`}
                  style={{ cursor: "pointer", opacity: dim ? 0.22 : 1, transition: "opacity 0.2s" }}
                  onClick={() => setSelected(n.id)}
                >
                  {isSelected && <circle r={r + 8} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="3 2" />}
                  {meta.shape === "circle" && <circle r={r} fill="var(--background)" stroke={rc} strokeWidth="2" />}
                  {meta.shape === "square" && <rect x={-r} y={-r} width={r * 2} height={r * 2} rx="3" fill="var(--background)" stroke={rc} strokeWidth="2" />}
                  {meta.shape === "hex" && (
                    <polygon points={hexPoints(r)} fill="var(--background)" stroke={rc} strokeWidth="2" />
                  )}
                  {meta.shape === "diamond" && (
                    <polygon points={`0,${-r} ${r},0 0,${r} ${-r},0`} fill="var(--background)" stroke={rc} strokeWidth="2" />
                  )}
                  <foreignObject x={-8} y={-8} width={16} height={16} style={{ pointerEvents: "none" }}>
                    <div style={{ width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon name={meta.icon} size={11} />
                    </div>
                  </foreignObject>
                  {showLabels && (
                    <text x={0} y={r + 12} textAnchor="middle" className="graph-node-label"
                      style={{ fontSize: 10, fill: isSelected ? "var(--foreground)" : "var(--muted-foreground)", fontWeight: isSelected ? 500 : 400 }}>
                      {n.label}
                    </text>
                  )}
                  {n.risk === "critical" && (
                    <circle cx={r - 2} cy={-r + 2} r="3" fill="var(--danger)" stroke="var(--background)" strokeWidth="1" />
                  )}
                </g>
              );
            })}
          </svg>
          <div style={{ position: "absolute", bottom: 14, left: 14, background: "var(--background)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 11, display: "flex", gap: 14 }}>
            <span className="row" style={{ gap: 5 }}><Dot color="var(--danger)" /> critical</span>
            <span className="row" style={{ gap: 5 }}><Dot color="var(--warning)" /> high</span>
            <span className="row" style={{ gap: 5 }}><Dot color="var(--info)" /> medium</span>
            <span className="row" style={{ gap: 5 }}><Dot color="var(--success)" /> low</span>
          </div>
          <div style={{ position: "absolute", bottom: 14, right: 14, display: "flex", gap: 4 }}>
            <button type="button" className="icon-btn" style={{ background: "var(--background)", border: "1px solid var(--border)" }}><Icon name="zoom-in" size={13} color="muted" /></button>
            <button type="button" className="icon-btn" style={{ background: "var(--background)", border: "1px solid var(--border)" }}><Icon name="zoom-out" size={13} color="muted" /></button>
            <button type="button" className="icon-btn" style={{ background: "var(--background)", border: "1px solid var(--border)" }}><Icon name="maximize" size={13} color="muted" /></button>
          </div>
        </div>

        <div style={{ width: 320, overflow: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 14, background: "var(--secondary)" }}>
          {selectedNode && <NodeInspector node={selectedNode} />}
        </div>
      </div>
    </>
  );
};

const NodeInspector = ({ node }: { node: GraphNode }) => {
  const meta = TYPE_META[node.type];
  const edges = GRAPH.edges.filter(([s, t]) => s === node.id || t === node.id);
  return (
    <>
      <div>
        <div className="metric-label">選択中ノード</div>
        <div className="row" style={{ gap: 8, marginTop: 6 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--background)", border: `2px solid ${RISK_COLOR[node.risk]}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name={meta.icon} size={16} />
          </div>
          <div>
            <div style={{ fontWeight: 500, fontSize: 14 }}>{node.label}</div>
            <div className="muted mono" style={{ fontSize: 11 }}>{node.type} · {node.meta}</div>
          </div>
        </div>
        <div className="row" style={{ marginTop: 10, gap: 6 }}>
          <Sev level={node.risk} />
          <span className="mono muted" style={{ fontSize: 11 }}>{node.id}</span>
        </div>
      </div>

      <div className="card">
        <div className="card-hd"><h3>Blast Radius</h3><span className="hd-meta">2HOPS</span></div>
        <div className="card-body" style={{ padding: 12, fontSize: 12 }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
            <span className="muted">影響ユーザー</span><span className="mono tabular">1,284</span>
          </div>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
            <span className="muted">影響ブラウザ</span><span className="mono tabular">3,842</span>
          </div>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
            <span className="muted">データクラス</span><span className="mono tabular">PII, 財務, ソース</span>
          </div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="muted">到達性</span><Badge variant="danger">直接</Badge>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-hd"><h3>関係 ({edges.length})</h3></div>
        <div>
          {edges.slice(0, 8).map(([s, t, rel], i) => {
            const other = s === node.id ? t : s;
            const n = GRAPH.nodes.find(x => x.id === other)!;
            return (
              <div key={i} className="list-row" style={{ gridTemplateColumns: "14px 1fr auto", padding: "8px 12px", fontSize: 12, borderBottom: i === edges.length - 1 ? "none" : undefined }}>
                <Icon name={TYPE_META[n.type].icon} size={11} color="muted" />
                <div>
                  <div style={{ fontWeight: 500 }}>{n.label}</div>
                  <div className="muted mono" style={{ fontSize: 10 }}>{rel}</div>
                </div>
                <Dot color={RISK_COLOR[n.risk]} />
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-hd"><h3>アクション</h3></div>
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button type="button" className="btn" style={{ justifyContent: "flex-start" }}><Icon name="search" size={12} /> フォレンジック開始</button>
          <button type="button" className="btn" style={{ justifyContent: "flex-start" }}><Icon name="shield" size={12} /> セッション隔離</button>
          <button type="button" className="btn" style={{ justifyContent: "flex-start" }}><Icon name="key-round" size={12} /> セッション失効</button>
          <button type="button" className="btn danger" style={{ justifyContent: "flex-start" }}><Icon name="ban" size={12} /> ブラウザ一時停止</button>
        </div>
      </div>
    </>
  );
};

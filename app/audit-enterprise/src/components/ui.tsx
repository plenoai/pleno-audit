import type { CSSProperties, ReactNode } from "react";
import {
  Activity, AlertTriangle, ArrowRight, Ban, Bell, Book, BookOpen, ChevronRight, ChevronsUpDown,
  Database, Download, ExternalLink, FileCheck, FileText, Filter, GitBranch, Info, Key, KeyRound,
  Layers, LayoutDashboard, Maximize, MessageSquare, Monitor, Moon, Play, Plug, Plus, Puzzle,
  RefreshCw, Rss, Search, Send, Settings, Share2, Shield, ShieldCheck, ShieldOff, Siren,
  SkipBack, SkipForward, Smartphone, Sparkles, Sun, Tag, Upload, UploadCloud,
  UserCheck, UserPlus, UserX, Workflow, ZoomIn, ZoomOut,
  type LucideIcon,
} from "lucide-react";
import type { Severity } from "../data";

const ICONS: Record<string, LucideIcon> = {
  activity: Activity,
  "alert-triangle": AlertTriangle,
  "arrow-right": ArrowRight,
  ban: Ban,
  bell: Bell,
  book: Book,
  "book-open": BookOpen,
  "chevron-right": ChevronRight,
  "chevrons-up-down": ChevronsUpDown,
  database: Database,
  download: Download,
  "external-link": ExternalLink,
  "file-check": FileCheck,
  "file-text": FileText,
  filter: Filter,
  "git-branch": GitBranch,
  info: Info,
  key: Key,
  "key-round": KeyRound,
  layers: Layers,
  "layout-dashboard": LayoutDashboard,
  maximize: Maximize,
  "message-square": MessageSquare,
  monitor: Monitor,
  moon: Moon,
  play: Play,
  plug: Plug,
  plus: Plus,
  puzzle: Puzzle,
  "refresh-cw": RefreshCw,
  rss: Rss,
  search: Search,
  send: Send,
  server: Database,
  settings: Settings,
  "share-2": Share2,
  shield: Shield,
  "shield-check": ShieldCheck,
  "shield-off": ShieldOff,
  siren: Siren,
  "skip-back": SkipBack,
  "skip-forward": SkipForward,
  smartphone: Smartphone,
  sparkles: Sparkles,
  sun: Sun,
  tag: Tag,
  upload: Upload,
  "upload-cloud": UploadCloud,
  "user-check": UserCheck,
  "user-plus": UserPlus,
  "user-x": UserX,
  workflow: Workflow,
  "zoom-in": ZoomIn,
  "zoom-out": ZoomOut,
};

export interface IconProps {
  name: string;
  size?: number;
  color?: "muted" | string;
  style?: CSSProperties;
}

export const Icon = ({ name, size = 14, color, style }: IconProps) => {
  const LucideComp = ICONS[name] ?? Info;
  const resolvedColor =
    color === "muted"
      ? "var(--muted-foreground)"
      : color && color !== "currentColor"
        ? color
        : "currentColor";
  return (
    <LucideComp
      size={size}
      strokeWidth={1.75}
      color={resolvedColor}
      style={{ flexShrink: 0, verticalAlign: "middle", ...style }}
    />
  );
};

export type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "accent";

export const Badge = ({ variant = "default", children, style }: { variant?: BadgeVariant; children: ReactNode; style?: CSSProperties }) => (
  <span className={`b ${variant}`} style={style}>{children}</span>
);

const SEV_MAP: Record<Severity, { v: BadgeVariant; t: string }> = {
  critical: { v: "danger", t: "critical" },
  high: { v: "danger", t: "high" },
  medium: { v: "warning", t: "medium" },
  low: { v: "info", t: "low" },
  info: { v: "info", t: "info" },
  safe: { v: "success", t: "safe" },
};

export const Sev = ({ level }: { level: Severity }) => {
  const m = SEV_MAP[level] ?? SEV_MAP.info;
  return <Badge variant={m.v}>{m.t}</Badge>;
};

export const Dot = ({ color = "var(--muted-foreground)", size = 8, style }: { color?: string; size?: number; style?: CSSProperties }) => (
  <span className="dot" style={{ background: color, width: size, height: size, ...style }} />
);

export const Sparkline = ({ data, width = 80, height = 22, color = "var(--accent)", fill = false }: {
  data: number[]; width?: number; height?: number; color?: string; fill?: boolean;
}) => {
  if (!data || data.length === 0) return null;
  let max = data[0];
  let min = data[0];
  for (const v of data) {
    if (v > max) max = v;
    if (v < min) min = v;
  }
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((d, i) => [i * step, height - ((d - min) / range) * (height - 2) - 1]);
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = fill ? `${d} L${width},${height} L0,${height} Z` : null;
  return (
    <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
      {area && <path d={area} fill={color} opacity="0.12" />}
      <path d={d} stroke={color} strokeWidth="1.25" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export const RiskBarScore = ({ value, max = 100, color }: { value: number; max?: number; color?: string }) => {
  const w = (value / max) * 100;
  const c = color || (value >= 80 ? "var(--danger)" : value >= 60 ? "var(--warning)" : value >= 40 ? "var(--info)" : "var(--success)");
  return (
    <div style={{ position: "relative", height: 6, background: "var(--tertiary)", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${w}%`, background: c, borderRadius: 3 }} />
    </div>
  );
};

export const Heatmap = ({ data, cols = 14, rows = 6, cellSize = 12, gap = 2 }: {
  data: number[]; cols?: number; rows?: number; cellSize?: number; gap?: number;
}) => {
  const maxN = cols * rows;
  const cells = Array.from({ length: maxN }, (_, i) => data[i % data.length] || 0);
  return (
    <svg width={cols * (cellSize + gap)} height={rows * (cellSize + gap)}>
      {cells.map((v, i) => {
        const x = (i % cols) * (cellSize + gap);
        const y = Math.floor(i / cols) * (cellSize + gap);
        const op = 0.1 + v * 0.9;
        const color = v > 0.7 ? "var(--danger)" : v > 0.4 ? "var(--warning)" : "var(--info)";
        return <rect key={i} x={x} y={y} width={cellSize} height={cellSize} fill={color} opacity={op} rx={2} />;
      })}
    </svg>
  );
};

export const Metric = ({ label, value, delta, unit, sub, spark }: {
  label: string; value: number | string; delta?: number; unit?: string; sub?: string; spark?: number[];
}) => {
  const up = typeof delta === "number" && delta > 0;
  const down = typeof delta === "number" && delta < 0;
  return (
    <div className="card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <div className="metric-label">{label}</div>
      <div className="row" style={{ alignItems: "baseline", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4, minWidth: 0 }}>
          <span className="metric-val tabular">{typeof value === "number" ? value.toLocaleString() : value}</span>
          {unit && <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{unit}</span>}
        </div>
        {spark && <Sparkline data={spark} width={64} height={20} />}
      </div>
      <div className="row" style={{ gap: 6, fontSize: 11, color: "var(--muted-foreground)" }}>
        {delta !== undefined && (
          <span className={`metric-delta ${up ? "up" : down ? "down" : ""}`}>
            {up ? "▲" : down ? "▼" : "●"} {Math.abs(delta)}
          </span>
        )}
        {sub && <span>{sub}</span>}
      </div>
    </div>
  );
};

export const PageHeader = ({ title, kicker, sub, actions }: {
  title: string; kicker?: string; sub?: string; actions?: ReactNode;
}) => (
  <div className="page-header">
    <div>
      <div className="title-row">
        <h1 className="page-title">{title}</h1>
        {kicker && <span className="page-kicker">{kicker}</span>}
      </div>
      {sub && <div className="page-sub">{sub}</div>}
    </div>
    {actions && <div className="page-actions">{actions}</div>}
  </div>
);

export const IconButton = ({ icon, onClick, title }: { icon: string; onClick?: () => void; title?: string }) => (
  <button className="icon-btn" onClick={onClick} title={title}>
    <Icon name={icon} size={15} color="muted" />
  </button>
);

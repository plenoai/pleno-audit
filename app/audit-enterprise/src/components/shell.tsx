import { useEffect, useRef, useState } from "react";
import type { OrgInfo } from "../data";
import { Icon, IconButton } from "./ui";

export type TabId =
  | "overview" | "graph" | "alerts" | "investigation" | "exfil" | "identity"
  | "fleet" | "extensions" | "saas" | "policy" | "compliance" | "integrations";

type NavItem =
  | { section: string; id?: never }
  | { id: TabId; ja: string; en: string; icon: string; count?: number; variant?: string; hero?: boolean; section?: never };

export const NAV: NavItem[] = [
  { section: "Workspace" },
  { id: "overview", ja: "概要", en: "Overview", icon: "layout-dashboard" },
  { id: "graph", ja: "アセットグラフ", en: "Asset Graph", icon: "git-branch", hero: true },
  { section: "Detection" },
  { id: "alerts", ja: "アラート", en: "Alerts / BDR", icon: "siren", count: 14, variant: "danger" },
  { id: "investigation", ja: "調査", en: "Forensics", icon: "search", count: 3, variant: "info" },
  { id: "exfil", ja: "データ漏洩", en: "Exfil Monitor", icon: "upload-cloud" },
  { id: "identity", ja: "アイデンティティ", en: "Identity", icon: "user-check" },
  { section: "Posture" },
  { id: "fleet", ja: "ブラウザ", en: "Fleet", icon: "monitor" },
  { id: "extensions", ja: "拡張機能", en: "Extensions", icon: "puzzle" },
  { id: "saas", ja: "SaaS & AI", en: "SaaS / AI", icon: "layers" },
  { id: "policy", ja: "ポリシー", en: "Policy (CASB)", icon: "shield-check" },
  { section: "Governance" },
  { id: "compliance", ja: "コンプライアンス", en: "Compliance", icon: "file-check" },
  { id: "integrations", ja: "連携", en: "Integrations", icon: "plug" },
];

export const Sidebar = ({ active, onChange }: { active: TabId; onChange: (id: TabId) => void }) => {
  const ref = useRef<HTMLElement>(null);
  const [ind, setInd] = useState({ top: 0, h: 0 });
  useEffect(() => {
    const el = ref.current?.querySelector(`[data-tab="${active}"]`) as HTMLElement | null;
    if (el) setInd({ top: el.offsetTop, h: el.offsetHeight });
  }, [active]);

  return (
    <nav className="sb" ref={ref}>
      <div className="sb-ind" style={{ top: ind.top, height: ind.h }} />
      {NAV.map((n, i) => {
        if ("section" in n && n.section) {
          return <div key={`s-${i}`} className="sb-section">{n.section}</div>;
        }
        if (!("id" in n) || !n.id) return null;
        return (
          <button
            key={n.id}
            data-tab={n.id}
            className={`tab ${active === n.id ? "active" : ""}`}
            onClick={() => onChange(n.id as TabId)}
            type="button"
          >
            <Icon name={n.icon} size={14} color="muted" />
            <span className="tab-label">{n.ja}</span>
            {n.count != null && <span className={`tab-count ${n.variant || ""}`}>{n.count}</span>}
            {n.hero && <Icon name="sparkles" size={10} color="muted" style={{ opacity: 0.5 }} />}
          </button>
        );
      })}
      <div className="sb-foot">
        <div>ローカルファースト · 外部送信なし</div>
        <div className="region">
          <span className="dot" style={{ background: "var(--success)" }} />
          <span>4リージョン · 正常</span>
        </div>
      </div>
    </nav>
  );
};

export const AppHeader = ({ org, dark, onDark }: {
  org: OrgInfo; dark: boolean; onDark: () => void;
}) => (
  <header className="app-header">
    <div className="brand">
      <span className="brand-mark">P</span>
      <span className="brand-name">Pleno</span>
      <span className="brand-sub">ZTBS Console</span>
    </div>
    <div className="hd-search">
      <Icon name="search" size={13} color="muted" />
      <input placeholder="資産、ユーザー、CVE、ドメインを検索..." />
      <span className="kbd">⌘K</span>
    </div>
    <div className="hd-right">
      <div className="hd-status">
        <span className="pulse" />
        <span>リアルタイム監視中 · {org.lastUpdated}</span>
      </div>
      <IconButton icon="bell" title="通知" />
      <IconButton icon={dark ? "sun" : "moon"} onClick={onDark} title="テーマ" />
      <div className="hd-org">
        <span className="avatar">{org.shortCode}</span>
        <span>{org.name}</span>
        <Icon name="chevrons-up-down" size={12} color="muted" />
      </div>
    </div>
  </header>
);

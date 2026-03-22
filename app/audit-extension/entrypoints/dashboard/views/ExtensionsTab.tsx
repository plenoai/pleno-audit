import { useState, useEffect, useMemo } from "preact/hooks";
import { Badge, Button, SearchInput } from "../../../components";
import { FilteredTab } from "../components/FilteredTab";
import { useTabFilter } from "../hooks/useTabFilter";
import { useTheme } from "../../../lib/theme";
import { truncate } from "../utils";
import { createLogger } from "@pleno-audit/extension-runtime";

const logger = createLogger("extensions-tab");

interface ExtensionInfo {
  id: string;
  name: string;
  description: string;
  version: string;
  enabled: boolean;
  permissions: string[];
  hostPermissions: string[];
  installType: string;
  type: string;
  mayDisable: boolean;
  homepageUrl?: string;
  updateUrl?: string;
  icons?: { size: number; url: string }[];
}

type RiskLevel = "critical" | "high" | "medium" | "low";

const criticalPermissions = ["debugger", "nativeMessaging", "proxy", "webRequestBlocking"];
const highRiskPermissions = ["cookies", "history", "tabs", "webNavigation", "webRequest", "management", "downloads", "clipboardRead", "clipboardWrite"];
const mediumRiskPermissions = ["storage", "activeTab", "contextMenus", "notifications", "alarms"];

function getPermissionRiskLevel(permissions: string[], hostPermissions: string[]): RiskLevel {
  const allPermissions = [...permissions, ...hostPermissions];
  const hasAllUrls = hostPermissions.some(
    (p) => p === "<all_urls>" || p === "*://*/*" || p === "http://*/*" || p === "https://*/*"
  );
  if (allPermissions.some((p) => criticalPermissions.includes(p)) || hasAllUrls) return "critical";
  if (allPermissions.some((p) => highRiskPermissions.includes(p))) return "high";
  if (allPermissions.some((p) => mediumRiskPermissions.includes(p))) return "medium";
  return "low";
}

const riskBadgeVariant: Record<RiskLevel, string> = { critical: "danger", high: "warning", medium: "info", low: "success" };
const riskLabel: Record<RiskLevel, string> = { critical: "重大", high: "高", medium: "中", low: "低" };

export function ExtensionsTab() {
  const { colors, isDark } = useTheme();
  const { searchQuery, setSearchQuery, filters, setFilter } = useTabFilter({
    critical: false,
    high: false,
  });
  const [extensions, setExtensions] = useState<ExtensionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const allExtensions = await chrome.management.getAll();
        setExtensions(
          allExtensions
            .filter((ext) => ext.id !== chrome.runtime.id)
            .map((ext) => ({
              id: ext.id,
              name: ext.name,
              description: ext.description,
              version: ext.version,
              enabled: ext.enabled,
              permissions: ext.permissions || [],
              hostPermissions: ext.hostPermissions || [],
              installType: ext.installType,
              type: ext.type,
              mayDisable: ext.mayDisable,
              homepageUrl: ext.homepageUrl,
              updateUrl: ext.updateUrl,
              icons: ext.icons,
            }))
        );
      } catch (error) {
        logger.error("Failed to load extensions", error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const criticalCount = useMemo(
    () => extensions.filter((e) => getPermissionRiskLevel(e.permissions, e.hostPermissions) === "critical").length,
    [extensions]
  );
  const highCount = useMemo(
    () => extensions.filter((e) => getPermissionRiskLevel(e.permissions, e.hostPermissions) === "high").length,
    [extensions]
  );

  const filtered = useMemo(() => {
    let result = extensions;
    if (filters.critical) result = result.filter((e) => getPermissionRiskLevel(e.permissions, e.hostPermissions) === "critical");
    if (filters.high) result = result.filter((e) => {
      const level = getPermissionRiskLevel(e.permissions, e.hostPermissions);
      return level === "high" || level === "critical";
    });
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (ext) =>
          ext.name.toLowerCase().includes(q) ||
          ext.description.toLowerCase().includes(q) ||
          ext.permissions.some((p) => p.toLowerCase().includes(q)) ||
          ext.hostPermissions.some((p) => p.toLowerCase().includes(q))
      );
    }
    return result;
  }, [extensions, searchQuery, filters.critical, filters.high]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return <div style={{ color: colors.textSecondary, textAlign: "center", padding: "24px" }}>読み込み中...</div>;
  }

  return (
    <FilteredTab
      data={filtered}
      rowKey={(ext) => ext.id}
      rowHighlight={(ext) => getPermissionRiskLevel(ext.permissions, ext.hostPermissions) === "critical"}
      emptyMessage="拡張機能が見つかりません"
      filterBar={
        <>
          <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="拡張機能名、権限で検索..." />
          <Button
            variant={filters.critical ? "primary" : "secondary"}
            size="sm"
            onClick={() => setFilter("critical", !filters.critical)}
          >
            重大 ({criticalCount})
          </Button>
          <Button
            variant={filters.high ? "primary" : "secondary"}
            size="sm"
            onClick={() => setFilter("high", !filters.high)}
          >
            高リスク ({highCount})
          </Button>
        </>
      }
      columns={[
        {
          key: "name",
          header: "拡張機能名",
          render: (ext) => (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {ext.icons?.[0]?.url && (
                <img src={ext.icons[0].url} alt="" style={{ width: "16px", height: "16px" }} />
              )}
              <span>{ext.name}</span>
            </div>
          ),
        },
        {
          key: "tags",
          header: "タグ",
          width: "220px",
          render: (ext) => {
            const allPerms = [...ext.permissions, ...ext.hostPermissions];
            const tags: { label: string; variant: "danger" | "warning" | "info" | "success" }[] = [];
            for (const p of allPerms) {
              if (criticalPermissions.includes(p)) tags.push({ label: p, variant: "danger" });
            }
            const hasAllUrls = ext.hostPermissions.some(
              (p) => p === "<all_urls>" || p === "*://*/*" || p === "http://*/*" || p === "https://*/*"
            );
            if (hasAllUrls) tags.push({ label: "<all_urls>", variant: "danger" });
            if (ext.updateUrl && !ext.updateUrl.includes("google.com")) {
              tags.push({ label: "外部更新", variant: "danger" });
            }
            if (!ext.mayDisable) tags.push({ label: "削除不可", variant: "warning" });
            if (!ext.enabled) tags.push({ label: "無効", variant: "info" });
            if (ext.installType === "admin") tags.push({ label: "管理者", variant: "warning" });
            if (tags.length === 0) return <span style={{ color: colors.textMuted }}>-</span>;
            return (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {tags.map((tag) => (
                  <Badge key={tag.label} variant={tag.variant} size="sm">{tag.label}</Badge>
                ))}
              </div>
            );
          },
        },
        {
          key: "permissions",
          header: "権限",
          width: "120px",
          render: (ext) => {
            const allPerms = [...ext.permissions, ...ext.hostPermissions];
            if (allPerms.length === 0) return <span style={{ color: colors.textMuted }}>-</span>;
            const isExpanded = expandedIds.has(ext.id);
            return (
              <div>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleExpand(ext.id); }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    color: isDark ? "#60a5fa" : "#0070f3",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span style={{ fontSize: "10px" }}>{isExpanded ? "\u25BC" : "\u25B6"}</span>
                  <Badge variant={allPerms.length > 10 ? "warning" : "info"}>{allPerms.length}</Badge>
                </button>
                {isExpanded && (
                  <div
                    style={{
                      marginTop: "8px",
                      padding: "8px",
                      background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                      borderRadius: "6px",
                      fontSize: "11px",
                      maxHeight: "200px",
                      overflowY: "auto",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "4px",
                    }}
                  >
                    {allPerms.map((perm) => {
                      const isAllUrls = perm === "<all_urls>" || perm === "*://*/*";
                      return (
                        <Badge key={perm} variant={isAllUrls ? "danger" : "default"} size="sm">
                          {perm}
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          },
        },
        {
          key: "homepage",
          header: "ホームページ",
          width: "160px",
          render: (ext) =>
            ext.homepageUrl ? (
              <a
                href={ext.homepageUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: isDark ? "#60a5fa" : "#0070f3", fontSize: "12px" }}
              >
                {truncate(ext.homepageUrl, 25)}
              </a>
            ) : (
              <span style={{ color: colors.textMuted }}>-</span>
            ),
        },
        {
          key: "version",
          header: "バージョン",
          width: "80px",
          render: (ext) => <code style={{ fontSize: "11px" }}>{ext.version}</code>,
        },
      ]}
    />
  );
}

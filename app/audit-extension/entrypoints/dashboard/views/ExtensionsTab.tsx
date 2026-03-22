import { useState, useEffect, useMemo } from "preact/hooks";
import { Badge, Button, SearchInput } from "../../../components";
import { FilteredTab } from "../components/FilteredTab";
import { useTabFilter } from "../hooks/useTabFilter";
import { useTheme } from "../../../lib/theme";
import { createLogger } from "@pleno-audit/extension-runtime";

const logger = createLogger("extensions-tab");

interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  permissions: string[];
  hostPermissions: string[];
  installType: string;
  type: string;
  mayDisable: boolean;
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
              version: ext.version,
              enabled: ext.enabled,
              permissions: ext.permissions || [],
              hostPermissions: ext.hostPermissions || [],
              installType: ext.installType,
              type: ext.type,
              mayDisable: ext.mayDisable,
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
          key: "version",
          header: "バージョン",
          width: "80px",
          render: (ext) => <code style={{ fontSize: "11px" }}>{ext.version}</code>,
        },
        {
          key: "risk",
          header: "リスク",
          width: "80px",
          render: (ext) => {
            const level = getPermissionRiskLevel(ext.permissions, ext.hostPermissions);
            return <Badge variant={riskBadgeVariant[level] as "danger" | "warning" | "info" | "success"}>{riskLabel[level]}</Badge>;
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
          key: "status",
          header: "状態",
          width: "80px",
          render: (ext) => (
            <Badge variant={ext.enabled ? "success" : "default"}>
              {ext.enabled ? "有効" : "無効"}
            </Badge>
          ),
        },
        {
          key: "installType",
          header: "インストール",
          width: "100px",
          render: (ext) => (
            <Badge variant={ext.installType === "admin" ? "warning" : "default"}>
              {ext.installType}
            </Badge>
          ),
        },
      ]}
    />
  );
}

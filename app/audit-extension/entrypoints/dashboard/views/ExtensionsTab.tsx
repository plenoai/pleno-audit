import { useState, useEffect, useMemo } from "preact/hooks";
import { Puzzle } from "lucide-preact";
import {
  Badge,
  Button,
  EmptyState,
  HostPane,
  HostListPane,
  HostDetailPane,
  HostListFilterBar,
  HostListBody,
  ListRow,
  LoadingState,
  PageHeader,
  DetailSection,
  KeyValueGrid,
} from "../../../components";
import { useTabFilter } from "../hooks/useTabFilter";
import { useTagFilter } from "../hooks/useTagFilter";
import { useTheme, fontSize, spacing, borderRadius } from "../../../lib/theme";
import { createLogger } from "libztbs/extension-runtime";
import { getPermissionRiskLevel, DANGEROUS_PERMISSIONS, type PermissionRiskLevel, type PermissionRisk } from "libztbs/extension-analyzers";

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

type TagVariant = "danger" | "warning" | "info" | "success";

interface ExtTag {
  label: string;
  variant: TagVariant;
}

const RISK_LEVEL_ORDER: Record<PermissionRiskLevel, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function getRiskLabel(level: PermissionRiskLevel): { text: string; variant: "danger" | "warning" | "info" | "default" } {
  switch (level) {
    case "critical": return { text: "High", variant: "danger" };
    case "high": return { text: "Medium", variant: "warning" };
    case "medium":
    case "low": return { text: "Low", variant: "info" };
  }
}

function getExtensionTags(ext: ExtensionInfo): ExtTag[] {
  const tags: ExtTag[] = [];
  const allPerms = [...ext.permissions, ...ext.hostPermissions];
  for (const p of allPerms) {
    const risk = DANGEROUS_PERMISSIONS.find((d) => d.permission === p);
    if (risk?.severity === "critical") tags.push({ label: p, variant: "danger" });
  }
  const hasAllUrls = ext.hostPermissions.some(
    (p) => p === "<all_urls>" || p === "*://*/*" || p === "http://*/*" || p === "https://*/*",
  );
  if (hasAllUrls) tags.push({ label: "<all_urls>", variant: "danger" });
  if (ext.updateUrl && !ext.updateUrl.includes("google.com")) {
    tags.push({ label: "外部更新", variant: "danger" });
  }
  if (!ext.mayDisable) tags.push({ label: "削除不可", variant: "warning" });
  if (!ext.enabled) tags.push({ label: "無効", variant: "info" });
  if (ext.installType === "admin") tags.push({ label: "管理者", variant: "warning" });
  return tags;
}

function getPermissionDescription(perm: string): string | undefined {
  const risk: PermissionRisk | undefined = DANGEROUS_PERMISSIONS.find((d) => d.permission === perm);
  return risk?.description;
}

function ExtensionRow({
  ext,
  isActive,
  onSelect,
}: {
  ext: ExtensionInfo;
  isActive: boolean;
  onSelect: () => void;
}) {
  const level = getPermissionRiskLevel(ext.permissions, ext.hostPermissions);
  const risk = getRiskLabel(level);
  const tags = getExtensionTags(ext);
  const allPerms = [...ext.permissions, ...ext.hostPermissions];

  return (
    <ListRow
      isHighlighted={isActive}
      activeIndicator={isActive}
      onClick={onSelect}
      badges={
        <>
          <Badge variant={risk.variant} size="sm">{risk.text}</Badge>
          {tags.slice(0, 4).map((tag) => (
            <Badge key={tag.label} variant={tag.variant} size="sm">{tag.label}</Badge>
          ))}
          {tags.length > 4 && (
            <Badge variant="default" size="sm">+{tags.length - 4}</Badge>
          )}
        </>
      }
      title={
        <>
          {ext.icons?.[0]?.url && (
            <img src={ext.icons[0].url} alt="" style={{ width: "14px", height: "14px", flexShrink: 0 }} />
          )}
          <span>{ext.name}</span>
        </>
      }
      meta={<>v{ext.version} · {allPerms.length}個の権限</>}
    />
  );
}

function ExtensionDetailContent({ ext }: { ext: ExtensionInfo }) {
  const { colors } = useTheme();
  const level = getPermissionRiskLevel(ext.permissions, ext.hostPermissions);
  const risk = getRiskLabel(level);
  const tags = getExtensionTags(ext);
  const allPerms = [...ext.permissions, ...ext.hostPermissions];
  const koidexUrl = `https://dex.koi.security/reports/chrome/${ext.id}/${ext.version}`;

  const meta: [string, import("preact").ComponentChildren][] = [
    ["id", ext.id],
    ["version", `v${ext.version}`],
    ["installType", ext.installType],
    ["enabled", ext.enabled ? "有効" : "無効"],
    ["mayDisable", ext.mayDisable ? "可" : "不可"],
  ];
  if (ext.updateUrl) meta.push(["updateUrl", ext.updateUrl]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
      <div style={{ display: "flex", gap: spacing.sm, alignItems: "flex-start" }}>
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: borderRadius.md,
            background: colors.bgPrimary,
            border: `1px solid ${colors.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {ext.icons?.[0]?.url ? (
            <img src={ext.icons[0].url} alt="" style={{ width: "20px", height: "20px" }} />
          ) : (
            <Puzzle size={18} color={colors.textMuted} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: spacing.xs, flexWrap: "wrap", marginBottom: "4px" }}>
            <Badge variant={risk.variant} size="sm">{risk.text}</Badge>
            {tags.map((tag) => (
              <Badge key={tag.label} variant={tag.variant} size="sm">{tag.label}</Badge>
            ))}
          </div>
          <h2 style={{ fontSize: "18px", fontWeight: 500, letterSpacing: "-0.01em", color: colors.textPrimary, margin: 0, wordBreak: "break-all" }}>
            {ext.name}
          </h2>
          <div style={{ fontSize: fontSize.xs, color: colors.textMuted, marginTop: "3px", fontFamily: "monospace" }}>
            v{ext.version} · {allPerms.length}個の権限
          </div>
        </div>
        <div style={{ display: "flex", gap: spacing.xs, flexShrink: 0, alignItems: "center" }}>
          <Button variant="secondary" size="sm" href={koidexUrl} target="_blank" rel="noopener noreferrer">
            Koidex ↗
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => chrome.tabs.create({ url: `chrome://extensions/?id=${ext.id}` })}
          >
            管理画面 →
          </Button>
        </div>
      </div>

      {ext.description && (
        <p style={{ fontSize: fontSize.sm, color: colors.textSecondary, margin: 0, lineHeight: 1.5 }}>
          {ext.description}
        </p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: spacing.md, alignItems: "start" }}>
        <DetailSection title="基本情報">
          <KeyValueGrid entries={meta} />
        </DetailSection>

        {ext.homepageUrl && (
          <DetailSection title="リンク">
            <a
              href={ext.homepageUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: colors.link, textDecoration: "none", fontSize: fontSize.sm, wordBreak: "break-all" }}
            >
              {ext.homepageUrl} ↗
            </a>
          </DetailSection>
        )}
      </div>

      {allPerms.length > 0 && (
        <DetailSection title="権限" meta={`${allPerms.length}件`}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: spacing.xs }}>
            {allPerms.map((perm) => {
              const isAllUrls = perm === "<all_urls>" || perm === "*://*/*";
              const isDangerous = DANGEROUS_PERMISSIONS.some((d) => d.permission === perm && d.severity === "critical");
              const description = getPermissionDescription(perm);
              const highlighted = isAllUrls || isDangerous;
              return (
                <div
                  key={perm}
                  style={{
                    padding: `${spacing.xs} ${spacing.sm}`,
                    background: highlighted ? colors.status.danger.bg : colors.bgSecondary,
                    border: `1px solid ${highlighted ? colors.status.danger.border : colors.border}`,
                    borderRadius: borderRadius.sm,
                    fontSize: fontSize.sm,
                    fontFamily: "monospace",
                    color: highlighted ? colors.status.danger.text : colors.textPrimary,
                    wordBreak: "break-all",
                  }}
                >
                  {perm}
                  {description && (
                    <div style={{ color: colors.textMuted, fontFamily: "inherit", fontSize: fontSize.xs, marginTop: 2 }}>
                      — {description}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DetailSection>
      )}
    </div>
  );
}

interface ExtensionsTabProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

export function ExtensionsTab({ searchQuery, setSearchQuery }: ExtensionsTabProps) {
  const { colors } = useTheme();
  const [extensions, setExtensions] = useState<ExtensionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  useTabFilter({ searchQuery, setSearchQuery });

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
            })),
        );
      } catch (error) {
        logger.error("Failed to load extensions", error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const { tagSummary, activeTagFilters, toggleTagFilter, filterByTags: tagFiltered } =
    useTagFilter(extensions, getExtensionTags);

  const filtered = useMemo(() => {
    let result = tagFiltered;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (ext) =>
          ext.name.toLowerCase().includes(q) ||
          ext.description.toLowerCase().includes(q) ||
          ext.permissions.some((p) => p.toLowerCase().includes(q)) ||
          ext.hostPermissions.some((p) => p.toLowerCase().includes(q)),
      );
    }
    result = [...result].sort((a, b) => {
      const levelA = RISK_LEVEL_ORDER[getPermissionRiskLevel(a.permissions, a.hostPermissions)];
      const levelB = RISK_LEVEL_ORDER[getPermissionRiskLevel(b.permissions, b.hostPermissions)];
      return levelA - levelB;
    });
    return result;
  }, [tagFiltered, searchQuery]);

  const activeExt = activeId ? extensions.find((e) => e.id === activeId) ?? null : null;

  if (loading) {
    return <LoadingState />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <PageHeader
        title="拡張機能"
        kicker="EXTENSION POSTURE"
        sub="インストール済み拡張機能の権限リスクを評価。<all_urls>・外部更新 URL・管理者強制を検出。"
        actions={
          <Button
            size="sm"
            variant="secondary"
            onClick={() => chrome.tabs.create({ url: "chrome://extensions" })}
          >
            拡張機能を管理 ↗
          </Button>
        }
      />
      <HostPane>
        <HostListPane>
          {tagSummary.length > 0 && (
            <HostListFilterBar>
              {tagSummary.map((tag) => (
                <Badge
                  key={tag.label}
                  variant={tag.variant}
                  active={activeTagFilters.has(tag.label)}
                  onClick={() => toggleTagFilter(tag.label)}
                >
                  {tag.label} ({tag.count})
                </Badge>
              ))}
            </HostListFilterBar>
          )}

          {filtered.length > 0 && (
            <div
              style={{
                padding: `${spacing.xs} ${spacing.lg}`,
                borderBottom: `1px solid ${colors.border}`,
                fontSize: fontSize.xs,
                color: colors.textMuted,
                background: colors.bgSecondary,
                flexShrink: 0,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {filtered.length}件の拡張機能
            </div>
          )}

          <HostListBody>
            {extensions.length === 0 ? (
              <EmptyState title="拡張機能が見つかりません" description="インストールされた拡張機能が検出されると表示されます" />
            ) : filtered.length === 0 ? (
              <EmptyState title="一致する拡張機能がありません" description="検索条件やフィルタを変更してください" />
            ) : (
              filtered.map((ext) => (
                <ExtensionRow
                  key={ext.id}
                  ext={ext}
                  isActive={activeId === ext.id}
                  onSelect={() => setActiveId((prev) => (prev === ext.id ? null : ext.id))}
                />
              ))
            )}
          </HostListBody>
        </HostListPane>

        <HostDetailPane>
          {activeExt ? (
            <ExtensionDetailContent ext={activeExt} />
          ) : (
            <div
              style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: colors.textMuted,
                fontSize: fontSize.sm,
              }}
            >
              リストから拡張機能を選択して詳細を表示
            </div>
          )}
        </HostDetailPane>
      </HostPane>
    </div>
  );
}

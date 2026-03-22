import { useMemo } from "preact/hooks";
import type { DetectedService, EventLog } from "@pleno-audit/casb-types";
import type { CapturedAIPrompt } from "@pleno-audit/ai-detector";
import type { CSPViolation } from "@pleno-audit/csp";
import { calculateSecurityPosture } from "@pleno-audit/alerts";
import type { ThemeColors } from "../../../lib/theme";
import { Badge, Card } from "../../../components";
import type { DashboardStyles } from "../styles";
import { HorizontalBarChart } from "../components/HorizontalBarChart";

interface OverviewTabProps {
  styles: DashboardStyles;
  colors: ThemeColors;
  violations: CSPViolation[];
  aiPrompts: CapturedAIPrompt[];
  services: DetectedService[];
  events: EventLog[];
  nrdServices: DetectedService[];
  typosquatServices: DetectedService[];
  directiveStats: { label: string; value: number }[];
  domainStats: { label: string; value: number }[];
}

export function OverviewTab({
  styles,
  colors,
  violations,
  aiPrompts,
  services,
  events,
  nrdServices,
  typosquatServices,
  directiveStats,
  domainStats,
}: OverviewTabProps) {
  const chartData = useMemo(() => {
    const days = 7;
    const dayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const dayData = Array.from({ length: days }, (_, index) => {
      const offset = days - 1 - index;
      const dayStart = now - (offset + 1) * dayMs;
      const dayEnd = now - offset * dayMs;
      const count = events.filter((e) => e.timestamp >= dayStart && e.timestamp < dayEnd).length;
      const hasRisk = events.some(
        (e) =>
          e.timestamp >= dayStart &&
          e.timestamp < dayEnd &&
          (e.type.includes("nrd") || e.type.includes("typosquat"))
      );
      return { offset, count, hasRisk };
    });
    let maxCount = 1;
    for (const d of dayData) {
      if (d.count > maxCount) maxCount = d.count;
    }
    return { dayData, maxCount };
  }, [events]);

  const posture = calculateSecurityPosture({
    nrdCount: nrdServices.length,
    typosquatCount: typosquatServices.length,
    cspViolationCount: violations.length,
    aiPromptCount: aiPrompts.length,
  });
  const privacyPolicyMissingCount = services.filter((s) => !s.privacyPolicyUrl).length;

  return (
    <>
      <Card title="セキュリティスコア" style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "32px", flexWrap: "wrap" }}>
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: "48px",
                fontWeight: 700,
                color:
                  posture.status === "normal"
                    ? "#22c55e"
                    : posture.status === "danger"
                      ? "#dc2626"
                      : "#f97316",
              }}
            >
              {posture.score}
            </div>
            <div style={{ fontSize: "12px", color: colors.textSecondary }}>/ 100</div>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: nrdServices.length > 0 ? "#dc2626" : "#22c55e",
                }}
              />
              <span style={{ fontSize: "13px" }}>NRD検出: {nrdServices.length}件</span>
              {nrdServices.length > 0 && (
                <Badge variant="danger" size="sm">
                  -{posture.breakdown.find(b => b.category === "nrd")?.penalty}pt
                </Badge>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: typosquatServices.length > 0 ? "#dc2626" : "#22c55e",
                }}
              />
              <span style={{ fontSize: "13px" }}>Typosquat: {typosquatServices.length}件</span>
              {typosquatServices.length > 0 && (
                <Badge variant="danger" size="sm">
                  -{posture.breakdown.find(b => b.category === "typosquat")?.penalty}pt
                </Badge>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: violations.length > 50 ? "#f97316" : "#22c55e",
                }}
              />
              <span style={{ fontSize: "13px" }}>CSP違反: {violations.length}件</span>
              {violations.length >= 10 && (
                <Badge variant="warning" size="sm">
                  -{posture.breakdown.find(b => b.category === "csp_violation")?.penalty}pt
                </Badge>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: aiPrompts.length > 0 ? "#3b82f6" : "#6b7280",
                }}
              />
              <span style={{ fontSize: "13px" }}>AI利用: {aiPrompts.length}件</span>
              <Badge variant="info" size="sm">監視中</Badge>
            </div>
          </div>
        </div>
      </Card>

      <Card title="7日間のアクティビティ" style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: "80px" }}>
          {(() => {
            const dayLabels = ["月", "火", "水", "木", "金", "土", "日"];
            const todayIndex = new Date().getDay();
            return chartData.dayData.map(({ offset, count, hasRisk }, i) => {
              const dayOfWeek = (todayIndex - offset + 7) % 7;
              const height = Math.max(4, (count / chartData.maxCount) * 60);
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: `${height}px`,
                      background: hasRisk
                        ? "#dc2626"
                        : count > 0
                          ? colors.interactive
                          : colors.bgSecondary,
                      borderRadius: "4px 4px 0 0",
                    }}
                    title={`${count}件`}
                  />
                  <span style={{ fontSize: "10px", color: colors.textSecondary }}>{dayLabels[dayOfWeek]}</span>
                </div>
              );
            });
          })()}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "8px",
            fontSize: "11px",
            color: colors.textSecondary,
          }}
        >
          <span>7日前</span>
          <span>今日</span>
        </div>
      </Card>

      <div style={styles.twoColumn}>
        <HorizontalBarChart data={directiveStats} title="Directive別違反数" styles={styles} />
        <HorizontalBarChart data={domainStats} title="ドメイン別違反数" styles={styles} />
      </div>

      <Card title="最近のイベント">
        {(() => {
          const recentEvents = events.slice(0, 10);
          if (recentEvents.length === 0) {
            return <p style={styles.emptyText}>イベントなし</p>;
          }
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {recentEvents.map((e) => (
                <div key={e.id} style={styles.eventItem}>
                  <span style={styles.eventTime}>
                    {new Date(e.timestamp).toLocaleTimeString("ja-JP")}
                  </span>
                  <Badge
                    variant={
                      e.type.includes("violation") || e.type.includes("nrd")
                        ? "danger"
                        : e.type.includes("ai") || e.type.includes("login")
                          ? "warning"
                          : "default"
                    }
                  >
                    {e.type}
                  </Badge>
                  <code style={styles.code}>{e.domain}</code>
                </div>
              ))}
            </div>
          );
        })()}
      </Card>

      <Card title="セキュリティ推奨事項" style={{ marginTop: "24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {nrdServices.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                padding: "12px",
                background: colors.bgSecondary,
                borderRadius: "8px",
                borderLeft: "3px solid #dc2626",
              }}
            >
              <Badge variant="danger">Critical</Badge>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, marginBottom: "4px" }}>NRDサイトへのアクセスを確認</div>
                <div style={{ fontSize: "12px", color: colors.textSecondary }}>
                  {nrdServices.map((s) => s.domain).join(", ")} への接続が検出されました。
                  これらは新規登録ドメインであり、フィッシングの可能性があります。
                </div>
              </div>
            </div>
          )}
          {typosquatServices.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                padding: "12px",
                background: colors.bgSecondary,
                borderRadius: "8px",
                borderLeft: "3px solid #dc2626",
              }}
            >
              <Badge variant="danger">Critical</Badge>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, marginBottom: "4px" }}>タイポスクワットの疑い</div>
                <div style={{ fontSize: "12px", color: colors.textSecondary }}>
                  {typosquatServices.map((s) => s.domain).join(", ")} は
                  正規サイトの偽装の可能性があります。URLを再確認してください。
                </div>
              </div>
            </div>
          )}
          {privacyPolicyMissingCount > 5 && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                padding: "12px",
                background: colors.bgSecondary,
                borderRadius: "8px",
                borderLeft: "3px solid #f97316",
              }}
            >
              <Badge variant="warning">High</Badge>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, marginBottom: "4px" }}>プライバシーポリシー未確認のサイト</div>
                <div style={{ fontSize: "12px", color: colors.textSecondary }}>
                  {privacyPolicyMissingCount}件のサイトでプライバシーポリシーが確認できません。
                  個人情報の取り扱いに注意してください。
                </div>
              </div>
            </div>
          )}
          {aiPrompts.length > 10 && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                padding: "12px",
                background: colors.bgSecondary,
                borderRadius: "8px",
                borderLeft: "3px solid #3b82f6",
              }}
            >
              <Badge variant="info">Info</Badge>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, marginBottom: "4px" }}>AI利用の監視</div>
                <div style={{ fontSize: "12px", color: colors.textSecondary }}>
                  {aiPrompts.length}件のAIプロンプトが記録されています。
                  機密情報をAIに送信していないか確認してください。
                </div>
              </div>
            </div>
          )}
          {violations.length > 50 && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                padding: "12px",
                background: colors.bgSecondary,
                borderRadius: "8px",
                borderLeft: "3px solid #eab308",
              }}
            >
              <Badge variant="warning">Medium</Badge>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, marginBottom: "4px" }}>CSP違反の増加</div>
                <div style={{ fontSize: "12px", color: colors.textSecondary }}>
                  {violations.length}件のCSP違反が検出されています。
                  サードパーティスクリプトの監視を強化することを推奨します。
                </div>
              </div>
            </div>
          )}
          {nrdServices.length === 0 && typosquatServices.length === 0 && violations.length < 50 && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                padding: "12px",
                background: colors.bgSecondary,
                borderRadius: "8px",
                borderLeft: "3px solid #22c55e",
              }}
            >
              <Badge variant="success">Good</Badge>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, marginBottom: "4px" }}>セキュリティ状態は良好です</div>
                <div style={{ fontSize: "12px", color: colors.textSecondary }}>
                  重大なセキュリティリスクは検出されていません。引き続き監視を継続します。
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}

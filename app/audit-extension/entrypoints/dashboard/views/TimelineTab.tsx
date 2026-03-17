import { useState, useCallback } from "preact/hooks";
import { useTheme } from "../../../lib/theme";
import { Card, Select } from "../../../components";
import {
  StackedTimelineChart,
  ActivityHeatmap,
  type TimeGranularity,
} from "../../../components/TimelineChart";
import {
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Filter,
  BarChart3,
  Activity,
  Calendar,
} from "lucide-preact";
import type { EventCategory } from "../domain/events";
import { useTimelineModel } from "../state/useTimelineModel";

export function TimelineTab() {
  const { colors } = useTheme();
  const [granularity, setGranularity] = useState<TimeGranularity>("day");
  const [category, setCategory] = useState<EventCategory | "all">("all");
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("7d");

  const {
    loading,
    filteredEvents,
    eventStats,
    domainStats,
    peakHour,
    maxBars,
    typeColors,
  } = useTimelineModel({
    period,
    category,
    granularity,
    fallbackColor: colors.textMuted,
  });

  const getTrendIcon = useCallback(
    (trend: number) => {
      if (trend > 0) return <TrendingUp size={14} color="#ef4444" />;
      if (trend < 0) return <TrendingDown size={14} color="#22c55e" />;
      return <Minus size={14} color={colors.textMuted} />;
    },
    [colors.textMuted]
  );

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "200px",
          color: colors.textMuted,
        }}
      >
        読み込み中...
      </div>
    );
  }

  return (
    <div>
      {/* フィルタ */}
      <Card style={{ marginBottom: "24px" }}>
        <div
          style={{
            display: "flex",
            gap: "16px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Calendar size={16} color={colors.textSecondary} />
            <span style={{ fontSize: "13px" }}>期間:</span>
            <Select
              value={period}
              onChange={(v) => setPeriod(v as typeof period)}
              options={[
                { value: "7d", label: "過去7日" },
                { value: "30d", label: "過去30日" },
                { value: "90d", label: "過去90日" },
              ]}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <BarChart3 size={16} color={colors.textSecondary} />
            <span style={{ fontSize: "13px" }}>粒度:</span>
            <Select
              value={granularity}
              onChange={(v) => setGranularity(v as TimeGranularity)}
              options={[
                { value: "hour", label: "時間" },
                { value: "day", label: "日" },
                { value: "week", label: "週" },
              ]}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Filter size={16} color={colors.textSecondary} />
            <span style={{ fontSize: "13px" }}>カテゴリ:</span>
            <Select
              value={category}
              onChange={(v) => setCategory(v as EventCategory)}
              options={[
                { value: "all", label: "すべて" },
                { value: "security", label: "セキュリティ" },
                { value: "ai", label: "AI関連" },
                { value: "policy", label: "ポリシー" },
                { value: "session", label: "セッション" },
                { value: "network", label: "ネットワーク" },
              ]}
            />
          </div>

          <div
            style={{
              marginLeft: "auto",
              fontSize: "13px",
              color: colors.textSecondary,
            }}
          >
            {filteredEvents.length.toLocaleString()} 件のイベント
          </div>
        </div>
      </Card>

      {/* サマリーカード */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <Card>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "8px",
            }}
          >
            <Activity size={16} color={colors.interactive} />
            <span style={{ fontSize: "13px", color: colors.textSecondary }}>
              総イベント数
            </span>
          </div>
          <div style={{ fontSize: "24px", fontWeight: 600 }}>
            {filteredEvents.length.toLocaleString()}
          </div>
        </Card>

        <Card>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "8px",
            }}
          >
            <Clock size={16} color={colors.interactive} />
            <span style={{ fontSize: "13px", color: colors.textSecondary }}>
              ピーク時間帯
            </span>
          </div>
          <div style={{ fontSize: "24px", fontWeight: 600 }}>
            {peakHour !== null
              ? `${peakHour}:00 - ${(peakHour + 1) % 24}:00`
              : "—"}
          </div>
        </Card>

        <Card>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "8px",
            }}
          >
            <TrendingUp size={16} color={colors.interactive} />
            <span style={{ fontSize: "13px", color: colors.textSecondary }}>
              イベントタイプ数
            </span>
          </div>
          <div style={{ fontSize: "24px", fontWeight: 600 }}>
            {eventStats.length}
          </div>
        </Card>

        <Card>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "8px",
            }}
          >
            <BarChart3 size={16} color={colors.interactive} />
            <span style={{ fontSize: "13px", color: colors.textSecondary }}>
              ドメイン数
            </span>
          </div>
          <div style={{ fontSize: "24px", fontWeight: 600 }}>
            {domainStats.total}
          </div>
        </Card>
      </div>

      {/* 時系列チャート */}
      <Card title="イベント推移" style={{ marginBottom: "24px" }}>
        <StackedTimelineChart
          data={filteredEvents.map((e) => ({
            timestamp: e.timestamp,
            type: e.type,
          }))}
          granularity={granularity}
          typeColors={typeColors}
          height={160}
          maxBars={maxBars}
        />

        {/* 凡例 */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            marginTop: "16px",
            paddingTop: "16px",
            borderTop: `1px solid ${colors.border}`,
          }}
        >
          {eventStats.slice(0, 6).map((stat) => (
            <div
              key={stat.type}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "2px",
                  background: stat.color,
                }}
              />
              <span style={{ fontSize: "11px", color: colors.textSecondary }}>
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "24px",
          marginBottom: "24px",
        }}
      >
        {/* アクティビティヒートマップ */}
        <Card title="活動ヒートマップ（直近7日間／時間帯×曜日）">
          <div style={{ marginTop: "8px" }}>
            <ActivityHeatmap
              data={filteredEvents.map((e) => ({ timestamp: e.timestamp }))}
              days={7}
              cellSize={16}
            />
          </div>
          <div
            style={{
              fontSize: "11px",
              color: colors.textMuted,
              marginTop: "12px",
            }}
          >
            濃い青ほどイベント数が多い時間帯
          </div>
        </Card>

        {/* イベントタイプ別統計 */}
        <Card title="イベントタイプ別">
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {eventStats.slice(0, 8).map((stat) => (
              <div
                key={stat.type}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px",
                  background: colors.bgSecondary,
                  borderRadius: "6px",
                }}
              >
                <div
                  style={{
                    width: "4px",
                    height: "24px",
                    borderRadius: "2px",
                    background: stat.color,
                  }}
                />
                <span style={{ flex: 1, fontSize: "12px" }}>{stat.label}</span>
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    marginRight: "8px",
                  }}
                >
                  {stat.count}
                </span>
                {getTrendIcon(stat.trend)}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ドメイン別アクティビティ */}
      <Card title="ドメイン別アクティビティ（Top 10）">
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {domainStats.top10.map((stat, index) => {
            const maxCount = domainStats.top10[0]?.count || 1;
            const width = (stat.count / maxCount) * 100;
            return (
              <div
                key={stat.domain}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <span
                  style={{
                    width: "24px",
                    fontSize: "12px",
                    color: colors.textMuted,
                  }}
                >
                  {index + 1}
                </span>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: "12px",
                      marginBottom: "4px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {stat.domain || "(unknown)"}
                  </div>
                  <div
                    style={{
                      height: "4px",
                      background: colors.bgSecondary,
                      borderRadius: "2px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${width}%`,
                        height: "100%",
                        background: colors.interactive,
                        borderRadius: "2px",
                      }}
                    />
                  </div>
                </div>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 500,
                    minWidth: "40px",
                    textAlign: "right",
                  }}
                >
                  {stat.count}
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

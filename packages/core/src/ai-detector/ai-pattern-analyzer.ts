/**
 * @fileoverview AI Utilization Pattern Analyzer
 *
 * Analyzes AI service usage patterns across the organization
 * to identify trends, anomalies, and risk patterns.
 */

export interface AIUsageEvent {
  timestamp: number;
  provider: string;
  domain: string;
  hasSensitiveData: boolean;
  dataTypes: string[];
  severity: "low" | "medium" | "high" | "critical";
}

export interface ProviderDistribution {
  provider: string;
  count: number;
  percentage: number;
  sensitivDataCount: number;
  riskLevel: "low" | "medium" | "high";
}

export interface AIPatternAnalysis {
  period: { start: number; end: number };
  totalEvents: number;
  eventsByHour: Record<number, number>;
  providerDistribution: ProviderDistribution[];
  sensitiveDataPercentage: number;
  averageEventsPerDay: number;
  peakUsageHour: number;
  anomalies: AIAnomaly[];
  riskMetrics: AIRiskMetrics;
}

export interface AIAnomaly {
  type: "spike" | "unusual_provider" | "sensitive_data_surge" | "time_pattern";
  severity: "low" | "medium" | "high";
  description: string;
  affectedProvider?: string;
  value: number;
  timestamp: number;
}

export interface AIRiskMetrics {
  criticalEvents: number;
  highRiskProviders: string[];
  sensitiveDataExposures: number;
  unusualActivityScore: number; // 0-100
  overallRiskScore: number; // 0-100
}

export interface OrganizationAITrend {
  period: string;
  totalUsage: number;
  growthRate: number; // percentage
  dominantProvider: string;
  sensitiveDataTrend: "increasing" | "stable" | "decreasing";
  riskTrend: "worsening" | "stable" | "improving";
}

class AIPatternAnalyzer {
  private events: AIUsageEvent[] = [];

  /**
   * Add AI usage event to analysis
   */
  addEvent(event: AIUsageEvent): void {
    this.events.push(event);
  }

  /**
   * Add multiple events
   */
  addEvents(events: AIUsageEvent[]): void {
    for (const event of events) {
      this.events.push(event);
    }
  }

  /**
   * Clear all events
   */
  clearEvents(): void {
    this.events = [];
  }

  /**
   * Analyze AI usage patterns for a time period
   */
  analyzePatterns(period: { start: number; end: number }): AIPatternAnalysis {
    const periodEvents = this.events.filter(
      (e) => e.timestamp >= period.start && e.timestamp <= period.end
    );

    const eventsByHour = this.groupEventsByHour(periodEvents);
    const providerDistribution = this.analyzeProviderDistribution(periodEvents);
    const sensitiveDataPercentage = this.calculateSensitiveDataPercentage(
      periodEvents
    );
    const averageEventsPerDay = this.calculateAverageEventsPerDay(
      periodEvents,
      period
    );
    const peakUsageHour = this.findPeakUsageHour(eventsByHour);
    const anomalies = this.detectAnomalies(periodEvents, eventsByHour);
    const riskMetrics = this.calculateRiskMetrics(periodEvents);

    return {
      period,
      totalEvents: periodEvents.length,
      eventsByHour,
      providerDistribution,
      sensitiveDataPercentage,
      averageEventsPerDay,
      peakUsageHour,
      anomalies,
      riskMetrics,
    };
  }

  /**
   * Group events by hour of day
   */
  private groupEventsByHour(events: AIUsageEvent[]): Record<number, number> {
    const hourly: Record<number, number> = {};

    for (let i = 0; i < 24; i++) {
      hourly[i] = 0;
    }

    for (const event of events) {
      const hour = new Date(event.timestamp).getHours();
      hourly[hour]++;
    }

    return hourly;
  }

  /**
   * Analyze provider distribution
   */
  private analyzeProviderDistribution(
    events: AIUsageEvent[]
  ): ProviderDistribution[] {
    const providerMap = new Map<
      string,
      { count: number; sensitiveCount: number }
    >();

    for (const event of events) {
      const current = providerMap.get(event.provider) || {
        count: 0,
        sensitiveCount: 0,
      };
      current.count++;
      if (event.hasSensitiveData) {
        current.sensitiveCount++;
      }
      providerMap.set(event.provider, current);
    }

    return Array.from(providerMap.entries())
      .map(([provider, data]) => {
        const percentage = (data.count / events.length) * 100;
        let riskLevel: "low" | "medium" | "high" = "low";

        if (data.sensitiveCount > data.count * 0.5) {
          riskLevel = "high";
        } else if (data.sensitiveCount > data.count * 0.3) {
          riskLevel = "medium";
        }

        return {
          provider,
          count: data.count,
          percentage,
          sensitivDataCount: data.sensitiveCount,
          riskLevel,
        };
      })
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Calculate percentage of events with sensitive data
   */
  private calculateSensitiveDataPercentage(events: AIUsageEvent[]): number {
    if (events.length === 0) return 0;
    const sensitiveCount = events.filter((e) => e.hasSensitiveData).length;
    return (sensitiveCount / events.length) * 100;
  }

  /**
   * Calculate average events per day
   */
  private calculateAverageEventsPerDay(
    events: AIUsageEvent[],
    period: { start: number; end: number }
  ): number {
    const days = (period.end - period.start) / (1000 * 60 * 60 * 24);
    return events.length / Math.max(days, 1);
  }

  /**
   * Find peak usage hour
   */
  private findPeakUsageHour(eventsByHour: Record<number, number>): number {
    let maxHour = 0;
    let maxCount = 0;

    for (const [hour, count] of Object.entries(eventsByHour)) {
      if (count > maxCount) {
        maxCount = count;
        maxHour = parseInt(hour, 10);
      }
    }

    return maxHour;
  }

  /**
   * Detect anomalies in usage patterns
   */
  private detectAnomalies(
    events: AIUsageEvent[],
    eventsByHour: Record<number, number>
  ): AIAnomaly[] {
    const anomalies: AIAnomaly[] = [];

    // Detect usage spikes
    const avgHourlyUsage =
      events.length / Object.keys(eventsByHour).length;
    for (const [hour, count] of Object.entries(eventsByHour)) {
      if (count > avgHourlyUsage * 3) {
        anomalies.push({
          type: "spike",
          severity: "medium",
          description: `${hour}時に${count}件のAI利用が検出されました（平均: ${Math.round(avgHourlyUsage)}件）`,
          value: count,
          timestamp: Date.now(),
        });
      }
    }

    // Detect unusual providers
    const providerDistribution = this.analyzeProviderDistribution(events);
    const highRiskProviders = providerDistribution.filter(
      (p) => p.riskLevel === "high"
    );
    for (const provider of highRiskProviders) {
      anomalies.push({
        type: "unusual_provider",
        severity: provider.sensitivDataCount > 0 ? "high" : "medium",
        description: `${provider.provider}への${provider.sensitivDataCount}件の機密データ送信を検出`,
        affectedProvider: provider.provider,
        value: provider.sensitivDataCount,
        timestamp: Date.now(),
      });
    }

    // Detect sensitive data surge
    const sensitiveDataPercentage = this.calculateSensitiveDataPercentage(
      events
    );
    if (sensitiveDataPercentage > 30) {
      anomalies.push({
        type: "sensitive_data_surge",
        severity: "high",
        description: `機密データ送信率が${sensitiveDataPercentage.toFixed(1)}%に達しました`,
        value: sensitiveDataPercentage,
        timestamp: Date.now(),
      });
    }

    return anomalies;
  }

  /**
   * Calculate risk metrics
   */
  private calculateRiskMetrics(events: AIUsageEvent[]): AIRiskMetrics {
    const criticalEvents = events.filter(
      (e) => e.severity === "critical"
    ).length;
    const highRiskProviders = [
      ...new Set(
        events
          .filter((e) => e.severity === "high" || e.severity === "critical")
          .map((e) => e.provider)
      ),
    ];
    const sensitiveDataExposures = events.filter(
      (e) => e.hasSensitiveData
    ).length;

    // Calculate unusual activity score
    const providerDistribution = this.analyzeProviderDistribution(events);
    const highRiskProviderCount = providerDistribution.filter(
      (p) => p.riskLevel === "high"
    ).length;
    const unusualActivityScore = Math.min(
      100,
      criticalEvents * 20 +
        highRiskProviderCount * 15 +
        Math.floor(sensitiveDataExposures / Math.max(events.length / 10, 1)) *
          10
    );

    // Calculate overall risk score
    const overallRiskScore = Math.min(
      100,
      (criticalEvents * 25 +
        sensitiveDataExposures * 5 +
        highRiskProviders.length * 15) /
        Math.max(events.length, 1)
    );

    return {
      criticalEvents,
      highRiskProviders,
      sensitiveDataExposures,
      unusualActivityScore,
      overallRiskScore,
    };
  }

  /**
   * Analyze organization AI trend
   */
  analyzeTrend(
    previousAnalysis: AIPatternAnalysis | null,
    currentAnalysis: AIPatternAnalysis
  ): OrganizationAITrend {
    const periodStart = new Date(currentAnalysis.period.start);
    const periodEnd = new Date(currentAnalysis.period.end);
    const periodLabel = `${periodStart.toLocaleDateString("ja-JP")} - ${periodEnd.toLocaleDateString("ja-JP")}`;

    let growthRate = 0;
    if (previousAnalysis) {
      growthRate =
        ((currentAnalysis.totalEvents - previousAnalysis.totalEvents) /
          previousAnalysis.totalEvents) *
        100;
    }

    const dominantProvider =
      currentAnalysis.providerDistribution[0]?.provider ||
      "unknown";

    // Determine sensitive data trend
    let sensitiveDataTrend: "increasing" | "stable" | "decreasing" = "stable";
    if (previousAnalysis) {
      if (
        currentAnalysis.sensitiveDataPercentage >
        previousAnalysis.sensitiveDataPercentage + 5
      ) {
        sensitiveDataTrend = "increasing";
      } else if (
        currentAnalysis.sensitiveDataPercentage <
        previousAnalysis.sensitiveDataPercentage - 5
      ) {
        sensitiveDataTrend = "decreasing";
      }
    }

    // Determine risk trend
    let riskTrend: "worsening" | "stable" | "improving" = "stable";
    if (previousAnalysis) {
      if (
        currentAnalysis.riskMetrics.overallRiskScore >
        previousAnalysis.riskMetrics.overallRiskScore + 10
      ) {
        riskTrend = "worsening";
      } else if (
        currentAnalysis.riskMetrics.overallRiskScore <
        previousAnalysis.riskMetrics.overallRiskScore - 10
      ) {
        riskTrend = "improving";
      }
    }

    return {
      period: periodLabel,
      totalUsage: currentAnalysis.totalEvents,
      growthRate,
      dominantProvider,
      sensitiveDataTrend,
      riskTrend,
    };
  }
}

/**
 * Create AI pattern analyzer instance
 */
export function createAIPatternAnalyzer(): AIPatternAnalyzer {
  return new AIPatternAnalyzer();
}

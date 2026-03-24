/**
 * @fileoverview Service Filters
 *
 * DetectedService配列に対するフィルタリングユーティリティ。
 */

import type { DetectedService } from "@libztbs/types";

/** NRD（新規登録ドメイン）に該当するサービスをフィルタ */
export function filterNRDServices(services: DetectedService[]): DetectedService[] {
  return services.filter((s) => s.nrdResult?.isNRD);
}

/** ログインページを持つサービスをフィルタ */
export function filterLoginServices(services: DetectedService[]): DetectedService[] {
  return services.filter((s) => s.hasLoginPage);
}

/** タイポスクワットに該当するサービスをフィルタ */
export function filterTyposquatServices(services: DetectedService[]): DetectedService[] {
  return services.filter((s) => s.typosquatResult?.isTyposquat);
}

/** AI活動が検出されたサービスをフィルタ */
export function filterAIServices(services: DetectedService[]): DetectedService[] {
  return services.filter((s) => s.aiDetected?.hasAIActivity);
}

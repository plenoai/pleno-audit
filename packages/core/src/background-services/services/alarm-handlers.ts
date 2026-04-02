interface LoggerLike {
  debug: (...args: unknown[]) => void;
}

interface AlarmHandlerDependencies {
  logger: LoggerLike;
  checkDNRMatchesHandler: () => Promise<void>;
  analyzeExtensionRisks: () => Promise<void>;
}

export function createAlarmHandlers(
  deps: AlarmHandlerDependencies,
): Map<string, () => void> {
  return new Map([
    ["checkDNRMatches", () => {
      deps.checkDNRMatchesHandler().catch((error) => deps.logger.debug("DNR match check failed:", error));
    }],
    ["extensionRiskAnalysis", () => {
      deps.analyzeExtensionRisks().catch((error) => deps.logger.debug("Extension risk analysis failed:", error));
    }],
  ]);
}

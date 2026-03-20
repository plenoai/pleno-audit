import type {
  DetectedService,
  NRDCache,
  NRDConfig,
  NRDDetectedDetails,
  NRDResult,
  TyposquatCache,
  TyposquatConfig,
  TyposquatDetectedDetails,
  TyposquatResult,
} from "@pleno-audit/detectors";
import {
  DEFAULT_NRD_CONFIG,
  DEFAULT_TYPOSQUAT_CONFIG,
  createNRDDetector,
  createTyposquatDetector,
} from "@pleno-audit/detectors";
import { DEFAULT_DETECTION_CONFIG, type DetectionConfig } from "@pleno-audit/extension-runtime";
import type { AlertManager } from "@pleno-audit/alerts";
import { resolveEventTimestamp } from "./event-timestamp.js";

interface LoggerLike {
  error: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
}

interface DomainRiskStorage {
  nrdConfig?: NRDConfig;
  typosquatConfig?: TyposquatConfig;
  detectionConfig?: DetectionConfig;
}

type DomainRiskEvent =
  | {
      type: "nrd_detected";
      domain: string;
      timestamp: number;
      details: NRDDetectedDetails;
    }
  | {
      type: "typosquat_detected";
      domain: string;
      timestamp: number;
      details: TyposquatDetectedDetails;
    };

interface DomainRiskServiceDeps {
  logger: LoggerLike;
  getStorage: () => Promise<DomainRiskStorage>;
  setStorage: (data: Partial<DomainRiskStorage>) => Promise<void>;
  updateService: (domain: string, update: Partial<DetectedService>) => Promise<void>;
  addEvent: (event: DomainRiskEvent) => Promise<unknown>;
  getAlertManager: () => AlertManager;
}

export interface DomainRiskService {
  handleNRDCheck: (domain: string) => Promise<NRDResult | { skipped: true; reason: string }>;
  getNRDConfig: () => Promise<NRDConfig>;
  setNRDConfig: (config: NRDConfig) => Promise<{ success: boolean }>;
  handleTyposquatCheck: (
    domain: string,
  ) => Promise<TyposquatResult | { skipped: true; reason: string }>;
  getTyposquatConfig: () => Promise<TyposquatConfig>;
  setTyposquatConfig: (config: TyposquatConfig) => Promise<{ success: boolean }>;
}

export function createDomainRiskService(deps: DomainRiskServiceDeps): DomainRiskService {
  const nrdCache: Map<string, NRDResult> = new Map();
  const typosquatCache: Map<string, TyposquatResult> = new Map();
  let nrdDetector: ReturnType<typeof createNRDDetector> | null = null;
  let typosquatDetector: ReturnType<typeof createTyposquatDetector> | null = null;

  const nrdCacheAdapter: NRDCache = {
    get: (domain) => nrdCache.get(domain) ?? null,
    set: (domain, result) => nrdCache.set(domain, result),
    clear: () => nrdCache.clear(),
  };

  const typosquatCacheAdapter: TyposquatCache = {
    get: (domain) => typosquatCache.get(domain) ?? null,
    set: (domain, result) => typosquatCache.set(domain, result),
    clear: () => typosquatCache.clear(),
  };

  async function getNRDConfig(): Promise<NRDConfig> {
    const storage = await deps.getStorage();
    return storage.nrdConfig || DEFAULT_NRD_CONFIG;
  }

  async function initNRDDetector(): Promise<void> {
    const config = await getNRDConfig();
    nrdDetector = createNRDDetector(config, nrdCacheAdapter);
  }

  async function checkNRD(domain: string): Promise<NRDResult> {
    if (!nrdDetector) {
      await initNRDDetector();
    }
    return nrdDetector!.checkDomain(domain);
  }

  async function handleNRDCheck(domain: string): Promise<NRDResult | { skipped: true; reason: string }> {
    try {
      const storage = await deps.getStorage();
      const detectionConfig = storage.detectionConfig || DEFAULT_DETECTION_CONFIG;

      if (!detectionConfig.enableNRD) {
        return { skipped: true, reason: "NRD detection disabled" };
      }

      const result = await checkNRD(domain);

      if (result.isNRD) {
        await deps.updateService(result.domain, {
          nrdResult: {
            isNRD: result.isNRD,
            confidence: result.confidence,
            domainAge: result.domainAge,
            checkedAt: result.checkedAt,
          },
        });

        await deps.addEvent({
          type: "nrd_detected",
          domain: result.domain,
          timestamp: resolveEventTimestamp(result.checkedAt, {
            logger: deps.logger,
            context: "nrd_detected",
          }),
          details: {
            isNRD: result.isNRD,
            confidence: result.confidence,
            registrationDate: result.registrationDate,
            domainAge: result.domainAge,
            method: result.method,
            suspiciousScore: result.suspiciousScores.totalScore,
            isDDNS: result.ddns.isDDNS,
            ddnsProvider: result.ddns.provider,
          },
        });

        await deps.getAlertManager().alertNRD({
          domain: result.domain,
          domainAge: result.domainAge,
          registrationDate: result.registrationDate,
          confidence: result.confidence,
        });
      }

      return result;
    } catch (error) {
      deps.logger.error("NRD check failed:", error);
      throw error;
    }
  }

  async function setNRDConfig(config: NRDConfig): Promise<{ success: boolean }> {
    try {
      await deps.setStorage({ nrdConfig: config });
      await initNRDDetector();
      nrdCacheAdapter.clear();
      return { success: true };
    } catch (error) {
      deps.logger.error("Error setting NRD config:", error);
      return { success: false };
    }
  }

  async function getTyposquatConfig(): Promise<TyposquatConfig> {
    const storage = await deps.getStorage();
    return storage.typosquatConfig || DEFAULT_TYPOSQUAT_CONFIG;
  }

  async function initTyposquatDetector(): Promise<void> {
    const config = await getTyposquatConfig();
    typosquatDetector = createTyposquatDetector(config, typosquatCacheAdapter);
  }

  function checkTyposquat(domain: string): TyposquatResult {
    if (!typosquatDetector) {
      typosquatDetector = createTyposquatDetector(
        DEFAULT_TYPOSQUAT_CONFIG,
        typosquatCacheAdapter,
      );
    }
    return typosquatDetector.checkDomain(domain);
  }

  async function handleTyposquatCheck(
    domain: string,
  ): Promise<TyposquatResult | { skipped: true; reason: string }> {
    try {
      const storage = await deps.getStorage();
      const detectionConfig = storage.detectionConfig || DEFAULT_DETECTION_CONFIG;

      if (!detectionConfig.enableTyposquat) {
        return { skipped: true, reason: "Typosquat detection disabled" };
      }

      if (!typosquatDetector) {
        await initTyposquatDetector();
      }

      const result = checkTyposquat(domain);

      if (result.isTyposquat) {
        await deps.updateService(result.domain, {
          typosquatResult: {
            isTyposquat: result.isTyposquat,
            confidence: result.confidence,
            totalScore: result.heuristics.totalScore,
            checkedAt: result.checkedAt,
          },
        });

        await deps.addEvent({
          type: "typosquat_detected",
          domain: result.domain,
          timestamp: resolveEventTimestamp(result.checkedAt, {
            logger: deps.logger,
            context: "typosquat_detected",
          }),
          details: {
            isTyposquat: result.isTyposquat,
            confidence: result.confidence,
            totalScore: result.heuristics.totalScore,
            homoglyphCount: result.heuristics.homoglyphs.length,
            hasMixedScript: result.heuristics.hasMixedScript,
            detectedScripts: result.heuristics.detectedScripts,
          },
        });

        await deps.getAlertManager().alertTyposquat({
          domain: result.domain,
          homoglyphCount: result.heuristics.homoglyphs.length,
          confidence: result.confidence,
        });
      }

      return result;
    } catch (error) {
      deps.logger.error("Typosquat check failed:", error);
      throw error;
    }
  }

  async function setTyposquatConfig(config: TyposquatConfig): Promise<{ success: boolean }> {
    try {
      await deps.setStorage({ typosquatConfig: config });
      await initTyposquatDetector();
      typosquatCacheAdapter.clear();
      return { success: true };
    } catch (error) {
      deps.logger.error("Error setting Typosquat config:", error);
      return { success: false };
    }
  }

  return {
    handleNRDCheck,
    getNRDConfig,
    setNRDConfig,
    handleTyposquatCheck,
    getTyposquatConfig,
    setTyposquatConfig,
  };
}

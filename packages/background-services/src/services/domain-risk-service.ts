import type { DetectedService } from "@pleno-audit/casb-types";
import type { NRDCache, NRDConfig, NRDResult } from "@pleno-audit/nrd";
import { DEFAULT_NRD_CONFIG, createNRDDetector } from "@pleno-audit/nrd";
import type { TyposquatCache, TyposquatConfig, TyposquatResult } from "@pleno-audit/typosquat";
import { DEFAULT_TYPOSQUAT_CONFIG, createTyposquatDetector } from "@pleno-audit/typosquat";
import { DEFAULT_DETECTION_CONFIG, type DetectionConfig } from "@pleno-audit/extension-runtime";
import type { AlertManager } from "@pleno-audit/alerts";

interface LoggerLike {
  error: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
}

interface DomainRiskStorage {
  nrdConfig?: NRDConfig;
  typosquatConfig?: TyposquatConfig;
  detectionConfig?: DetectionConfig;
}

interface DomainRiskServiceDeps {
  logger: LoggerLike;
  getStorage: () => Promise<DomainRiskStorage>;
  setStorage: (data: Partial<DomainRiskStorage>) => Promise<void>;
  updateService: (domain: string, update: Partial<DetectedService>) => Promise<void>;
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

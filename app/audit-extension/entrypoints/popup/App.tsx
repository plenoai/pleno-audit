import { useState, useEffect } from "preact/hooks";
import type {
  DetectedService,
  CapturedAIPrompt,
} from "@pleno-audit/detectors";
import { analyzePrompt } from "@pleno-audit/detectors";
import type { CSPViolation, NetworkRequest } from "@pleno-audit/csp";
import {
  createLogger,
  type StorageData,
  type DoHRequestRecord,
} from "@pleno-audit/extension-runtime";
import { Shield } from "lucide-preact";
import { ThemeContext, useThemeState, useTheme } from "../../lib/theme";
import { Badge, Button, ErrorBoundary, PopupSettingsMenu } from "../../components";
import {
  ServiceTab,
  EventTab,
  PolicyTab,
} from "./components";
import { createStyles } from "./styles";
import { aggregateServices, type UnifiedService } from "./utils/serviceAggregator";
import { sendMessage } from "./utils/messaging";

type Tab = "service" | "event" | "policy";
const logger = createLogger("popup-app");

function countEvents(data: TabData): number {
  const nrdCount = data.services.filter((s) => s.nrdResult?.isNRD).length;
  const typosquatCount = data.services.filter((s) => s.typosquatResult?.isTyposquat).length;
  let aiRiskCount = 0;
  for (const prompt of data.aiPrompts) {
    const { pii, risk } = analyzePrompt(prompt.prompt);
    if (pii.hasSensitiveData) {
      if (risk.riskLevel !== "info" && risk.riskLevel !== "low") {
        aiRiskCount++;
      }
    }
  }
  return nrdCount + typosquatCount + aiRiskCount + data.violations.length + data.doHRequests.length + data.networkRequests.length;
}

const TABS: { key: Tab; label: string; count?: (data: TabData) => number }[] = [
  { key: "service", label: "Service", count: (d) => d.unifiedServices.length },
  { key: "event", label: "Event", count: countEvents },
  { key: "policy", label: "Policy" },
];

interface TabData {
  services: DetectedService[];
  unifiedServices: UnifiedService[];
  aiPrompts: CapturedAIPrompt[];
  violations: CSPViolation[];
  networkRequests: NetworkRequest[];
  doHRequests: DoHRequestRecord[];
}

function getStatus(data: TabData) {
  const nrdCount = data.services.filter(s => s.nrdResult?.isNRD).length;
  if (nrdCount > 0) return { variant: "danger" as const, label: "警告", dot: false };
  if (data.violations.length > 10) return { variant: "warning" as const, label: "注意", dot: false };
  if (data.aiPrompts.length > 0) return { variant: "info" as const, label: "監視", dot: false };
  return { variant: "success" as const, label: "正常", dot: true };
}

function PopupContent() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [data, setData] = useState<StorageData>({ services: {}, events: [] });
  const [tab, setTab] = useState<Tab>("service");
  const [loading, setLoading] = useState(true);
  const [violations, setViolations] = useState<CSPViolation[]>([]);
  const [networkRequests, setNetworkRequests] = useState<NetworkRequest[]>([]);
  const [aiPrompts, setAIPrompts] = useState<CapturedAIPrompt[]>([]);
  const [doHRequests, setDoHRequests] = useState<DoHRequestRecord[]>([]);
  const [unifiedServices, setUnifiedServices] = useState<UnifiedService[]>([]);

  useEffect(() => {
    loadData();
    loadCSPData();
    loadAIData();
    loadDoHData();
    const listener = (changes: {
      [key: string]: chrome.storage.StorageChange;
    }) => {
      if (changes.services) {
        loadData();
      }
      if (changes.cspReports) {
        loadCSPData();
      }
      if (changes.aiPrompts) {
        loadAIData();
      }
      if (changes.doHRequests) {
        loadDoHData();
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  async function loadData() {
    try {
      const servicesResult = await chrome.storage.local.get(["services"]);
      setData({
        services: servicesResult.services || {},
        events: [],
      });
    } catch (error) {
      logger.warn({
        event: "POPUP_STORAGE_LOAD_FAILED",
        error,
      });
      setData({
        services: {},
        events: [],
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadCSPData() {
    try {
      const [vData, nData] = await Promise.all([
        sendMessage<CSPViolation[]>({
          type: "GET_CSP_REPORTS",
          data: { type: "csp-violation" },
        }),
        sendMessage<NetworkRequest[]>({
          type: "GET_CSP_REPORTS",
          data: { type: "network-request" },
        }),
      ]);
      if (Array.isArray(vData)) setViolations(vData);
      if (Array.isArray(nData)) setNetworkRequests(nData);
    } catch (error) {
      logger.warn({
        event: "POPUP_CSP_DATA_LOAD_FAILED",
        error,
      });
    }
  }

  async function loadAIData() {
    try {
      const data = await sendMessage<CapturedAIPrompt[]>({ type: "GET_AI_PROMPTS" });
      if (Array.isArray(data)) setAIPrompts(data);
    } catch (error) {
      logger.warn({
        event: "POPUP_AI_DATA_LOAD_FAILED",
        error,
      });
    }
  }

  async function loadDoHData() {
    try {
      const result = await sendMessage<{ requests: DoHRequestRecord[] }>({ type: "GET_DOH_REQUESTS", data: { limit: 100 } });
      if (result?.requests) setDoHRequests(result.requests);
    } catch (error) {
      logger.warn({
        event: "POPUP_DOH_DATA_LOAD_FAILED",
        error,
      });
    }
  }

  // Update unified services when dependencies change
  useEffect(() => {
    const services = Object.values(data.services) as DetectedService[];
    aggregateServices(services, networkRequests, violations)
      .then(setUnifiedServices)
      .catch((error) => {
        logger.warn({
          event: "POPUP_AGGREGATE_SERVICES_FAILED",
          error,
        });
      });
  }, [data.services, networkRequests, violations]);

  function openDashboard() {
    const url = chrome.runtime.getURL("dashboard.html");
    chrome.tabs.create({ url });
  }

  const services = Object.values(data.services) as DetectedService[];

  const tabData: TabData = { services, unifiedServices, aiPrompts, violations, networkRequests, doHRequests };
  const status = getStatus(tabData);

  function renderContent() {
    if (loading) {
      return <p style={styles.emptyText}>読み込み中...</p>;
    }
    switch (tab) {
      case "service":
        return (
          <ServiceTab
            services={services}
            violations={violations}
            networkRequests={networkRequests}
          />
        );
      case "event":
        return (
          <EventTab
            services={services}
            violations={violations}
            networkRequests={networkRequests}
            aiPrompts={aiPrompts}
            doHRequests={doHRequests}
          />
        );
      case "policy":
        return <PolicyTab violations={violations} />;
      default:
        return null;
    }
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>
          <Shield size={20} />
          Pleno Audit
          <Badge variant={status.variant} size="sm" dot={status.dot}>{status.label}</Badge>
        </h1>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <Button variant="secondary" size="sm" onClick={openDashboard}>
            Dashboard
          </Button>
          <PopupSettingsMenu />
        </div>
      </header>

      <nav style={styles.tabNav}>
        {TABS.map((t) => {
          const count = t.count?.(tabData) || 0;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                ...styles.tabBtn,
                ...(tab === t.key ? styles.tabBtnActive : styles.tabBtnInactive),
              }}
            >
              {t.label}
              {count > 0 && (
                <span style={{
                  ...styles.tabCount,
                  ...(tab === t.key ? styles.tabCountActive : styles.tabCountInactive),
                }}>
                  {count > 20000 ? "20000+" : count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <main style={styles.content}>{renderContent()}</main>
    </div>
  );
}

export function App() {
  const themeState = useThemeState();

  return (
    <ThemeContext.Provider value={themeState}>
      <ErrorBoundary>
        <PopupContent />
      </ErrorBoundary>
    </ThemeContext.Provider>
  );
}

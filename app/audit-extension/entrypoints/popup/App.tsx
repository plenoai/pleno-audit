import { useState, useEffect } from "preact/hooks";
import type { DetectedService } from "@pleno-audit/casb-types";
import type { CapturedAIPrompt } from "@pleno-audit/ai-detector";
import type { CSPViolation } from "@pleno-audit/csp";
import {
  createLogger,
  type StorageData,
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
import type { UnifiedService } from "./utils/serviceAggregator";
import { sendMessage } from "./utils/messaging";

type Tab = "service" | "event" | "policy";
const logger = createLogger("popup-app");

const TABS: { key: Tab; label: string }[] = [
  { key: "service", label: "Service" },
  { key: "event", label: "Event" },
  { key: "policy", label: "Policy" },
];

interface StatusData {
  services: DetectedService[];
  violations: CSPViolation[];
  aiPrompts: CapturedAIPrompt[];
}

function getStatus(data: StatusData) {
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
  const [aiPrompts, setAIPrompts] = useState<CapturedAIPrompt[]>([]);
  const [unifiedServices, setUnifiedServices] = useState<UnifiedService[]>([]);
  const [eventCount, setEventCount] = useState(0);

  useEffect(() => {
    loadData();
    loadCSPData();
    loadAIData();
    loadPopupEvents();
    loadUnifiedServices();
    const listener = (changes: {
      [key: string]: chrome.storage.StorageChange;
    }) => {
      if (changes.services) {
        loadData();
        loadUnifiedServices();
      }
      if (changes.generatedCSPPolicy) {
        loadCSPData();
        loadPopupEvents();
        loadUnifiedServices();
      }
      if (changes.aiPrompts) {
        loadAIData();
        loadPopupEvents();
      }
      if (changes.doHRequests) {
        loadPopupEvents();
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
      const vData = await sendMessage<CSPViolation[]>({
        type: "GET_CSP_REPORTS",
        data: { type: "csp-violation" },
      });
      if (Array.isArray(vData)) setViolations(vData);
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

  async function loadPopupEvents() {
    try {
      const result = await sendMessage<{ total: number }>({ type: "GET_POPUP_EVENTS" });
      if (result?.total !== undefined) setEventCount(result.total);
    } catch (error) {
      logger.warn({ event: "POPUP_EVENTS_LOAD_FAILED", error });
    }
  }

  async function loadUnifiedServices() {
    try {
      const result = await sendMessage<UnifiedService[]>({ type: "GET_AGGREGATED_SERVICES" });
      if (Array.isArray(result)) setUnifiedServices(result);
    } catch (error) {
      logger.warn({ event: "POPUP_UNIFIED_SERVICES_LOAD_FAILED", error });
    }
  }

  function openDashboard() {
    const url = chrome.runtime.getURL("dashboard.html");
    chrome.tabs.create({ url });
  }

  const services = Object.values(data.services) as DetectedService[];

  const status = getStatus({ services, violations, aiPrompts });

  const tabCounts: Record<Tab, number | undefined> = {
    service: unifiedServices.length,
    event: eventCount,
    policy: undefined,
  };

  function renderContent() {
    if (loading) {
      return <p style={styles.emptyText}>読み込み中...</p>;
    }
    switch (tab) {
      case "service":
        return <ServiceTab />;
      case "event":
        return <EventTab />;
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
          const count = tabCounts[t.key] || 0;
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

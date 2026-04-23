import { useEffect, useState } from "react";
import { DATA } from "./data";
import { AppHeader, Sidebar, type TabId } from "./components/shell";
import { OverviewPage } from "./pages/Overview";
import { GraphPage } from "./pages/Graph";
import { AlertsPage, ExfilPage, IdentityPage, InvestigationPage } from "./pages/Detection";
import { ExtensionsPage, FleetPage, PolicyPage, SaasPage } from "./pages/Posture";
import { CompliancePage, IntegrationsPage } from "./pages/Governance";

const STORAGE_KEY = "pleno-enterprise.tab";

function App() {
  const [tab, setTab] = useState<TabId>(() => {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    return (saved as TabId) || "overview";
  });
  const [dark, setDark] = useState(true);

  useEffect(() => {
    if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, tab);
  }, [tab]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const data = DATA;

  const page = (() => {
    switch (tab) {
      case "overview": return <OverviewPage data={data} riskViz="bar" />;
      case "graph": return <GraphPage />;
      case "alerts": return <AlertsPage data={data} />;
      case "investigation": return <InvestigationPage />;
      case "exfil": return <ExfilPage data={data} />;
      case "identity": return <IdentityPage data={data} />;
      case "fleet": return <FleetPage data={data} />;
      case "extensions": return <ExtensionsPage data={data} />;
      case "saas": return <SaasPage data={data} />;
      case "policy": return <PolicyPage data={data} />;
      case "compliance": return <CompliancePage data={data} />;
      case "integrations": return <IntegrationsPage data={data} />;
    }
  })();

  return (
    <div className="app">
      <AppHeader org={data.org} dark={dark} onDark={() => setDark(v => !v)} />
      <div className="body">
        <Sidebar active={tab} onChange={setTab} />
        <main className="main" key={tab}>
          {page}
        </main>
      </div>
    </div>
  );
}

export default App;

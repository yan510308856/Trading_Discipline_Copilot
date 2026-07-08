import { useEffect, useState } from "react";

import { DailySummary } from "./components/DailySummary";
import { Dashboard } from "./components/Dashboard";
import { OpenTradePanel } from "./components/OpenTradePanel";
import { PostTradeReview } from "./components/PostTradeReview";
import { OpenTradeAlerts } from "./components/OpenTradeAlerts";
import { RulesLibrary } from "./components/RulesLibrary";
import { TradeChecklist } from "./components/TradeChecklist";
import type { NavigationItem, PageId } from "./types";
import { hashForPage, pageFromHash } from "./utils/navigation";

const navigation: NavigationItem[] = [
  { id: "dashboard", label: "Dashboard", shortLabel: "Home" },
  { id: "trade-checklist", label: "New Trade", shortLabel: "Plan" },
  { id: "rule-alerts", label: "Rule Alerts", shortLabel: "Alerts" },
  { id: "open-trades", label: "Open Trades", shortLabel: "Manage" },
  { id: "post-trade-review", label: "Post-Trade Review", shortLabel: "Review" },
  { id: "daily-summary", label: "Daily Summary", shortLabel: "Summary" },
  { id: "rules-library", label: "Rules Library", shortLabel: "Rules" },
];

const pages: Record<PageId, React.ReactNode> = {
  dashboard: <Dashboard />,
  "trade-checklist": <TradeChecklist />,
  "rule-alerts": <OpenTradeAlerts />,
  "open-trades": <OpenTradePanel />,
  "post-trade-review": <PostTradeReview />,
  "daily-summary": <DailySummary />,
  "rules-library": <RulesLibrary />,
};

export default function App() {
  const [activePage, setActivePage] = useState<PageId>(() =>
    pageFromHash(window.location.hash),
  );

  useEffect(() => {
    const restorePageFromUrl = () => setActivePage(pageFromHash(window.location.hash));
    window.addEventListener("hashchange", restorePageFromUrl);
    return () => window.removeEventListener("hashchange", restorePageFromUrl);
  }, []);

  function navigateTo(page: PageId) {
    setActivePage(page);
    window.location.hash = hashForPage(page);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">TD</span>
          <div>
            <strong>Trading Discipline</strong>
            <span>Copilot</span>
          </div>
        </div>

        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <button
              key={item.id}
              className={activePage === item.id ? "nav-item active" : "nav-item"}
              onClick={() => navigateTo(item.id)}
              aria-current={activePage === item.id ? "page" : undefined}
            >
              <span className="nav-initial" aria-hidden="true">
                {item.shortLabel.slice(0, 1)}
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <p className="sidebar-note">Process over outcome.</p>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Trading Discipline Copilot</p>
            <h1>{navigation.find((item) => item.id === activePage)?.label}</h1>
          </div>
          <span className="stage-label">MVP · Stage 11 polish</span>
        </header>
        {pages[activePage]}
      </main>
    </div>
  );
}

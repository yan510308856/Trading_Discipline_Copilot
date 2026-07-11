import { useEffect, useState } from "react";

import { DailySummary } from "./components/DailySummary";
import { Dashboard } from "./components/Dashboard";
import { OpenTradePanel } from "./components/OpenTradePanel";
import { PostTradeReview } from "./components/PostTradeReview";
import { AttentionCenter } from "./components/AttentionCenter";
import { RulesLibrary } from "./components/RulesLibrary";
import { TradeChecklist } from "./components/TradeChecklist";
import type { NavigationItem, PageId } from "./types";
import { hashForPage, pageFromHash } from "./utils/navigation";

export const navigation: NavigationItem[] = [
  { id: "dashboard", label: "Dashboard", shortLabel: "Home", icon: "▦" },
  { id: "trade-checklist", label: "New Trade", shortLabel: "Plan", icon: "☑" },
  { id: "attention", label: "Attention", shortLabel: "Act", icon: "⚠" },
  { id: "open-trades", label: "Open Trades", shortLabel: "Manage", icon: "▣" },
  { id: "post-trade-review", label: "Post-Trade Review", shortLabel: "Review", icon: "✓" },
  { id: "daily-summary", label: "Daily Summary", shortLabel: "Summary", icon: "▥" },
  { id: "rules-library", label: "Rules Library", shortLabel: "Rules", icon: "□" },
];

const pages: Record<PageId, React.ReactNode> = {
  dashboard: <Dashboard />,
  "trade-checklist": <TradeChecklist />,
  attention: <AttentionCenter />,
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
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="nav-label">{item.label}</span>
              <span className="nav-short-label">{item.shortLabel}</span>
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
          <span className="stage-label">Live discipline MVP</span>
        </header>
        {pages[activePage]}
      </main>
    </div>
  );
}

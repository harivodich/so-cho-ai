"use client";

import { type ReactNode } from "react";
import { UiIcon, type IconName } from "@/components/ui-icon";
import { triggerHapticFeedback } from "@/lib/haptic";

export type AppTab = "entry" | "ledger" | "reports" | "inventory" | "debts";

type Props = {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onQuickVoice?: () => void;
  header?: ReactNode;
  children: ReactNode;
};

export function AppShell({
  activeTab,
  onTabChange,
  onQuickVoice,
  header,
  children,
}: Props) {
  const tabs: Array<{ id: AppTab; label: string; icon: IconName }> = [
    { id: "entry", label: "Ghi chép", icon: "pencil" },
    { id: "ledger", label: "Sổ cái", icon: "book" },
    { id: "reports", label: "Báo cáo", icon: "chart" },
    { id: "inventory", label: "Kho hàng", icon: "check" },
    { id: "debts", label: "Công nợ", icon: "alert" },
  ];

  return (
    <div className="app-shell-container">
      {/* Top Header */}
      {header}

      {/* Navigation Switcher */}
      <nav className="app-navigation-bar" aria-label="Điều hướng chính">
        <div className="app-nav-tabs" role="tablist">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={isActive}
                className={`app-nav-tab ${isActive ? "active" : ""}`}
                onClick={() => {
                  triggerHapticFeedback(15);
                  onTabChange(tab.id);
                }}
              >
                <UiIcon name={tab.icon} size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="app-main-content">
        {children}
      </main>

      {/* Mobile Floating Quick Voice Trigger */}
      {onQuickVoice && activeTab !== "entry" ? (
        <button
          type="button"
          className="floating-voice-btn"
          onClick={() => {
            triggerHapticFeedback([30, 20]);
            onQuickVoice();
          }}
          aria-label="Ghi âm giọng nói nhanh"
          title="Nói để ghi sổ"
        >
          <UiIcon name="microphone" size={22} />
          <span>Nói</span>
        </button>
      ) : null}
    </div>
  );
}

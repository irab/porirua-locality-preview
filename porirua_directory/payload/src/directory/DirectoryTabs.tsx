"use client";

import type { DirectoryTabId, DirectoryTabsProps } from "./types";

export function DirectoryTabs({ tabs, active, onChange, children }: DirectoryTabsProps) {
  return (
    <div>
      <div className="directory-tabs" role="tablist" aria-label="Directory">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            aria-controls={`${tab.id}-panel`}
            className={active === tab.id ? "active" : undefined}
            onClick={() => onChange(tab.id as DirectoryTabId)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}

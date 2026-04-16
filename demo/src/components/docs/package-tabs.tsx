"use client";

import { useState } from "react";

type Tab = {
  readonly label: string;
  readonly value: string;
  readonly content: string;
};

export function PackageTabs({ tabs }: { readonly tabs: readonly Tab[] }) {
  const [activeValue, setActiveValue] = useState(tabs[0]?.value ?? "");
  const activeTab = tabs.find((tab) => tab.value === activeValue) ?? tabs[0];

  if (!activeTab) {
    return null;
  }

  return (
    <div className="docs-package-tabs">
      <div className="docs-package-tabs__list" role="tablist" aria-label="Package surfaces">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            className="docs-package-tabs__tab"
            data-active={tab.value === activeTab.value}
            onClick={() => setActiveValue(tab.value)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="docs-package-tabs__panel" role="tabpanel">
        <p>{activeTab.content}</p>
      </div>
    </div>
  );
}

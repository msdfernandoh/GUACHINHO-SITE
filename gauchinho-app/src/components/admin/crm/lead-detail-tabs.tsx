"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

const TABS = [
  { id: "cadastro", label: "Cadastro" },
  { id: "agenda", label: "Agenda" },
  { id: "retorno", label: "Retorno" },
  { id: "fechamento", label: "Fechamento" },
  { id: "perda", label: "Perda" },
] as const;

export type LeadDetailTabId = (typeof TABS)[number]["id"];

type Props = {
  panels: Record<LeadDetailTabId, ReactNode>;
  defaultTab?: LeadDetailTabId;
};

export function LeadDetailTabs({ panels, defaultTab = "cadastro" }: Props) {
  const [tab, setTab] = useState<LeadDetailTabId>(defaultTab);

  return (
    <div className="space-y-4">
      <div
        className="flex flex-wrap gap-1 rounded-xl border border-zinc-700 bg-zinc-900/80 p-1"
        role="tablist"
        aria-label="Seções do lead"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium transition",
              tab === t.id
                ? t.id === "perda"
                  ? "bg-red-600 text-white"
                  : "bg-amber-500 text-zinc-950"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{panels[tab]}</div>
    </div>
  );
}

"use client";

import { useState } from "react";

export function CommissionBulkSelector({
  items,
  action,
  label,
}: {
  items: Array<{ id: string; label: string }>;
  action: (formData: FormData) => void | Promise<void>;
  label: string;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const all = items.length > 0 && selected.length === items.length;
  return (
    <form
      action={action}
      className="rounded-lg border border-slate-200 bg-slate-50 p-3"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            checked={all}
            onChange={() =>
              setSelected(all ? [] : items.map((item) => item.id))
            }
          />{" "}
          Selecionar todos
        </label>
        <button
          disabled={!selected.length}
          className="rounded bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
        >
          {label} ({selected.length})
        </button>
      </div>
      <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto">
        {items.map((item) => (
          <label
            key={item.id}
            className="flex items-center gap-1 rounded bg-white px-2 py-1 text-xs"
          >
            <input
              type="checkbox"
              name="previsao_ids"
              value={item.id}
              checked={selected.includes(item.id)}
              onChange={() =>
                setSelected((current) =>
                  current.includes(item.id)
                    ? current.filter((id) => id !== item.id)
                    : [...current, item.id],
                )
              }
            />
            {item.label}
          </label>
        ))}
      </div>
    </form>
  );
}

"use client";

import type { ReactNode } from "react";

const raconAppCss = `
  .racon-indicador { min-height: 100vh; background: #f4f8fc; color: #0b2855; }
  .racon-indicador [class*="bg-zinc-950"], .racon-indicador [class*="bg-[#090b10]"] { background-color: #f4f8fc; }
  .racon-indicador [class*="bg-zinc-900"] { background-color: #ffffff; }
  .racon-indicador [class*="bg-zinc-800"] { background-color: #e8f1fb; }
  .racon-indicador [class*="text-white"] { color: #0b2855; }
  .racon-indicador [class*="text-zinc-200"], .racon-indicador [class*="text-zinc-300"], .racon-indicador [class*="text-zinc-400"], .racon-indicador [class*="text-zinc-500"], .racon-indicador [class*="text-zinc-600"] { color: #4b6480; }
  .racon-indicador [class*="text-amber"] { color: #0066cc; }
  .racon-indicador [class*="border-zinc"] { border-color: #cbdced; }
  .racon-indicador [class*="border-amber"] { border-color: #0099dd; }
  .racon-indicador [class*="bg-amber"] { background-color: #0066cc; color: #ffffff; }
  .racon-indicador [class*="from-amber"] { --tw-gradient-from: #0066cc var(--tw-gradient-from-position); --tw-gradient-to: rgb(0 102 204 / 0) var(--tw-gradient-to-position); }
  .racon-indicador [class*="to-amber"] { --tw-gradient-to: #20c9d7 var(--tw-gradient-to-position); }
  .racon-indicador input, .racon-indicador textarea { background: #ffffff; color: #0b2855; }
`;

export function AppIndicadorTheme({ racon, children }: { racon: boolean; children: ReactNode }) {
  if (!racon) return <>{children}</>;
  return <div className="racon-indicador"><style>{raconAppCss}</style>{children}</div>;
}

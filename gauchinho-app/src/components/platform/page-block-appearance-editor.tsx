"use client";

import { useState } from "react";
import { VISUAL_COLORS, visualBlocksForPage, type SitePagesAppearance, type VisualBlockConfig, type VisualColor } from "@/lib/tenant/site-appearance";
import { MediaFieldControl } from "./media-field-control";

export function PageBlockAppearanceEditor({ templateId, value, menus, onChange }: {
  templateId: string; value?: SitePagesAppearance; menus: { label: string; rota: string }[];
  onChange: (value: SitePagesAppearance) => void;
}) {
  const [page, setPage] = useState("/");
  const [blockId, setBlockId] = useState("pagina");
  const pages = new Map([["/", "Início"], ["/simulador", "Simulador"], ["/grupos", "Grupos"], ["/calculadoras", "Calculadoras"]]);
  menus.forEach(menu => { const path = menu.rota.split(/[?#]/)[0]; if (/^\/[a-zA-Z0-9/_-]*$/.test(path) && !pages.has(path)) pages.set(path, menu.label); });
  const config = value || {};
  const block = config[page]?.[blockId] || {};
  function update(patch: Partial<VisualBlockConfig>) {
    onChange({ ...config, [page]: { ...config[page], [blockId]: { ...block, ...patch } } });
  }
  return <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 text-slate-900">
    <div><h2 className="font-bold">Fotos e cores por página e bloco</h2><p className="mt-1 text-sm text-slate-500">Campos vazios herdam a paleta do modelo. Um bloco substitui somente a sua configuração; as demais páginas permanecem intactas. Salve o modelo ao terminar.</p></div>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-semibold">Página<select aria-label="Página visual" className="mt-1 w-full rounded border p-2" value={page} onChange={e => { setPage(e.target.value); setBlockId("pagina"); }}>{Array.from(pages).map(([path, label]) => <option key={path} value={path}>{label} ({path})</option>)}</select></label>
      <label className="text-sm font-semibold">Bloco<select aria-label="Bloco visual" className="mt-1 w-full rounded border p-2" value={blockId} onChange={e => setBlockId(e.target.value)}>{Object.entries(visualBlocksForPage(page)).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
    </div>
    <div className="grid gap-4 sm:grid-cols-3">{(Object.entries(VISUAL_COLORS) as [VisualColor, string][]).map(([key, label]) => <label key={key} className="text-xs font-semibold">{label}<div className="mt-1 flex gap-2"><input aria-label={`${label} — seletor`} type="color" value={block[key] || "#0066cc"} onChange={e => update({ [key]: e.target.value })} className="h-9 w-10" /><input aria-label={label} placeholder="Herdar do modelo" value={block[key] || ""} onChange={e => update({ [key]: e.target.value })} className="w-full rounded border p-2" /><button type="button" aria-label={`Herdar ${label}`} onClick={() => update({ [key]: undefined })}>↺</button></div></label>)}</div>
    <MediaFieldControl key={`${page}:${blockId}`} templateId={templateId} spec={{ slotId: `pagina-${page.replace(/\//g, "-")}-${blockId}`, slotLabel: "Imagem deste bloco", larguraRecomendada: 1600, alturaRecomendada: 600, proporcaoRecomendada: "8:3", proporcaoRatio: 8 / 3, descricao: page === "/" ? "Substitui a foto do bloco na home. No bloco Página inteira, usa imagem de fundo." : blockId === "pagina" ? "Banner exibido no topo desta página." : "Imagem de fundo apenas neste bloco. Ajuste as cores para manter contraste." }} imageUrl={block.imagem_url || ""} objectFit={block.imagem_ajuste} objectPosition={block.imagem_posicao} onChangeUrl={url => update({ imagem_url: url })} onChangeObjectFit={fit => update({ imagem_ajuste: fit })} onChangeObjectPosition={pos => update({ imagem_posicao: ["center", "top", "bottom", "left", "right", "top-left", "top-right"].includes(pos) ? pos as VisualBlockConfig["imagem_posicao"] : "center" })} />
    <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => { const next = { ...config[page] }; delete next[blockId]; onChange({ ...config, [page]: next }); }}>Restaurar herança deste bloco</button>
  </section>;
}

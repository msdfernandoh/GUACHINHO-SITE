"use client";

/** Caixa com o texto do termo (já preenchido) e o "Li e aceito". Componente controlado. */
export function SplTermoCaixa({
  texto,
  versao,
  aceito,
  onAceito,
  pdf,
  preenchido = true,
}: {
  texto: string;
  versao: string;
  aceito: boolean;
  onAceito: (v: boolean) => void;
  pdf?: string;
  preenchido?: boolean;
}) {
  const [titulo, ...resto] = texto.split("\n");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-lg font-black text-[#0A1931]">{titulo || "Termo de parceria"}</p>
        {pdf && <a href={pdf} className="text-base font-bold text-[#153E90] underline">
          Baixar PDF do termo
        </a>}
      </div>
      <div className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 text-base leading-relaxed text-slate-800">
        {resto.join("\n").replace(/^» /gm, "").trim()}
      </div>
      <p className="text-sm text-slate-500">Versão {versao}{preenchido ? " · já preenchido com os dados do seu cadastro." : ""}</p>
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-[#153E90]/30 bg-white p-4">
        <input type="checkbox" checked={aceito} onChange={(e) => onAceito(e.target.checked)} className="mt-1 h-7 w-7 shrink-0 accent-[#153E90]" />
        <span className="text-lg font-black text-[#0A1931]">Li e aceito o termo de parceria</span>
      </label>
    </div>
  );
}

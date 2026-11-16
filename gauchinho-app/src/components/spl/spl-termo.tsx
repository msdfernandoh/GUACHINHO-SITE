"use client";

/** Caixa com o texto do termo e o "Li e aceito". Componente controlado. */
export function SplTermoCaixa({
  texto,
  versao,
  aceito,
  onAceito,
}: {
  texto: string;
  versao: string;
  aceito: boolean;
  onAceito: (v: boolean) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-lg font-black text-[#0A1931]">Termo de parceria</p>
        <a href="/api/public/spl/termos/pdf" className="text-base font-bold text-[#153E90] underline">
          Baixar PDF do termo
        </a>
      </div>
      <div className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 text-base leading-relaxed text-slate-800">
        {texto}
      </div>
      <p className="text-sm text-slate-500">Versão {versao}</p>
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-[#153E90]/30 bg-white p-4">
        <input type="checkbox" checked={aceito} onChange={(e) => onAceito(e.target.checked)} className="mt-1 h-7 w-7 shrink-0 accent-[#153E90]" />
        <span className="text-lg font-black text-[#0A1931]">Li e aceito o termo de parceria</span>
      </label>
    </div>
  );
}

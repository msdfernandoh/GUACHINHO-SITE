import type { ReactNode } from "react";
import Link from "next/link";
import { BotaoCopiar } from "./spl-copiar";
import { mascaraPix, PIX_TIPOS, type PixTipo } from "@/lib/spl/mascaras";

export const brl = (v: number | null | undefined, casas = 0) =>
  v == null || !Number.isFinite(v)
    ? "—"
    : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: casas, maximumFractionDigits: casas });

export const brl2 = (v: number | null | undefined) => brl(v, 2);

export const fone = (d: string | null | undefined) => {
  const s = String(d ?? "").replace(/\D/g, "");
  if (s.length === 11) return `(${s.slice(0, 2)}) ${s.slice(2, 7)}-${s.slice(7)}`;
  if (s.length === 10) return `(${s.slice(0, 2)}) ${s.slice(2, 6)}-${s.slice(6)}`;
  return s;
};

export function SplHeader({ direita }: { direita?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0A1931]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/spl" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/spl-img/spl.png" alt="SPL Engenharia" className="h-8 w-auto rounded bg-white px-2 py-1" />
          <span className="text-sm font-bold text-white/60">×</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/spl-img/logo-racon-gauchinho.jpeg" alt="Racon Consórcios · Gauchinho" className="h-8 w-auto rounded bg-white px-1" />
        </Link>
        {direita}
      </div>
    </header>
  );
}

export function SplShell({ children, direita }: { children: ReactNode; direita?: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F4F7FB] text-slate-900">
      <SplHeader direita={direita} />
      {children}
      <footer className="bg-[#0A1931] px-4 py-8 text-center text-xs text-white/60">
        SPL Engenharia × Racon Consórcios · Franqueado Gauchinho · Sinop e Sorriso / MT
      </footer>
    </div>
  );
}

export function Cartao({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</div>;
}

export function Campo({
  rotulo,
  dica,
  children,
}: {
  rotulo: string;
  dica?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-base font-bold text-slate-800">{rotulo}</span>
      {children}
      {dica ? <span className="mt-1 block text-sm text-slate-500">{dica}</span> : null}
    </label>
  );
}

export const inputGrande =
  "w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-4 text-lg text-slate-900 outline-none transition focus:border-[#153E90] focus:ring-4 focus:ring-[#153E90]/15";

export function BotaoGrande({
  children,
  onClick,
  tipo = "primario",
  disabled,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  tipo?: "primario" | "secundario" | "ouro" | "verde";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const cores = {
    primario: "bg-[#153E90] text-white hover:bg-[#12284C]",
    secundario: "border-2 border-slate-300 bg-white text-slate-800 hover:border-[#153E90]",
    ouro: "bg-[#F59E0B] text-[#3B2302] hover:bg-[#FBB43A]",
    verde: "bg-[#16A34A] text-white hover:bg-[#15803D]",
  }[tipo];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[60px] rounded-2xl px-6 py-4 text-lg font-extrabold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${cores} ${className}`}
    >
      {children}
    </button>
  );
}

export function Aviso({ children, tom = "erro" }: { children: ReactNode; tom?: "erro" | "ok" | "info" }) {
  const cores = {
    erro: "border-red-200 bg-red-50 text-red-800",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-800",
    info: "border-sky-200 bg-sky-50 text-sky-900",
  }[tom];
  return (
    <p role={tom === "erro" ? "alert" : "status"} className={`rounded-2xl border px-4 py-3 text-base font-semibold ${cores}`}>
      {children}
    </p>
  );
}

/** Link wa.me para um número brasileiro (ou para escolher o contato, sem número). */
export function linkWhatsapp(texto: string, telefone?: string | null) {
  const d = String(telefone ?? "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  return `https://wa.me/${d ? `55${d}` : ""}?text=${encodeURIComponent(texto)}`;
}

export function LinkCopiavel({
  titulo,
  url,
  mensagemWhatsapp,
  whatsappPara,
  rotuloWhatsapp = "Enviar no WhatsApp",
}: {
  titulo: string;
  url: string;
  mensagemWhatsapp?: string;
  /** Telefone de destino; sem ele o WhatsApp pede para escolher o contato. */
  whatsappPara?: string | null;
  rotuloWhatsapp?: string;
}) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-[#153E90]/30 bg-[#153E90]/5 p-4">
      <p className="text-sm font-bold uppercase tracking-wide text-[#153E90]">{titulo}</p>
      <p className="mt-1 break-all font-mono text-base text-slate-800">{url}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <BotaoCopiar texto={url} />
        {mensagemWhatsapp ? (
          <a
            href={linkWhatsapp(`${mensagemWhatsapp}\n${url}`, whatsappPara)}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl bg-[#16A34A] px-4 py-3 text-base font-bold text-white"
          >
            {rotuloWhatsapp}
          </a>
        ) : null}
      </div>
    </div>
  );
}

/** Tipo da chave (botões) + chave com a máscara do tipo. Componente controlado. */
export function CampoPix({
  rotulo = "Chave PIX",
  tipo,
  valor,
  onTipo,
  onValor,
}: {
  rotulo?: string;
  tipo: PixTipo | "";
  valor: string;
  onTipo: (t: PixTipo) => void;
  onValor: (v: string) => void;
}) {
  const atual = PIX_TIPOS.find((t) => t.value === tipo);
  return (
    <div className="space-y-2">
      <span className="block text-base font-bold text-slate-800">{rotulo}</span>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {PIX_TIPOS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => {
              onTipo(t.value);
              onValor(mascaraPix(t.value, valor));
            }}
            className={`rounded-xl border-2 px-2 py-3 text-base font-bold ${tipo === t.value ? "border-[#153E90] bg-[#153E90] text-white" : "border-slate-200 bg-white text-slate-800"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <input
        className={inputGrande}
        value={valor}
        disabled={!tipo}
        inputMode={tipo === "CELULAR" || tipo === "CPF" || tipo === "CNPJ" ? "numeric" : tipo === "EMAIL" ? "email" : "text"}
        onChange={(e) => onValor(mascaraPix(tipo, e.target.value))}
        placeholder={atual ? atual.placeholder : "Escolha o tipo da chave acima"}
      />
    </div>
  );
}

export { BotaoCopiar };

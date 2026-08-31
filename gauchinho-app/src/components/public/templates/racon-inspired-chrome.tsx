"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, Phone, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import type { RaconTemplateIdentidade, RaconTemplateMenu } from "./racon-inspired-home";
import { RACON_LOGO } from "@/lib/tenant/site-appearance";
import { contactNumber, resolveSiteContacts } from "@/lib/tenant/site-contacts";

type Props = {
  empresaNome: string;
  logoUrl?: string | null;
  identidade?: RaconTemplateIdentidade;
  menus: RaconTemplateMenu[];
  telefoneContato?: string;
  whatsappContato?: string;
  footerCopyright?: string | null;
};

export function RaconInspiredHeader({
  empresaNome,
  logoUrl,
  identidade = {},
  menus,
  telefoneContato,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const primary = identidade.cor_primaria || "#0099dd";
  const secondary = identidade.cor_secundaria || "#0c2340";
  const accent = identidade.cor_destaque || "#ffb800";
  const activeMenus = menus.filter(menu => menu.ativo !== false);
  const login = activeMenus.find((menu) => menu.id === "login");
  const navegacao = activeMenus.filter((menu) => menu.id !== "login");
  const telefone = resolveSiteContacts({ telefone: telefoneContato }, identidade.contatos).telefone;
  const number = contactNumber(telefone);
  const logo = logoUrl || (identidade.marca_propria ? null : RACON_LOGO);

  return (
    <>
      <div style={{ backgroundColor: primary }} className="w-full px-4 py-1.5 text-white text-[11px] font-semibold">
        <div className="mx-auto flex max-w-7xl items-center justify-end gap-6">
          {number ? <a href={`tel:${number}`} className="flex items-center gap-1.5">
            <Phone className="h-3 w-3" style={{ color: accent }} />
            <span>Televendas: {telefone}</span>
          </a> : null}
        </div>
      </div>
      <header className="sticky top-0 z-40 w-full border-b border-slate-100 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-3">
            <div className="relative h-16 w-44 overflow-hidden">
              {logo ? <Image src={logo} unoptimized={Boolean(logo.startsWith("https:"))} alt={empresaNome} fill sizes="176px" className={`object-contain ${logo === RACON_LOGO ? "scale-150" : ""}`} /> : <strong className="flex h-full items-center text-lg" style={{ color: primary }}>{empresaNome}</strong>}
            </div>
          </Link>

          <nav className="hidden min-w-0 flex-1 items-center justify-end gap-x-3 text-[11px] font-bold text-slate-700 xl:flex" aria-label="Navegação principal">
            {navegacao.map((menu) => (
              <Link key={menu.id} href={menu.rota} className="whitespace-nowrap border-b-2 border-transparent py-1 transition-colors hover:border-current" style={{ color: secondary }}>
                {menu.label}
              </Link>
            ))}
            {login ? (
              <Link href={login.rota} style={{ borderColor: primary, color: primary }} className="whitespace-nowrap rounded-full border px-4 py-2 font-black uppercase">
                {login.label}
              </Link>
            ) : null}
          </nav>

          <button type="button" onClick={() => setAberto((atual) => !atual)} className="rounded-lg border border-slate-200 p-2 text-slate-700 xl:hidden" aria-expanded={aberto} aria-controls="racon-menu-mobile">
            <span className="sr-only">Menu</span>
            {aberto ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {aberto ? (
          <nav id="racon-menu-mobile" className="max-h-[75vh] overflow-y-auto border-t border-slate-100 bg-white px-4 py-3 xl:hidden" aria-label="Navegação mobile">
            <div className="mx-auto grid max-w-7xl gap-1 sm:grid-cols-2">
              {activeMenus.map((menu) => (
                <Link key={menu.id} href={menu.rota} onClick={() => setAberto(false)} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  {menu.label}
                </Link>
              ))}
            </div>
          </nav>
        ) : null}
      </header>
    </>
  );
}

export function RaconInspiredFooter({
  empresaNome,
  identidade = {},
  menus,
  telefoneContato,
  whatsappContato,
  footerCopyright,
}: Props) {
  const secondary = identidade.cor_primaria || "#0066cc";
  const links = menus.filter((menu) => menu.id !== "home" && menu.ativo !== false);
  const contatos = resolveSiteContacts({ telefone: telefoneContato, whatsapp: whatsappContato }, identidade.contatos);
  const phone = contactNumber(contatos.telefone);
  const whatsapp = contactNumber(contatos.whatsapp, true);

  return (
    <footer id="contato" data-site-tone="inverse" style={{ backgroundColor: secondary }} className="scroll-mt-24 border-t border-slate-800 pt-10 pb-7 text-xs text-white">
      <div className="mx-auto max-w-7xl space-y-7 px-4 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[1fr_2fr_1fr]">
          <div className="space-y-3">
            <strong className="block text-sm font-black tracking-tight text-white">{empresaNome}</strong>
            {phone ? <p><a href={`tel:${phone}`}>Televendas: {contatos.telefone}</a></p> : null}
            {whatsapp ? <p><a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">WhatsApp: {contatos.whatsapp}</a></p> : null}
          </div>
          <nav className="grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-3" aria-label="Links do site">
            {links.map((menu) => <Link key={menu.id} href={menu.rota} className="hover:text-white">{menu.label}</Link>)}
          </nav>
          <div className="space-y-3">
            <strong className="block text-xs font-bold uppercase tracking-wider text-white">Regulatório</strong>
            <p>{identidade.marca_propria ? `Atendimento por ${empresaNome}.` : "Empresa autorizada e fiscalizada pelo Banco Central do Brasil."}</p>
            <span className="inline-flex items-center gap-1.5 rounded bg-white/5 px-2.5 py-1 text-[10px] text-slate-300"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Ambiente seguro</span>
          </div>
        </div>
        <div className="border-t border-slate-700 pt-5 text-[11px] text-white">
          {footerCopyright || "Todos os direitos reservados."}
        </div>
      </div>
    </footer>
  );
}

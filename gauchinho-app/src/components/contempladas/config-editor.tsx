"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salvarConfigAction } from "@/app/(landing-contempladas)/contempladas/actions";
import type { ConfigContempladas } from "@/lib/contempladas/repo";
import type { Acrescimo } from "@/lib/contempladas/motor";
import { brl, btnOuro, inputCls, MoneyInput, PixInput, TelInput, mascaraTelefone, type TipoPix } from "./ui";

function SeletorValor({ valor, onChange, rotuloPct = "% do crédito" }: { valor: Acrescimo; onChange: (v: Acrescimo) => void; rotuloPct?: string }) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-2">
      <select className={`${inputCls} !w-36`} value={valor.tipo} onChange={(e) => onChange({ ...valor, tipo: e.target.value as Acrescimo["tipo"] })}>
        <option value="FIXO">R$ fixo</option>
        <option value="PERCENTUAL">{rotuloPct}</option>
      </select>
      {valor.tipo === "FIXO" ? (
        <MoneyInput value={valor.valor} onChange={(v) => onChange({ ...valor, valor: v })} />
      ) : (
        <div className="flex items-center rounded-xl border border-slate-300 bg-white">
          <input className="w-full rounded-xl bg-transparent px-3 py-2.5 text-right outline-none" type="number" step="0.01" min={0} value={valor.valor || ""} placeholder="0,00" onChange={(e) => onChange({ ...valor, valor: Number(e.target.value) })} />
          <span className="pr-3 text-sm font-semibold text-slate-500">%</span>
        </div>
      )}
    </div>
  );
}

const agioTxt = (tipo: string, valor: number) => (valor > 0 ? (tipo === "PERCENTUAL" ? `${valor}% do crédito` : brl(valor)) : "sem ágio");

/** Configuração salva em uma linha. */
export function resumoConfig(c: ConfigContempladas) {
  const partes = [
    `Ágio imóvel ${agioTxt(c.agio_tipo, c.agio_valor)}`,
    `veículo ${agioTxt(c.agio_auto_tipo, c.agio_auto_valor)}`,
    c.sinal_imovel || c.sinal_auto ? `sinal ${c.sinal_imovel ? brl(c.sinal_imovel) : "—"} / ${c.sinal_auto ? brl(c.sinal_auto) : "—"}` : "sem sinal (PIX = entrada)",
    c.comissao_modo === "PERCENTUAL" ? `comissão ${c.comissao_percentual}% do crédito` : "comissão da tabela",
    `repasse ${c.comissao_repasse_percentual}%`,
    c.whatsapp ? `WhatsApp ${mascaraTelefone(c.whatsapp)}` : "sem WhatsApp",
    c.chave_pix ? `PIX ${c.chave_pix}` : "sem PIX",
  ];
  return partes.join(" · ");
}

/**
 * Configuração recolhida em uma linha com Editar; abre o formulário e recolhe ao salvar.
 * ehPadrao = configuração do dono (padrão da empresa, inclui tempo da pré-reserva).
 */
export function ConfigEditor({ titulo, inicial, ehPadrao, alvoAuthId = null, aberto: abertoIni = false }: { titulo: string; inicial: ConfigContempladas; ehPadrao: boolean; alvoAuthId?: string | null; aberto?: boolean }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(abertoIni);
  const [cfg, setCfg] = useState(inicial);
  const [salvo, setSalvo] = useState(inicial);
  const [mesmoAgio, setMesmoAgio] = useState(inicial.agio_tipo === inicial.agio_auto_tipo && inicial.agio_valor === inicial.agio_auto_valor);
  const [atualizarEntradas, setAtualizarEntradas] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pend, start] = useTransition();
  const onSalvo = (msg: string) => {
    setSalvo(cfg);
    setOk(msg);
    setErro(null);
    setAberto(false);
  };

  if (!aberto)
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-bold text-[#0a2a66]">{titulo}{salvo.unidade ? ` · ${salvo.unidade}` : ""}</p>
            <p className="mt-0.5 text-xs text-slate-600">{resumoConfig(salvo)}</p>
            {ok && <p className="mt-1 text-xs font-semibold text-emerald-700">{ok}</p>}
          </div>
          <button className="rounded-lg bg-[#0047bb] px-4 py-2 text-sm font-bold text-white" onClick={() => { setCfg(salvo); setOk(null); setAberto(true); }}>Editar</button>
        </div>
      </div>
    );

  return (
    <div className="space-y-4 rounded-2xl border-2 border-[#0047bb]/30 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="font-bold text-[#0a2a66]">{titulo}</p>
        <button className="text-sm text-slate-500 underline" onClick={() => { setCfg(salvo); setAberto(false); }}>Cancelar</button>
      </div>

          <p className="text-sm text-slate-500">
            {ehPadrao
              ? "Padrão da empresa: vale para as suas cotas e para administradores de cotas que ainda não configuraram a unidade."
              : "Configuração da sua unidade: vale só para as cotas que você sobe."}
          </p>
          <label className="block text-sm font-semibold">Nome da unidade (aparece para o cliente)
            <input className={inputCls} value={cfg.unidade ?? ""} onChange={(e) => setCfg({ ...cfg, unidade: e.target.value })} placeholder="Ex.: Racon Sorriso" />
          </label>

          <div>
            <p className="text-sm font-semibold">Ágio na subida das cotas</p>
            <label className="my-1 flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" className="h-4 w-4 accent-[#0047bb]" checked={mesmoAgio}
                onChange={(e) => { setMesmoAgio(e.target.checked); if (e.target.checked) setCfg({ ...cfg, agio_auto_tipo: cfg.agio_tipo, agio_auto_valor: cfg.agio_valor }); }} />
              Mesmo ágio para imóvel e veículo
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <div><p className="mb-1 text-xs text-slate-500">{mesmoAgio ? "Imóvel e veículo" : "Imóvel"}</p>
                <SeletorValor valor={{ tipo: cfg.agio_tipo, valor: cfg.agio_valor }}
                  onChange={(v) => setCfg({ ...cfg, agio_tipo: v.tipo, agio_valor: v.valor, ...(mesmoAgio ? { agio_auto_tipo: v.tipo, agio_auto_valor: v.valor } : {}) })} /></div>
              {!mesmoAgio && <div><p className="mb-1 text-xs text-slate-500">Veículo</p>
                <SeletorValor valor={{ tipo: cfg.agio_auto_tipo, valor: cfg.agio_auto_valor }} onChange={(v) => setCfg({ ...cfg, agio_auto_tipo: v.tipo, agio_auto_valor: v.valor })} /></div>}
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" className="h-4 w-4 accent-[#0047bb]" checked={atualizarEntradas} onChange={(e) => setAtualizarEntradas(e.target.checked)} />
            Ao salvar, atualizar a entrada de todas as cotas disponíveis com este ágio
          </label>

          <div>
            <p className="text-sm font-semibold">Sinal mínimo para segurar a cota (opcional)</p>
            <p className="mb-1 text-xs text-slate-500">PIX que o cliente paga para travar a cota. Em branco ou zero: o PIX é a entrada inteira.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-slate-500">Imóvel<MoneyInput value={cfg.sinal_imovel} onChange={(v) => setCfg({ ...cfg, sinal_imovel: v })} /></label>
              <label className="text-xs text-slate-500">Veículo<MoneyInput value={cfg.sinal_auto} onChange={(v) => setCfg({ ...cfg, sinal_auto: v })} /></label>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold">Mensagens de WhatsApp</p>
            <p className="mb-1 text-xs text-slate-500">Taxa de transferência padrão por cota (quando a lista não traz) e dia do vencimento.</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="text-xs text-slate-500">Transferência imóvel<MoneyInput value={cfg.transferencia_imovel} onChange={(v) => setCfg({ ...cfg, transferencia_imovel: v })} /></label>
              <label className="text-xs text-slate-500">Transferência veículo<MoneyInput value={cfg.transferencia_auto} onChange={(v) => setCfg({ ...cfg, transferencia_auto: v })} /></label>
              <label className="text-xs text-slate-500">Dia do vencimento<input className={inputCls} type="number" min={1} max={31} value={cfg.dia_vencimento} onChange={(e) => setCfg({ ...cfg, dia_vencimento: Number(e.target.value) })} /></label>
            </div>
          </div>

          <label className="block text-sm font-semibold">Comissão paga às revendas (todas as cotas)
            <select className={inputCls} value={cfg.comissao_modo} onChange={(e) => setCfg({ ...cfg, comissao_modo: e.target.value as ConfigContempladas["comissao_modo"] })}>
              <option value="TABELA">A comissão de cada cota (tabela)</option>
              <option value="PERCENTUAL">Percentual sobre o crédito</option>
            </select>
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {cfg.comissao_modo === "PERCENTUAL" && (
              <label className="block text-sm">% do crédito<input className={inputCls} type="number" step="0.01" value={cfg.comissao_percentual} onChange={(e) => setCfg({ ...cfg, comissao_percentual: Number(e.target.value) })} /></label>
            )}
            <label className="block text-sm">Repasse à revenda (%)<input className={inputCls} type="number" value={cfg.comissao_repasse_percentual} onChange={(e) => setCfg({ ...cfg, comissao_repasse_percentual: Number(e.target.value) })} /></label>
          </div>
          <label className="block text-sm font-semibold">WhatsApp de reservas da unidade
            <TelInput value={mascaraTelefone(cfg.whatsapp ?? "")} onChange={(v) => setCfg({ ...cfg, whatsapp: v })} />
          </label>
          <div className="block text-sm font-semibold">Chave PIX da unidade
            <PixInput tipo={cfg.chave_pix_tipo as TipoPix} valor={cfg.chave_pix ?? ""} onChange={(t, v) => setCfg({ ...cfg, chave_pix_tipo: t, chave_pix: v })} />
          </div>
          <label className="block text-sm font-semibold">Favorecido (nome que aparece no PIX)<input className={inputCls} value={cfg.favorecido_pix ?? ""} onChange={(e) => setCfg({ ...cfg, favorecido_pix: e.target.value })} /></label>
          {ehPadrao && (
            <label className="block text-sm font-semibold">Tempo da pré-reserva (minutos, vale para todas as unidades)
              <input className={inputCls} type="number" min={5} value={cfg.pre_reserva_minutos} onChange={(e) => setCfg({ ...cfg, pre_reserva_minutos: Number(e.target.value) })} />
            </label>
          )}
          <button className={`${btnOuro} w-full`} disabled={pend} onClick={() => start(async () => {
            const r = await salvarConfigAction(cfg, atualizarEntradas, alvoAuthId);
            if (r.ok) {
              onSalvo(`✅ Configuração salva.${r.atualizadas ? ` Entrada de ${r.atualizadas} cota(s) atualizada com o novo ágio.` : ""}`);
              router.refresh();
            } else setErro(r.erro);
          })}>Salvar</button>
              {erro && <p className="text-sm text-red-600">⚠️ {erro}</p>}
    </div>
  );
}

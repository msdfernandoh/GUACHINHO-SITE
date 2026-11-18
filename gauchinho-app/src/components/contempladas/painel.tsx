"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  atualizarUsuarioAction,
  cadastrarUsuarioAction,
  decidirReservaAction,
  gerarConviteAction,
  permissaoEnvioAction,
  salvarPerfilAction,
  salvarConfigAction,
  statusCotaAction,
} from "@/app/(landing-contempladas)/contempladas/actions";
import type { ConfigContempladas, CotaPortal } from "@/lib/contempladas/repo";
import type { Acrescimo } from "@/lib/contempladas/motor";
import { brl, btnOuro, btnSec, Card, inputCls, PixInput, Sair, TelInput, mascaraTelefone, type TipoPix } from "./ui";

type Reserva = { id: string; tipo: "PRE" | "PIX"; nome: string; telefone: string; cotaIds: string[]; expiraEm: string | null; criadaEm: string; comprovanteUrl: string | null };
type Proposta = { numero: number; cliente: string | null; vendedor: string | null; credito: number; entrada: number; desconto: number; rentabilidade: number; vendida: boolean; criadaEm: string };
type Membro = { id: string; nome: string; email: string; telefone: string | null; papel: "GERENTE" | "VENDEDOR"; ativo: boolean };
type UsuarioErp = { id: string; nome: string; email: string; perfil: string; contempladas_pode_enviar: boolean };
type Aba = "reservas" | "cotas" | "propostas" | "equipe" | "config" | "meu";

function SeletorValor({ valor, onChange, rotuloPct = "% do crédito" }: { valor: Acrescimo; onChange: (v: Acrescimo) => void; rotuloPct?: string }) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-2">
      <select className={`${inputCls} !w-36`} value={valor.tipo} onChange={(e) => onChange({ ...valor, tipo: e.target.value as Acrescimo["tipo"] })}>
        <option value="FIXO">Valor fixo R$</option>
        <option value="PERCENTUAL">{rotuloPct}</option>
      </select>
      <input className={inputCls} type="number" step="0.01" min={0} value={valor.valor} onChange={(e) => onChange({ ...valor, valor: Number(e.target.value) })} />
    </div>
  );
}

export function Painel(props: {
  papel: "DONO" | "GERENTE" | "VENDEDOR";
  adicional: Acrescimo;
  telefone: string | null;
  logoUrl: string | null;
  reservas: Reserva[];
  cotas: CotaPortal[];
  config: ConfigContempladas | null;
  stats: { simulacoes: number; preReservas: number; reservasPix: number; vendidas: number };
  propostas: Proposta[];
  equipe: Membro[];
  usuariosErp: UsuarioErp[];
}) {
  const router = useRouter();
  const gerencia = props.papel !== "VENDEDOR";
  const [aba, setAba] = useState<Aba>(gerencia ? "reservas" : "propostas");
  const [busca, setBusca] = useState("");
  const [pend, start] = useTransition();
  const [cfg, setCfg] = useState(props.config);
  const [adicional, setAdicional] = useState(props.adicional);
  const [tel, setTel] = useState(mascaraTelefone(props.telefone ?? ""));
  const [aviso, setAviso] = useState<string | null>(null);
  const [novo, setNovo] = useState({ nome: "", email: "", telefone: "", senha: "", papel: "VENDEDOR" as "GERENTE" | "VENDEDOR" });
  const [convite, setConvite] = useState<string | null>(null);
  const porId = new Map(props.cotas.map((c) => [c.id, c]));
  const agir = (fn: () => Promise<unknown>, ok?: string) =>
    start(async () => {
      try {
        await fn();
        if (ok) setAviso(ok);
        router.refresh();
      } catch (e) {
        setAviso(`⚠️ ${e instanceof Error ? e.message : "Erro"}`);
      }
    });

  const vendidas = props.propostas.filter((p) => p.vendida);
  const somaVendida = vendidas.reduce((s, p) => s + p.rentabilidade, 0);
  const somaAberta = props.propostas.filter((p) => !p.vendida).reduce((s, p) => s + p.rentabilidade, 0);

  const abas: [Aba, string][] = gerencia
    ? [["reservas", `Reservas (${props.reservas.length})`], ["cotas", "Cotas"], ["propostas", "Propostas"], ["equipe", "Equipe"], ["config", "Configurar"], ["meu", "Meu perfil"]]
    : [["propostas", "Minhas propostas"], ["meu", "Meu perfil"]];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(gerencia
          ? [["Simulações", props.stats.simulacoes], ["Pré-reservas", props.stats.preReservas], ["PIX a conferir", props.stats.reservasPix], ["Vendidas", props.stats.vendidas]]
          : [["Propostas", props.propostas.length], ["Vendidas", vendidas.length], ["Comissões recebidas", brl(somaVendida)], ["Em aberto", brl(somaAberta)]]
        ).map(([l, v]) => (
          <Card key={l as string} className="!p-3"><p className="text-xl font-black text-[#0047bb]">{v}</p><p className="text-[11px] uppercase text-slate-500">{l}</p></Card>
        ))}
      </div>

      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (busca) router.push(`/contempladas/p/${busca.replace(/\D/g, "")}`); }}>
        <input className={inputCls} inputMode="numeric" placeholder="Nº da proposta para reimprimir" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <button className={btnOuro}>Abrir</button>
      </form>

      <div className="flex gap-1 overflow-x-auto">
        {abas.map(([k, l]) => (
          <button key={k} onClick={() => { setAba(k); setAviso(null); }} className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold ${aba === k ? "bg-[#0047bb] text-white" : "bg-slate-50"}`}>{l}</button>
        ))}
        <span className="ml-auto self-center pl-2"><Sair /></span>
      </div>
      {aviso && <p className="text-sm">{aviso}</p>}

      {aba === "reservas" && gerencia && (
        <div className="space-y-2">
          {!props.reservas.length && <Card className="text-center text-slate-500">Nenhuma reserva ativa.</Card>}
          {props.reservas.map((r) => {
            const cs = r.cotaIds.map((id) => porId.get(id)).filter(Boolean) as CotaPortal[];
            return (
              <Card key={r.id} className={r.tipo === "PIX" ? "border-emerald-300" : ""}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold uppercase text-[#0047bb]">{r.tipo === "PIX" ? "Em análise · PIX enviado, cota bloqueada" : "Pré-reserva"}</p>
                    <p className="font-bold">{r.nome}</p>
                    <a className="text-sm text-emerald-700 underline" href={`https://wa.me/55${r.telefone}`} target="_blank" rel="noreferrer">{r.telefone}</a>
                  </div>
                  {r.expiraEm && <p className="text-right text-xs text-slate-500">expira<br />{new Date(r.expiraEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>}
                </div>
                <p className="mt-2 text-sm">{cs.map((c) => `${c.codigo} ${brl(c.credito)}`).join(" + ")}</p>
                {r.comprovanteUrl && <a className="mt-1 inline-block text-sm text-[#0047bb] underline" href={r.comprovanteUrl} target="_blank" rel="noreferrer">Ver comprovante</a>}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button disabled={pend} className="rounded-xl bg-emerald-500 py-3 font-bold text-white" onClick={() => agir(() => decidirReservaAction(r.id, "VENDIDA"))}>✔ Vendida</button>
                  <button disabled={pend} className="rounded-xl border border-slate-300 py-3 font-semibold" onClick={() => agir(() => decidirReservaAction(r.id, "CANCELAR"))}>{r.tipo === "PIX" ? "Liberar" : "Remover"}</button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {aba === "cotas" && gerencia && (
        <div className="space-y-2">
          <a href="/contempladas/importar" className={`${btnOuro} block text-center`}>+ Incluir cotas</a>
          {props.cotas.map((c) => (
            <Card key={c.id} className="!p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-bold">{brl(c.credito)} <span className="text-xs font-normal text-slate-500">{c.codigo}</span></p>
                  <p className="text-xs text-slate-500">Entrada {brl(c.entrada)} · {c.prazo}x {brl(c.parcela)}</p>
                </div>
                <span className={`rounded-lg px-2 py-1 text-xs font-bold ${c.status === "VENDIDA" ? "bg-red-100 text-red-700" : c.status === "RESERVADA" ? "bg-orange-100 text-orange-800" : "bg-emerald-100 text-emerald-800"}`}>{c.status === "RESERVADA" ? "EM ANÁLISE" : c.status}</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1 text-xs">
                <button disabled={pend || c.status === "VENDIDA"} className="rounded-lg bg-emerald-600 py-2 font-bold text-white" onClick={() => agir(() => statusCotaAction(c.id, "VENDIDA"))}>Vendida</button>
                <button disabled={pend || c.status === "DISPONIVEL"} className="rounded-lg bg-slate-100 py-2" onClick={() => agir(() => statusCotaAction(c.id, "DISPONIVEL"))}>Liberar</button>
                <button disabled={pend} className="rounded-lg bg-red-100 py-2 text-red-700" onClick={() => agir(() => statusCotaAction(c.id, "INATIVA"))}>Excluir</button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {aba === "propostas" && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">A rentabilidade aparece só aqui, nunca na proposta do cliente.</p>
          {!props.propostas.length && <Card className="text-center text-slate-500">Nenhuma proposta ainda.</Card>}
          {props.propostas.map((p) => (
            <a key={p.numero} href={`/contempladas/p/${p.numero}`} className="block">
              <Card className="!p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-bold">nº {p.numero} · {brl(p.credito)}</p>
                    <p className="text-xs text-slate-500">
                      {p.cliente ?? "sem nome"}{gerencia && p.vendedor ? ` · ${p.vendedor}` : ""} · entrada {brl(p.entrada)}{p.desconto > 0 ? ` (desc. ${brl(p.desconto)})` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-700">{brl(p.rentabilidade)}</p>
                    <p className={`text-[11px] font-bold ${p.vendida ? "text-emerald-700" : "text-slate-500"}`}>{p.vendida ? "VENDIDA" : "em aberto"}</p>
                  </div>
                </div>
              </Card>
            </a>
          ))}
        </div>
      )}

      {aba === "meu" && (
        <Card>
          <form className="space-y-3" onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("adicional_tipo", adicional.tipo);
            fd.set("adicional_valor", String(adicional.valor));
            agir(async () => { const r = await salvarPerfilAction(fd); if (!r.ok) throw new Error(r.erro); }, "✅ Perfil salvo.");
          }}>
            <div>
              <p className="font-semibold">Logomarca na proposta</p>
              <p className="mb-2 text-xs text-slate-500">Aparece no topo das propostas que você gerar. PNG, JPG ou WEBP até 2 MB.</p>
              {props.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={props.logoUrl} alt="Logo atual" className="mb-2 h-16 rounded-lg bg-white p-2 object-contain" />
              )}
              <input name="logo" type="file" accept="image/png,image/jpeg,image/webp" className={inputCls} />
              {props.logoUrl && <label className="mt-1 flex items-center gap-2 text-xs"><input type="checkbox" name="remover_logo" value="1" /> remover logo atual</label>}
            </div>
            <div>
              <p className="font-semibold">Seu WhatsApp</p>
              <p className="mb-1 text-xs text-slate-500">Sai na proposta, embaixo da sua assinatura.</p>
              <TelInput name="telefone" value={tel} onChange={setTel} />
            </div>
            <div>
              <p className="font-semibold">Adicional fixo na entrada</p>
              <p className="mb-1 text-xs text-slate-500">Entra sozinho em toda proposta que você gerar logado e soma na sua rentabilidade. O cliente vê só a entrada total.</p>
              <SeletorValor valor={adicional} onChange={setAdicional} />
            </div>
            <button className={`${btnOuro} w-full`} disabled={pend}>Salvar</button>
          </form>
        </Card>
      )}

      {aba === "config" && gerencia && cfg && (
        <Card className="space-y-3">
          <div>
            <p className="text-sm font-semibold">Ágio padrão na subida das cotas</p>
            <p className="mb-1 text-xs text-slate-500">Somado à entrada de toda cota enviada (pode ser trocado no envio).</p>
            <SeletorValor valor={{ tipo: cfg.agio_tipo, valor: cfg.agio_valor }} onChange={(v) => setCfg({ ...cfg, agio_tipo: v.tipo, agio_valor: v.valor })} />
          </div>
          <label className="block text-sm">Comissão paga ao vendedor
            <select className={inputCls} value={cfg.comissao_modo} onChange={(e) => setCfg({ ...cfg, comissao_modo: e.target.value as ConfigContempladas["comissao_modo"] })}>
              <option value="TABELA">A comissão de cada cota (tabela)</option>
              <option value="PERCENTUAL">Percentual sobre o crédito</option>
            </select>
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {cfg.comissao_modo === "PERCENTUAL" && (
              <label className="block text-sm">% do crédito<input className={inputCls} type="number" step="0.01" value={cfg.comissao_percentual} onChange={(e) => setCfg({ ...cfg, comissao_percentual: Number(e.target.value) })} /></label>
            )}
            <label className="block text-sm">Repasse ao vendedor (%)<input className={inputCls} type="number" value={cfg.comissao_repasse_percentual} onChange={(e) => setCfg({ ...cfg, comissao_repasse_percentual: Number(e.target.value) })} /></label>
          </div>
          <label className="block text-sm">WhatsApp de reservas
            <TelInput value={mascaraTelefone(cfg.whatsapp ?? "")} onChange={(v) => setCfg({ ...cfg, whatsapp: v })} />
          </label>
          <div className="block text-sm">Chave PIX
            <PixInput tipo={cfg.chave_pix_tipo as TipoPix} valor={cfg.chave_pix ?? ""} onChange={(t, v) => setCfg({ ...cfg, chave_pix_tipo: t, chave_pix: v })} />
          </div>
          <label className="block text-sm">Favorecido (nome que aparece no PIX)<input className={inputCls} value={cfg.favorecido_pix ?? ""} onChange={(e) => setCfg({ ...cfg, favorecido_pix: e.target.value })} /></label>
          <label className="block text-sm">Tempo da pré-reserva (minutos)
            <input className={inputCls} type="number" min={5} value={cfg.pre_reserva_minutos} onChange={(e) => setCfg({ ...cfg, pre_reserva_minutos: Number(e.target.value) })} />
          </label>
          <button className={`${btnOuro} w-full`} disabled={pend} onClick={() => agir(async () => { const r = await salvarConfigAction(cfg); if (!r.ok) throw new Error(r.erro); }, "✅ Configuração salva.")}>Salvar</button>
        </Card>
      )}

      {aba === "equipe" && gerencia && (
        <div className="space-y-3">
          <Card className="space-y-2">
            <p className="font-semibold">Link de cadastro</p>
            <p className="text-xs text-slate-500">Vale 7 dias. Quem se cadastra pelo link entra só no portal, sem acesso ao ERP.</p>
            <div className="grid grid-cols-2 gap-2">
              <button className={btnSec} disabled={pend} onClick={() => start(async () => { const r = await gerarConviteAction("VENDEDOR"); if (r.ok) setConvite(`${location.origin}/contempladas/cadastro/${r.token}`); })}>Link de vendedor</button>
              {props.papel === "DONO" && (
                <button className={btnSec} disabled={pend} onClick={() => start(async () => { const r = await gerarConviteAction("GERENTE"); if (r.ok) setConvite(`${location.origin}/contempladas/cadastro/${r.token}`); })}>Link de gerente</button>
              )}
            </div>
            {convite && (
              <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-xs">
                <p className="select-all break-all">{convite}</p>
                <div className="grid grid-cols-2 gap-2">
                  <button className={btnSec} onClick={() => navigator.clipboard.writeText(convite)}>Copiar</button>
                  <a className={`${btnSec} text-center`} href={`https://wa.me/?text=${encodeURIComponent(`Seu cadastro no portal de cotas contempladas: ${convite}`)}`} target="_blank" rel="noreferrer">WhatsApp</a>
                </div>
              </div>
            )}
          </Card>

          <Card className="space-y-2">
            <p className="font-semibold">Cadastrar agora</p>
            <input className={inputCls} placeholder="Nome" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
            <input className={inputCls} type="email" placeholder="E-mail (login)" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} />
            <TelInput value={novo.telefone} onChange={(v) => setNovo({ ...novo, telefone: v })} />
            <input className={inputCls} placeholder="Senha inicial (mín. 8)" value={novo.senha} onChange={(e) => setNovo({ ...novo, senha: e.target.value })} />
            {props.papel === "DONO" && (
              <select className={inputCls} value={novo.papel} onChange={(e) => setNovo({ ...novo, papel: e.target.value as "GERENTE" | "VENDEDOR" })}>
                <option value="VENDEDOR">Vendedor</option>
                <option value="GERENTE">Gerente</option>
              </select>
            )}
            <button className={`${btnOuro} w-full`} disabled={pend}
              onClick={() => start(async () => {
                const r = await cadastrarUsuarioAction(novo);
                setAviso(r.ok ? `✅ ${novo.nome} cadastrado. Login: ${novo.email}` : `⚠️ ${r.erro}`);
                if (r.ok) { setNovo({ nome: "", email: "", telefone: "", senha: "", papel: "VENDEDOR" }); router.refresh(); }
              })}>Cadastrar</button>
          </Card>

          <Card className="space-y-1">
            <p className="mb-1 font-semibold">Usuários do portal</p>
            {!props.equipe.length && <p className="text-sm text-slate-500">Ninguém cadastrado ainda.</p>}
            {props.equipe.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 border-t border-slate-100 py-2">
                <span className="text-sm"><b>{m.nome}</b><span className="block text-xs text-slate-500">{m.email} · {m.papel === "GERENTE" ? "gerente" : "vendedor"}</span></span>
                <div className="flex gap-1">
                  {props.papel === "DONO" && (
                    <button className="rounded-lg bg-slate-100 px-2 py-1 text-xs" disabled={pend} onClick={() => agir(() => atualizarUsuarioAction(m.id, { papel: m.papel === "GERENTE" ? "VENDEDOR" : "GERENTE" }))}>
                      {m.papel === "GERENTE" ? "→ vendedor" : "→ gerente"}
                    </button>
                  )}
                  <button className={`rounded-lg px-2 py-1 text-xs ${m.ativo ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-800"}`} disabled={pend} onClick={() => agir(() => atualizarUsuarioAction(m.id, { ativo: !m.ativo }))}>
                    {m.ativo ? "Bloquear" : "Ativar"}
                  </button>
                </div>
              </div>
            ))}
          </Card>

          {props.papel === "DONO" && props.usuariosErp.length > 0 && (
            <Card className="space-y-1">
              <p className="mb-1 font-semibold">Usuários do ERP com gerência no portal</p>
              {props.usuariosErp.map((u) => (
                <label key={u.id} className="flex items-center justify-between gap-2 border-t border-slate-100 py-2">
                  <span className="text-sm"><b>{u.nome}</b><span className="block text-xs text-slate-500">{u.email} · {u.perfil}</span></span>
                  <input type="checkbox" className="h-6 w-6 accent-[#0047bb]" disabled={pend || u.perfil === "master"} checked={u.perfil === "master" || u.contempladas_pode_enviar}
                    onChange={(e) => agir(() => permissaoEnvioAction(u.id, e.target.checked))} />
                </label>
              ))}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

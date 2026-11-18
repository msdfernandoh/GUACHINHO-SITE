import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { configsPorDono, obterProposta } from "@/lib/contempladas/repo";
import { agruparPeriodos, cronogramaMensal, faixasMensais, resumirCombinacao, rotuloMes } from "@/lib/contempladas/motor";
import { AcoesProposta } from "@/components/contempladas/acoes-proposta";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Proposta · Cotas Contempladas" }, robots: { index: false } };

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const MODOS = ["COMPLETA", "MENSAL", "SEMESTRAL", "ANUAL", "RESUMO", "DETALHADA"];
const tel = (d: string | null) => {
  const x = (d ?? "").replace(/\D/g, "");
  return x.length === 11 ? `(${x.slice(0, 2)}) ${x.slice(2, 7)}-${x.slice(7)}` : x.length === 10 ? `(${x.slice(0, 2)}) ${x.slice(2, 6)}-${x.slice(6)}` : x;
};

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid">
      <h2 className="mb-2 border-b-2 border-[#0047bb] pb-1 text-sm font-black uppercase tracking-wide text-[#0a2a66]">{titulo}</h2>
      {children}
    </section>
  );
}

const th = "px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500";
const td = "px-2 py-1.5";

export default async function Page({ params, searchParams }: { params: Promise<{ numero: string }>; searchParams: Promise<{ modo?: string }> }) {
  const tenant = await getResolvedTenant();
  if (!tenant) notFound();
  const { numero } = await params;
  const { modo: modoQuery } = await searchParams;
  const [p, cfgs] = await Promise.all([obterProposta(tenant.empresaId, Number(numero)), configsPorDono(tenant.empresaId)]);
  if (!p) notFound();
  // PIX e WhatsApp da unidade dona da cota.
  const cfg = cfgs.de(p.cotas[0]?.dono_auth_id ?? null);

  const modo = modoQuery && MODOS.includes(modoQuery.toUpperCase()) ? modoQuery.toUpperCase() : p.modo;
  const r = resumirCombinacao(p.cotas);
  // Adicional do vendedor já embutido na entrada (rateado por cota); desconto aparece para o cliente.
  const entradaFinal = r.entrada + p.adicional - p.desconto;
  const entradaCota = (credito: number, entrada: number) => entrada + (r.credito ? (p.adicional * credito) / r.credito : 0);
  const meses = cronogramaMensal(p.cotas, new Date(p.criadaEm));
  const faixas = faixasMensais(meses);
  const vendidas = p.cotas.filter((c) => c.status === "VENDIDA").length;
  const indisponivel = p.cotas.some((c) => c.status !== "DISPONIVEL");
  const ver = (m: string) => modo === "COMPLETA" || modo === "DETALHADA" || modo === m;
  const data = new Date(p.criadaEm);

  return (
    <div className="min-h-dvh bg-[#eef1f6] py-4 text-slate-900 print:bg-white print:py-0">
      <style>{`@page{size:A4;margin:12mm}@media print{html,body{background:#fff!important}}`}</style>

      <div className="contempladas-doc mx-auto mb-4 max-w-[860px] px-4 print:hidden">
        <div className="mb-3 flex items-center justify-between text-sm">
          <a href="/contempladas" className="font-semibold text-[#0047bb] hover:underline">← Voltar ao simulador</a>
          <span className="text-slate-500">Proposta nº {p.numero}</span>
        </div>
        <AcoesProposta
          numero={p.numero}
          propostaId={p.id}
          cotaIds={p.cotas.map((c) => c.id)}
          disponivel={!indisponivel}
          whatsapp={cfg.whatsapp}
          chavePix={cfg.chave_pix}
          tipoPix={{ CELULAR: "celular", EMAIL: "e-mail", CPF: "CPF", CNPJ: "CNPJ", ALEATORIA: "aleatória" }[cfg.chave_pix_tipo]}
          favorecido={cfg.favorecido_pix}
          minutos={cfg.pre_reserva_minutos}
          entrada={entradaFinal}
          resumoTexto={`Proposta nº ${p.numero}: ${p.cotas.length} cota(s), crédito ${brl(r.credito)}, entrada ${brl(entradaFinal)}, média ${brl(r.parcelaMedia)}/mês. Cotas: ${p.cotas.map((c) => c.codigo).join(", ")}`}
        />
      </div>

      <article className="mx-auto max-w-[860px] space-y-6 bg-white p-6 text-[13px] text-slate-800 shadow-lg sm:p-10 print:max-w-none print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            {p.vendedorLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.vendedorLogo} alt="Logomarca" className="h-14 max-w-[180px] object-contain" />
            ) : (
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#0047bb] text-xl font-black text-white">R</div>
            )}
            <div>
              <p className="text-lg font-black leading-tight text-[#0a2a66]">Proposta de Cotas Contempladas</p>
              <p className="text-xs text-slate-500">Consórcio de imóveis · Racon</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-slate-500">Proposta</p>
            <p className="text-2xl font-black text-[#0a2a66]">nº {p.numero}</p>
            <p className="text-xs text-slate-500">{data.toLocaleDateString("pt-BR")} · {data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
          </div>
        </header>

        {indisponivel && (
          <div className={`rounded-lg border-2 p-3 text-center text-base font-black ${vendidas ? "border-red-600 text-red-600" : "border-orange-500 text-orange-600"}`}>
            {vendidas === p.cotas.length ? "VENDIDA" : vendidas ? `${vendidas} de ${p.cotas.length} cotas já VENDIDAS` : "Cota(s) em análise para outro cliente"}
          </div>
        )}

        <div className="grid gap-1 text-sm sm:grid-cols-2">
          <p><span className="text-slate-500">Cliente: </span><b>{p.clienteNome ?? "________________________________"}</b></p>
          {p.clienteTelefone && <p><span className="text-slate-500">Telefone: </span><b>{tel(p.clienteTelefone)}</b></p>}
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="bg-[#0047bb] px-5 py-4 text-white">
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">Crédito total</p>
            <p className="text-4xl font-black">{brl(r.credito)}</p>
            <p className="text-xs text-white/60">{p.cotas.length} {p.cotas.length > 1 ? "cotas contempladas somadas" : "cota contemplada"}</p>
          </div>
          <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 sm:grid-cols-4 sm:divide-y-0">
            {[
              ["Entrada", brl(entradaFinal), p.desconto > 0 ? `com desconto de ${brl(p.desconto)}` : null],
              ["Média mensal", brl(r.parcelaMedia), "valor diluído"],
              ["Saldo devedor", brl(r.saldo), null],
              ["Prazo", `${r.prazoMaximo} meses`, "última parcela"],
            ].map(([l, v, s]) => (
              <div key={l as string} className="px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{l}</p>
                <p className="text-lg font-black text-[#0a2a66]">{v}</p>
                {s && <p className={`text-[11px] ${l === "Entrada" ? "font-semibold text-emerald-700" : "text-slate-500"}`}>{s}</p>}
              </div>
            ))}
          </div>
        </div>

        <Secao titulo="Cotas da proposta">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead className="bg-slate-50"><tr><th className={`${th} text-left`}>Cota</th><th className={`${th} text-right`}>Crédito</th><th className={`${th} text-right`}>Entrada</th><th className={`${th} text-right`}>Parcela</th><th className={`${th} text-right`}>Prazo</th><th className={`${th} text-right`}>Saldo</th><th className={th}>Situação</th></tr></thead>
              <tbody>
                {p.cotas.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className={`${td} font-semibold`}>{c.codigo}</td>
                    <td className={`${td} text-right`}>{brl(c.credito)}</td>
                    <td className={`${td} text-right`}>{brl(entradaCota(c.credito, c.entrada))}</td>
                    <td className={`${td} text-right`}>{brl(c.parcela)}</td>
                    <td className={`${td} text-right`}>{c.prazo}x</td>
                    <td className={`${td} text-right`}>{brl(c.saldo_devedor)}</td>
                    <td className={`${td} text-center text-xs`}>{c.status === "DISPONIVEL" ? "Disponível" : c.status === "VENDIDA" ? "VENDIDA" : c.status === "RESERVADA" ? "Em análise" : "Indisponível"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-300 font-bold">
                <tr><td className={td}>Total</td><td className={`${td} text-right`}>{brl(r.credito)}</td><td className={`${td} text-right`}>{brl(r.entrada + p.adicional)}</td><td className={`${td} text-right`}>{brl(r.parcelaInicial)}</td><td className={`${td} text-right`}>{r.prazoMaximo}x</td><td className={`${td} text-right`}>{brl(r.saldo)}</td><td /></tr>
              </tfoot>
            </table>
          </div>
          {p.desconto > 0 && <p className="mt-2 text-right text-sm font-semibold text-emerald-700">Desconto na entrada: −{brl(p.desconto)} · Entrada final {brl(entradaFinal)}</p>}
        </Secao>

        {ver("MENSAL") && (
          <Secao titulo="Parcelas mensais">
            <p className="mb-2 text-xs text-slate-500">O valor muda quando uma cota começa ou termina de pagar.</p>
            <table className="w-full">
              <thead className="bg-slate-50"><tr><th className={`${th} text-left`}>Período</th><th className={`${th} text-right`}>Meses</th><th className={`${th} text-right`}>Valor por mês</th></tr></thead>
              <tbody>
                {faixas.map((f) => (
                  <tr key={f.de} className="border-t border-slate-100">
                    <td className={td}>{f.de === f.ate ? rotuloMes(f.de) : `${rotuloMes(f.de)} a ${rotuloMes(f.ate)}`}</td>
                    <td className={`${td} text-right`}>{f.meses}</td>
                    <td className={`${td} text-right font-bold`}>{brl(f.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Secao>
        )}

        {(["SEMESTRAL", "ANUAL"] as const).filter(ver).map((t) => (
          <Secao key={t} titulo={t === "ANUAL" ? "Resumo anual" : "Resumo semestral"}>
            <table className="w-full">
              <thead className="bg-slate-50"><tr><th className={`${th} text-left`}>Período</th><th className={`${th} text-right`}>Total no período</th><th className={`${th} text-right`}>Média por mês</th></tr></thead>
              <tbody>
                {agruparPeriodos(meses, t).map((x) => (
                  <tr key={x.rotulo} className="border-t border-slate-100">
                    <td className={td}>{x.rotulo}</td><td className={`${td} text-right`}>{brl(x.total)}</td><td className={`${td} text-right font-semibold`}>{brl(x.mediaMensal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Secao>
        ))}

        {modo === "RESUMO" && (
          <Secao titulo="Média resumida">
            <p>Valor mensal diluído de <b>{brl(r.parcelaMedia)}</b> em {r.prazoMaximo} meses. Alguns meses saem mais caros e outros mais em conta; para ver mês a mês, peça a versão detalhada.</p>
          </Secao>
        )}

        {modo === "DETALHADA" && (
          <Secao titulo="Detalhado mês a mês, por cota">
            <table className="w-full text-xs">
              <tbody>
                {meses.map((m) => (
                  <tr key={m.mes} className="border-t border-slate-100 align-top">
                    <td className={`${td} w-16 font-semibold`}>{rotuloMes(m.mes)}</td>
                    <td className={`${td} text-slate-500`}>{m.itens.map((i) => `${i.codigo} ${i.numero}/${i.de} ${brl(i.parcela)}`).join(" · ")}</td>
                    <td className={`${td} text-right font-bold`}>{brl(m.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Secao>
        )}

        <p className="rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">
          Valores informados pela administradora na data desta proposta, sem o reajuste anual das parcelas. A reserva da cota só é garantida após o PIX da entrada e a confirmação da transferência pela administradora. Disponibilidade sujeita a confirmação no momento do fechamento.
        </p>

        <section className="break-inside-avoid pt-10">
          <div className="grid gap-12 sm:grid-cols-2 print:grid-cols-2">
            <div className="text-center">
              <div className="mb-1 border-t border-slate-800" />
              <p className="font-bold">{p.clienteNome ?? "Cliente"}</p>
              <p className="text-xs text-slate-500">Cliente{p.clienteTelefone ? ` · ${tel(p.clienteTelefone)}` : ""}</p>
            </div>
            <div className="text-center">
              <div className="mb-1 border-t border-slate-800" />
              <p className="font-bold">{p.vendedorNome ?? "Consultor"}</p>
              <p className="text-xs text-slate-500">Consultor{p.vendedorTelefone ? ` · ${tel(p.vendedorTelefone)}` : ""}</p>
            </div>
          </div>
          <p className="mt-8 text-center text-xs text-slate-400">Local e data: ____________________________, ____/____/________</p>
        </section>
      </article>
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { getConfig, obterProposta } from "@/lib/contempladas/repo";
import { agruparPeriodos, cronogramaMensal, faixasMensais, resumirCombinacao, rotuloMes } from "@/lib/contempladas/motor";
import { Shell } from "@/components/contempladas/ui";
import { AcoesProposta } from "@/components/contempladas/acoes-proposta";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Proposta · Cotas Contempladas" }, robots: { index: false } };

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const MODOS = ["COMPLETA", "MENSAL", "SEMESTRAL", "ANUAL", "RESUMO", "DETALHADA"];

export default async function Page({ params, searchParams }: { params: Promise<{ numero: string }>; searchParams: Promise<{ modo?: string }> }) {
  const tenant = await getResolvedTenant();
  if (!tenant) notFound();
  const { numero } = await params;
  const { modo: modoQuery } = await searchParams;
  const [p, cfg] = await Promise.all([obterProposta(tenant.empresaId, Number(numero)), getConfig(tenant.empresaId)]);
  if (!p) notFound();

  const modo = modoQuery && MODOS.includes(modoQuery.toUpperCase()) ? modoQuery.toUpperCase() : p.modo;
  const r = resumirCombinacao(p.cotas);
  // Adicional do vendedor já embutido na entrada; desconto aparece para o cliente.
  const entradaFinal = r.entrada + p.adicional - p.desconto;
  const meses = cronogramaMensal(p.cotas, new Date(p.criadaEm));
  const faixas = faixasMensais(meses);
  const vendidas = p.cotas.filter((c) => c.status === "VENDIDA").length;
  const indisponivel = p.cotas.some((c) => c.status !== "DISPONIVEL");
  const ver = (m: string) => modo === "COMPLETA" || modo === "DETALHADA" || modo === m;

  return (
    <Shell titulo={`Proposta nº ${p.numero}`} sub={new Date(p.criadaEm).toLocaleString("pt-BR")}>
      <article className="proposta space-y-4">
        {indisponivel && (
          <div className={`rounded-2xl p-4 text-center font-bold ${vendidas ? "bg-red-500/20 text-red-200" : "bg-orange-500/20 text-orange-200"}`}>
            {vendidas === p.cotas.length ? "VENDIDA" : vendidas ? `${vendidas} de ${p.cotas.length} cotas já VENDIDAS` : "Cota(s) reservada(s) por outro cliente"}
          </div>
        )}

        <div className="rounded-2xl bg-gradient-to-br from-amber-300 to-amber-500 p-5 text-[#07142b]">
          <p className="text-xs font-bold uppercase">{p.clienteNome ? `Proposta para ${p.clienteNome}` : "Proposta de cotas contempladas"}</p>
          <p className="text-4xl font-black">{brl(r.credito)}</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <span>Entrada<br /><b className="text-lg">{brl(entradaFinal)}</b>{p.desconto > 0 && <><br /><span className="text-xs">com desconto de {brl(p.desconto)}</span></>}</span>
            <span>Média mensal<br /><b className="text-lg">{brl(r.parcelaMedia)}</b></span>
            <span>Saldo devedor<br /><b className="text-lg">{brl(r.saldo)}</b></span>
            <span>Prazo<br /><b className="text-lg">{r.prazoMaximo} meses</b></span>
          </div>
        </div>

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <h2 className="mb-2 font-bold">Cotas desta proposta ({p.cotas.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-xs text-white/50"><tr><th className="p-1 text-left">Cota</th><th className="p-1 text-right">Crédito</th><th className="p-1 text-right">Entrada</th><th className="p-1 text-right">Parcela</th><th className="p-1 text-right">Prazo</th><th className="p-1 text-right">Saldo</th><th className="p-1">Status</th></tr></thead>
              <tbody>
                {p.cotas.map((c) => (
                  <tr key={c.id} className="border-t border-white/5">
                    <td className="p-1">{c.codigo}</td>
                    <td className="p-1 text-right">{brl(c.credito)}</td>
                    <td className="p-1 text-right">{brl(c.entrada + (r.credito ? (p.adicional * c.credito) / r.credito : 0))}</td>
                    <td className="p-1 text-right">{brl(c.parcela)}</td>
                    <td className="p-1 text-right">{c.prazo}x</td>
                    <td className="p-1 text-right">{brl(c.saldo_devedor)}</td>
                    <td className="p-1 text-center text-xs">{c.status === "DISPONIVEL" ? "Disponível" : c.status === "VENDIDA" ? "VENDIDA" : c.status === "RESERVADA" ? "Reservada" : "Indisponível"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {p.desconto > 0 && <p className="mt-2 text-sm text-emerald-300">Desconto na entrada: {brl(p.desconto)}</p>}
        </section>

        {ver("MENSAL") && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <h2 className="mb-2 font-bold">Mensal · muda quando uma cota começa ou termina</h2>
            <table className="w-full text-sm">
              <thead className="text-xs text-white/50"><tr><th className="p-1 text-left">Período</th><th className="p-1 text-right">Meses</th><th className="p-1 text-right">Valor por mês</th></tr></thead>
              <tbody>
                {faixas.map((f) => (
                  <tr key={f.de} className="border-t border-white/5">
                    <td className="p-1">{f.de === f.ate ? rotuloMes(f.de) : `${rotuloMes(f.de)} a ${rotuloMes(f.ate)}`}</td>
                    <td className="p-1 text-right">{f.meses}</td>
                    <td className="p-1 text-right font-semibold">{brl(f.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {(["SEMESTRAL", "ANUAL"] as const).filter(ver).map((t) => (
          <section key={t} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <h2 className="mb-2 font-bold">{t === "ANUAL" ? "Anual" : "Semestral"}</h2>
            <table className="w-full text-sm">
              <thead className="text-xs text-white/50"><tr><th className="p-1 text-left">Período</th><th className="p-1 text-right">Total</th><th className="p-1 text-right">Média/mês</th></tr></thead>
              <tbody>
                {agruparPeriodos(meses, t).map((x) => (
                  <tr key={x.rotulo} className="border-t border-white/5">
                    <td className="p-1">{x.rotulo}</td><td className="p-1 text-right">{brl(x.total)}</td><td className="p-1 text-right">{brl(x.mediaMensal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}

        {modo === "RESUMO" && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm">
            <h2 className="mb-1 font-bold">Média resumida</h2>
            <p>Valor mensal diluído de <b>{brl(r.parcelaMedia)}</b> em {r.prazoMaximo} meses. Alguns meses saem mais caros e outros mais em conta; para ver mês a mês, abra a versão detalhada.</p>
          </section>
        )}

        {modo === "DETALHADA" && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <h2 className="mb-2 font-bold">Detalhado mês a mês, por cota</h2>
            <div className="max-h-[70vh] overflow-auto text-xs print:max-h-none">
              {meses.map((m) => (
                <div key={m.mes} className="flex justify-between gap-2 border-t border-white/5 py-1">
                  <span className="w-14 font-semibold">{rotuloMes(m.mes)}</span>
                  <span className="flex-1 text-white/60">{m.itens.map((i) => `${i.codigo} ${i.numero}/${i.de} ${brl(i.parcela)}`).join(" · ")}</span>
                  <b>{brl(m.total)}</b>
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="text-[11px] text-white/50">
          Valores informados pela administradora na data da proposta, sem reajuste anual das parcelas. A cota só fica garantida após o PIX da entrada e a confirmação da transferência.
        </p>

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
      </article>
    </Shell>
  );
}

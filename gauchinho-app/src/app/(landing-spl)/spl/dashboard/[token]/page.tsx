import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { timingSafeEqual } from "node:crypto";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { dashboardSpl, tokenDashboardSpl } from "@/lib/spl/repo";
import { extrairToken } from "@/lib/spl/links";
import { labelDe, MODELOS_PARCERIA } from "@/lib/spl/types";
import { brl, SplShell } from "@/components/spl/spl-ui";
import { SplInstalarApp } from "@/components/spl/spl-instalar-app";
import { metadataAppSpl } from "@/lib/spl/app-metadata";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const esperado = await tokenDashboardSpl();
  const valido = !!esperado && tokenConfere(extrairToken(token), esperado);
  return metadataAppSpl({
    titulo: "Painel SPL · Imobiliárias parceiras",
    inicio: valido ? `/spl/dashboard/spl-engenharia-${esperado}` : "/spl",
    nomeApp: "SPL · Imobiliárias parceiras",
    curto: "Painel SPL",
  });
}

function tokenConfere(recebido: string, esperado: string) {
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

const STATUS: Record<string, { label: string; cor: string }> = {
  APROVADA: { label: "Aprovada", cor: "bg-emerald-100 text-emerald-800" },
  PENDENTE: { label: "Em aprovação", cor: "bg-amber-100 text-amber-800" },
  INATIVA: { label: "Inativa", cor: "bg-slate-200 text-slate-700" },
};

export default async function SplDashboardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tenant = await getResolvedTenant();
  const esperado = await tokenDashboardSpl();
  if (!tenant || !esperado || !tokenConfere(extrairToken(token), esperado)) notFound();

  const d = await dashboardSpl(tenant.empresaId);
  const n = (v: number) => v.toLocaleString("pt-BR");
  const maxEmp = Math.max(1, ...d.porEmpreendimento.map((e) => e.clientes));
  const maxSol = Math.max(1, ...d.porSolucao.map((s) => s.total));
  const atualizado = new Date().toLocaleString("pt-BR", { timeZone: "America/Cuiaba", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <SplShell direita={<span className="text-sm font-semibold text-white/70">Atualizado {atualizado}</span>}>
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#153E90]">SPL Engenharia · Chaves para o Futuro</p>
          <h1 className="text-3xl font-black text-[#0A1931]">Painel das imobiliárias parceiras</h1>
        </div>

        <SplInstalarApp texto="Coloque este painel na tela inicial do celular" />

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["Imobiliárias cadastradas", n(d.totais.imobiliarias), `${n(d.totais.aprovadas)} aprovadas · ${n(d.totais.pendentes)} em aprovação`],
            ["Vendedores na rede", n(d.totais.vendedores), "cadastrados pelas imobiliárias"],
            ["Clientes enviados", n(d.totais.clientes), `de ${n(d.totais.carteira)} unidades na carteira`],
            ["Clientes em atendimento", n(d.totais.emAtendimento), `${n(d.totais.propostas)} com proposta · ${n(d.totais.fechados)} fechados`],
          ].map(([titulo, valor, sub]) => (
            <div key={titulo} className="rounded-3xl bg-[#0A1931] p-5 text-white">
              <p className="text-sm text-white/70">{titulo}</p>
              <p className="mt-1 text-4xl font-black text-[#F59E0B]">{valor}</p>
              <p className="mt-1 text-sm text-white/60">{sub}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black text-[#0A1931]">Clientes por empreendimento</h2>
            <ul className="mt-4 space-y-3">
              {d.porEmpreendimento.map((e) => (
                <li key={e.slug}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-bold text-slate-800">
                      {e.nome} <span className="font-normal text-slate-500">· {e.cidade} · {e.entrega}</span>
                    </span>
                    <span className="font-bold">{n(e.clientes)}</span>
                  </div>
                  <div className="mt-1 h-3 rounded-full bg-slate-100">
                    <div className="h-3 rounded-full bg-[#153E90]" style={{ width: `${(e.clientes / maxEmp) * 100}%` }} />
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {n(e.jaComprou)} já compraram · {n(e.emAtendimento)} em atendimento · {n(e.fechados)} fechados · {n(e.unidades)} unidades
                  </p>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black text-[#0A1931]">Solução escolhida</h2>
            <ul className="mt-4 space-y-3">
              {d.porSolucao.map((s) => (
                <li key={s.label}>
                  <div className="flex justify-between text-sm">
                    <span className="font-bold text-slate-800">{s.label}</span>
                    <span className="font-bold">{n(s.total)}</span>
                  </div>
                  <div className="mt-1 h-3 rounded-full bg-slate-100">
                    <div className="h-3 rounded-full bg-[#F59E0B]" style={{ width: `${(s.total / maxSol) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black text-[#0A1931]">Imobiliárias</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[860px] text-left">
              <thead className="text-sm text-slate-500">
                <tr>
                  {["Imobiliária", "Modelo", "Situação", "Vendedores", "Clientes", "Em atendimento", "Propostas", "Fechados", "Valor nas chaves"].map((h) => (
                    <th key={h} className="py-2 pr-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.imobiliarias.map((i) => (
                  <tr key={i.id} className="border-t">
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2">
                        {i.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={i.logo_url} alt="" className="h-8 w-8 rounded object-contain ring-1 ring-slate-200" />
                        ) : null}
                        <span className="font-bold">{i.nome}</span>
                      </div>
                    </td>
                    <td className="pr-3 text-sm">{labelDe(MODELOS_PARCERIA, i.modelo_parceria)}</td>
                    <td className="pr-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS[i.status]?.cor ?? ""}`}>{STATUS[i.status]?.label ?? i.status}</span>
                    </td>
                    <td className="pr-3">{n(i.vendedores)}</td>
                    <td className="pr-3 font-bold">{n(i.clientes)}</td>
                    <td className="pr-3">{n(i.emAtendimento)}</td>
                    <td className="pr-3">{n(i.propostas)}</td>
                    <td className="pr-3">{n(i.fechados)}</td>
                    <td className="pr-3">{brl(i.valorChaves)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!d.imobiliarias.length ? <p className="py-4 text-slate-500">Nenhuma imobiliária cadastrada ainda.</p> : null}
          </div>
        </section>
        <p className="text-center text-sm text-slate-500">Somente números agregados. Os dados pessoais dos clientes ficam com a equipe Racon.</p>
      </main>
    </SplShell>
  );
}

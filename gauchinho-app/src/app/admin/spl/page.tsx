import Link from "next/link";
import { requireTenantPermission } from "@/lib/tenant/context";
import { listarClientesAdmin, listarEmpreendimentos, listarImobiliariasAdmin, tokenDashboardSpl } from "@/lib/spl/repo";
import { caminhoConvite, caminhoPainel } from "@/lib/spl/links";
import { getTermosSpl } from "@/lib/spl/termos";
import { CopiarTexto, ExcluirImobiliaria } from "@/components/admin/spl-admin-acoes";
import { getSplConfig } from "@/lib/spl/config-server";
import { labelDe, labelModeloVendedores, MODELOS_PARCERIA, SOLUCOES, STATUS_CLIENTE } from "@/lib/spl/types";
import { formatCurrency } from "@/lib/utils/format";
import { Button, Input, Label } from "@/components/ui/form-primitives";
import {
  alternarLogoAction,
  decidirImobiliariaAction,
  salvarConfigSplAction,
  salvarEmpreendimentoAction,
  salvarTermosSplAction,
  statusClienteAction,
} from "./actions";

export const dynamic = "force-dynamic";

const STATUS_COR: Record<string, string> = {
  PENDENTE: "bg-amber-100 text-amber-800",
  APROVADA: "bg-emerald-100 text-emerald-800",
  RECUSADA: "bg-red-100 text-red-800",
  INATIVA: "bg-zinc-200 text-zinc-700",
};

export default async function AdminSplPage() {
  const ctx = await requireTenantPermission("gerenciar_imoveis");
  const empresaId = ctx.empresaAtiva!.id;
  const isMasterUser = ctx.usuario.perfil === "master";
  const [imobs, clientes, empreendimentos, config, tokenSpl, termos] = await Promise.all([
    listarImobiliariasAdmin(empresaId),
    listarClientesAdmin(empresaId),
    listarEmpreendimentos(empresaId),
    getSplConfig(),
    tokenDashboardSpl(),
    getTermosSpl(),
  ]);
  const site = "https://spl.raconsinop.com.br";
  const pendentes = imobs.filter((i) => i.status === "PENDENTE").length;
  const card = "rounded-xl border bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Portfólio SPL</h1>
          <p className="text-sm text-zinc-500">
            Imobiliárias parceiras, carteira de clientes e parâmetros do portfólio usado pelos vendedores.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/spl" target="_blank" className="rounded-lg border px-3 py-2 text-sm font-semibold">
            Ver página
          </Link>
          <Link href="/admin/cartas-contempladas/importar" className="rounded-lg border px-3 py-2 text-sm font-semibold">
            Atualizar cartas
          </Link>
        </div>
      </div>

      {tokenSpl ? (
        <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
          <div>
            <p className="font-bold">Painel da SPL Engenharia</p>
            <p className="text-sm text-zinc-500">Link somente leitura com os números de todas as imobiliárias. Envie para a SPL.</p>
            <p className="mt-1 break-all font-mono text-xs">https://spl.raconsinop.com.br/spl/dashboard/spl-engenharia-{tokenSpl}</p>
          </div>
          <a href={`/spl/dashboard/spl-engenharia-${tokenSpl}`} target="_blank" rel="noreferrer" className="rounded-lg border px-3 py-2 text-sm font-semibold">
            Abrir painel da SPL
          </a>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Imobiliárias", imobs.length],
          ["Aguardando aprovação", pendentes],
          ["Clientes na carteira", clientes.length],
          ["Em atendimento", clientes.filter((c) => c.status !== "NOVO" && c.status !== "PERDIDO").length],
        ].map(([l, v]) => (
          <div key={String(l)} className={card}>
            <p className="text-xs uppercase text-zinc-500">{l}</p>
            <p className="text-2xl font-bold">{v}</p>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Imobiliárias</h2>
        <div className="overflow-x-auto rounded-xl border bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-800">
              <tr>
                {["Imobiliária", "Responsável", "Modelo", "Equipe", "Carteira", "Situação", "Ações"].map((h) => (
                  <th key={h} className="p-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {imobs.map((i) => (
                <tr key={i.id} className="border-t align-top dark:border-zinc-800">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {i.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={i.logo_url} alt="" className="h-9 w-9 rounded object-contain ring-1 ring-zinc-200" />
                      ) : null}
                      <div>
                        <p className="font-semibold">{i.nome}</p>
                        <p className="text-xs text-zinc-500">
                          {i.cnpj ?? <span className="font-bold text-amber-600">sem CNPJ (incompleto)</span>} · PIX {i.chave_pix_tipo ? `${i.chave_pix_tipo.toLowerCase()} ` : ""}{i.chave_pix ?? "—"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    {i.responsavel}
                    <p className="text-xs text-zinc-500">{i.telefone} · {i.email}</p>
                  </td>
                  <td className="p-3">
                    {labelDe(MODELOS_PARCERIA, i.modelo_parceria)}
                    <p className="text-xs text-zinc-500">Vendedores: {labelModeloVendedores(i.modelo_vendedores)}</p>
                  </td>
                  <td className="p-3">
                    {i.vendedores} cadastrados
                    <p className="text-xs text-zinc-500">{i.quantidade_vendedores} informados</p>
                  </td>
                  <td className="p-3">
                    {i.clientes} clientes
                    <p className="text-xs text-zinc-500">{i.emAtendimento} em atendimento</p>
                  </td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${STATUS_COR[i.status] ?? ""}`}>{i.status}</span>
                    <p className="mt-1 text-xs text-zinc-500">Logo na página: {i.exibir_logo ? "sim" : "não"}</p>
                    <p className={`text-xs ${termos && i.termos_versao === termos.versao ? "text-emerald-700" : "text-amber-600"}`}>
                      Termo:{" "}
                      {!termos
                        ? "não publicado"
                        : i.termos_versao === termos.versao && i.termos_aceito_em
                          ? `aceito em ${new Date(i.termos_aceito_em).toLocaleDateString("pt-BR")}`
                          : i.termos_aceito_em
                            ? "aceitou versão antiga"
                            : "pendente"}
                    </p>
                  </td>
                  <td className="space-y-1 p-3">
                    <div className="flex flex-wrap gap-1">
                      {i.status !== "APROVADA" ? (
                        <form action={decidirImobiliariaAction}>
                          <input type="hidden" name="id" value={i.id} />
                          <input type="hidden" name="decisao" value="aprovar" />
                          <Button size="sm" variant="gold">Aprovar</Button>
                        </form>
                      ) : null}
                      {i.status === "PENDENTE" ? (
                        <form action={decidirImobiliariaAction}>
                          <input type="hidden" name="id" value={i.id} />
                          <input type="hidden" name="decisao" value="recusar" />
                          <Button size="sm" variant="outline">Recusar</Button>
                        </form>
                      ) : null}
                      {i.status === "APROVADA" ? (
                        <>
                          <form action={alternarLogoAction}>
                            <input type="hidden" name="id" value={i.id} />
                            <input type="hidden" name="exibir" value={i.exibir_logo ? "false" : "true"} />
                            <Button size="sm" variant="outline">{i.exibir_logo ? "Ocultar logo" : "Mostrar logo"}</Button>
                          </form>
                          <form action={decidirImobiliariaAction}>
                            <input type="hidden" name="id" value={i.id} />
                            <input type="hidden" name="decisao" value="inativar" />
                            <Button size="sm" variant="ghost">Inativar</Button>
                          </form>
                        </>
                      ) : null}
                    </div>
                    <a
                      href={`https://wa.me/55${i.telefone}?text=${encodeURIComponent(`Olá, ${i.responsavel}! Este é o sistema da ${i.nome} no portfólio SPL. Abra no celular e instale na tela inicial:\nhttps://spl.raconsinop.com.br${caminhoPainel(i.nome, i.token_painel)}`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-xs font-semibold text-emerald-700 underline"
                    >
                      Enviar o sistema no WhatsApp
                    </a>
                    <CopiarTexto texto={`${site}${caminhoPainel(i.nome, i.token_painel)}`} rotulo="Copiar link do painel" />
                    <CopiarTexto texto={`${site}${caminhoConvite(i.nome, i.codigo_convite)}`} rotulo="Copiar link de convite dos vendedores" />
                    {termos && i.termos_versao === termos.versao ? (
                      <a href={`/api/public/spl/termos/pdf?painel=${i.token_painel}`} className="block text-xs font-semibold text-blue-700 underline">
                        Baixar termo aceito (PDF)
                      </a>
                    ) : null}
                    {isMasterUser ? <ExcluirImobiliaria id={i.id} nome={i.nome} /> : null}
                    <a href={caminhoPainel(i.nome, i.token_painel)} target="_blank" rel="noreferrer" className="block text-xs font-semibold text-amber-600 underline">
                      Abrir ou editar o painel da imobiliária
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!imobs.length ? <p className="p-4 text-sm text-zinc-500">Nenhuma imobiliária cadastrada ainda.</p> : null}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Carteira de clientes</h2>
        <div className="overflow-x-auto rounded-xl border bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-800">
              <tr>
                {["Cliente", "Imobiliária / vendedor", "Empreendimento", "Chaves", "Solução", "Proposta", "Situação"].map((h) => (
                  <th key={h} className="p-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id} className="border-t dark:border-zinc-800">
                  <td className="p-3">
                    <p className="font-semibold">{c.nome}</p>
                    <p className="text-xs text-zinc-500">{c.telefone}</p>
                  </td>
                  <td className="p-3">
                    {c.imobiliaria?.nome ?? "—"}
                    <p className="text-xs text-zinc-500">{c.vendedor?.nome ?? "pelo painel"}</p>
                  </td>
                  <td className="p-3">
                    {empreendimentos.find((e) => e.slug === c.empreendimento_slug)?.nome ?? "—"}
                    {c.unidade ? <p className="text-xs text-zinc-500">{c.unidade}</p> : null}
                  </td>
                  <td className="p-3">{formatCurrency(c.valor_chaves)}</td>
                  <td className="p-3">{labelDe(SOLUCOES, c.solucao)}</td>
                  <td className="p-3 text-xs">
                    {c.proposta_expira_em
                      ? `${new Date(c.proposta_expira_em) < new Date() ? "Venceu" : "Vale até"} ${new Date(c.proposta_expira_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`
                      : "—"}
                  </td>
                  <td className="p-3">
                    <form action={statusClienteAction} className="flex gap-1">
                      <input type="hidden" name="id" value={c.id} />
                      <select name="status" defaultValue={c.status} className="rounded border px-2 py-1 text-sm dark:bg-zinc-800">
                        {STATUS_CLIENTE.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                      <Button size="sm" variant="outline">Salvar</Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!clientes.length ? <p className="p-4 text-sm text-zinc-500">Nenhum cliente na carteira ainda.</p> : null}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Empreendimentos</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {empreendimentos.map((e) => (
            <form key={e.id} action={salvarEmpreendimentoAction} className={`${card} space-y-2`}>
              <input type="hidden" name="id" value={e.id} />
              <p className="font-bold">{e.nome} · {e.cidade}</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>Entrega</Label>
                  <Input name="entrega_texto" defaultValue={e.entrega_texto} />
                </div>
                <div>
                  <Label>Vendidas</Label>
                  <Input name="vendidas" defaultValue={String(e.vendidas)} />
                </div>
                <div>
                  <Label>Disponíveis</Label>
                  <Input name="disponiveis" defaultValue={String(e.disponiveis)} />
                </div>
              </div>
              <p className="text-xs font-semibold text-zinc-500">Recomendado no portfólio</p>
              <div className="flex flex-wrap gap-3 text-sm">
                {SOLUCOES.map((s) => (
                  <label key={s.value} className="flex items-center gap-1">
                    <input type="checkbox" name="solucoes" value={s.value} defaultChecked={e.solucoes_recomendadas.includes(s.value)} />
                    {s.curta}
                  </label>
                ))}
                <label className="flex items-center gap-1">
                  <input type="checkbox" name="ativo" defaultChecked />
                  Ativo
                </label>
              </div>
              <Button size="sm">Salvar</Button>
            </form>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Termo de parceria das imobiliárias</h2>
        <form action={salvarTermosSplAction} className={`${card} space-y-3`}>
          <p className="text-sm text-zinc-500">
            {termos
              ? `Publicado: versão ${termos.versao}. Ao publicar de novo, as imobiliárias precisam aceitar a nova versão no painel.`
              : "Ainda não publicado. Depois de publicado, o aceite passa a ser obrigatório no cadastro."}{" "}
            Separe os parágrafos com uma linha em branco. O PDF sai com os dados e o aceite de cada imobiliária.
          </p>
          <textarea
            name="texto"
            rows={16}
            defaultValue={termos?.texto ?? ""}
            className="w-full rounded-lg border p-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            placeholder="TERMO DE PARCERIA COMERCIAL…"
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="gold">Publicar termo</Button>
            {termos ? (
              <a href="/api/public/spl/termos/pdf" className="rounded-lg border px-3 py-2 text-sm font-semibold">
                Ver PDF
              </a>
            ) : null}
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Parâmetros</h2>
        <form action={salvarConfigSplAction} className={`${card} grid gap-3 md:grid-cols-3`}>
          {(
            [
              ["margemEntradaCarta", "Margem na entrada · carta de imóvel (R$)", config.margemEntradaCarta],
              ["margemEntradaCartaVeiculo", "Margem na entrada · carta de veículo (R$)", config.margemEntradaCartaVeiculo],
              ["taxaHomeEquityMensal", "Home equity (% ao mês)", config.taxaHomeEquityMensal],
              ["prazoHomeEquityMeses", "Home equity (prazo padrão, meses)", config.prazoHomeEquityMeses],
              ["taxaFinanciamentoMensal", "Financiamento (% ao mês)", config.taxaFinanciamentoMensal],
              ["prazoFinanciamentoMeses", "Financiamento (prazo padrão, meses)", config.prazoFinanciamentoMeses],
              ["validadePropostaHoras", "Validade da proposta (horas)", config.validadePropostaHoras],
              ["grupoSpl", "Plano SPL · grupo", config.grupoSpl],
              ["reduzidaSpl", "Plano SPL · parcela reduzida (%)", config.reduzidaSpl],
              ["embutidoSpl", "Plano SPL · lance embutido (%)", config.embutidoSpl],
              ["reajusteSpl", "Plano SPL · reajuste", config.reajusteSpl],
              ["grupoEconomico", "Plano Econômico · grupo", config.grupoEconomico],
              ["reduzidaEconomico", "Plano Econômico · parcela reduzida (%)", config.reduzidaEconomico],
              ["embutidoEconomico", "Plano Econômico · lance embutido (%)", config.embutidoEconomico],
              ["reajusteEconomico", "Plano Econômico · reajuste", config.reajusteEconomico],
              ["whatsappReservas", "WhatsApp para reservas de carta (vazio = WhatsApp do site)", config.whatsappReservas],
            ] as const
          ).map(([k, l, v]) => (
            <div key={k}>
              <Label>{l}</Label>
              <Input name={k} defaultValue={String(v)} />
            </div>
          ))}
          <div className="md:col-span-3">
            <Button variant="gold">Salvar parâmetros</Button>
          </div>
        </form>
      </section>
    </div>
  );
}

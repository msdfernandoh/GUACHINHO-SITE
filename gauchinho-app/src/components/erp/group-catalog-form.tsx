"use client";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { GroupActionState } from "@/app/platform/grupos-actions";
import { calcularAssembleiaMetade } from "@/lib/grupos/regra-integralizacao";

const initial: GroupActionState = { status: "IDLE", message: "" };
const field = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white";

type Admin = { id: string; nome: string };
type Item = { id: string; nome: string; administradora_id: string };
type Group = {
  id?: string;
  codigo_grupo?: string;
  administradora_id?: string | null;
  tipo_administradora_id?: string | null;
  modalidade_comissao_id?: string | null;
  status?: string;
  ativo?: boolean;
  prazo_total?: number | null;
  data_primeira_assembleia?: string | null;
  taxa_administrativa_percentual?: number | null;
  fundo_reserva_percentual?: number | null;
  seguro_percentual?: number | null;
  permite_lance_embutido?: boolean;
  percentual_lance_embutido?: number | null;
  percentual_parcela_reduzida?: number | null;
  percentuais_parcela_reduzida?: number[] | null;
  regra_integralizacao_parcela_reduzida?: "CONTEMPLACAO" | "ASSEMBLEIA" | null;
  assembleia_limite_parcela_reduzida?: number | null;
  lances?: Array<{
    id?: string;
    nome: string;
    percentual_lance_embutido: number;
    percentual_recurso_proprio_minimo: number;
    base_referencia?: "SALDO_DEVEDOR" | "CREDITO";
    descricao?: string | null;
  }>;
  vagas_disponiveis?: number | null;
  origem_governanca?: string;
  status_governanca?: string;
  modalidades_habilitadas_ids?: string[];
  modalidade_integral_habilitada?: boolean;
  modalidade_reduzida_habilitada?: boolean;
  modalidade_personalizada_habilitada?: boolean;
  status_vagas_local?: string;
  alteracao_catalogo_status?: string;
  observacoes?: string | null;
};

export function GroupCatalogForm({
  action,
  administradoras,
  tipos,
  modalidades: _modalidades,
  grupo,
  readonly = false,
  scope,
}: {
  action: (state: GroupActionState, data: FormData) => Promise<GroupActionState>;
  administradoras: Admin[];
  tipos: Item[];
  modalidades: Item[];
  grupo?: Group;
  readonly?: boolean;
  scope: "PLATFORM" | "ERP";
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(action, initial);
  const [admin, setAdmin] = useState(
    grupo?.administradora_id ?? administradoras[0]?.id ?? ""
  );

  const availableTypes = useMemo(
    () => tipos.filter((x) => x.administradora_id === admin),
    [tipos, admin]
  );
  const [integral, setIntegral] = useState(grupo?.modalidade_integral_habilitada !== false);
  const [reduzida, setReduzida] = useState(grupo?.modalidade_reduzida_habilitada !== false);
  const [personalizada, setPersonalizada] = useState(
    grupo?.modalidade_personalizada_habilitada !== false,
  );
  const [percentuaisReduzidos, setPercentuaisReduzidos] = useState<string[]>(() => {
    const cadastrados = grupo?.percentuais_parcela_reduzida;
    if (Array.isArray(cadastrados) && cadastrados.length > 0) return cadastrados.map(String);
    return [String(grupo?.percentual_parcela_reduzida ?? 60)];
  });
  const [prazoTotal, setPrazoTotal] = useState(grupo?.prazo_total ? String(grupo.prazo_total) : "");
  const [regraIntegralizacao, setRegraIntegralizacao] = useState<"" | "CONTEMPLACAO" | "ASSEMBLEIA">(
    grupo?.regra_integralizacao_parcela_reduzida ?? (grupo?.id ? "" : "CONTEMPLACAO"),
  );
  const [assembleiaLimite, setAssembleiaLimite] = useState(
    grupo?.assembleia_limite_parcela_reduzida ? String(grupo.assembleia_limite_parcela_reduzida) : "",
  );
  const [lances, setLances] = useState(() =>
    (grupo?.lances ?? []).map((lance, index) => ({
      id: lance.id ?? `existente-${index}`,
      nome: lance.nome,
      percentual_lance_embutido: String(lance.percentual_lance_embutido ?? ""),
      percentual_recurso_proprio_minimo: String(lance.percentual_recurso_proprio_minimo ?? 0),
      base_referencia: lance.base_referencia ?? "SALDO_DEVEDOR",
      descricao: lance.descricao ?? "",
    })),
  );
  const [novoCredito, setNovoCredito] = useState("");
  const [creditos, setCreditos] = useState<string[]>([]);
  useEffect(() => {
    if (state.status === "SUCCESS") {
      setCreditos([]);
      setNovoCredito("");
      if (state.redirectTo) router.replace(state.redirectTo);
    } else if (state.status === "CONFLICT" && state.redirectTo) {
      router.replace(state.redirectTo);
    }
  }, [router, state]);

  function adicionarCredito() {
    const valor = novoCredito.trim();
    if (!valor) return;
    setCreditos((atuais) => (atuais.includes(valor) ? atuais : [...atuais, valor]));
    setNovoCredito("");
  }

  return (
    <form
      action={formAction}
      className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <input type="hidden" name="id" value={grupo?.id ?? ""} />
      <input type="hidden" name="lances_json" value={JSON.stringify(lances)} />
      <input type="hidden" name="percentuais_parcela_reduzida_json" value={JSON.stringify(percentuaisReduzidos)} />
      <input type="hidden" name="creditos_json" value={JSON.stringify(creditos)} />

      {scope === "ERP" && grupo?.alteracao_catalogo_status && grupo.alteracao_catalogo_status !== "SEM_ALTERACAO" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Alteração local ativa · <strong>{grupo.alteracao_catalogo_status}</strong>. Ela vale somente para esta franquia até a análise da Platform.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Administradora
          <select
            className={field}
            name="administradora_id"
            value={admin}
            onChange={(e) => setAdmin(e.target.value)}
            disabled={readonly}
            required
          >
            {administradoras.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
          {readonly && <input type="hidden" name="administradora_id" value={admin} />}
        </label>

        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Código / Número do Grupo
          <input
            className={field}
            name="codigo_grupo"
            defaultValue={grupo?.codigo_grupo ?? ""}
            disabled={readonly}
            required
          />
        </label>

        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Tipo Oficial do Bem
          <select
            className={field}
            name="tipo_administradora_id"
            defaultValue={grupo?.tipo_administradora_id ?? availableTypes[0]?.id ?? ""}
            disabled={readonly}
            required
          >
            {availableTypes.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Status do Grupo
          <select
            className={field}
            name="status"
            defaultValue={grupo?.status ?? "Disponível"}
            disabled={readonly}
          >
            <option value="Disponível">Disponível para Venda</option>
            <option value="Indisponível">Indisponível</option>
            <option value="Encerrado">Encerrado</option>
          </select>
        </label>

        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Prazo Total (Meses)
          <input
            className={field}
            name="prazo_total"
            type="number"
            min="1"
            value={prazoTotal}
            onChange={(event) => setPrazoTotal(event.target.value)}
            disabled={readonly}
            required
          />
        </label>

        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Data da primeira assembleia
          <input
            className={field}
            name="data_primeira_assembleia"
            type="date"
            defaultValue={grupo?.data_primeira_assembleia?.split("T")[0] ?? ""}
            disabled={readonly}
            required={!grupo?.id}
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">Obrigatória em todo novo grupo e usada para projetar a data da integralização.</span>
        </label>

        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Taxa Administrativa (%)
          <input
            className={field}
            name="taxa_administrativa_percentual"
            inputMode="decimal"
            defaultValue={grupo?.taxa_administrativa_percentual ?? 24}
            disabled={readonly}
          />
        </label>

        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Fundo de Reserva (%)
          <input className={field} name="fundo_reserva_percentual" inputMode="decimal" defaultValue={grupo?.fundo_reserva_percentual ?? 0} disabled={readonly} placeholder="Ex.: 2" />
        </label>

        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Taxa do seguro prestamista
          <input
            className={field}
            name="seguro_percentual"
            inputMode="decimal"
            defaultValue={Number(grupo?.seguro_percentual ?? 0) > 0 ? grupo?.seguro_percentual ?? 0.0004 : 0.0004}
            disabled={readonly}
            placeholder="0,0004"
            required
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">
            Taxa decimal. O cliente escolhe o seguro no início da venda; após a contemplação ele é obrigatório.
          </span>
        </label>
      </div>

      <div className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900 dark:bg-blue-950/20">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Modalidades de parcela do grupo</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400">A faixa da comissão é identificada automaticamente. Aqui é informado somente o percentual comercial usado pelo site.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="rounded-lg border bg-white p-3 text-sm font-semibold dark:bg-slate-900">
            <input name="modalidade_integral_habilitada" type="checkbox" checked={integral} onChange={(e) => setIntegral(e.target.checked)} className="mr-2" /> Integral 100%
          </label>
          <label className="rounded-lg border bg-white p-3 text-sm font-semibold dark:bg-slate-900">
            <input name="modalidade_reduzida_habilitada" type="checkbox" checked={reduzida} onChange={(e) => { setReduzida(e.target.checked); if (!e.target.checked) setPersonalizada(false); }} className="mr-2" /> Parcela reduzida
          </label>
          {scope === "ERP" ? <label className="rounded-lg border bg-white p-3 text-sm font-semibold dark:bg-slate-900">
            <input name="modalidade_personalizada_habilitada" type="checkbox" checked={personalizada} disabled={!reduzida} onChange={(e) => setPersonalizada(e.target.checked)} className="mr-2" /> Permitir ajuste personalizado
          </label> : null}
        </div>
        {reduzida ? <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
            <div className="flex items-center justify-between gap-2">
              <span>Opções fixas de parcela reduzida (%)</span>
              <button type="button" onClick={() => setPercentuaisReduzidos((atuais) => [...atuais, ""])} className="rounded-lg border border-blue-300 bg-white px-2 py-1 text-xs font-bold text-blue-700">+ Adicionar</button>
            </div>
            {percentuaisReduzidos.map((percentual, index) => (
              <div key={`${index}-${percentuaisReduzidos.length}`} className="flex gap-2">
                <input className={field} inputMode="decimal" value={percentual} onChange={(event) => setPercentuaisReduzidos((atuais) => atuais.map((item, i) => i === index ? event.target.value : item))} placeholder={index === 0 ? "60" : "70"} required />
                {percentuaisReduzidos.length > 1 ? <button type="button" onClick={() => setPercentuaisReduzidos((atuais) => atuais.filter((_, i) => i !== index))} className="mt-1 text-xs font-bold text-red-600">Remover</button> : null}
              </div>
            ))}
            <span className="block text-xs font-normal text-slate-500">Cadastre 60%, 70% ou outras opções fixas. A primeira será o padrão do site; a comissão continua na faixa automática.</span>
          </div>
          <fieldset className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
            <legend className="font-semibold">Vigência informativa da parcela reduzida</legend>
            {grupo?.id && !grupo.regra_integralizacao_parcela_reduzida ? <label className="block"><input type="radio" name="regra_integralizacao_parcela_reduzida" value="" checked={regraIntegralizacao === ""} onChange={() => setRegraIntegralizacao("")} className="mr-2" />Grupo legado — não alterar nem exibir regra nova</label> : null}
            <label className="block"><input type="radio" name="regra_integralizacao_parcela_reduzida" value="CONTEMPLACAO" checked={regraIntegralizacao === "CONTEMPLACAO"} onChange={() => setRegraIntegralizacao("CONTEMPLACAO")} className="mr-2" />Até a contemplação</label>
            <label className="block"><input type="radio" name="regra_integralizacao_parcela_reduzida" value="ASSEMBLEIA" checked={regraIntegralizacao === "ASSEMBLEIA"} onChange={() => setRegraIntegralizacao("ASSEMBLEIA")} className="mr-2" />Até a assembleia X; integral a partir de X+1</label>
            {regraIntegralizacao === "ASSEMBLEIA" ? <div className="flex items-end gap-2">
              <label className="flex-1 font-semibold">Última assembleia reduzida
                <input className={field} name="assembleia_limite_parcela_reduzida" type="number" min="1" max={Math.max(1, Number(prazoTotal || 1) - 1)} value={assembleiaLimite} onChange={(e) => setAssembleiaLimite(e.target.value)} required />
              </label>
              <button type="button" onClick={() => setAssembleiaLimite(String(calcularAssembleiaMetade(Number(prazoTotal || 0))))} className="mb-0.5 rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-bold text-blue-800">Usar 50% do prazo</button>
            </div> : null}
          </fieldset>
        </div> : null}
      </div>

      {scope === "ERP" ? (
        <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/60 p-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Apresentação nesta franquia</h3>
            <p className="text-xs text-slate-600">Esta configuração é local e não altera as demais empresas.</p>
          </div>
          <label className="block text-sm font-semibold text-slate-700">
            Situação de vagas no site
            <select className={field} name="status_vagas_local" defaultValue={grupo?.status_vagas_local ?? "HERDAR"}>
              <option value="HERDAR">Usar vagas oficiais do SaaS</option>
              <option value="DISPONIVEL">Disponível nesta franquia</option>
              <option value="AGUARDANDO_NOVAS_VAGAS">Aguardando novas vagas</option>
            </select>
          </label>
        </div>
      ) : null}

      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
        Observações do grupo
        <textarea className={field} name="observacoes" rows={3} defaultValue={grupo?.observacoes ?? ""} placeholder="Informações importantes para o consultor e para a proposta." disabled={readonly} />
      </label>

      {!readonly ? <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
        Tabela comercial do grupo
        <input className={`${field} file:mr-3 file:rounded-md file:border-0 file:bg-blue-700 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white`} name="tabela_arquivo" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" />
        <span className="mt-1 block text-xs font-normal text-slate-500">Opcional. PDF, JPG, PNG ou WEBP de até 15 MB. O arquivo ficará disponível no ERP e no SaaS.</span>
      </label> : null}

      {!readonly ? (
        <section className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Créditos do grupo</h3>
            <p className="text-xs text-slate-500">Inclua os valores que serão exibidos como cotas comerciais. As parcelas são calculadas pelo site.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input className={field} value={novoCredito} onChange={(event) => setNovoCredito(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); adicionarCredito(); } }} inputMode="decimal" placeholder="Ex.: 200.000,00" aria-label="Novo valor de crédito" />
            <button type="button" onClick={adicionarCredito} className="rounded-lg border border-blue-500 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50">+ Adicionar crédito</button>
          </div>
          {creditos.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {creditos.map((credito, index) => (
                <span key={`${credito}-${index}`} className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800">
                  {credito}
                  <button type="button" onClick={() => setCreditos((atuais) => atuais.filter((_, i) => i !== index))} className="text-red-600" aria-label={`Remover crédito ${credito}`}>×</button>
                </span>
              ))}
            </div>
          ) : <p className="text-xs text-slate-400">Nenhum novo crédito incluído nesta edição.</p>}
          {scope === "ERP" ? <p className="text-xs text-slate-500">Em grupo local, os créditos ficam disponíveis imediatamente no ERP e seguem junto para homologação global.</p> : null}
        </section>
      ) : null}

      <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="text-sm font-bold text-slate-900 dark:text-white">Modalidades de lance</h3><p className="text-xs text-slate-500">Informação comercial exibida separadamente no site e na proposta; não define a modalidade da parcela.</p></div>
          <button type="button" onClick={() => setLances((current) => [...current, { id: `novo-${Date.now()}`, nome: "", percentual_lance_embutido: "", percentual_recurso_proprio_minimo: "0", base_referencia: "SALDO_DEVEDOR", descricao: "" }])} className="rounded-lg border border-blue-500 px-3 py-1.5 text-xs font-bold text-blue-700">+ Adicionar modalidade</button>
        </div>
        {lances.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-center text-xs text-slate-500">Nenhuma modalidade cadastrada.</p> : <div className="space-y-3">{lances.map((lance, index) => (
          <div key={lance.id} className="grid gap-3 rounded-lg border p-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="text-xs font-semibold">Nome da modalidade<input className={field} value={lance.nome} onChange={(e) => setLances((rows) => rows.map((row, i) => i === index ? { ...row, nome: e.target.value } : row))} placeholder="Ex.: Lance total de 50%" required /></label>
            <label className="text-xs font-semibold">Máximo embutido (%)<input className={field} value={lance.percentual_lance_embutido} onChange={(e) => setLances((rows) => rows.map((row, i) => i === index ? { ...row, percentual_lance_embutido: e.target.value } : row))} inputMode="decimal" placeholder="40" required /></label>
            <label className="text-xs font-semibold">Recurso próprio mínimo (%)<input className={field} value={lance.percentual_recurso_proprio_minimo} onChange={(e) => setLances((rows) => rows.map((row, i) => i === index ? { ...row, percentual_recurso_proprio_minimo: e.target.value } : row))} inputMode="decimal" placeholder="10" required /></label>
            <label className="text-xs font-semibold">Base de referência<select className={field} value={lance.base_referencia} onChange={(e) => setLances((rows) => rows.map((row, i) => i === index ? { ...row, base_referencia: e.target.value as "SALDO_DEVEDOR" | "CREDITO" } : row))}><option value="SALDO_DEVEDOR">Saldo devedor</option><option value="CREDITO">Crédito contratado</option></select></label>
            <label className="text-xs font-semibold">Descrição opcional<input className={field} value={lance.descricao} onChange={(e) => setLances((rows) => rows.map((row, i) => i === index ? { ...row, descricao: e.target.value } : row))} /></label>
            <div className="flex items-center justify-between md:col-span-2 xl:col-span-5"><span className="text-xs text-slate-500">Composição mínima informada: {Number(lance.percentual_lance_embutido || 0) + Number(lance.percentual_recurso_proprio_minimo || 0)}%</span><button type="button" onClick={() => setLances((rows) => rows.filter((_, i) => i !== index))} className="text-xs font-bold text-red-600">Remover</button></div>
          </div>
        ))}</div>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <p className="text-xs text-slate-500">
          Origem do Grupo:{" "}
          <strong className="text-slate-900 dark:text-white">
            {grupo?.origem_governanca === "LOCAL" ? "Empresa Local" : "Catálogo Global SaaS"}
          </strong>
        </p>

        {!readonly && <div className="flex flex-wrap gap-2">
          <button disabled={isPending} type="submit" name="acao_pos_salvar" value="CONTINUAR" className="rounded-xl border border-blue-300 bg-white px-5 py-2.5 text-sm font-bold text-blue-800 hover:bg-blue-50 disabled:cursor-wait disabled:opacity-60">
            {isPending ? "Salvando grupo…" : "Salvar e continuar"}
          </button>
          <button disabled={isPending} type="submit" name="acao_pos_salvar" value="VOLTAR" className="rounded-xl bg-blue-700 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-800 disabled:cursor-wait disabled:opacity-60">
            {isPending ? "Salvando grupo…" : "Salvar e voltar para Grupos"}
          </button>
        </div>}
      </div>

      {(state.status !== "IDLE" || isPending) && (
        <p
          className={`rounded-lg p-3 text-xs font-bold ${
            state.status === "SUCCESS"
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
              : "bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
          }`}
        >
          {isPending ? "Salvando o grupo e seus créditos. Aguarde a confirmação para evitar duplicidade." : state.message}
        </p>
      )}
    </form>
  );
}

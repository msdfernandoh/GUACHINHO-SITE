"use client";
import { useActionState, useMemo, useState } from "react";
import type { GroupActionState } from "@/app/platform/grupos-actions";

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
  taxa_administrativa_percentual?: number | null;
  fundo_reserva_percentual?: number | null;
  seguro_percentual?: number | null;
  permite_lance_embutido?: boolean;
  percentual_lance_embutido?: number | null;
  vagas_disponiveis?: number | null;
  origem_governanca?: string;
  status_governanca?: string;
  modalidades_habilitadas_ids?: string[];
  modalidade_integral_habilitada?: boolean;
  modalidade_reduzida_habilitada?: boolean;
  modalidade_personalizada_habilitada?: boolean;
  status_vagas_local?: string;
  alteracao_catalogo_status?: string;
};

export function GroupCatalogForm({
  action,
  administradoras,
  tipos,
  modalidades,
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
  const [state, formAction] = useActionState(action, initial);
  const [admin, setAdmin] = useState(
    grupo?.administradora_id ?? administradoras[0]?.id ?? ""
  );

  const availableTypes = useMemo(
    () => tipos.filter((x) => x.administradora_id === admin),
    [tipos, admin]
  );
  const availableModes = useMemo(
    () => modalidades.filter((x) => x.administradora_id === admin),
    [modalidades, admin]
  );

  const [selectedModes, setSelectedModes] = useState<Set<string>>(() => {
    if (grupo?.modalidades_habilitadas_ids && grupo.modalidades_habilitadas_ids.length > 0) {
      return new Set(grupo.modalidades_habilitadas_ids);
    }
    // Por padrão todas as modalidades da administradora vêm habilitadas
    return new Set(modalidades.map((m) => m.id));
  });
  const [integral, setIntegral] = useState(grupo?.modalidade_integral_habilitada !== false);
  const [reduzida, setReduzida] = useState(grupo?.modalidade_reduzida_habilitada !== false);
  const [personalizada, setPersonalizada] = useState(
    grupo?.modalidade_personalizada_habilitada !== false,
  );

  function toggleMode(modeId: string) {
    if (readonly) return;
    setSelectedModes((prev) => {
      const next = new Set(prev);
      if (next.has(modeId)) {
        if (next.size > 1) next.delete(modeId); // Mantém pelo menos uma
      } else {
        next.add(modeId);
      }
      return next;
    });
  }

  return (
    <form
      action={formAction}
      className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <input type="hidden" name="id" value={grupo?.id ?? ""} />
      {/* Fallback de compatibilidade modalidade_comissao_id com primeira modalidade ativa */}
      <input
        type="hidden"
        name="modalidade_comissao_id"
        value={grupo?.modalidade_comissao_id || Array.from(selectedModes)[0] || ""}
      />

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
            defaultValue={grupo?.prazo_total ?? ""}
            disabled={readonly}
          />
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
      </div>

      {/* SEÇÃO MODALIDADES DE PAGAMENTO HABILITADAS (N:N) */}
      {scope === "ERP" ? (
        <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/60 p-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Modalidades visíveis nesta franquia</h3>
            <p className="text-xs text-slate-600">A franquia pode restringir as opções oficiais. Isso não altera as outras empresas.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="rounded-lg border bg-white p-3 text-sm font-semibold">
              <input name="modalidade_integral_habilitada" type="checkbox" checked={integral} onChange={(e) => setIntegral(e.target.checked)} className="mr-2" /> Integral
            </label>
            <label className="rounded-lg border bg-white p-3 text-sm font-semibold">
              <input name="modalidade_reduzida_habilitada" type="checkbox" checked={reduzida} onChange={(e) => { setReduzida(e.target.checked); if (!e.target.checked) setPersonalizada(false); }} className="mr-2" /> Reduzida 60%
            </label>
            <label className="rounded-lg border bg-white p-3 text-sm font-semibold">
              <input name="modalidade_personalizada_habilitada" type="checkbox" checked={personalizada} disabled={!reduzida} onChange={(e) => setPersonalizada(e.target.checked)} className="mr-2" /> Personalizada
            </label>
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

      {scope === "PLATFORM" ? <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40 space-y-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Modalidades de Pagamento Permitidas no Grupo
          </h3>
          <p className="text-xs text-slate-500">
            O grupo disponibiliza as modalidades abaixo. A escolha específica do plano de pagamento (Integral ou Reduzida) é feita pelo cliente no momento da contratação/venda.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {availableModes.map((m) => {
            const isChecked = selectedModes.has(m.id);
            return (
              <label
                key={m.id}
                className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                  isChecked
                    ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30"
                    : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
                }`}
              >
                <input
                  type="checkbox"
                  name={`modalidade_habilitada_${m.id}`}
                  checked={isChecked}
                  onChange={() => toggleMode(m.id)}
                  disabled={readonly}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{m.nome}</p>
                  <p className="text-[11px] text-slate-500">
                    {isChecked ? "✓ Habilitada para simulação e venda" : "Desabilitada neste grupo"}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      </div> : null}

      {scope === "ERP" ? (
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
          Novos créditos sugeridos para este grupo
          <textarea className={field} name="creditos" rows={2} placeholder="Ex.: 100.000; 150.000; 200.000" />
          <span className="mt-1 block text-xs font-normal text-slate-500">Os créditos entram como solicitação para homologação global. Nenhum valor de parcela é cadastrado aqui.</span>
        </label>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          <input
            name="permite_lance_embutido"
            type="checkbox"
            defaultChecked={grupo?.permite_lance_embutido !== false}
            disabled={readonly}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          Permite lance embutido
        </label>

        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Limite Lance Embutido (%)
          <input
            className={field}
            name="percentual_lance_embutido"
            inputMode="decimal"
            defaultValue={grupo?.percentual_lance_embutido ?? 25}
            disabled={readonly}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <p className="text-xs text-slate-500">
          Origem do Grupo:{" "}
          <strong className="text-slate-900 dark:text-white">
            {grupo?.origem_governanca === "LOCAL" ? "Empresa Local" : "Catálogo Global SaaS"}
          </strong>
        </p>

        {!readonly && (
          <button
            type="submit"
            className="rounded-xl bg-blue-700 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-800"
          >
            {scope === "ERP" ? "Aplicar localmente e enviar para análise" : "Salvar alterações"}
          </button>
        )}
      </div>

      {state.status !== "IDLE" && (
        <p
          className={`rounded-lg p-3 text-xs font-bold ${
            state.status === "SUCCESS"
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
              : "bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}

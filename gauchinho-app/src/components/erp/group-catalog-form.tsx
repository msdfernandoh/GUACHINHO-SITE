"use client";
import { useActionState, useMemo, useState } from "react";
import type { GroupActionState } from "@/app/platform/grupos-actions";

const initial: GroupActionState = { status: "IDLE", message: "" };
const field =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2";
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
  permite_lance_embutido?: boolean;
  percentual_lance_embutido?: number | null;
  origem_governanca?: string;
  status_governanca?: string;
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
  action: (
    state: GroupActionState,
    data: FormData,
  ) => Promise<GroupActionState>;
  administradoras: Admin[];
  tipos: Item[];
  modalidades: Item[];
  grupo?: Group;
  readonly?: boolean;
  scope: "PLATFORM" | "ERP";
}) {
  const [state, formAction] = useActionState(action, initial);
  const [admin, setAdmin] = useState(
    grupo?.administradora_id ?? administradoras[0]?.id ?? "",
  );
  const availableTypes = useMemo(
    () => tipos.filter((x) => x.administradora_id === admin),
    [tipos, admin],
  );
  const availableModes = useMemo(
    () => modalidades.filter((x) => x.administradora_id === admin),
    [modalidades, admin],
  );
  return (
    <form
      action={formAction}
      className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <input type="hidden" name="id" value={grupo?.id ?? ""} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <label className="text-sm font-medium">
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
          {readonly && (
            <input type="hidden" name="administradora_id" value={admin} />
          )}
        </label>
        <label className="text-sm font-medium">
          Código/Número do Grupo
          <input
            className={field}
            name="codigo_grupo"
            defaultValue={grupo?.codigo_grupo ?? ""}
            disabled={readonly}
            required
          />
        </label>
        <label className="text-sm font-medium">
          Tipo oficial
          <select
            className={field}
            name="tipo_administradora_id"
            defaultValue={grupo?.tipo_administradora_id ?? ""}
            disabled={readonly}
            required
          >
            <option value="">Selecione</option>
            {availableTypes.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Modalidade de comissão
          <select
            className={field}
            name="modalidade_comissao_id"
            defaultValue={grupo?.modalidade_comissao_id ?? ""}
            disabled={readonly}
            required
          >
            <option value="">Selecione</option>
            {availableModes.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Status
          <select
            className={field}
            name="status"
            defaultValue={grupo?.status ?? "Disponível"}
            disabled={readonly}
          >
            <option>Disponível</option>
            <option>Indisponível</option>
            <option>Encerrado</option>
          </select>
        </label>
        <label className="text-sm font-medium">
          Prazo total
          <input
            className={field}
            name="prazo_total"
            type="number"
            min="1"
            defaultValue={grupo?.prazo_total ?? ""}
            disabled={readonly}
          />
        </label>
        <label className="text-sm font-medium">
          Taxa administrativa (%)
          <input
            className={field}
            name="taxa_administrativa_percentual"
            inputMode="decimal"
            defaultValue={grupo?.taxa_administrativa_percentual ?? ""}
            disabled={readonly}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            name="permite_lance_embutido"
            type="checkbox"
            defaultChecked={grupo?.permite_lance_embutido}
            disabled={readonly}
          />{" "}
          Permite lance embutido
        </label>
        <label className="text-sm font-medium">
          Limite lance embutido (%)
          <input
            className={field}
            name="percentual_lance_embutido"
            inputMode="decimal"
            defaultValue={grupo?.percentual_lance_embutido ?? ""}
            disabled={readonly}
          />
        </label>
      </div>
      <div className="rounded-lg bg-slate-50 p-3 text-sm">
        <strong>Mapeamento legado:</strong> o campo histórico “modalidade/tipo
        de bem” é preenchido pelo nome do Tipo oficial apenas para
        compatibilidade. A modalidade de comissão permanece no relacionamento
        próprio.
      </div>
      {grupo?.status_governanca && (
        <p className="text-sm">
          <strong>Governança:</strong>{" "}
          {grupo.status_governanca.replaceAll("_", " ")}
        </p>
      )}
      {state.message && (
        <p
          role="status"
          className={`rounded-lg p-3 text-sm ${state.status === "SUCCESS" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}
        >
          {state.message}
        </p>
      )}
      {readonly ? (
        <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
          Grupo Global: dados oficiais são somente leitura no ERP. Alterações
          estruturais pertencem à Platform.
        </p>
      ) : (
        <button className="rounded-lg bg-blue-700 px-4 py-2 font-bold text-white">
          {grupo?.id
            ? "Salvar alterações"
            : scope === "PLATFORM"
              ? "Criar Grupo Global"
              : "Criar Grupo Local"}
        </button>
      )}
    </form>
  );
}

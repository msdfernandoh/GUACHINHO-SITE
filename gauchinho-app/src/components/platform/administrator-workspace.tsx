"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  criarCurvaEstornoAction,
  salvarDadosAdministradoraAction,
  salvarModalidadeAdministradoraAction,
  salvarTipoAdministradoraAction,
  type PlatformFormState,
} from "@/app/platform/administradoras-actions";

const initial: PlatformFormState = { status: "IDLE", message: "" };
const field =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
type Item = {
  id: string;
  nome: string;
  codigo: string;
  ativo: boolean;
  descricao?: string | null;
};
type Curve = {
  id: string;
  nome: string;
  versao: number;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  status: string;
  faixas: { mes_relativo: number; percentual_estorno: number }[];
};

function Feedback({ state }: { state: PlatformFormState }) {
  if (!state.message) return null;
  return (
    <p
      role="status"
      className={`rounded-lg p-3 text-sm ${state.status === "SUCCESS" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}
    >
      {state.message}
    </p>
  );
}

export function AdministratorWorkspace({
  administradora,
  tipos,
  modalidades,
  curvas,
}: {
  administradora: {
    id: string;
    nome: string;
    nome_fantasia: string | null;
    status: string;
  };
  tipos: Item[];
  modalidades: Item[];
  curvas: Curve[];
}) {
  const [tab, setTab] = useState("dados");
  const [tipoState, tipoAction] = useActionState(
    salvarTipoAdministradoraAction,
    initial,
  );
  const [modalState, modalAction] = useActionState(
    salvarModalidadeAdministradoraAction,
    initial,
  );
  const [curveState, curveAction] = useActionState(
    criarCurvaEstornoAction,
    initial,
  );
  const [adminState, adminAction] = useActionState(
    salvarDadosAdministradoraAction,
    initial,
  );
  const [tipoEdit, setTipoEdit] = useState<Item | null>(null);
  const [tipoNome, setTipoNome] = useState("");
  const [modalEdit, setModalEdit] = useState<Item | null>(null);
  const [modalNome, setModalNome] = useState("");
  const [modalDescricao, setModalDescricao] = useState("");
  const [curveEdit, setCurveEdit] = useState<Curve | null>(null);
  const [curveName, setCurveName] = useState("");
  const [curveStart, setCurveStart] = useState("");
  const [ranges, setRanges] = useState([{ mes: "1", percentual: "" }]);
  const tabs = [
    ["dados", "Dados gerais"],
    ["tipos", "Tipos"],
    ["modalidades", "Modalidades"],
    ["curvas", "Curvas de Estorno"],
    ["programas", "Programas da Franqueadora"],
    ["grupos", "Grupos"],
    ["historico", "Histórico"],
  ];
  const completeness = [
    tipos.some((x) => x.ativo),
    modalidades.some((x) => x.ativo),
    curvas.some((x) => x.status !== "INATIVA"),
  ];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${tab === id ? "bg-cyan-700 text-white" : "border bg-white text-slate-700"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <aside className="rounded-xl border border-cyan-200 bg-cyan-50 p-4">
        <p className="font-bold">
          CONFIGURAÇÃO: {completeness.every(Boolean) ? "Completa" : "Pendente"}
        </p>
        <p className="mt-1 text-sm text-slate-600">
          {completeness[0] ? "✓" : "⚠"} Tipos · {completeness[1] ? "✓" : "⚠"}{" "}
          Modalidades · {completeness[2] ? "✓" : "⚠"} Curva · Programas e grupos
          são validados nas respectivas abas.
        </p>
      </aside>
      {tab === "dados" && (
        <form
          action={adminAction}
          className="grid gap-4 rounded-xl border bg-white p-5 md:grid-cols-3"
        >
          <input
            type="hidden"
            name="administradora_id"
            value={administradora.id}
          />
          <label className="text-sm font-medium">
            Nome
            <input
              className={field}
              name="nome"
              defaultValue={administradora.nome}
              required
            />
          </label>
          <label className="text-sm font-medium">
            Nome fantasia
            <input
              className={field}
              name="nome_fantasia"
              defaultValue={administradora.nome_fantasia ?? ""}
            />
          </label>
          <label className="text-sm font-medium">
            Status
            <select
              className={field}
              name="status"
              defaultValue={administradora.status}
            >
              <option>ATIVA</option>
              <option>INATIVA</option>
            </select>
          </label>
          <Feedback state={adminState} />
          <button className="rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white">
            Salvar dados gerais
          </button>
        </form>
      )}
      {tab === "tipos" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.5fr]">
          <form
            action={tipoAction}
            className="space-y-3 rounded-xl border bg-white p-5"
          >
            <input
              type="hidden"
              name="administradora_id"
              value={administradora.id}
            />
            <input type="hidden" name="id" value={tipoEdit?.id ?? ""} />
            <input
              type="hidden"
              name="ativo"
              value={tipoEdit?.ativo === false ? "false" : "true"}
            />
            <h2 className="font-bold">
              {tipoEdit ? "Editar Tipo" : "Novo Tipo"}
            </h2>
            <p className="text-xs text-slate-500">
              Informe somente o nome. Código técnico e ID são gerados
              internamente.
            </p>
            <input
              className={field}
              name="nome"
              value={tipoNome}
              onChange={(e) => setTipoNome(e.target.value)}
              placeholder="Ex.: Automóveis"
              required
            />
            <Feedback state={tipoState} />
            <div className="flex gap-2">
              <button className="rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white">
                Salvar Tipo
              </button>
              {tipoEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setTipoEdit(null);
                    setTipoNome("");
                  }}
                  className="rounded-lg border px-4 py-2"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
          <div className="overflow-hidden rounded-xl border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="p-3">Nome</th>
                  <th>Status</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {tipos.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="p-3 font-medium">{item.nome}</td>
                    <td>{item.ativo ? "Ativo" : "Inativo"}</td>
                    <td>
                      <button
                        onClick={() => {
                          setTipoEdit(item);
                          setTipoNome(item.nome);
                        }}
                        className="text-cyan-700"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {tab === "modalidades" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.5fr]">
          <form
            action={modalAction}
            className="space-y-3 rounded-xl border bg-white p-5"
          >
            <input
              type="hidden"
              name="administradora_id"
              value={administradora.id}
            />
            <input type="hidden" name="id" value={modalEdit?.id ?? ""} />
            <input
              type="hidden"
              name="ativo"
              value={modalEdit?.ativo === false ? "false" : "true"}
            />
            <h2 className="font-bold">
              {modalEdit ? "Editar Modalidade" : "Nova Modalidade"}
            </h2>
            <input
              className={field}
              name="nome"
              value={modalNome}
              onChange={(e) => setModalNome(e.target.value)}
              placeholder="Ex.: Integral"
              required
            />
            <textarea
              className={field}
              name="descricao"
              value={modalDescricao}
              onChange={(e) => setModalDescricao(e.target.value)}
              placeholder="Descrição opcional"
            />
            <Feedback state={modalState} />
            <div className="flex gap-2">
              <button className="rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white">
                Salvar Modalidade
              </button>
              {modalEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setModalEdit(null);
                    setModalNome("");
                    setModalDescricao("");
                  }}
                  className="rounded-lg border px-4 py-2"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
          <div className="overflow-hidden rounded-xl border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="p-3">Nome</th>
                  <th>Status</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {modalidades.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="p-3 font-medium">{item.nome}</td>
                    <td>{item.ativo ? "Ativa" : "Inativa"}</td>
                    <td>
                      <button
                        onClick={() => {
                          setModalEdit(item);
                          setModalNome(item.nome);
                          setModalDescricao(item.descricao ?? "");
                        }}
                        className="text-cyan-700"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {tab === "curvas" && (
        <div className="space-y-5">
          <form
            action={curveAction}
            className="space-y-4 rounded-xl border bg-white p-5"
          >
            <input
              type="hidden"
              name="administradora_id"
              value={administradora.id}
            />
            <input type="hidden" name="curva_id" value={curveEdit?.id ?? ""} />
            <input
              type="hidden"
              name="nova_versao"
              value={
                curveEdit?.status !== "RASCUNHO" && curveEdit ? "true" : "false"
              }
            />
            <input
              type="hidden"
              name="faixas"
              value={JSON.stringify(
                ranges.map((x) => ({
                  mes: Number(x.mes),
                  percentual: Number(x.percentual.replace(",", ".")),
                })),
              )}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm font-medium">
                Nome
                <input
                  className={field}
                  name="nome"
                  value={curveName}
                  onChange={(e) => setCurveName(e.target.value)}
                  required
                />
              </label>
              <label className="text-sm font-medium">
                Início da vigência
                <input
                  className={field}
                  type="date"
                  name="vigencia_inicio"
                  value={curveStart}
                  onChange={(e) => setCurveStart(e.target.value)}
                  required
                />
              </label>
            </div>
            <div>
              <div className="mb-2 flex justify-between">
                <h3 className="font-semibold">Faixas estruturadas</h3>
                <button
                  type="button"
                  onClick={() =>
                    setRanges((x) => [
                      ...x,
                      { mes: String(x.length + 1), percentual: "" },
                    ])
                  }
                  className="rounded border px-3 py-1 text-sm"
                >
                  Adicionar faixa/mês
                </button>
              </div>
              {ranges.map((range, index) => (
                <div
                  key={index}
                  className="mb-2 grid grid-cols-[1fr_1fr_auto] gap-2"
                >
                  <input
                    aria-label="Mês"
                    className={field}
                    type="number"
                    min="1"
                    value={range.mes}
                    onChange={(e) =>
                      setRanges((x) =>
                        x.map((r, i) =>
                          i === index ? { ...r, mes: e.target.value } : r,
                        ),
                      )
                    }
                  />
                  <input
                    aria-label="Percentual"
                    className={field}
                    inputMode="decimal"
                    value={range.percentual}
                    onChange={(e) =>
                      setRanges((x) =>
                        x.map((r, i) =>
                          i === index
                            ? { ...r, percentual: e.target.value }
                            : r,
                        ),
                      )
                    }
                    placeholder="Percentual %"
                  />
                  <button
                    type="button"
                    disabled={ranges.length === 1}
                    onClick={() =>
                      setRanges((x) => x.filter((_, i) => i !== index))
                    }
                    className="text-red-600 disabled:opacity-30"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
            <Feedback state={curveState} />
            <button className="rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white">
              {curveEdit?.status !== "RASCUNHO" && curveEdit
                ? "Criar nova versão"
                : "Salvar curva"}
            </button>
          </form>
          <div className="grid gap-3 md:grid-cols-2">
            {curvas.map((curve) => (
              <article
                key={curve.id}
                className="rounded-xl border bg-white p-4"
              >
                <p className="font-bold">
                  {curve.nome} · v{curve.versao}
                </p>
                <p className="text-sm text-slate-500">
                  {curve.vigencia_inicio} · {curve.status}
                </p>
                <p className="mt-2 text-sm">
                  {curve.faixas
                    .map((f) => `${f.mes_relativo}º: ${f.percentual_estorno}%`)
                    .join(" · ")}
                </p>
                <button
                  onClick={() => {
                    setCurveEdit(curve);
                    setCurveName(curve.nome);
                    setCurveStart(curve.vigencia_inicio);
                    setRanges(
                      curve.faixas.map((f) => ({
                        mes: String(f.mes_relativo),
                        percentual: String(f.percentual_estorno),
                      })),
                    );
                  }}
                  className="mt-3 text-sm font-semibold text-cyan-700"
                >
                  {curve.status === "RASCUNHO"
                    ? "Editar rascunho"
                    : "Nova versão"}
                </button>
              </article>
            ))}
          </div>
        </div>
      )}
      {tab === "programas" && (
        <div
          id="programas-da-franqueadora"
          className="rounded-xl border bg-white p-5"
        >
          <h2 className="font-bold">Programas da Franqueadora</h2>
          <p className="mt-2 text-sm text-slate-600">
            A gestão de programas e regras oficiais desta Administradora aparece
            abaixo desta área, sempre vinculada à Administradora, Tipo e
            Modalidade.
          </p>
        </div>
      )}
      {tab === "grupos" && (
        <div className="rounded-xl border bg-white p-5">
          <h2 className="font-bold">Grupos da Administradora</h2>
          <p className="mt-2 text-sm text-slate-600">
            Gerencie os grupos globais em Platform → Grupos. Todos devem sair
            com Tipo e Modalidade canônicos.
          </p>
          <Link
            href="/platform/grupos"
            className="mt-3 inline-block font-semibold text-cyan-700"
          >
            Abrir Grupos →
          </Link>
        </div>
      )}
      {tab === "historico" && (
        <div className="rounded-xl border bg-white p-5">
          <h2 className="font-bold">Histórico</h2>
          <p className="mt-2 text-sm text-slate-600">
            Versões de curva e registros inativos permanecem visíveis; snapshots
            de vendas e comissões não são reescritos.
          </p>
        </div>
      )}
    </div>
  );
}

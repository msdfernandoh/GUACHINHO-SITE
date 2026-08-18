"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  criarCurvaEstornoAction,
  configurarCurvaRegraAction,
  configurarModalidadeTiposAction,
  excluirCurvaEstornoAction,
  excluirModalidadeAdministradoraAction,
  excluirProgramaAction,
  excluirTipoAdministradoraAction,
  salvarDadosAdministradoraAction,
  salvarModeloMasterAction,
  salvarModalidadeAdministradoraAction,
  salvarTipoAdministradoraAction,
  statusModeloMasterAction,
  statusProgramaAction,
  novaVersaoProgramaAction,
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
  aplicavel_todos_tipos?: boolean;
  tipos?: { tipo_id: string }[];
};
type Curve = {
  id: string;
  nome: string;
  versao: number;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  status: string;
  descricao?: string | null;
  ativa?: boolean;
  aplicavel_todos_tipos?: boolean;
  aplicavel_todas_modalidades?: boolean;
  faixas: { mes_relativo: number; percentual_estorno: number }[];
  tipos?: { tipo_id: string }[];
  modalidades?: { modalidade_id: string }[];
};
type Model = { id:string;nome:string;descricao:string|null;versao:number;percentual_total_referencia:number;status:string;tipo_id:string;tipo?:{nome?:string}|null;modalidades?:Array<{modalidade_id:string;regra_franquia_origem_id:string|null;modalidade?:{nome?:string}|null}> };
type Program = { id:string; nome:string; versao:number; status:string; ativo:boolean; empresa?: {nome_fantasia?:string}|null; regras?: Array<{id:string;versao:number;percentual_total_comissao:number|null;vigencia_inicio:string;vigencia_fim:string|null;configuracao_homologada:boolean;tipo_administradora_id:string|null;modalidade_comissao_id:string|null;curva_estorno_id:string|null;tipo?:{nome?:string}|null;modalidade?:{nome?:string}|null;curva?:{nome?:string;versao?:number}|null;etapas?:{id:string}[]}> };
type Group = { id:string; codigo_grupo:string; status_governanca:string; origem_governanca:string; ativo:boolean; tipo?:{nome?:string}|null; modalidades?:Array<{ativo:boolean;modalidade?:{nome?:string}|null}>; produtos?:Array<{id:string;ativo:boolean}> };
type Audit = { id:string; acao:string; entidade_tipo:string; campos_alterados:unknown; created_at:string };

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
  modelos,
  programas,
  grupos,
  franquiasCredenciadas,
  historico,
  gruposPendentes,
  initialTab,
}: {
  administradora: {
    id: string;
    nome: string;
    nome_fantasia: string | null;
    status: string;
    descricao_institucional?: string | null;
  };
  tipos: Item[];
  modalidades: Item[];
  curvas: Curve[];
  modelos: Model[];
  programas: Program[];
  grupos: Group[];
  franquiasCredenciadas: number;
  historico: Audit[];
  gruposPendentes: number;
  initialTab?: string;
}) {
  const allowedTabs = new Set(["dados","tipos","modalidades","curvas","modelos","programas","grupos","historico"]);
  const [tab, setTab] = useState(allowedTabs.has(initialTab ?? "") ? initialTab! : "dados");
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
  const [deleteTipoState, deleteTipoAction] = useActionState(excluirTipoAdministradoraAction, initial);
  const [deleteModalState, deleteModalAction] = useActionState(excluirModalidadeAdministradoraAction, initial);
  const [modalTiposState, modalTiposAction] = useActionState(configurarModalidadeTiposAction, initial);
  const [deleteCurveState, deleteCurveAction] = useActionState(excluirCurvaEstornoAction, initial);
  const [modelState, modelAction] = useActionState(salvarModeloMasterAction, initial);
  const [modelStatusState, modelStatusAction] = useActionState(statusModeloMasterAction, initial);
  const [ruleCurveState, ruleCurveAction] = useActionState(configurarCurvaRegraAction, initial);
  const [programStatusState, programStatusAction] = useActionState(statusProgramaAction, initial);
  const [programVersionState, programVersionAction] = useActionState(novaVersaoProgramaAction, initial);
  const [programDeleteState, programDeleteAction] = useActionState(excluirProgramaAction, initial);
  const [tipoEdit, setTipoEdit] = useState<Item | null>(null);
  const [tipoNome, setTipoNome] = useState("");
  const [modalEdit, setModalEdit] = useState<Item | null>(null);
  const [modalNome, setModalNome] = useState("");
  const [modalDescricao, setModalDescricao] = useState("");
  const [curveEdit, setCurveEdit] = useState<Curve | null>(null);
  const [modelEdit, setModelEdit] = useState<Model | null>(null);
  const [curveName, setCurveName] = useState("");
  const [curveStart, setCurveStart] = useState("");
  const [curveEnd, setCurveEnd] = useState("");
  const [curveDescription, setCurveDescription] = useState("");
  const [ranges, setRanges] = useState([{ mes: "1", percentual: "" }]);
  const tabs = [
    ["dados", "Dados gerais"],
    ["tipos", "Tipos"],
    ["modalidades", "Modalidades"],
    ["curvas", "Curvas de Estorno"],
    ["modelos", "Modelos / Tabelas Master"],
    ["programas", "Programas da Franqueadora"],
    ["grupos", "Grupos"],
    ["historico", "Histórico"],
  ];
  const completeness = [
    tipos.some((x) => x.ativo),
    modalidades.some((x) => x.ativo),
    curvas.some((x) => x.status !== "INATIVA"),
    programas.some((x) => x.ativo && x.status !== "RASCUNHO"),
  ];
  const overallReady = completeness.every(Boolean) && gruposPendentes === 0;
  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Tipos",tipos.filter(x=>x.ativo).length],["Modalidades",modalidades.filter(x=>x.ativo).length],["Curvas",curvas.filter(x=>x.status!=="INATIVA").length],["Programas",programas.length],["Grupos",grupos.length],["Produtos",grupos.reduce((n,g)=>n+(g.produtos?.length??0),0)],["Franquias credenciadas",franquiasCredenciadas],["Pendências",gruposPendentes]].map(([label,value])=><article key={label} className="rounded-xl border bg-white p-4"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></article>)}</section>
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
          CONFIGURAÇÃO: {overallReady ? "COMPLETA" : gruposPendentes > 0 ? "COM PENDÊNCIAS" : "PARCIAL"}
        </p>
        <p className="mt-1 text-sm text-slate-600">
          {completeness[0] ? "✓" : "⚠"} Tipos · {completeness[1] ? "✓" : "⚠"}{" "}
          Modalidades · {completeness[2] ? "✓" : "⚠"} Curvas · {completeness[3] ? "✓" : "⚠"} Programas homologados · {gruposPendentes ? `⚠ ${gruposPendentes} grupo(s) pendente(s)` : "✓ Grupos"}.
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
          <label className="text-sm font-medium md:col-span-3">Descrição institucional<textarea className={field} name="descricao_institucional" defaultValue={administradora.descricao_institucional??""}/></label>
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
            <Feedback state={deleteTipoState} />
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
                    <td><div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => {
                          setTipoEdit(item);
                          setTipoNome(item.nome);
                        }}
                        className="text-cyan-700"
                      >
                        Editar
                      </button>
                      <form action={tipoAction}><input type="hidden" name="administradora_id" value={administradora.id}/><input type="hidden" name="id" value={item.id}/><input type="hidden" name="nome" value={item.nome}/><input type="hidden" name="ativo" value={item.ativo?"false":"true"}/><button className="text-slate-600">{item.ativo?"Inativar":"Ativar"}</button></form>
                      <form action={deleteTipoAction} onSubmit={(e)=>{if(!confirm("Excluir Tipo definitivamente?"))e.preventDefault();}}><input type="hidden" name="administradora_id" value={administradora.id}/><input type="hidden" name="id" value={item.id}/><button className="text-red-700">Excluir</button></form>
                    </div></td>
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
            <Feedback state={deleteModalState} />
            <Feedback state={modalTiposState} />
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
                    <td><div className="flex flex-wrap gap-3">
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
                      <form action={modalAction}><input type="hidden" name="administradora_id" value={administradora.id}/><input type="hidden" name="id" value={item.id}/><input type="hidden" name="nome" value={item.nome}/><input type="hidden" name="descricao" value={item.descricao??""}/><input type="hidden" name="ativo" value={item.ativo?"false":"true"}/><button className="text-slate-600">{item.ativo?"Inativar":"Ativar"}</button></form>
                      <form action={deleteModalAction} onSubmit={(e)=>{if(!confirm("Excluir Modalidade definitivamente?"))e.preventDefault();}}><input type="hidden" name="administradora_id" value={administradora.id}/><input type="hidden" name="id" value={item.id}/><button className="text-red-700">Excluir</button></form>
                    </div><form action={modalTiposAction} className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3"><input type="hidden" name="administradora_id" value={administradora.id}/><input type="hidden" name="modalidade_id" value={item.id}/><p className="font-semibold">Aplicável a</p><label className="mr-3"><input type="radio" name="aplicabilidade" value="TODOS" defaultChecked={item.aplicavel_todos_tipos!==false}/> Todos os Tipos</label><label><input type="radio" name="aplicabilidade" value="SELECIONADOS" defaultChecked={item.aplicavel_todos_tipos===false}/> Tipos selecionados</label><div className="flex flex-wrap gap-3">{tipos.filter(t=>t.ativo).map(t=><label key={t.id}><input type="checkbox" name="tipo_id" value={t.id} defaultChecked={item.tipos?.some(x=>x.tipo_id===t.id)}/> {t.nome}</label>)}</div><button className="text-sm font-bold text-cyan-700">Salvar aplicabilidade</button></form></td>
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
            key={curveEdit?.id ?? "nova-curva"}
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
              <label className="text-sm font-medium">Descrição<textarea className={field} name="descricao" value={curveDescription} onChange={(e)=>setCurveDescription(e.target.value)}/></label>
              <label className="text-sm font-medium">Status<select className={field} name="status" defaultValue={curveEdit?.status??"RASCUNHO"}><option>RASCUNHO</option><option>HOMOLOGADA</option><option>INATIVA</option></select></label>
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
              <label className="text-sm font-medium">Fim da vigência<input className={field} type="date" name="vigencia_fim" value={curveEnd} onChange={(e)=>setCurveEnd(e.target.value)}/></label>
            </div>
            <fieldset className="rounded-lg border p-3"><legend className="px-1 font-semibold">Tipos</legend><label className="mr-4"><input type="radio" name="tipos_aplicabilidade" value="TODOS" defaultChecked={curveEdit?.aplicavel_todos_tipos!==false}/> Todos</label><label><input type="radio" name="tipos_aplicabilidade" value="SELECIONADOS" defaultChecked={curveEdit?.aplicavel_todos_tipos===false}/> Selecionados</label><div className="mt-2 flex flex-wrap gap-3">{tipos.filter(x=>x.ativo).map(x=><label key={x.id}><input type="checkbox" name="curva_tipo_id" value={x.id} defaultChecked={curveEdit?.tipos?.some(y=>y.tipo_id===x.id)}/> {x.nome}</label>)}</div></fieldset>
            <fieldset className="rounded-lg border p-3"><legend className="px-1 font-semibold">Modalidades</legend><label className="mr-4"><input type="radio" name="modalidades_aplicabilidade" value="TODAS" defaultChecked={curveEdit?.aplicavel_todas_modalidades!==false}/> Todas</label><label><input type="radio" name="modalidades_aplicabilidade" value="SELECIONADAS" defaultChecked={curveEdit?.aplicavel_todas_modalidades===false}/> Selecionadas</label><div className="mt-2 flex flex-wrap gap-3">{modalidades.filter(x=>x.ativo).map(x=><label key={x.id}><input type="checkbox" name="curva_modalidade_id" value={x.id} defaultChecked={curveEdit?.modalidades?.some(y=>y.modalidade_id===x.id)}/> {x.nome}</label>)}</div></fieldset>
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
            <Feedback state={deleteCurveState} />
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
                    setCurveDescription(curve.descricao??"");
                    setCurveStart(curve.vigencia_inicio);
                    setCurveEnd(curve.vigencia_fim??"");
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
                <form action={deleteCurveAction} onSubmit={(e)=>{if(!confirm("Excluir Curva definitivamente?"))e.preventDefault();}} className="mt-2"><input type="hidden" name="administradora_id" value={administradora.id}/><input type="hidden" name="id" value={curve.id}/><button className="text-sm text-red-700">Excluir se não utilizada</button></form>
              </article>
            ))}
          </div>
        </div>
      )}
      {tab === "modelos" && (
        <div className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
          <form key={modelEdit?.id??"novo-modelo"} action={modelAction} className="space-y-4 rounded-xl border bg-white p-5">
            <input type="hidden" name="administradora_id" value={administradora.id}/><input type="hidden" name="id" value={modelEdit?.id??""}/><input type="hidden" name="nova_versao" value={modelEdit&&modelEdit.status!=="RASCUNHO"?"true":"false"}/>
            <div><h2 className="font-bold">{modelEdit?modelEdit.status==="RASCUNHO"?"Editar Modelo Master":"Nova versão do Modelo Master":"Novo Modelo Master"}</h2><p className="mt-1 text-sm text-slate-500">Camada de referência sobre regras canônicas; não duplica o cálculo.</p></div>
            <label className="block text-sm font-medium">Nome<input className={field} name="nome" defaultValue={modelEdit?.nome??""} required/></label>
            <label className="block text-sm font-medium">Tipo<select className={field} name="tipo_id" defaultValue={modelEdit?.tipo_id??""} required><option value="">Selecione</option>{tipos.filter(x=>x.ativo).map(x=><option key={x.id} value={x.id}>{x.nome}</option>)}</select></label>
            <label className="block text-sm font-medium">Referência total (%)<input className={field} name="percentual" inputMode="decimal" defaultValue={modelEdit?.percentual_total_referencia??""} required/></label>
            <label className="block text-sm font-medium">Descrição<textarea className={field} name="descricao" defaultValue={modelEdit?.descricao??""}/></label>
            <fieldset className="space-y-3 rounded-lg border p-3"><legend className="px-1 font-semibold">Distribuição por Modalidade</legend>{modalidades.filter(x=>x.ativo).map(m=>{const linked=modelEdit?.modalidades?.find(x=>x.modalidade_id===m.id);const rules=programas.flatMap(p=>p.regras??[]).filter(r=>r.modalidade_comissao_id===m.id);return <div key={m.id} className="grid gap-2 rounded bg-slate-50 p-3 md:grid-cols-[auto_1fr]"><label className="font-medium"><input type="checkbox" name="modalidade_id" value={m.id} defaultChecked={Boolean(linked)}/> {m.nome}</label><select className={field} name={`regra_${m.id}`} defaultValue={linked?.regra_franquia_origem_id??""}><option value="">Sem regra canônica vinculada</option>{rules.map(r=><option key={r.id} value={r.id}>{r.tipo?.nome??"Todos"} · {r.percentual_total_comissao}% · v{r.versao}</option>)}</select></div>})}</fieldset>
            <Feedback state={modelState}/><Feedback state={modelStatusState}/><div className="flex gap-2"><button className="rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white">{modelEdit&&modelEdit.status!=="RASCUNHO"?"Criar nova versão":"Salvar Modelo"}</button>{modelEdit&&<button type="button" onClick={()=>setModelEdit(null)} className="rounded-lg border px-4 py-2">Cancelar</button>}</div>
          </form>
          <div className="space-y-3">{modelos.map(model=><article key={model.id} className="rounded-xl border bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-bold">{model.nome} · v{model.versao}</h3><p className="text-sm text-slate-500">{model.tipo?.nome} · referência {model.percentual_total_referencia}%</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{model.status}</span></div><p className="mt-3 text-sm">{model.modalidades?.map(x=>x.modalidade?.nome).filter(Boolean).join(" · ")||"Sem modalidades"}</p><div className="mt-3 flex flex-wrap gap-3"><button onClick={()=>setModelEdit(model)} className="font-semibold text-cyan-700">{model.status==="RASCUNHO"?"Editar":"Nova versão"}</button>{model.status==="RASCUNHO"&&<form action={modelStatusAction}><input type="hidden" name="administradora_id" value={administradora.id}/><input type="hidden" name="id" value={model.id}/><input type="hidden" name="status" value="HOMOLOGADO"/><button className="text-emerald-700">Homologar</button></form>}{model.status==="HOMOLOGADO"&&<form action={modelStatusAction}><input type="hidden" name="administradora_id" value={administradora.id}/><input type="hidden" name="id" value={model.id}/><input type="hidden" name="status" value="INATIVO"/><button className="text-slate-600">Inativar</button></form>}</div></article>)}{!modelos.length&&<p className="rounded-xl border bg-white p-6 text-sm text-slate-500">Nenhum Modelo Master cadastrado.</p>}</div>
        </div>
      )}
      {tab === "programas" && (
        <div id="programas-da-franqueadora" className="rounded-xl border bg-white p-5">
          <h2 className="font-bold">Programas da Franqueadora</h2>
          <p className="mt-2 text-sm text-slate-600">RASCUNHO ainda não participa do motor de novas vendas. Programas homologados/usados exigem nova versão.</p>
          <Feedback state={ruleCurveState}/><Feedback state={programStatusState}/><Feedback state={programVersionState}/><Feedback state={programDeleteState}/>
          <div className="mt-4 overflow-x-auto"><table className="min-w-[1250px] w-full text-sm"><thead><tr className="border-b text-left">{["Nome","Tipo","Modalidade","Comissão","Vigência","Curva opcional","Versão","Status","Ações"].map(x=><th key={x} className="p-3">{x}</th>)}</tr></thead><tbody>{programas.flatMap(p=>(p.regras?.length?p.regras:[null]).map(r=><tr key={`${p.id}-${r?.id??"sem-regra"}`} className="border-b align-top"><td className="p-3 font-semibold">{p.nome}<small className="block font-normal text-slate-500">{p.empresa?.nome_fantasia??"—"}</small></td><td>{r?.tipo?.nome??"—"}</td><td>{r?.modalidade?.nome??"—"}</td><td>{r?.percentual_total_comissao!=null?`${r.percentual_total_comissao}%`:"—"}</td><td>{r?`${r.vigencia_inicio} → ${r.vigencia_fim??"aberta"}`:"—"}</td><td>{r?<form action={ruleCurveAction} className="flex min-w-[220px] gap-2"><input type="hidden" name="administradora_id" value={administradora.id}/><input type="hidden" name="regra_id" value={r.id}/><select className={field} name="curva_id" defaultValue={r.curva_estorno_id??""} disabled={r.configuracao_homologada}><option value="">Nenhuma curva</option>{curvas.filter(c=>c.status==="HOMOLOGADA"&&c.ativa!==false).map(c=><option key={c.id} value={c.id}>{c.nome} · v{c.versao}</option>)}</select>{!r.configuracao_homologada&&<button className="font-bold text-cyan-700">Salvar</button>}</form>:"—"}</td><td>v{r?.versao??p.versao}</td><td><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{r?.configuracao_homologada?"HOMOLOGADO / ATIVO":p.status}</span></td><td><div className="flex min-w-[250px] flex-wrap gap-3"><Link href={`/platform/administradoras/${administradora.id}/programas/${p.id}`} className="font-bold text-cyan-700">Abrir</Link>{p.status==="RASCUNHO"&&<form action={programStatusAction}><input type="hidden" name="administradora_id" value={administradora.id}/><input type="hidden" name="programa_id" value={p.id}/><input type="hidden" name="status" value="ATIVO"/><button className="text-emerald-700">Homologar</button></form>}{p.status==="ATIVO"&&<form action={programStatusAction}><input type="hidden" name="administradora_id" value={administradora.id}/><input type="hidden" name="programa_id" value={p.id}/><input type="hidden" name="status" value="INATIVO"/><button className="text-slate-600">Inativar</button></form>}<form action={programVersionAction}><input type="hidden" name="administradora_id" value={administradora.id}/><input type="hidden" name="programa_id" value={p.id}/><button className="text-cyan-700">Nova versão</button></form>{p.status==="RASCUNHO"&&<form action={programDeleteAction} onSubmit={(e)=>{if(!confirm("Excluir Programa sem uso?"))e.preventDefault();}}><input type="hidden" name="administradora_id" value={administradora.id}/><input type="hidden" name="programa_id" value={p.id}/><button className="text-red-700">Excluir</button></form>}</div></td></tr>))}{!programas.length&&<tr><td colSpan={9} className="p-6 text-center text-slate-500">Nenhum Programa vinculado.</td></tr>}</tbody></table></div>
        </div>
      )}
      {tab === "grupos" && (
        <div className="rounded-xl border bg-white p-5">
          <h2 className="font-bold">Grupos da Administradora</h2>
          <div className="mt-4 overflow-x-auto"><table className="min-w-[850px] w-full text-sm"><thead><tr className="border-b text-left">{["Grupo","Tipo","Modalidades disponíveis","Produtos","Status","Configuração","Origem","Ação"].map(x=><th key={x} className="p-3">{x}</th>)}</tr></thead><tbody>{grupos.map(g=>{const mods=g.modalidades?.filter(x=>x.ativo).map(x=>x.modalidade?.nome).filter(Boolean)??[];const ready=Boolean(g.tipo?.nome&&mods.length&&(g.produtos?.some(x=>x.ativo)));return <tr key={g.id} className="border-b"><td className="p-3 font-bold">{g.codigo_grupo}</td><td>{g.tipo?.nome??"Sem Tipo"}</td><td>{mods.join(", ")||"Sem Modalidade"}</td><td>{g.produtos?.length??0}</td><td>{g.ativo?"ATIVO":"INATIVO"}</td><td><span className={ready?"text-emerald-700":"text-amber-700"}>{ready?"PRONTO":"CONFIGURAÇÃO PENDENTE"}</span></td><td>{g.origem_governanca}</td><td><Link href={`/platform/grupos/${g.id}`} className="font-bold text-cyan-700">Ver Grupo</Link></td></tr>})}</tbody></table></div>
        </div>
      )}
      {tab === "historico" && (
        <div className="rounded-xl border bg-white p-5">
          <h2 className="font-bold">Histórico</h2>
          <div className="mt-4 space-y-3">{historico.map(h=><article key={h.id} className="border-l-2 border-cyan-300 pl-3"><p className="font-semibold">{h.acao.replaceAll("_"," ")} · {h.entidade_tipo}</p><p className="text-xs text-slate-500">{new Date(h.created_at).toLocaleString("pt-BR")}</p></article>)}{!historico.length&&<p className="text-sm text-slate-500">Nenhum evento Platform registrado.</p>}</div>
        </div>
      )}
    </div>
  );
}

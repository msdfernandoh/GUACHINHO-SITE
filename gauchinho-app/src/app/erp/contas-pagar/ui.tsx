"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  CheckCircle2,
  FileUp,
  Landmark,
  Plus,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button, Input, Select, Textarea } from "@/components/ui/form-primitives";
import {
  atualizarSocioPagadorContas,
  baixarConta,
  criarBanco,
  criarCentro,
  criarConta,
  importarContasCsv,
  type ContasActionResult,
} from "./actions";

type Conta = {
  id: string;
  descricao: string;
  fornecedor: string | null;
  valor: number;
  vencimento: string;
  competencia: string;
  status: "aberta" | "paga" | "cancelada";
  pago_em: string | null;
  pago_pessoalmente: boolean;
  socio_pagador_usuario_id: string | null;
  responsavel_importado?: string | null;
  necessita_revisao?: boolean;
};
type Banco = { id: string; nome: string };
type Centro = { id: string; nome: string };
type Usuario = { id: string; nome: string; email: string; socioPagador?: boolean };
type Movimento = { tipo_movimento: "entrada" | "saida"; valor: number };
type Tab = "conta" | "banco" | "centro" | "importar";
type Filtro = "todas" | "abertas" | "pagas";

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");

export function ContasPagarClient({
  contas,
  bancos,
  centros,
  socios,
  usuarios,
  caixa,
}: {
  contas: Conta[];
  bancos: Banco[];
  centros: Centro[];
  socios: Usuario[];
  usuarios: Usuario[];
  caixa: Movimento[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("conta");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [pessoal, setPessoal] = useState(false);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [socioLote, setSocioLote] = useState("");
  const [feedback, setFeedback] = useState<ContasActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const usuariosById = useMemo(() => new Map(usuarios.map((usuario) => [usuario.id, usuario])), [usuarios]);
  const resumo = useMemo(() => {
    const abertas = contas.filter((conta) => conta.status === "aberta");
    const mes = new Date().toISOString().slice(0, 7);
    const pagas = contas.filter((conta) => conta.status === "paga" && conta.competencia === mes);
    const pessoalMes = pagas.filter((conta) => conta.pago_pessoalmente);
    const porSocio = new Map<string, number>(socios.map((socio) => [socio.id, 0]));
    pessoalMes.forEach((conta) => {
      const socioId = conta.socio_pagador_usuario_id;
      if (socioId) porSocio.set(socioId, (porSocio.get(socioId) ?? 0) + Number(conta.valor));
    });
    const total = [...porSocio.values()].reduce((acc, value) => acc + value, 0);
    return {
      abertas: abertas.reduce((acc, conta) => acc + Number(conta.valor), 0),
      pagas: pagas.reduce((acc, conta) => acc + Number(conta.valor), 0),
      pessoal: total,
      ajustes: [...porSocio.entries()].map(([id, value]) => ({
        nome: usuariosById.get(id)?.nome ?? "Sócio",
        saldo: value - total / Math.max(socios.length, 1),
      })),
    };
  }, [contas, socios, usuariosById]);
  const saldo = caixa.reduce(
    (acc, movimento) => acc + (movimento.tipo_movimento === "entrada" ? Number(movimento.valor) : -Number(movimento.valor)),
    0,
  );
  const contasFiltradas = contas.filter((conta) => {
    if (filtro === "abertas") return conta.status === "aberta";
    if (filtro === "pagas") return conta.status === "paga";
    return conta.status !== "cancelada";
  });
  const cards: Array<{ label: string; value: number; color: string; Icon: LucideIcon }> = [
    { label: "A pagar", value: resumo.abertas, color: "bg-rose-600", Icon: ReceiptText },
    { label: "Pagas no mês", value: resumo.pagas, color: "bg-emerald-600", Icon: CheckCircle2 },
    { label: "Pago pessoalmente", value: resumo.pessoal, color: "bg-amber-500", Icon: WalletCards },
    { label: "Saldo de caixa", value: saldo, color: "bg-blue-700", Icon: Banknote },
  ];

  function execute(action: () => Promise<ContasActionResult>, onSuccess?: () => void) {
    startTransition(async () => {
      const result = await action();
      setFeedback(result);
      if (result.ok) {
        onSuccess?.();
        router.refresh();
      }
    });
  }

  function submitForm(
    event: React.FormEvent<HTMLFormElement>,
    action: (form: FormData) => Promise<ContasActionResult>,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    execute(() => action(data), () => {
      form.reset();
      if (action === criarConta) setPessoal(false);
    });
  }

  function toggleConta(id: string) {
    setSelecionadas((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const tabs: Array<[Tab, string, typeof Plus]> = [
    ["conta", "Nova despesa", Plus],
    ["importar", "Importar CSV", FileUp],
    ["banco", "Cadastrar banco", Landmark],
    ["centro", "Centro de custo", ReceiptText],
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <header>
        <p className="text-xs font-bold uppercase tracking-[.2em] text-blue-700">Financeiro operacional</p>
        <h1 className="mt-1 text-3xl font-extrabold text-slate-950">Contas a pagar e caixa</h1>
        <p className="mt-2 text-slate-500">Lance despesas, marque quem pagou e veja o ajuste entre os sócios.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, color, Icon }) => (
          <div key={label} className={`${color} rounded-2xl p-5 text-white shadow-lg`}>
            <Icon className="h-7 w-7 opacity-80" />
            <p className="mt-5 text-sm font-semibold opacity-90">{label}</p>
            <p className="mt-1 text-3xl font-black">{brl(value)}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-5 py-3 font-bold ${
              tab === id ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </button>
        ))}
      </div>

      {feedback ? (
        <div className={`rounded-xl border px-4 py-3 text-sm ${feedback.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
          <p className="font-semibold">{feedback.message}</p>
          {feedback.importacao?.erros.length ? (
            <ul className="mt-2 list-disc pl-5 text-xs">
              {feedback.importacao.erros.map((error) => <li key={error}>{error}</li>)}
            </ul>
          ) : null}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {tab === "conta" ? (
          <form onSubmit={(event) => submitForm(event, criarConta)} className="grid gap-3 md:grid-cols-3">
            <Input name="descricao" required placeholder="O que precisa ser pago? *" />
            <Input name="fornecedor" placeholder="Fornecedor" />
            <Input name="valor" required type="number" step="0.01" min="0.01" placeholder="Valor (R$) *" />
            <Input name="vencimento" required type="date" />
            <Select name="centro"><option value="">Centro de custo</option>{centros.map((centro) => <option key={centro.id} value={centro.id}>{centro.nome}</option>)}</Select>
            <Select name="banco"><option value="">Conta bancária</option>{bancos.map((banco) => <option key={banco.id} value={banco.id}>{banco.nome}</option>)}</Select>
            <label className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900 md:col-span-2">
              <input name="pessoal" type="checkbox" checked={pessoal} onChange={(event) => setPessoal(event.target.checked)} />
              Paguei pessoalmente como sócio
            </label>
            {pessoal ? <Select name="socio" required><option value="">Quem pagou?</option>{socios.map((socio) => <option key={socio.id} value={socio.id}>{socio.nome}</option>)}</Select> : null}
            <Textarea name="obs" className="md:col-span-2" placeholder="Observação (opcional)" />
            <Button disabled={pending} className="min-h-12 bg-blue-700 text-base hover:bg-blue-800">{pending ? "Salvando…" : "Adicionar conta"}</Button>
          </form>
        ) : tab === "banco" ? (
          <form onSubmit={(event) => submitForm(event, criarBanco)} className="grid gap-3 md:grid-cols-4">
            <Input name="nome" required placeholder="Nome para exibir *" />
            <Input name="banco" placeholder="Banco" />
            <Input name="agencia" placeholder="Agência" />
            <Input name="conta" placeholder="Conta (ex.: **** 1234)" />
            <Button disabled={pending} className="min-h-12 md:col-span-4">{pending ? "Salvando…" : "Salvar banco"}</Button>
          </form>
        ) : tab === "centro" ? (
          <form onSubmit={(event) => submitForm(event, criarCentro)} className="grid gap-3 md:grid-cols-3">
            <Input name="nome" required placeholder="Nome do centro *" />
            <Input name="codigo" placeholder="Código" />
            <Button disabled={pending} className="min-h-12">{pending ? "Salvando…" : "Salvar centro"}</Button>
          </form>
        ) : (
          <form onSubmit={(event) => submitForm(event, importarContasCsv)} className="space-y-4">
            <div>
              <h2 className="font-bold text-slate-900">Importar contas a pagar e pagas</h2>
              <p className="mt-1 text-sm text-slate-500">CSV separado por ponto e vírgula. Reimportações não duplicam contas com o mesmo ID.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Input name="arquivo" type="file" accept=".csv,text/csv" required className="max-w-xl" />
              <a href="/modelos/modelo_importacao_contas.csv" download className="text-sm font-semibold text-blue-700 underline">Baixar modelo CSV</a>
            </div>
            <Button disabled={pending} className="min-h-11 bg-blue-700 hover:bg-blue-800">{pending ? "Importando…" : "Importar arquivo"}</Button>
          </form>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.8fr_1fr]">
        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="space-y-3 border-b p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-bold text-slate-900">Despesas</h2>
              <div className="flex gap-2">
                {(["todas", "abertas", "pagas"] as Filtro[]).map((item) => (
                  <button key={item} type="button" onClick={() => setFiltro(item)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${filtro === item ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>
                    {item === "todas" ? "Todas" : item === "abertas" ? "A pagar" : "Pagas"}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3">
              <span className="text-xs font-bold text-slate-600">{selecionadas.size} selecionada(s)</span>
              <Select value={socioLote} onChange={(event) => setSocioLote(event.target.value)} className="max-w-xs">
                <option value="">Remover pagamento pessoal</option>
                {socios.map((socio) => <option key={socio.id} value={socio.id}>Pago pessoalmente por {socio.nome}</option>)}
              </Select>
              <Button
                type="button"
                size="sm"
                disabled={pending || selecionadas.size === 0}
                onClick={() => execute(
                  () => atualizarSocioPagadorContas([...selecionadas], socioLote || null),
                  () => setSelecionadas(new Set()),
                )}
              >
                Aplicar às selecionadas
              </Button>
            </div>
          </div>
          <div className="divide-y">
            {contasFiltradas.length === 0 ? (
              <p className="p-8 text-center text-slate-500">Nenhuma despesa neste filtro.</p>
            ) : contasFiltradas.map((conta) => (
              <div key={conta.id} className="grid gap-3 p-4 md:grid-cols-[auto_1fr_auto] md:items-center">
                <input type="checkbox" checked={selecionadas.has(conta.id)} onChange={() => toggleConta(conta.id)} aria-label={`Selecionar ${conta.descricao}`} />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-slate-900">{conta.descricao}</p>
                    {conta.necessita_revisao ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Revisar</span> : null}
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${conta.status === "paga" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{conta.status === "paga" ? "Paga" : "A pagar"}</span>
                  </div>
                  <p className="text-sm text-slate-500">Vence em {dataBr(conta.vencimento)}{conta.fornecedor ? ` · ${conta.fornecedor}` : ""}</p>
                  {conta.responsavel_importado ? <p className="text-xs text-slate-400">Responsável no CSV: {conta.responsavel_importado}</p> : null}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <b className="min-w-28 text-right text-slate-900">{brl(Number(conta.valor))}</b>
                  <Select
                    aria-label={`Sócio pagador de ${conta.descricao}`}
                    value={conta.socio_pagador_usuario_id ?? ""}
                    disabled={pending}
                    onChange={(event) => execute(() => atualizarSocioPagadorContas([conta.id], event.target.value || null))}
                    className="min-w-52"
                  >
                    <option value="">Não pago pessoalmente</option>
                    {socios.map((socio) => <option key={socio.id} value={socio.id}>{socio.nome}</option>)}
                  </Select>
                  {conta.status === "aberta" ? (
                    <Button type="button" size="sm" disabled={pending} onClick={() => execute(() => baixarConta(conta.id))} className="bg-emerald-600 hover:bg-emerald-700">Dar baixa</Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-slate-950 p-5 text-white shadow-lg">
          <h2 className="font-bold">Fechamento entre sócios</h2>
          <p className="mt-1 text-sm text-slate-400">Somente contas pagas pessoalmente no mês atual.</p>
          <div className="mt-5 space-y-3">
            {resumo.ajustes.length === 0 ? (
              <p className="rounded-xl bg-white/10 p-4 text-sm text-slate-300">Marque uma conta como paga pessoalmente para ver a compensação.</p>
            ) : resumo.ajustes.map((ajuste) => (
              <div key={ajuste.nome} className="rounded-xl bg-white/10 p-4">
                <p className="font-semibold">{ajuste.nome}</p>
                <p className="mt-1 text-sm text-slate-300">
                  {ajuste.saldo > 0 ? `Deve receber ${brl(ajuste.saldo)} dos demais / empresa.` : ajuste.saldo < 0 ? `Deve repassar ${brl(-ajuste.saldo)} para equalizar.` : "Está equilibrado."}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

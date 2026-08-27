"use client";

import { useMemo, useState, useTransition } from "react";
import { readSheet } from "read-excel-file/browser";
import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { confirmarImportacaoLegadoAction, preverImportacaoLegadoAction } from "@/app/erp/clientes/importar/actions";
import { parseClientesLegado, type CelulaPlanilha, type ClienteLegadoLinha, type DiagnosticoClienteLegado } from "@/lib/erp/clientes-legado";

type Regra = { id: string; nome: string; detalhe: string };
type Participante = { id: string; nome: string };
type Historico = { id: string; arquivo_nome: string; status: string; total_importadas: number; total_pendencias: number; total_previsoes_futuras: number; created_at: string };

export function ClientesLegadoImportador({ regras, defaultRegraId, participantes, historico }: { regras: Regra[]; defaultRegraId: string; participantes: Participante[]; historico: Historico[] }) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [arquivoHash, setArquivoHash] = useState("");
  const [linhas, setLinhas] = useState<ClienteLegadoLinha[]>([]);
  const [diagnosticos, setDiagnosticos] = useState<DiagnosticoClienteLegado[]>([]);
  const [regraId, setRegraId] = useState(defaultRegraId);
  const [participanteId, setParticipanteId] = useState("");
  const [semComissao, setSemComissao] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [isPending, startTransition] = useTransition();
  const dataReferencia = new Date().toISOString().slice(0, 10);
  const resumo = useMemo(() => ({
    total: diagnosticos.length,
    aptas: diagnosticos.filter((item) => item.erros.length === 0).length,
    pendencias: diagnosticos.filter((item) => item.pendencias.length > 0 && item.erros.length === 0).length,
    bloqueadas: diagnosticos.filter((item) => item.erros.length > 0).length,
    previsoes: diagnosticos.reduce((total, item) => total + item.previsoes_futuras, 0),
  }), [diagnosticos]);

  async function selecionarArquivo(file: File | null) {
    setArquivo(file); setLinhas([]); setDiagnosticos([]); setMensagem(""); setErro(""); setArquivoHash("");
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) { setErro("Use um arquivo .xlsx. Salve arquivos .xls como Pasta de Trabalho do Excel (.xlsx)."); return; }
    try {
      const buffer = await file.arrayBuffer();
      const [rows, digest] = await Promise.all([readSheet(buffer), crypto.subtle.digest("SHA-256", buffer)]);
      const parsed = parseClientesLegado(rows as unknown as CelulaPlanilha[][]);
      if (parsed.erros.length) { setErro(parsed.erros.join(" ")); return; }
      setLinhas(parsed.linhas);
      setArquivoHash(Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join(""));
      setMensagem(`${parsed.linhas.length} linhas lidas. Configure o lote e execute a prévia.`);
    } catch (cause) { setErro(cause instanceof Error ? cause.message : "Não foi possível ler a planilha."); }
  }

  function executarPrevia() {
    setErro(""); setMensagem("");
    startTransition(async () => {
      try {
        const result = await preverImportacaoLegadoAction({ linhas, regraId: regraId || null, semComissao, dataReferencia });
        setDiagnosticos(result.diagnosticos);
        setMensagem(`Prévia concluída: ${result.resumo.aptas} aptas e ${result.resumo.bloqueadas} bloqueadas.`);
      } catch (cause) { setErro(cause instanceof Error ? cause.message : "Falha ao validar a importação."); }
    });
  }

  function confirmar() {
    if (!arquivo) return;
    setErro(""); setMensagem("");
    const idempotencyKey = `${arquivoHash}:${semComissao ? "SEM" : regraId}:${semComissao ? "SEM" : participanteId}`;
    startTransition(async () => {
      try {
        const result = await confirmarImportacaoLegadoAction({ linhas, regraId: regraId || null, participanteId: participanteId || null, semComissao, dataReferencia, arquivoNome: arquivo.name, arquivoHash, idempotencyKey });
        setMensagem(`Importação concluída: ${result.total_importadas} cotas, ${result.total_pendencias} cadastros pendentes e ${result.total_previsoes_futuras} comissões futuras.`);
      } catch (cause) { setErro(cause instanceof Error ? cause.message : "Falha ao importar o lote."); }
    });
  }

  return <div className="space-y-6">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="grid gap-5 lg:grid-cols-2">
      <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/50 p-6 text-center transition hover:border-blue-400"><Upload className="text-blue-600" size={28}/><span className="mt-3 font-bold text-slate-900">Selecionar planilha .xlsx</span><span className="mt-1 text-xs text-slate-500">Cliente, CPF/CNPJ, Contato, Administradora, Bem, Data contrato, Grupo, Cota e Valor</span><span className="mt-2 text-[11px] text-amber-700">Grupo ausente recebe cadastro básico inativo para a carteira histórica e não é publicado para venda.</span><input type="file" accept=".xlsx" className="sr-only" onChange={(event) => void selecionarArquivo(event.target.files?.[0] ?? null)}/>{arquivo && <span className="mt-3 rounded-full bg-white px-3 py-1 text-xs font-bold text-blue-700">{arquivo.name}</span>}</label>
      <div className="space-y-4"><label className="block text-sm font-semibold text-slate-700">Regra histórica de comissão<select value={regraId} disabled={semComissao} onChange={(event) => { setRegraId(event.target.value); setDiagnosticos([]); }} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 disabled:bg-slate-100"><option value="">Selecione a regra usada na época</option>{regras.map((regra) => <option key={regra.id} value={regra.id}>{regra.nome} — {regra.detalhe}</option>)}</select><span className="mt-1 block text-xs font-normal text-slate-500">A modalidade reduzida 60% é selecionada como padrão quando cadastrada; você pode trocar a regra antes da prévia.</span></label>
        <label className="block text-sm font-semibold text-slate-700">Sócio/beneficiário direto<select value={participanteId} disabled={semComissao} onChange={(event) => setParticipanteId(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 disabled:bg-slate-100"><option value="">Selecione quem receberá</option>{participantes.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
        <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><input type="checkbox" checked={semComissao} onChange={(event) => { setSemComissao(event.target.checked); setDiagnosticos([]); }} className="mt-1"/><span><strong>Importar sem comissão</strong><br/><span className="text-xs">Para contemplados ou contratos cujo cronograma já encerrou.</span></span></label></div>
    </div><div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={executarPrevia} disabled={isPending || !linhas.length || (!semComissao && !regraId)} className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-bold text-white disabled:opacity-40">{isPending ? <Loader2 className="animate-spin" size={17}/> : <FileSpreadsheet size={17}/>}Validar prévia</button><button type="button" onClick={confirmar} disabled={isPending || !diagnosticos.length || resumo.bloqueadas > 0 || (!semComissao && (!regraId || !participanteId))} className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white disabled:opacity-40"><CheckCircle2 size={17}/>Confirmar importação</button></div>{erro && <div className="mt-4 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertCircle className="shrink-0" size={18}/>{erro}</div>}{mensagem && <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-medium text-blue-800">{mensagem}</div>}</section>
    {diagnosticos.length > 0 && <section className="space-y-4"><div className="grid gap-3 sm:grid-cols-5">{[["Linhas",resumo.total],["Aptas",resumo.aptas],["Pendentes",resumo.pendencias],["Bloqueadas",resumo.bloqueadas],["Comissões futuras",resumo.previsoes]].map(([label,value]) => <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-slate-900">{value}</p></div>)}</div><div className="max-h-[520px] overflow-auto rounded-2xl border border-slate-200 bg-white"><table className="min-w-[1000px] w-full text-left text-xs"><thead className="sticky top-0 bg-slate-100 text-slate-600"><tr><th className="p-3">Linha</th><th className="p-3">Cliente</th><th className="p-3">Grupo/cota</th><th className="p-3">Contrato</th><th className="p-3">Valor</th><th className="p-3">Pendências</th><th className="p-3">Futuras</th><th className="p-3">Situação</th></tr></thead><tbody>{diagnosticos.map((item) => <tr key={item.linha} className="border-t border-slate-100"><td className="p-3">{item.linha}</td><td className="p-3 font-semibold">{item.cliente_nome}</td><td className="p-3">{item.grupo}/{item.cota}</td><td className="p-3">{item.data_contrato}</td><td className="p-3">{item.valor_credito.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</td><td className="p-3">{item.pendencias.length ? item.pendencias.map((p) => p.replace("PENDENTE_","")).join(", ") : "—"}</td><td className="p-3 font-bold">{item.previsoes_futuras}</td><td className="p-3">{item.erros.length ? <span className="text-red-700">{item.erros.join("; ")}</span> : <span className="font-bold text-emerald-700">Apta</span>}</td></tr>)}</tbody></table></div></section>}
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><h2 className="font-bold text-slate-900">Histórico de lotes</h2><p className="text-sm text-slate-500">Auditoria e idempotência das importações confirmadas.</p></div>{historico.length ? <div className="divide-y divide-slate-100">{historico.map((item) => <div key={item.id} className="grid gap-2 p-4 text-sm sm:grid-cols-[1fr_repeat(4,auto)] sm:items-center"><div><p className="font-bold text-slate-900">{item.arquivo_nome}</p><p className="text-xs text-slate-500">{new Date(item.created_at).toLocaleString("pt-BR")}</p></div><span>{item.total_importadas} cotas</span><span>{item.total_pendencias} pendentes</span><span>{item.total_previsoes_futuras} futuras</span><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">{item.status}</span></div>)}</div> : <p className="p-6 text-sm text-slate-500">Nenhuma importação confirmada.</p>}</section>
  </div>;
}

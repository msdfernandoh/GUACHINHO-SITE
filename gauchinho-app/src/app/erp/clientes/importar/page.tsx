import Link from "next/link";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
import { ClientesLegadoImportador } from "@/components/erp/clientes-legado-importador";

type RegraImportacaoRow = {
  id: string;
  programa_id: string;
  percentual_total_comissao: number;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  tipo: { nome: string } | Array<{ nome: string }> | null;
  modalidade: { nome: string } | Array<{ nome: string }> | null;
};

type ProgramaImportacaoRow = {
  id: string;
  nome: string;
  versao: number;
  status: string;
  uso_exclusivo_importacao_legado: boolean;
};

export default async function ImportarClientesLegadoPage() {
  const { empresaAtiva } = await requireErpRouteAccess("clientes");
  if (!empresaAtiva) return null;
  const db = await createClient();
  const { data: admins } = await db.from("administradoras").select("id,nome,nome_fantasia").eq("status","ATIVA");
  const racon = (admins ?? []).find((item) => `${item.nome ?? ""} ${item.nome_fantasia ?? ""}`.toUpperCase().includes("RACON"));
  const { data: programas } = racon ? await db.from("comissao_programas").select("id,nome,versao,status,uso_exclusivo_importacao_legado").eq("empresa_id",empresaAtiva.id).eq("administradora_id",racon.id).eq("uso_exclusivo_importacao_legado",true).order("versao",{ascending:false}) : { data: [] };
  const programaIds = (programas ?? []).map((item) => item.id);
  const [{ data: regras }, { data: participantes }, { data: historico }] = await Promise.all([
    programaIds.length ? db.from("comissao_regras_franquia").select("id,programa_id,versao,percentual_total_comissao,vigencia_inicio,vigencia_fim,tipo:administradora_tipos(nome),modalidade:administradora_modalidades_comissao(nome)").eq("empresa_id",empresaAtiva.id).in("programa_id",programaIds).order("vigencia_inicio",{ascending:false}) : Promise.resolve({data:[]}),
    db.from("participantes_comerciais").select("id,nome,nome_exibicao").eq("empresa_id",empresaAtiva.id).eq("status","ATIVO").order("nome"),
    db.from("importacao_clientes_legado_lotes").select("id,arquivo_nome,status,total_importadas,total_pendencias,total_previsoes_futuras,created_at").eq("empresa_id",empresaAtiva.id).order("created_at",{ascending:false}).limit(20),
  ]);
  const programaMap = new Map(((programas ?? []) as ProgramaImportacaoRow[]).map((item) => [item.id,item]));
  const regrasUi = ((regras ?? []) as unknown as RegraImportacaoRow[]).map((regra) => {
    const programa = programaMap.get(regra.programa_id);
    const tipo = Array.isArray(regra.tipo) ? regra.tipo[0] : regra.tipo;
    const modalidade = Array.isArray(regra.modalidade) ? regra.modalidade[0] : regra.modalidade;
    return { id: regra.id, nome: `${programa?.uso_exclusivo_importacao_legado ? "[SOMENTE IMPORTAÇÃO] " : ""}${programa?.nome ?? "Programa"} · ${tipo?.nome ?? "Tipo"} · ${modalidade?.nome ?? "Modalidade"}`, detalhe: `${regra.percentual_total_comissao}% | ${regra.vigencia_inicio}${regra.vigencia_fim ? ` a ${regra.vigencia_fim}` : " em diante"}`, reduzida60: /60/.test(modalidade?.nome ?? ""), exclusivaImportacao: Boolean(programa?.uso_exclusivo_importacao_legado) };
  }).sort((a,b) => Number(b.exclusivaImportacao) - Number(a.exclusivaImportacao));
  return <main className="space-y-6 pb-12"><header className="rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-900 p-7 text-white shadow-xl"><Link href="/erp/clientes" className="inline-flex items-center gap-2 text-xs font-bold text-cyan-200 hover:text-white"><ArrowLeft size={15}/>Voltar aos clientes</Link><div className="mt-5 flex items-center gap-4"><span className="rounded-2xl bg-white/10 p-3"><FileSpreadsheet size={26}/></span><div><p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">Carteira histórica Racon</p><h1 className="mt-1 text-3xl font-black">Importar clientes e cotas legadas</h1><p className="mt-2 max-w-3xl text-sm text-slate-300">Valide todo o lote antes de confirmar. CPF e telefone ausentes geram pendência; grupo/cota inválidos ou duplicados bloqueiam a operação.</p></div></div></header><ClientesLegadoImportador regras={regrasUi} defaultRegraId={regrasUi.find((item) => item.exclusivaImportacao && item.reduzida60)?.id ?? regrasUi.find((item) => item.exclusivaImportacao)?.id ?? regrasUi.find((item) => item.reduzida60)?.id ?? regrasUi[0]?.id ?? ""} participantes={(participantes ?? []).map((item) => ({id:item.id,nome:item.nome_exibicao || item.nome}))} historico={historico ?? []}/></main>;
}

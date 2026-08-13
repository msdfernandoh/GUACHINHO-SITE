import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { ContasPagarClient } from "./ui";

export default async function ContasPagarPage() {
  const { empresaAtiva }=await getCurrentTenantContext(); if(!empresaAtiva) return null;
  const db=createAdminClient(); const e=empresaAtiva.id;
  const [contas,bancos,centros,vinculos,caixa]=await Promise.all([
    db.from("financeiro_contas_pagar").select("*").eq("empresa_id",e).order("vencimento").limit(100),
    db.from("financeiro_contas_bancarias").select("*").eq("empresa_id",e).eq("ativo",true),
    db.from("financeiro_centros_custo").select("*").eq("empresa_id",e).eq("ativo",true),
    db.from("empresa_usuarios").select("usuario:usuarios(id,nome,email)").eq("empresa_id",e).eq("ativo",true),
    db.from("caixa_movimentos").select("tipo_movimento,valor").eq("empresa_id",e),
  ]);
  return <ContasPagarClient contas={(contas.data??[]) as never[]} bancos={(bancos.data??[]) as never[]} centros={(centros.data??[]) as never[]} socios={(vinculos.data??[]).flatMap((v)=>v.usuario?[v.usuario]:[]) as never[]} caixa={(caixa.data??[]) as never[]} />;
}

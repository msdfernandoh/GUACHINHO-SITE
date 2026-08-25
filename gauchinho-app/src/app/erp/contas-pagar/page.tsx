import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { ContasPagarClient } from "./ui";

export default async function ContasPagarPage() {
  const { empresaAtiva, usuario, vinculos: vinculosContexto } = await getCurrentTenantContext();
  if (!empresaAtiva) return null;
  const db = createAdminClient();
  const empresaId = empresaAtiva.id;
  const vinculoAtivo = vinculosContexto?.find((vinculo) => vinculo.empresa_id === empresaId);
  const isMaster = Boolean(
    usuario?.perfil === "master" ||
      vinculoAtivo?.papel?.codigo === "admin_empresa"
  );
  const podeEstornar = Boolean(
    isMaster || (vinculoAtivo as { pode_estornar_contas?: boolean })?.pode_estornar_contas
  );

  const [contas, bancos, centros, fornecedores, vinculos, caixa, logs] = await Promise.all([
    db
      .from("financeiro_contas_pagar")
      .select("*")
      .eq("empresa_id", empresaId)
      .neq("status", "cancelada")
      .order("vencimento", { ascending: true })
      .limit(1000),
    db.from("financeiro_contas_bancarias").select("*").eq("empresa_id", empresaId).order("nome"),
    db.from("financeiro_centros_custo").select("*").eq("empresa_id", empresaId).order("nome"),
    db.from("financeiro_fornecedores").select("*").eq("empresa_id", empresaId).order("nome"),
    db
      .from("empresa_usuarios")
      .select("socio_pagador,pode_estornar_contas,usuario:usuarios!empresa_usuarios_usuario_id_fkey(id,nome,email)")
      .eq("empresa_id", empresaId)
      .eq("ativo", true),
    db.from("caixa_movimentos").select("id,tipo_movimento,valor,data_movimento,descricao").eq("empresa_id", empresaId),
    db
      .from("financeiro_contas_pagar_logs")
      .select("*,usuario:usuarios!financeiro_contas_pagar_logs_usuario_id_fkey(nome,email)")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  if (vinculos.error) throw new Error(vinculos.error.message);
  const usuarios = (vinculos.data ?? []).flatMap((vinculo) => {
    const usuario = vinculo.usuario as unknown as { id: string; nome: string; email: string } | null;
    return usuario ? [{ ...usuario, socioPagador: Boolean(vinculo.socio_pagador) }] : [];
  });
  return (
    <ContasPagarClient
      contas={(contas.data ?? []) as any[]}
      bancos={(bancos.data ?? []) as any[]}
      centros={(centros.data ?? []) as any[]}
      fornecedores={(fornecedores.data ?? []) as any[]}
      socios={usuarios.filter((usuario) => usuario.socioPagador)}
      caixa={(caixa.data ?? []) as any[]}
      logs={(logs.data ?? []) as any[]}
      master={isMaster}
      podeEstornar={podeEstornar}
    />
  );
}

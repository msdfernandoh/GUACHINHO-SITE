import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { ContasPagarClient } from "./ui";

export default async function ContasPagarPage() {
  const { empresaAtiva, usuario, vinculos: vinculosContexto } = await getCurrentTenantContext();
  if (!empresaAtiva) return null;
  const db = createAdminClient();
  const empresaId = empresaAtiva.id;
  const vinculoAtivo = vinculosContexto?.find((vinculo) => vinculo.empresa_id === empresaId);
  const master = usuario?.perfil === "master" && vinculoAtivo?.papel?.codigo === "admin_empresa";
  const [contas, bancos, centros, vinculos, caixa, logs] = await Promise.all([
    db
      .from("financeiro_contas_pagar")
      .select("*")
      .eq("empresa_id", empresaId)
      .neq("status", "cancelada")
      .order("vencimento", { ascending: false })
      .limit(500),
    db.from("financeiro_contas_bancarias").select("*").eq("empresa_id", empresaId).eq("ativo", true),
    db.from("financeiro_centros_custo").select("*").eq("empresa_id", empresaId).eq("ativo", true),
    db
      .from("empresa_usuarios")
      .select("socio_pagador,usuario:usuarios!empresa_usuarios_usuario_id_fkey(id,nome,email)")
      .eq("empresa_id", empresaId)
      .eq("ativo", true),
    db.from("caixa_movimentos").select("tipo_movimento,valor").eq("empresa_id", empresaId),
    master
      ? db
          .from("financeiro_contas_pagar_logs")
          .select("*,usuario:usuarios!financeiro_contas_pagar_logs_usuario_id_fkey(nome,email)")
          .eq("empresa_id", empresaId)
          .order("created_at", { ascending: false })
          .limit(300)
      : Promise.resolve({ data: [] }),
  ]);
  if (vinculos.error) throw new Error(vinculos.error.message);
  const usuarios = (vinculos.data ?? []).flatMap((vinculo) => {
    const usuario = vinculo.usuario as unknown as { id: string; nome: string; email: string } | null;
    return usuario ? [{ ...usuario, socioPagador: Boolean(vinculo.socio_pagador) }] : [];
  });
  return (
    <ContasPagarClient
      contas={(contas.data ?? []) as never[]}
      bancos={(bancos.data ?? []) as never[]}
      centros={(centros.data ?? []) as never[]}
      socios={usuarios.filter((usuario) => usuario.socioPagador)}
      usuarios={usuarios}
      caixa={(caixa.data ?? []) as never[]}
      logs={(logs.data ?? []) as never[]}
      master={Boolean(master)}
    />
  );
}

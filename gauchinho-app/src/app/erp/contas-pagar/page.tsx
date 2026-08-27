import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { ContasPagarClient } from "./ui";
import { consultarContasPagar, consultarProjecaoCaixa } from "./actions";

export default async function ContasPagarPage() {
  const { empresaAtiva, vinculos: vinculosContexto } = await getCurrentTenantContext();
  if (!empresaAtiva) return null;
  const db = createAdminClient();
  const empresaId = empresaAtiva.id;
  const vinculoAtivo = vinculosContexto?.find((vinculo) => vinculo.empresa_id === empresaId);
  const isMaster = vinculoAtivo?.papel?.codigo === "admin_empresa";
  const podeEstornar = Boolean(
    isMaster || vinculoAtivo?.pode_estornar_contas
  );

  const [consulta, projecaoCaixa, bancos, centros, fornecedores, vinculos] = await Promise.all([
    consultarContasPagar(),
    consultarProjecaoCaixa(),
    db.from("financeiro_contas_bancarias").select("*").eq("empresa_id", empresaId).order("nome"),
    db.from("financeiro_centros_custo").select("*").eq("empresa_id", empresaId).order("nome"),
    db.from("financeiro_fornecedores").select("*").eq("empresa_id", empresaId).order("nome"),
    db
      .from("empresa_usuarios")
      .select("socio_pagador,pode_estornar_contas,usuario:usuarios!empresa_usuarios_usuario_id_fkey(id,nome,email)")
      .eq("empresa_id", empresaId)
      .eq("ativo", true),
  ]);
  if (vinculos.error) throw new Error(vinculos.error.message);
  const usuarios = (vinculos.data ?? []).flatMap((vinculo) => {
    const usuario = vinculo.usuario as unknown as { id: string; nome: string; email: string } | null;
    return usuario ? [{ ...usuario, socioPagador: Boolean(vinculo.socio_pagador) }] : [];
  });

  const fornecedoresDb = (fornecedores.data ?? []) as any[];

  // Monta lista unificada de fornecedores (tabela + despesas já cadastradas)
  const fornecedoresMap = new Map<string, any>();

  fornecedoresDb.forEach((f) => {
    if (f && f.nome) {
      fornecedoresMap.set(f.nome.trim().toLowerCase(), {
        ...f,
        totalContas: 0,
      });
    }
  });

  consulta.fornecedores_uso.forEach((uso) => {
    const nome = uso.nome.trim();
    if (nome) {
      const key = nome.toLowerCase();
      if (fornecedoresMap.has(key)) {
        const item = fornecedoresMap.get(key);
        item.totalContas = Number(uso.total);
      } else {
        fornecedoresMap.set(key, {
          id: `temp-${encodeURIComponent(nome)}`,
          nome: nome,
          ativo: true,
          totalContas: Number(uso.total),
          isFromContas: true,
        });
      }
    }
  });

  const todosFornecedores = Array.from(fornecedoresMap.values()).sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" })
  );

  return (
    <ContasPagarClient
      consultaInicial={consulta}
      projecaoCaixa={projecaoCaixa}
      bancos={(bancos.data ?? []) as any[]}
      centros={(centros.data ?? []) as any[]}
      fornecedores={todosFornecedores}
      socios={usuarios.filter((usuario) => usuario.socioPagador)}
      master={isMaster}
      podeEstornar={podeEstornar}
    />
  );
}

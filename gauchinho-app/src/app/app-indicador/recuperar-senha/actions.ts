"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { solicitarRecuperacaoSenhaAction, type RecuperarSenhaState } from "@/app/(auth)/esqueci-senha/actions";

const mensagemGenerica = "Se o CPF estiver cadastrado no programa, enviaremos um link para o e-mail associado à conta. Verifique a caixa de entrada e o spam.";

export async function recuperarSenhaIndicadorPorCpfAction(
  _prevState: RecuperarSenhaState | null,
  formData: FormData,
): Promise<RecuperarSenhaState> {
  const cpf = String(formData.get("identificador") ?? "").replace(/\D/g, "");
  if (!/^\d{11}$/.test(cpf)) return { ok: false, message: "Informe um CPF válido com 11 dígitos." };

  const tenant = await getResolvedTenant();
  if (!tenant) return { ok: true, message: mensagemGenerica };
  const admin = createAdminClient({ noStore: true });
  const { data: participante } = await admin.from("participantes_comerciais")
    .select("id,usuario_id,status")
    .eq("empresa_id", tenant.empresaId)
    .eq("cpf", cpf)
    .maybeSingle();
  if (!participante?.usuario_id || (participante.status ?? "ATIVO").toUpperCase() !== "ATIVO") {
    return { ok: true, message: mensagemGenerica };
  }
  const [{ data: vinculo }, { data: indicador }, { data: usuario }] = await Promise.all([
    admin.from("empresa_usuarios").select("id").eq("empresa_id", tenant.empresaId)
      .eq("usuario_id", participante.usuario_id).eq("ativo", true).maybeSingle(),
    admin.from("programa_indicadores").select("id").eq("empresa_id", tenant.empresaId)
      .eq("participante_id", participante.id).eq("ativo", true).maybeSingle(),
    admin.from("usuarios").select("email,ativo").eq("id", participante.usuario_id).maybeSingle(),
  ]);
  if (!vinculo || !indicador || !usuario?.ativo || !usuario.email) {
    return { ok: true, message: mensagemGenerica };
  }

  const emailForm = new FormData();
  emailForm.set("email", usuario.email);
  const result = await solicitarRecuperacaoSenhaAction(null, emailForm);
  return result.ok ? { ok: true, message: mensagemGenerica } : result;
}

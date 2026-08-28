"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type TrocaSenhaState = {
  ok: boolean;
  message: string;
};

export async function trocarSenhaPrimeiroAcesso(senha: string): Promise<TrocaSenhaState> {
  if (senha.length < 8) {
    return { ok: false, message: "A senha deve ter pelo menos 8 caracteres." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { ok: false, message: "Sessão inválida ou expirada. Entre novamente com a senha inicial." };
  }

  const { error: passwordError } = await supabase.auth.updateUser({ password: senha });
  if (passwordError) {
    return { ok: false, message: passwordError.message };
  }

  const admin = createAdminClient();
  const { data: authUser, error: authUserError } = await admin.auth.admin.getUserById(user.id);
  if (authUserError || !authUser.user) {
    return { ok: false, message: "Senha alterada, mas não foi possível concluir a liberação do acesso. Tente novamente." };
  }

  const appMetadata = {
    ...authUser.user.app_metadata,
    exige_troca_senha: false,
  };
  const { error: metadataError } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: appMetadata,
  });
  if (metadataError) {
    return { ok: false, message: "Senha alterada, mas não foi possível concluir a liberação do acesso. Tente novamente." };
  }

  // Compatibilidade com convites antigos que ainda estejam pendentes.
  const { error: ativacaoError } = await supabase.rpc("rpc_ativar_meus_convites");
  if (ativacaoError) {
    return { ok: false, message: `Senha alterada, mas a ativação de um vínculo antigo falhou: ${ativacaoError.message}` };
  }

  await supabase.auth.refreshSession();
  return { ok: true, message: "Senha definida com sucesso." };
}

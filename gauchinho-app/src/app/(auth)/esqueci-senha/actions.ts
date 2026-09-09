"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type RecuperarSenhaState = {
  ok: boolean;
  message: string;
};

export async function solicitarRecuperacaoSenhaAction(
  _prevState: RecuperarSenhaState | null,
  formData: FormData,
): Promise<RecuperarSenhaState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email || !email.includes("@")) {
    return {
      ok: false,
      message: "Por favor, informe um endereço de e-mail válido.",
    };
  }

  try {
    const headersList = await headers();
    const host = headersList.get("host") || "localhost:3000";
    const proto = headersList.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
    const origin = `${proto}://${host}`;
    const redirectTo = `${origin}/auth/confirm?next=/definir-senha`;

    const admin = createAdminClient();
    const { data: usuario, error: usuarioErr } = await admin
      .from("usuarios")
      .select("id, email, auth_user_id, ativo")
      .ilike("email", email)
      .maybeSingle();

    if (usuarioErr) {
      console.error("[solicitarRecuperacaoSenha] Erro ao buscar usuário:", usuarioErr);
    }

    // Se o usuário não existir no sistema de negócio, retorna mensagem genérica (prevenção de enumeração)
    if (!usuario) {
      return {
        ok: true,
        message: "Se o e-mail estiver cadastrado, você receberá instruções para redefinir sua senha em instantes. Verifique sua caixa de entrada e pasta de spam.",
      };
    }

    if (!usuario.ativo) {
      return {
        ok: false,
        message: "Esta conta está desativada no sistema. Solicite a reativação ao administrador.",
      };
    }

    // Caso o usuário exista mas ainda não possua auth_user_id vinculado (ex: dados legados)
    if (!usuario.auth_user_id) {
      const { data: authCreated, error: createError } = await admin.auth.admin.createUser({
        email: usuario.email,
        password: "midiapormidia@123",
        email_confirm: true,
        app_metadata: { exige_troca_senha: true },
      });
      if (!createError && authCreated?.user?.id) {
        await admin
          .from("usuarios")
          .update({ auth_user_id: authCreated.user.id })
          .eq("id", usuario.id);
      }
    }

    const supabase = await createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(usuario.email, {
      redirectTo,
    });

    if (resetError) {
      console.error("[solicitarRecuperacaoSenha] Erro resetPasswordForEmail:", resetError);
      return {
        ok: false,
        message: resetError.message || "Erro ao solicitar recuperação. Tente novamente mais tarde.",
      };
    }

    return {
      ok: true,
      message: "Se o e-mail estiver cadastrado, você receberá instruções para redefinir sua senha em instantes. Verifique sua caixa de entrada e pasta de spam.",
    };
  } catch (err) {
    console.error("[solicitarRecuperacaoSenha] Erro inesperado:", err);
    return {
      ok: false,
      message: "Ocorreu um erro ao processar sua solicitação. Tente novamente mais tarde.",
    };
  }
}

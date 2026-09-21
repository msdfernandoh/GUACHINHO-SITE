import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { digitsOnlyPhone } from "@/lib/utils/format";

type ParticipanteApp = {
  id: string;
  nome: string;
  telefone: string | null;
  whatsapp: string | null;
  status: string | null;
};

export async function resolveIndicadorAppSession(empresaId: string, usuarioId: string) {
  const admin = createAdminClient({ noStore: true });
  const { data: participantes, error: participantesError } = await admin
    .from("participantes_comerciais")
    .select("id,nome,telefone,whatsapp,status")
    .eq("empresa_id", empresaId)
    .eq("usuario_id", usuarioId);

  if (participantesError || !participantes?.length) {
    return { participante: null, indicador: null };
  }

  const participantesAtivos = (participantes as ParticipanteApp[]).filter(
    (participante) => (participante.status ?? "ATIVO").toUpperCase() === "ATIVO",
  );
  if (!participantesAtivos.length) return { participante: null, indicador: null };

  const { data: indicadores } = await admin
    .from("programa_indicadores")
    .select("id,participante_id")
    .eq("empresa_id", empresaId)
    .in("participante_id", participantesAtivos.map((participante) => participante.id))
    .eq("ativo", true)
    .limit(1);

  let indicador = indicadores?.[0] ?? null;

  // Contas antigas do app podiam ter Auth, usuário e participante criados sem
  // a última linha de programa_indicadores. Recompõe somente o vínculo do
  // próprio usuário autenticado e apenas quando CPF e telefone são válidos.
  if (!indicador) {
    const { data: usuario } = await admin
      .from("usuarios")
      .select("auth_user_id,telefone")
      .eq("id", usuarioId)
      .maybeSingle();
    const authUser = usuario?.auth_user_id
      ? (await admin.auth.admin.getUserById(usuario.auth_user_id)).data.user
      : null;
    const cpf = String(authUser?.user_metadata?.cpf ?? "").replace(/\D/g, "");
    const telefone = digitsOnlyPhone(usuario?.telefone ?? "");
    const participanteCanonico = participantesAtivos[0];

    if (/^\d{11}$/.test(cpf) && telefone.length >= 10 && telefone.length <= 13) {
      const { data: criado } = await admin
        .from("programa_indicadores")
        .insert({
          empresa_id: empresaId,
          participante_id: participanteCanonico.id,
          cpf,
          telefone,
          chave_pix: telefone,
          origem_cadastro: "APP_LEGADO_REPARADO",
        })
        .select("id,participante_id")
        .maybeSingle();

      if (criado) {
        indicador = criado;
        await admin
          .from("participantes_comerciais")
          .update({ cpf, telefone, whatsapp: telefone })
          .eq("empresa_id", empresaId)
          .eq("id", participanteCanonico.id);
        await admin.from("participante_tipos").upsert(
          { empresa_id: empresaId, participante_id: participanteCanonico.id, tipo_codigo: "INDICADOR" },
          { onConflict: "participante_id,tipo_codigo", ignoreDuplicates: true },
        );
      }
    }
  }
  const participante = indicador
    ? participantesAtivos.find((item) => item.id === indicador.participante_id) ?? null
    : participantesAtivos[0] ?? null;

  return { participante, indicador };
}

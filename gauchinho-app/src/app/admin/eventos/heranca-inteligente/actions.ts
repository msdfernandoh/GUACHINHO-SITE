"use server";

import { revalidatePath } from "next/cache";
import { requireUsuario } from "@/lib/auth/get-usuario";
import { canManageImobiliarias } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { eventoLocalDateTimeToIso } from "@/lib/eventos-sorteio/timezone";
import { HERANCA_EVENTO_SLUG } from "@/lib/heranca-inteligente/lead";

export type SalvarHerancaResult = { ok: true } | { ok: false; error: string };

function campo(fd: FormData, nome: string) {
  return String(fd.get(nome) ?? "").trim();
}

/** Atualiza dia, horário, vagas e local do encontro Herança Inteligente. */
export async function salvarHerancaEventoAction(fd: FormData): Promise<SalvarHerancaResult> {
  try {
    const u = await requireUsuario();
    if (!canManageImobiliarias(u.perfil)) return { ok: false, error: "Sem permissão." };

    const data = campo(fd, "data");
    const hora = campo(fd, "hora");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^\d{2}:\d{2}$/.test(hora)) {
      return { ok: false, error: "Informe o dia e o horário do encontro." };
    }
    const vagas = Number.parseInt(campo(fd, "vagas"), 10);
    if (!Number.isInteger(vagas) || vagas < 1 || vagas > 5000) {
      return { ok: false, error: "Informe a quantidade de vagas (a partir de 1)." };
    }
    const local = campo(fd, "local");
    if (!local) return { ok: false, error: "Informe o local do encontro." };

    const { error } = await createAdminClient()
      .from("eventos")
      .update({
        data_evento: eventoLocalDateTimeToIso(`${data}T${hora}`),
        limite_participantes: vagas,
        local,
        endereco: campo(fd, "endereco") || null,
        cidade: campo(fd, "cidade") || null,
        estado: campo(fd, "estado").toUpperCase().slice(0, 2) || null,
        updated_at: new Date().toISOString(),
      })
      .eq("slug", HERANCA_EVENTO_SLUG);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/eventos");
    revalidatePath("/admin/eventos/heranca-inteligente");
    revalidatePath("/filhos");
    revalidatePath("/filhos/evento");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Não foi possível salvar." };
  }
}

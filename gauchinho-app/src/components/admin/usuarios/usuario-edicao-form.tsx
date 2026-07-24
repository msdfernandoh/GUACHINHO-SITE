"use client";

import { AdminFormSubmitButton } from "@/components/admin/admin-form-submit-button";
import { Label, Select } from "@/components/ui/form-primitives";
import { PERFIS } from "@/lib/auth/permissions";
import { isGmailAddress } from "@/lib/google-calendar/email";

type Props = {
  usuarioId: string;
  nome: string;
  email: string;
  perfil: string;
  isConsultor: boolean;
  leadsApenasProprios: boolean;
  googleAgendaSync: boolean;
  googleConnected: boolean;
  updateAction: (formData: FormData) => Promise<void>;
};

export function UsuarioEdicaoForm({
  usuarioId,
  nome,
  email,
  perfil,
  isConsultor,
  leadsApenasProprios,
  googleAgendaSync,
  googleConnected,
  updateAction,
}: Props) {
  const gmail = isGmailAddress(email);

  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-xs font-medium text-amber-400/90 hover:text-amber-300 [&::-webkit-details-marker]:hidden">
        Editar usuário
      </summary>
      <form action={updateAction} className="mt-3 min-w-[16rem] space-y-3 rounded-lg border border-zinc-700 bg-zinc-950/60 p-3">
        <input type="hidden" name="usuario_id" value={usuarioId} />
        <p className="text-xs text-zinc-500">{nome}</p>
        <div>
          <Label className="text-xs">Perfil</Label>
          <Select name="perfil" defaultValue={perfil} className="mt-1 w-full">
            {PERFIS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </div>
        <label className="flex items-start gap-2 text-xs">
          <input type="checkbox" name="is_consultor" defaultChecked={isConsultor} className="mt-0.5" />
          Consultor comercial (aparece na agenda e nos leads)
        </label>
        <label className="flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            name="leads_apenas_proprios"
            defaultChecked={leadsApenasProprios}
            className="mt-0.5"
          />
          Ver apenas leads em que for consultor responsável
        </label>
        <div className="rounded-md border border-zinc-800 p-2">
          <label className={`flex items-start gap-2 text-xs ${gmail ? "" : "opacity-60"}`}>
            <input
              type="checkbox"
              name="google_agenda_sync"
              defaultChecked={googleAgendaSync && gmail}
              disabled={!gmail}
              className="mt-0.5"
            />
            Sincronizar agenda com Google Agenda
          </label>
          {!gmail ? (
            <p className="mt-1 text-[10px] text-zinc-500">Requer login com e-mail @gmail.com ({email}).</p>
          ) : googleAgendaSync ? (
            <p className="mt-1 text-[10px] text-zinc-500">
              {googleConnected
                ? "Conta Google conectada — compromissos novos vão para a agenda dele(a)."
                : "Habilitado — o usuário deve abrir Admin → Agenda e clicar em “Conectar Google Agenda”."}
            </p>
          ) : (
            <p className="mt-1 text-[10px] text-zinc-500">
              Ao marcar e salvar, o consultor poderá autorizar o Google na tela Agenda.
            </p>
          )}
        </div>
        <AdminFormSubmitButton label="Salvar alterações" pendingLabel="Salvando…" size="sm" />
      </form>
    </details>
  );
}

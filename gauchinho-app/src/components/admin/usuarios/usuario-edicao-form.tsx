"use client";

import { useMemo, useState } from "react";
import { AdminFormSubmitButton } from "@/components/admin/admin-form-submit-button";
import { Input, Label, Select } from "@/components/ui/form-primitives";
import { surfaceInputDark } from "@/components/ui/form-primitives";
import { ADMIN_MENU_ITEMS, type AdminMenuKey } from "@/lib/admin/admin-menus";
import { PERFIS } from "@/lib/auth/permissions";
import { isGmailAddress } from "@/lib/google-calendar/email";

type Props = {
  usuarioId: string;
  nome: string;
  email: string;
  telefone: string | null;
  perfil: string;
  isConsultor: boolean;
  leadsApenasProprios: boolean;
  agendaAcessoTodos: boolean;
  googleAgendaSync: boolean;
  googleConnected: boolean;
  menuKeysAtivos: AdminMenuKey[];
  updateAction: (formData: FormData) => Promise<void>;
};

export function UsuarioEdicaoForm({
  usuarioId,
  nome,
  email,
  telefone,
  perfil,
  isConsultor,
  leadsApenasProprios,
  agendaAcessoTodos,
  googleAgendaSync,
  googleConnected,
  menuKeysAtivos,
  updateAction,
}: Props) {
  const [emailEdit, setEmailEdit] = useState(email);
  const gmail = useMemo(() => isGmailAddress(emailEdit), [emailEdit]);

  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-xs font-medium text-amber-400/90 hover:text-amber-300 [&::-webkit-details-marker]:hidden">
        Editar usuário
      </summary>
      <form
        action={updateAction}
        className="mt-3 min-w-[18rem] max-w-md space-y-3 rounded-lg border border-zinc-700 bg-zinc-950/60 p-3"
      >
        <input type="hidden" name="usuario_id" value={usuarioId} />
        <div>
          <Label className="text-xs">Nome</Label>
          <Input name="nome" defaultValue={nome} required className={`mt-1 ${surfaceInputDark}`} />
        </div>
        <div>
          <Label className="text-xs">E-mail (login)</Label>
          <Input
            name="email"
            type="email"
            required
            value={emailEdit}
            onChange={(e) => setEmailEdit(e.target.value)}
            className={`mt-1 ${surfaceInputDark}`}
          />
          <p className="mt-1 text-[10px] text-zinc-500">Altera também o login no Supabase Auth.</p>
        </div>
        <div>
          <Label className="text-xs">Telefone</Label>
          <Input
            name="telefone"
            type="tel"
            defaultValue={telefone ?? ""}
            className={`mt-1 ${surfaceInputDark}`}
          />
        </div>
        <div>
          <Label className="text-xs">Nova senha (opcional)</Label>
          <Input
            name="nova_senha"
            type="password"
            minLength={8}
            autoComplete="new-password"
            placeholder="Mín. 8 caracteres"
            className={`mt-1 ${surfaceInputDark}`}
          />
        </div>
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
        <div className="space-y-2 rounded-md border border-zinc-800 p-2">
          <p className="text-xs font-semibold text-zinc-300">Menus do painel</p>
          <p className="text-[10px] text-zinc-500">Nenhum marcado = padrão do perfil.</p>
          <div className="grid max-h-40 gap-1.5 overflow-y-auto sm:grid-cols-2">
            {ADMIN_MENU_ITEMS.map((m) => (
              <label key={m.key} className="flex items-center gap-2 text-[11px]">
                <input
                  type="checkbox"
                  name="admin_menu"
                  value={m.key}
                  defaultChecked={menuKeysAtivos.includes(m.key)}
                />
                {m.label}
              </label>
            ))}
          </div>
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
        <label className="flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            name="agenda_acesso_todos"
            defaultChecked={agendaAcessoTodos}
            className="mt-0.5"
          />
          Ver e gerenciar a agenda de todos os consultores (agendar, editar e cancelar compromissos)
        </label>
        <div className="rounded-md border border-zinc-800 p-2">
          <label className="flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              name="google_agenda_sync"
              defaultChecked={googleAgendaSync && gmail}
              className="mt-0.5"
            />
            Sincronizar agenda com Google Agenda
          </label>
          {!gmail ? (
            <p className="mt-1 text-[10px] text-amber-500/90">
              Só funciona com e-mail @gmail.com. Ao salvar, esta opção será desmarcada se o e-mail não for Gmail.
            </p>
          ) : googleAgendaSync ? (
            <p className="mt-1 text-[10px] text-zinc-500">
              {googleConnected
                ? "Conectado ao Google — se mudar o e-mail, será preciso conectar de novo na Agenda."
                : "Habilitado — o usuário conecta em Admin → Agenda."}
            </p>
          ) : (
            <p className="mt-1 text-[10px] text-zinc-500">Marque para permitir conexão na tela Agenda.</p>
          )}
        </div>
        <AdminFormSubmitButton label="Salvar alterações" pendingLabel="Salvando…" size="sm" />
      </form>
    </details>
  );
}

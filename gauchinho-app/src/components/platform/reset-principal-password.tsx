"use client";

import { useActionState, useState } from "react";
import { gerarNovaSenhaPrincipalPlatformAction, type PlatformFormState } from "@/app/platform/usuarios-actions";

export function ResetPrincipalPassword({ empresaId, linkId, email }: { empresaId: string; linkId: string; email: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)} className="rounded border border-cyan-300 bg-cyan-50 px-2.5 py-1.5 text-xs font-bold text-cyan-800">Gerar nova senha</button>
    {open && <PasswordDialog empresaId={empresaId} linkId={linkId} email={email} onClose={() => setOpen(false)} />}
  </>;
}

function PasswordDialog({ empresaId, linkId, email, onClose }: { empresaId: string; linkId: string; email: string; onClose: () => void }) {
  const [state, action, pending] = useActionState(gerarNovaSenhaPrincipalPlatformAction, { status: "IDLE", message: "" } as PlatformFormState);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" role="dialog" aria-modal="true" aria-label="Nova senha do responsável principal">
    <div className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 text-left text-sm text-slate-900 shadow-xl">
      <h3 className="text-lg font-bold">Nova senha do responsável principal</h3>
      <p className="break-all">{email}</p>
      {!state.data?.senhaTemporaria ? <form action={action} className="space-y-4">
        <input type="hidden" name="empresa_id" value={empresaId} />
        <input type="hidden" name="empresa_usuario_id" value={linkId} />
        <p>A senha atual será substituída. Se este usuário participa de outras franquias, a nova senha valerá para todos os seus acessos. Papéis, permissões e vínculos não serão alterados.</p>
        <label className="flex items-start gap-2"><input type="checkbox" name="confirmar" value="true" required disabled={pending} className="mt-1" />Confirmo a redefinição e entregarei a senha ao responsável por um canal seguro.</label>
        {state.message && <p role="alert" className="text-rose-700">{state.message}</p>}
        <div className="flex justify-end gap-3"><button type="button" disabled={pending} onClick={onClose} className="rounded border px-4 py-2">Cancelar</button><button disabled={pending} className="rounded bg-cyan-700 px-4 py-2 font-bold text-white">{pending ? "Gerando..." : "Confirmar e gerar senha"}</button></div>
      </form> : <>
        <p role="status" className="text-emerald-800">{state.message}</p>
        <p className="text-xs">A senha deixará de ser exibida ao fechar esta janela.</p>
        <div className="select-all break-all rounded border bg-slate-50 p-4 font-mono">{state.data.senhaTemporaria}</div>
        {copyError && <p role="alert">Não foi possível copiar automaticamente. Selecione e copie a senha acima.</p>}
        <div className="flex justify-end gap-3">
          <button type="button" className="rounded border px-4 py-2" onClick={async () => {
            try { await navigator.clipboard.writeText(`E-mail: ${state.data!.email}\nSenha temporária: ${state.data!.senhaTemporaria}`); setCopied(true); setCopyError(false); } catch { setCopyError(true); }
          }}>{copied ? "Copiado" : "Copiar e-mail e senha"}</button>
          <button type="button" className="rounded bg-cyan-700 px-4 py-2 font-bold text-white" onClick={onClose}>Fechar</button>
        </div>
      </>}
    </div>
  </div>;
}

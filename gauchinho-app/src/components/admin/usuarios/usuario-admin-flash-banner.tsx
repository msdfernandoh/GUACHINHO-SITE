import { usuarioAdminFlashMessage } from "@/lib/admin/usuario-admin-flash";

export function UsuarioAdminFlashBanner({ codigo }: { codigo?: string | null }) {
  const msg = usuarioAdminFlashMessage(codigo);
  if (!msg) return null;
  const ok = codigo === "salvo";
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${
        ok
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
          : "border-amber-500/40 bg-amber-500/10 text-amber-100"
      }`}
      role="status"
    >
      {msg}
    </div>
  );
}

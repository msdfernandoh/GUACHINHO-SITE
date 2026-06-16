import { redirect, notFound } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageImobiliarias } from "@/lib/auth/permissions";
import {
  createImobiliariaUsuarioAction,
  fetchImobiliaria,
  updateImobiliariaMasterAction,
} from "../actions";
import { ImobiliariaForm } from "@/components/admin/imobiliaria-form";
import { Button, Input, Label } from "@/components/ui/form-primitives";

export default async function EditarImobiliariaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const u = await getUsuarioNegocio();
  if (!canManageImobiliarias(u?.perfil)) redirect("/admin");
  const { id } = await params;
  const imob = await fetchImobiliaria(id).catch(() => null);
  if (!imob) notFound();

  const update = updateImobiliariaMasterAction.bind(null, id);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">{imob.nome}</h1>
        <p className="text-sm text-zinc-500">Slug: {imob.slug}</p>
      </div>
      <ImobiliariaForm action={update} masterFields imob={imob} />
      <form action={createImobiliariaUsuarioAction} className="max-w-md space-y-3 rounded-xl border p-4 dark:border-zinc-800">
        <h2 className="font-semibold">Usuário imobiliária</h2>
        <input type="hidden" name="imobiliaria_id" value={id} />
        <div>
          <Label>Nome</Label>
          <Input name="nome" required />
        </div>
        <div>
          <Label>E-mail login</Label>
          <Input name="email" type="email" required />
        </div>
        <div>
          <Label>Senha inicial</Label>
          <Input name="password" type="password" minLength={8} required />
        </div>
        <Button type="submit">Criar login imobiliária</Button>
      </form>
    </div>
  );
}

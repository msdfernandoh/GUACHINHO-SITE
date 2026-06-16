import { redirect } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { isImobiliaria, isStaff } from "@/lib/auth/permissions";
import { createImovelAction } from "../actions";
import { fetchImobiliariasList } from "../../imobiliarias/actions";
import { ImovelForm } from "@/components/admin/imovel-form";

export default async function NovoImovelPage() {
  const u = await getUsuarioNegocio();
  if (!u || (!isStaff(u.perfil) && !isImobiliaria(u.perfil))) redirect("/login");

  const imobiliarias =
    u.perfil === "master" ? await fetchImobiliariasList({ ativo: "sim" }) : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Novo imóvel</h1>
      <ImovelForm
        action={createImovelAction}
        showImobiliariaSelect={u.perfil === "master"}
        imobiliarias={imobiliarias.map((i) => ({ id: i.id, nome: i.nome }))}
        defaultImobiliariaId={u.imobiliaria_id ?? undefined}
      />
    </div>
  );
}

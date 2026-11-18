import type { Metadata } from "next";
import { Shell } from "@/components/contempladas/ui";
import { SolicitarAcesso } from "@/components/contempladas/solicitar";

export const metadata: Metadata = { title: { absolute: "Solicitar acesso · Cotas Contempladas" }, robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { tipo } = await searchParams;
  const inicial = tipo === "administrador" ? "ADMINISTRA" : "REVENDE";
  return (
    <Shell titulo="Solicitar acesso" sub="Revendas e administradores de cotas">
      <SolicitarAcesso inicial={inicial} />
    </Shell>
  );
}

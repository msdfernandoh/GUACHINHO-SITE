import { redirect } from "next/navigation";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { AcessoCadastroClient } from "./client";

export default async function AcessosCadastroPage() {
  if (!(await isPlatformSuperadmin())) redirect("/platform/revisao");
  return <AcessoCadastroClient />;
}

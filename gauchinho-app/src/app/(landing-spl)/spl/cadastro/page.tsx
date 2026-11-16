import type { Metadata } from "next";
import { SplCadastroImobiliaria } from "@/components/spl/spl-cadastro";
import { SplShell } from "@/components/spl/spl-ui";
import { getTermosSpl } from "@/lib/spl/termos";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Cadastro de imobiliária · Portfólio SPL" },
  robots: { index: false },
};

export default async function SplCadastroPage() {
  const termos = await getTermosSpl();
  return (
    <SplShell>
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="mb-2 text-3xl font-black text-[#0A1931]">Cadastre sua imobiliária</h1>
        <p className="mb-6 text-lg text-slate-600">Três passos rápidos. No fim você recebe o link do seu painel e o link para os vendedores.</p>
        <SplCadastroImobiliaria termos={termos ? { versao: termos.versao, texto: termos.texto } : null} />
      </main>
    </SplShell>
  );
}

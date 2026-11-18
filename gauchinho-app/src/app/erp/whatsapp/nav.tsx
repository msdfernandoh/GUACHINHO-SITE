import Link from "next/link";
import { MessageCircle } from "lucide-react";

/** Abas do módulo WhatsApp; mantém a instância escolhida entre as telas. */
export default function WhatsappNav({ atual, instanciaId }: { atual: "conversas" | "templates" | "envios"; instanciaId?: string }) {
  const q = instanciaId ? "?instancia_id=" + instanciaId : "";
  const abas = [
    { id: "conversas", rotulo: "Conexão e conversas", href: "/erp/whatsapp" + q },
    { id: "templates", rotulo: "Templates", href: "/erp/whatsapp/templates" + q },
    { id: "envios", rotulo: "Envios automáticos", href: "/erp/whatsapp/envios" + q },
  ];
  return (
    <div className="mx-auto mb-6 max-w-5xl space-y-4 text-slate-950">
      <header className="flex items-center gap-3">
        <MessageCircle className="text-emerald-600" size={30} />
        <div>
          <h1 className="text-2xl font-bold">WhatsApp</h1>
          <p className="text-sm text-slate-500">Números, templates e envios da sua empresa.</p>
        </div>
      </header>
      <nav className="flex flex-wrap gap-2 border-b border-slate-200">
        {abas.map((a) => (
          <Link key={a.id} href={a.href} className={"-mb-px border-b-2 px-3 py-2 text-sm font-semibold " + (a.id === atual ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-800")}>
            {a.rotulo}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function SeletorInstancia({ instancias, selecionada, base }: { instancias: { id: string; nome: string; numero_exibicao: string | null; numero_celular: string | null; status: string }[]; selecionada: string; base: string }) {
  if (instancias.length < 2) return null;
  return (
    <form action={base} className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-4">
      <label className="block flex-1 text-sm font-semibold">
        Número (instância)
        <select name="instancia_id" defaultValue={selecionada} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          {instancias.map((i) => (
            <option key={i.id} value={i.id}>{i.nome} · {i.numero_exibicao || i.numero_celular || "número pendente"} · {i.status}</option>
          ))}
        </select>
      </label>
      <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Trocar</button>
    </form>
  );
}

import Link from "next/link";
const steps = [
  "Abrir ou cadastrar a Administradora",
  "Cadastrar Tipos oficiais",
  "Cadastrar Modalidades",
  "Criar Curva de Estorno estruturada",
  "Criar Programa e regra da Franqueadora",
  "Homologar a regra na Platform",
  "Configurar Grupos com Tipo e Modalidade",
  "Salvar vigência fiscal no ERP",
  "Criar regra Automática ou Manual do participante",
  "Validar uma venda antes da liberação",
];
export default function AjudaComissoesPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-700">
          Manual operacional
        </p>
        <h1 className="text-3xl font-bold">Como configurar comissões</h1>
        <p className="text-slate-500">
          A sequência abaixo acompanha os menus e botões atuais do sistema.
        </p>
      </header>
      <ol className="grid gap-3 md:grid-cols-2">
        {steps.map((step, index) => (
          <li key={step} className="rounded-xl border bg-white p-4">
            <span className="text-xs font-bold text-cyan-700">
              ETAPA {index + 1}
            </span>
            <p className="font-semibold">{step}</p>
          </li>
        ))}
      </ol>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
        <strong>Regra central:</strong> Administradora → Tipo → Modalidade →
        Programa homologado → Grupo → Venda → Snapshot. Automática herda o
        cronograma oficial; Manual exige cronograma próprio.
      </div>
      <div className="flex gap-3">
        <Link
          href="/platform/administradoras"
          className="rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white"
        >
          Abrir Administradoras
        </Link>
        <Link
          href="/platform/grupos"
          className="rounded-lg border px-4 py-2 font-bold"
        >
          Abrir Grupos
        </Link>
      </div>
    </div>
  );
}

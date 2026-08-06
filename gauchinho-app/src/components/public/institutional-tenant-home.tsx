import type { EmpresaBranding } from "@/lib/tenant/branding";

type Props = {
  branding: EmpresaBranding;
  showModuloIndisponivel?: boolean;
};

/**
 * Home institucional controlada para tenants sem dados operacionais legados
 * (ex.: Empresa B na Fase 2). Não consulta grupos, leads, simulador real, etc.
 */
export function InstitutionalTenantHome({ branding, showModuloIndisponivel }: Props) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:py-24">
      {showModuloIndisponivel ? (
        <p className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Este módulo ainda não está disponível neste site.
        </p>
      ) : null}
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400/90">
        Site institucional
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        {branding.nome_site}
      </h1>
      {branding.subtitulo ? (
        <p className="mt-3 text-lg text-zinc-300">{branding.subtitulo}</p>
      ) : null}
      {branding.descricao_institucional ? (
        <p className="mt-6 text-base leading-relaxed text-zinc-400">
          {branding.descricao_institucional}
        </p>
      ) : (
        <p className="mt-6 text-base leading-relaxed text-zinc-400">
          Conteúdo institucional de demonstração. Módulos comerciais e operacionais
          ainda não estão habilitados para este tenant.
        </p>
      )}
      <ul className="mt-10 space-y-2 text-sm text-zinc-500">
        <li>Sem catálogo de grupos ou cotas nesta fase.</li>
        <li>Sem simulador baseado em dados reais.</li>
        <li>Sem leads, propostas, eventos ou contratação online.</li>
      </ul>
    </main>
  );
}

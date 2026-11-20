const SITE_SISTEMA = "https://www.msdeducacaoead.com.br/inicio/consorcio";

/** Banner no fim do portal divulgando o ERP de gestão de consórcios. */
export function BannerSistema() {
  return (
    <section className="mt-10 overflow-hidden rounded-2xl bg-[#0b1d3d] text-white shadow-lg">
      <div className="grid gap-6 p-6 sm:p-8 md:grid-cols-[1.4fr_1fr] md:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f5a524]">Para franquias e escritórios de consórcio</p>
          <h2 className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">Sua operação de consórcio no piloto automático</h2>
          <p className="mt-3 text-sm text-slate-300 sm:text-base">
            Este portal faz parte de um sistema completo de gestão: robôs que dão lances e baixam boletos direto na administradora,
            conferência do repasse de comissões, comissões futuras, ranking dos melhores grupos, CRM com captura de leads e financeiro.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
            {["Lances automáticos", "Boletos do mês", "Conciliação de comissões", "Melhores grupos", "Leads e CRM", "Financeiro e sócios"].map((t) => (
              <li key={t} className="rounded-full bg-white/10 px-3 py-1">{t}</li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col items-start gap-3 md:items-end">
          <a href={SITE_SISTEMA} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-xl bg-[#f5a524] px-6 py-3 text-base font-bold text-[#0b1d3d] shadow hover:bg-[#ffb83d]">
            Conheça o sistema de gestão de consórcios
          </a>
          <p className="text-xs text-slate-400">Planos, demonstração e detalhes do sistema</p>
        </div>
      </div>
    </section>
  );
}

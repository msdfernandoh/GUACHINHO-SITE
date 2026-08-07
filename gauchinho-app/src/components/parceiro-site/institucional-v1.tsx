import type { PartnerPublicViewModel } from "@/lib/parceiros/public-site-data";

export function InstitucionalV1Site({ vm }: { vm: PartnerPublicViewModel }) {
  const style = {
    "--ps-primary": vm.cor_primaria,
    "--ps-secondary": vm.cor_secundaria,
    "--ps-accent": vm.cor_destaque,
  } as React.CSSProperties;

  return (
    <div
      className="min-h-screen bg-[var(--ps-secondary)] text-white"
      style={style}
      data-parceiro-template="institucional_v1"
      data-preview={vm.is_preview ? "1" : "0"}
    >
      <header className="border-b border-white/10 bg-[var(--ps-primary)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            {vm.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={vm.logo_url} alt="" className="h-10 w-auto object-contain" />
            ) : null}
            <div>
              <p className="text-lg font-semibold tracking-tight">{vm.nome_site}</p>
              <p className="text-xs text-white/70">{vm.organizacao_nome}</p>
            </div>
          </div>
          <nav className="hidden flex-wrap gap-3 text-sm md:flex" aria-label="Menu do site">
            {vm.menus.map((m) => (
              <a key={m.codigo} href={m.href} className="text-white/85 hover:text-[var(--ps-accent)]">
                {m.label}
              </a>
            ))}
          </nav>
          {vm.whatsapp_link ? (
            <a
              href={vm.whatsapp_link}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-[var(--ps-accent)] px-3 py-2 text-sm font-semibold text-[var(--ps-primary)]"
            >
              WhatsApp
            </a>
          ) : null}
        </div>
      </header>

      <main>
        <section
          id="inicio"
          className="relative overflow-hidden px-4 py-16 md:py-24"
          style={
            vm.banner_url
              ? {
                  backgroundImage: `linear-gradient(rgba(10,22,40,.72), rgba(10,22,40,.85)), url(${vm.banner_url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          <div className="mx-auto max-w-5xl">
            <h1 className="max-w-2xl text-3xl font-bold tracking-tight md:text-5xl">
              {vm.texto_hero}
            </h1>
            {vm.descricao ? (
              <p className="mt-4 max-w-xl text-base text-white/80 md:text-lg">{vm.descricao}</p>
            ) : null}
            {vm.whatsapp_link ? (
              <a
                href={vm.whatsapp_link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-flex rounded-lg bg-[var(--ps-accent)] px-5 py-3 text-sm font-semibold text-[var(--ps-primary)]"
              >
                Falar no WhatsApp
              </a>
            ) : null}
          </div>
        </section>

        <section id="quem-somos" className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="text-2xl font-semibold text-[var(--ps-accent)]">Quem somos</h2>
          <p className="mt-3 max-w-3xl whitespace-pre-line text-white/85">
            {vm.texto_sobre || `${vm.organizacao_nome} oferece soluções em consórcio.`}
          </p>
        </section>

        <section id="consorcio" className="bg-black/20 px-4 py-14">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-2xl font-semibold text-[var(--ps-accent)]">Consórcio</h2>
            <p className="mt-3 max-w-3xl text-white/85">
              Planeje a conquista do seu bem com condições transparentes e atendimento próximo.
            </p>
          </div>
        </section>

        <section id="indicacao" className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="text-2xl font-semibold text-[var(--ps-accent)]">Indicação</h2>
          <p className="mt-3 max-w-3xl text-white/85">
            Conhece alguém que busca consórcio? Fale conosco e indique com confiança.
          </p>
        </section>

        <section id="contato" className="bg-black/20 px-4 py-14">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-2xl font-semibold text-[var(--ps-accent)]">Contato</h2>
            <ul className="mt-4 space-y-2 text-white/85">
              {vm.contato.telefone ? <li>Telefone: {vm.contato.telefone}</li> : null}
              {vm.contato.whatsapp ? <li>WhatsApp: {vm.contato.whatsapp}</li> : null}
              {vm.contato.email ? <li>E-mail: {vm.contato.email}</li> : null}
              {vm.contato.instagram ? <li>Instagram: {vm.contato.instagram}</li> : null}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[var(--ps-primary)] px-4 py-8 text-sm text-white/70">
        <div className="mx-auto max-w-5xl space-y-2">
          <p className="font-medium text-white/90">{vm.nome_site}</p>
          <p>{vm.tenant_identificacao}</p>
          {vm.is_preview ? (
            <p className="text-[var(--ps-accent)]">Preview administrativo — noindex — não publicado.</p>
          ) : null}
        </div>
      </footer>
    </div>
  );
}

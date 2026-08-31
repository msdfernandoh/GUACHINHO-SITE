import type { EmpresaBranding } from "@/lib/tenant/branding";
import { isRaconModel } from "@/lib/tenant/model-family";
import { RaconInspiredHome } from "@/components/public/templates/racon-inspired-home";
import type { EmpresaSiteModel } from "@/lib/tenant/site-model";

type Props = {
  branding: EmpresaBranding;
  siteModel: EmpresaSiteModel | null;
  showModuloIndisponivel?: boolean;
};

/**
 * Home institucional de alta conversão para tenants e franquias
 * utilizando a experiência visual Racon Inspired.
 */
export function InstitutionalTenantHome({ branding, siteModel, showModuloIndisponivel }: Props) {
  // Um entitlement suspenso nunca troca a identidade de um modelo pelo Racon.
  if (!siteModel || !isRaconModel(siteModel)) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-20">
        <h1 className="text-3xl font-bold">{branding.nome_site}</h1>
        <p className="mt-4">{showModuloIndisponivel
          ? "Este módulo não está disponível neste site."
          : "Site em configuração. Entre em contato com a empresa."}</p>
      </main>
    );
  }
  const identidade = {
    ...siteModel.identidadeVisual,
    ...(branding.cor_primaria ? { cor_primaria: branding.cor_primaria } : {}),
    ...(branding.cor_secundaria ? { cor_secundaria: branding.cor_secundaria } : {}),
    ...(branding.cor_destaque ? { cor_destaque: branding.cor_destaque } : {}),
  };
  const logoUrl = siteModel.usarLogoPropria
    ? branding.logo_url
    : siteModel.logoPadraoUrl ?? branding.logo_url;

  return (
    <div>
      {showModuloIndisponivel && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-center text-xs font-bold text-amber-900">
          Este módulo ainda não está disponível neste site institucional.
        </div>
      )}
      <RaconInspiredHome
        empresaNome={branding.nome_site}
        logoUrl={logoUrl}
        identidade={identidade}
        menus={siteModel.menus}
        secoes={siteModel.secoes}
        footerCopyright={siteModel.footerCopyright ?? undefined}
        telefoneContato={branding.telefone}
        whatsappContato={branding.whatsapp}
        showChrome={false}
      />
    </div>
  );
}


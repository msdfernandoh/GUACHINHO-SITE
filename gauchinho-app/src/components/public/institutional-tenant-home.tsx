import type { EmpresaBranding } from "@/lib/tenant/branding";
import { RaconInspiredHome } from "@/components/public/templates/racon-inspired-home";
import type { EmpresaSiteModel } from "@/lib/tenant/site-model";

type Props = {
  branding: EmpresaBranding;
  siteModel: EmpresaSiteModel;
  showModuloIndisponivel?: boolean;
};

/**
 * Home institucional de alta conversão para tenants e franquias
 * utilizando a experiência visual Racon Inspired.
 */
export function InstitutionalTenantHome({ branding, siteModel, showModuloIndisponivel }: Props) {
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
        telefoneContato={branding.telefone || "(41) 3000-0000"}
        whatsappContato={branding.whatsapp || "(41) 99999-9999"}
        showChrome={false}
      />
    </div>
  );
}


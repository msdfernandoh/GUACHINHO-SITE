import type { EmpresaBranding } from "@/lib/tenant/branding";
import { RaconInspiredHome } from "@/components/public/templates/racon-inspired-home";

type Props = {
  branding: EmpresaBranding;
  showModuloIndisponivel?: boolean;
};

/**
 * Home institucional de alta conversão para tenants e franquias
 * utilizando a experiência visual Racon Inspired.
 */
export function InstitutionalTenantHome({ branding, showModuloIndisponivel }: Props) {
  return (
    <div>
      {showModuloIndisponivel && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-center text-xs font-bold text-amber-900">
          Este módulo ainda não está disponível neste site institucional.
        </div>
      )}
      <RaconInspiredHome
        empresaNome={branding.nome_site}
        logoUrl={branding.logo_url}
        identidade={{
          cor_primaria: branding.cor_primaria || "#0066cc",
          cor_secundaria: branding.cor_secundaria || "#0c2340",
          cor_destaque: branding.cor_destaque || "#ffb800",
          cor_fundo: "#ffffff",
          cor_texto: "#0f172a",
        }}
        telefoneContato={branding.telefone || "(41) 3000-0000"}
        whatsappContato={branding.whatsapp || "(41) 99999-9999"}
      />
    </div>
  );
}


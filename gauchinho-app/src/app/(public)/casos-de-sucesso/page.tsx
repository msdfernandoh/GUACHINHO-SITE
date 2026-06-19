import { permanentRedirect } from "next/navigation";

/** Casos de sucesso ficam na página unificada de depoimentos. */
export default function CasosDeSucessoRedirectPage() {
  permanentRedirect("/depoimentos#casos-de-sucesso");
}

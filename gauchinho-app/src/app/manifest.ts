import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return { name: "Gauchinho Parceiros", short_name: "Gauchinho", start_url: "/app-indicador", display: "standalone", background_color: "#09090b", theme_color: "#d4a017", icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }] };
}

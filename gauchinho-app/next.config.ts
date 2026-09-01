import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Garante que as fontes/assets do PDF de proposta sejam incluídos no bundle serverless.
  outputFileTracingIncludes: {
    "/api/**": ["./src/lib/proposta/pdf/fonts/**", "./src/lib/proposta/pdf/assets/**"],
    "/admin/**": ["./src/lib/proposta/pdf/fonts/**", "./src/lib/proposta/pdf/assets/**"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "**.supabase.in",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;

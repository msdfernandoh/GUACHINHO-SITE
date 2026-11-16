import "server-only";
import { getConfigJsonPublic } from "@/server/config";
import { DEFAULT_SPL_PORTFOLIO, normalizarSplConfig, SPL_CONFIG_CHAVE, type SplPortfolioConfig } from "./config";

export async function getSplConfig(): Promise<SplPortfolioConfig> {
  const raw = await getConfigJsonPublic<Partial<SplPortfolioConfig>>(SPL_CONFIG_CHAVE, DEFAULT_SPL_PORTFOLIO);
  return normalizarSplConfig(raw);
}

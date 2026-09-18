import { CadastroParceiroClient } from "@/components/public/parceiros-landing-client";
import { MODELOS_PROGRAMA_PARCEIROS, type ModeloParceiroId } from "@/lib/parceiros/modelos-programa";
export default async function CadastroParceiroPage({ searchParams }: { searchParams: Promise<{ modelo?: string }> }) { const { modelo } = await searchParams; const selecionado = MODELOS_PROGRAMA_PARCEIROS.find((item) => item.id === modelo)?.id ?? "GERADOR_POSSIBILIDADES"; return <CadastroParceiroClient modeloInicial={selecionado as ModeloParceiroId} />; }

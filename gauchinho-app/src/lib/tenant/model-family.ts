type ModelNode = { codigo: string; modelo_origem_id?: string | null };
export type ModelFamily = "racon_inspired" | "gauchinho_default" | null;

/** A cópia herda somente o renderizador; conteúdo e publicação são próprios. */
export async function resolveModelFamily(
  model: ModelNode,
  readOrigin: (id: string) => Promise<ModelNode | null>,
): Promise<ModelFamily> {
  const seen = new Set<string>();
  let current: ModelNode | null = model;
  for (let depth = 0; current && depth < 20; depth++) {
    if (current.codigo === "racon_inspired" || current.codigo === "gauchinho_default") return current.codigo;
    const id = current.modelo_origem_id;
    if (!id || seen.has(id)) return null;
    seen.add(id);
    current = await readOrigin(id);
  }
  return null;
}

export function isRaconModel(model?: { codigo: string; layoutBase?: ModelFamily } | null) {
  return model?.codigo === "racon_inspired" || model?.layoutBase === "racon_inspired";
}

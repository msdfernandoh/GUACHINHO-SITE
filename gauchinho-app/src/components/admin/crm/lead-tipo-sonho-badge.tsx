const LABELS: Record<string, string> = {
  Carro: "Carro",
  Moto: "Moto",
  Casa: "Casa",
  Terreno: "Terreno",
  Frota: "Frota",
};

export function LeadTipoSonhoBadge({ value }: { value: string | null | undefined }) {
  if (!value?.trim()) {
    return <span className="text-zinc-500">—</span>;
  }
  const label = LABELS[value] ?? value;
  return (
    <span className="inline-flex rounded-md bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-100">
      {label}
    </span>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buildSimuladorUrl } from "@/lib/home/build-simulador-url";
import { Button, Input, Label, Select } from "@/components/ui/form-primitives";
import { HomeSection } from "./home-section";

type Props = {
  defaults: {
    prazoImovel: number;
    prazoAutomovel: number;
    valorImovel: number;
    valorAutomovel: number;
  };
};

export function HomeQuickSimulator({ defaults }: Props) {
  const router = useRouter();
  const [tipo, setTipo] = useState<"imovel" | "automovel">("imovel");
  const [valor, setValor] = useState(defaults.valorImovel);
  const [prazo, setPrazo] = useState(defaults.prazoImovel);

  function onTipoChange(next: "imovel" | "automovel") {
    setTipo(next);
    if (next === "imovel") {
      setValor(defaults.valorImovel);
      setPrazo(defaults.prazoImovel);
    } else {
      setValor(defaults.valorAutomovel);
      setPrazo(defaults.prazoAutomovel);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const href = buildSimuladorUrl({
      tipo,
      solucao: "consorcio",
      valor,
      prazo,
      origem: "home_simulador_rapido",
    });
    router.push(href);
  }

  return (
    <HomeSection
      id="simulador-rapido"
      eyebrow="Simule em segundos"
      title="Simulador rápido"
      subtitle="Informe o básico — na página do simulador você refina lance, parcela e comparativo."
      className="bg-zinc-900/30"
    >
      <form
        onSubmit={submit}
        className="mx-auto max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-2xl shadow-black/40 md:p-8"
      >
        <div className="grid gap-5 md:grid-cols-3">
          <div>
            <Label>Tipo de bem</Label>
            <Select
              value={tipo}
              onChange={(e) => onTipoChange(e.target.value as "imovel" | "automovel")}
              className="mt-1 border-zinc-700 bg-zinc-900 text-zinc-100"
            >
              <option value="imovel">Imóvel</option>
              <option value="automovel">Automóvel / moto / utilitário</option>
            </Select>
          </div>
          <div>
            <Label>Valor do crédito (R$)</Label>
            <Input
              type="number"
              min={1000}
              step={1000}
              value={valor}
              onChange={(e) => setValor(Number(e.target.value) || 0)}
              className="mt-1 border-zinc-700 bg-zinc-900 text-zinc-100"
            />
          </div>
          <div>
            <Label>Prazo (meses)</Label>
            <Input
              type="number"
              min={12}
              step={12}
              value={prazo}
              onChange={(e) => setPrazo(Number(e.target.value) || 0)}
              className="mt-1 border-zinc-700 bg-zinc-900 text-zinc-100"
            />
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="submit" variant="gold" className="rounded-full px-8">
            Simular agora
          </Button>
          <Button
            type="button"
            variant="outlineGold"
            className="rounded-full border-zinc-600 bg-zinc-900 text-zinc-100"
            onClick={() =>
              router.push(buildSimuladorUrl({ solucao: "financiamento", valor, prazo }))
            }
          >
            Ver como financiamento
          </Button>
        </div>
      </form>
    </HomeSection>
  );
}

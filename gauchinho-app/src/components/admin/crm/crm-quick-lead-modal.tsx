"use client";

import { useState, useTransition } from "react";
import { createLeadRapidoAction } from "@/app/admin/leads/actions";
import { ORIGENS_LABEL, LEAD_TEMPERATURES, MODELOS_INTERESSE } from "@/lib/crm/constants";
import { X, Sparkles, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/form-primitives";

export function CrmQuickLeadModal({ onClose }: { onClose: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");
  const [origem, setOrigem] = useState("whatsapp");
  const [modeloInteresse, setModeloInteresse] = useState("CLIENTE_FINAL");
  const [produtoInteresse, setProdutoInteresse] = useState("imovel");
  const [valorEstimado, setValorEstimado] = useState("");
  const [valorParcela, setValorParcela] = useState("");
  const [temperatura, setTemperatura] = useState("Quente");
  const [proximaAcao, setProximaAcao] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [expandido, setExpandido] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      setError("Informe o nome ou identificação do lead.");
      return;
    }
    if (!contato.trim()) {
      setError("Informe o WhatsApp, telefone ou e-mail de contato.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        await createLeadRapidoAction({
          nome,
          contato,
          origem,
          modeloInteresse,
          produtoInteresse: expandido ? produtoInteresse : undefined,
          valorEstimado: expandido && valorEstimado ? Number(valorEstimado.replace(/\D/g, "")) : undefined,
          valorCredito: expandido && valorEstimado ? Number(valorEstimado.replace(/\D/g, "")) : undefined,
          valorParcela: expandido && valorParcela ? Number(valorParcela.replace(/\D/g, "")) : undefined,
          temperatura,
          proximaAcao: proximaAcao.trim() || undefined,
          observacoes: observacoes.trim() || undefined,
        });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao cadastrar lead");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <button
          onClick={onClose}
          disabled={isPending}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 text-blue-400">
          <Sparkles className="h-5 w-5" />
          <h2 className="text-lg font-bold text-zinc-100">Entrada Rápida de Lead</h2>
        </div>
        <p className="mt-1 text-xs text-zinc-400">
          Cadastre em segundos. O lead pode entrar incompleto e ser enriquecido depois.
        </p>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-950/30 p-3 text-xs text-red-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Nome */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300">
              Nome ou Identificação <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ex: João Silva ou Contato Feira"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-hidden"
            />
          </div>

          {/* Contato e Origem */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-zinc-300">
                WhatsApp / Tel / E-mail <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="(66) 99999-9999 ou email"
                value={contato}
                onChange={(e) => setContato(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300">Origem</label>
              <select
                value={origem}
                onChange={(e) => setOrigem(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-hidden"
              >
                {Object.entries(ORIGENS_LABEL).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
                <option value="landing_page_parceiros">Landing Page Parceiros</option>
                <option value="network_terca">Network Terça 19h</option>
                <option value="indicacao_parceiro">Indicação de Parceiro</option>
              </select>
            </div>
          </div>

          {/* Temperatura e Modelo de Interesse */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-zinc-300">Temperatura</label>
              <select
                value={temperatura}
                onChange={(e) => setTemperatura(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-hidden"
              >
                {LEAD_TEMPERATURES.map((temp) => (
                  <option key={temp} value={temp}>
                    {temp === "Quente" || temp === "Muito quente" || temp === "Urgente" ? `🔥 ${temp}` : temp}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300">Modelo de Interesse</label>
              <select
                value={modeloInteresse}
                onChange={(e) => setModeloInteresse(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-hidden"
              >
                {MODELOS_INTERESSE.map((mod) => (
                  <option key={mod.codigo} value={mod.codigo}>
                    {mod.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Próxima Ação Imediata */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300">Próxima Ação (Opcional)</label>
            <input
              type="text"
              placeholder="Ex: Ligar hoje às 14h ou Enviar apresentação no WhatsApp"
              value={proximaAcao}
              onChange={(e) => setProximaAcao(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-hidden"
            />
          </div>

          {/* Toggle de Campos Avançados */}
          <button
            type="button"
            onClick={() => setExpandido(!expandido)}
            className="text-xs text-blue-400 hover:underline"
          >
            {expandido ? "- Ocultar campos adicionais" : "+ Adicionar valor de crédito, parcela, produto e observações"}
          </button>

          {expandido && (
            <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400">Produto</label>
                  <select
                    value={produtoInteresse}
                    onChange={(e) => setProdutoInteresse(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200"
                  >
                    <option value="imovel">Imóvel</option>
                    <option value="veiculo">Automóvel / Veículo</option>
                    <option value="pesados">Pesados / Agrícola</option>
                    <option value="servicos">Serviços / Capital</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400">Crédito Pretendido (R$)</label>
                  <input
                    type="number"
                    placeholder="Ex: 500000"
                    value={valorEstimado}
                    onChange={(e) => setValorEstimado(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400">Parcela Mensal (R$)</label>
                  <input
                    type="number"
                    placeholder="Ex: 2500"
                    value={valorParcela}
                    onChange={(e) => setValorParcela(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-400">Observações Iniciais</label>
                <textarea
                  rows={2}
                  placeholder="Anotações sobre o perfil ou contexto do primeiro contato"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500"
                />
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-1.5 bg-blue-600 text-xs font-semibold text-white shadow hover:bg-blue-500"
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isPending ? "Cadastrando..." : "Cadastrar Lead"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import React, { startTransition, useState, useEffect, useRef } from "react";
import {
  Upload,
  Link as LinkIcon,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Layers,
  Eye,
  Trash2,
  RefreshCw,
  FolderOpen,
} from "lucide-react";
import { uploadTemplateMediaPlatformAction } from "@/app/platform/templates-actions";

export type ImageObjectFit = "cover" | "contain";
export type ImageObjectPosition =
  | "center"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "left-top";

export type MediaLibraryItem = {
  id: string;
  url: string;
  nome: string;
  slot_sugerido?: string;
  dimensoes?: string;
  tamanho_bytes?: number;
  data?: string;
};

export type MediaSlotSpec = {
  slotId: string;
  slotLabel: string;
  larguraRecomendada: number;
  alturaRecomendada: number;
  proporcaoRecomendada: string;
  proporcaoRatio: number; // ex: 1920/760 = 2.526
  descricao: string;
  presets?: Array<{ label: string; url: string; nome: string }>;
};

export const SYSTEM_MEDIA_PRESETS: MediaLibraryItem[] = [
  {
    id: "preset-rubinho-hero",
    nome: "Rubinho Conquiste Hero",
    url: "/racon/racon-rubinho-hero.png",
    slot_sugerido: "hero",
    dimensoes: "1920 × 760 px",
  },
  {
    id: "preset-rubinho-apontando",
    nome: "Rubinho Apontando (Stats)",
    url: "/racon/racon-rubinho-apontando.png",
    slot_sugerido: "embaixador_stats",
    dimensoes: "800 × 1000 px",
  },
  {
    id: "preset-rubinho-conquiste",
    nome: "Rubinho Conquiste (Filiais)",
    url: "/racon/racon-rubinho-conquiste.png",
    slot_sugerido: "banner_filiais",
    dimensoes: "1600 × 600 px",
  },
  {
    id: "preset-card-veiculo-racon",
    nome: "Racon Motorista (Veículos)",
    url: "/racon/racon-card-veiculo.png",
    slot_sugerido: "card_veiculos",
    dimensoes: "900 × 650 px",
  },
  {
    id: "preset-card-imovel-racon",
    nome: "Racon Família Casa (Imóveis)",
    url: "/racon/racon-card-imovel.png",
    slot_sugerido: "card_imoveis",
    dimensoes: "900 × 650 px",
  },
  {
    id: "preset-card-patrimonio-racon",
    nome: "Racon Investimento (Patrimônio)",
    url: "/racon/racon-card-patrimonio.png",
    slot_sugerido: "card_patrimonio",
    dimensoes: "900 × 650 px",
  },
  {
    id: "preset-gauchinho-campanha",
    nome: "Gauchinho Campanha Hero",
    url: "/media/gauchinho-campanha.jpeg",
    slot_sugerido: "hero",
    dimensoes: "1920 × 760 px",
  },
  {
    id: "preset-foto-carros",
    nome: "Foto Carros Novos",
    url: "/foto/Carros.png",
    slot_sugerido: "card_veiculos",
    dimensoes: "900 × 650 px",
  },
  {
    id: "preset-foto-casa",
    nome: "Foto Casa de Alto Padrão",
    url: "/foto/Casa.png",
    slot_sugerido: "card_imoveis",
    dimensoes: "900 × 650 px",
  },
  {
    id: "preset-foto-caminhoes",
    nome: "Foto Caminhões e Frota Pesada",
    url: "/foto/Caminhoes-e-Frota.png",
    slot_sugerido: "card_patrimonio",
    dimensoes: "900 × 650 px",
  },
];

export function MediaFieldControl({
  templateId,
  spec,
  imageUrl,
  objectFit = "cover",
  objectPosition = "center",
  onChangeUrl,
  onChangeObjectFit,
  onChangeObjectPosition,
  bibliotecaCustom = [],
  onAddToLibrary,
}: {
  templateId: string;
  spec: MediaSlotSpec;
  imageUrl: string;
  objectFit?: ImageObjectFit;
  objectPosition?: ImageObjectPosition;
  onChangeUrl: (url: string) => void;
  onChangeObjectFit?: (fit: ImageObjectFit) => void;
  onChangeObjectPosition?: (pos: ImageObjectPosition) => void;
  bibliotecaCustom?: MediaLibraryItem[];
  onAddToLibrary?: (item: MediaLibraryItem) => void;
}) {
  const [fonte, setFonte] = useState<"upload" | "url" | "biblioteca">("upload");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [modalBiblioteca, setModalBiblioteca] = useState(false);

  // Detecção de Dimensões Reais da Imagem
  const [dimensoesReais, setDimensoesReais] = useState<{ largura: number; altura: number } | null>(null);
  const [aspectWarning, setAspectWarning] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!imageUrl) {
      setDimensoesReais(null);
      setAspectWarning(null);
      return;
    }

    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      setDimensoesReais({ largura: w, altura: h });

      if (w > 0 && h > 0) {
        const ratio = w / h;
        const targetRatio = spec.proporcaoRatio;
        const diff = Math.abs(ratio - targetRatio) / targetRatio;

        // Se desvio for superior a 20%, gera aviso informativo sem bloqueio
        if (diff > 0.2) {
          setAspectWarning(
            `A imagem possui proporção (${w} × ${h} px) diferente da proporção recomendada (${spec.proporcaoRecomendada}). Ela será recortada suavemente (${objectFit}) para preencher este espaço.`,
          );
        } else {
          setAspectWarning(null);
        }
      }
    };
    img.onerror = () => {
      setDimensoesReais(null);
      setAspectWarning(null);
    };
  }, [imageUrl, spec.proporcaoRatio, spec.proporcaoRecomendada, objectFit]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("template_id", templateId || "global");
    formData.append("slot", spec.slotId);
    formData.append("file", file);

    startTransition(async () => {
      try {
        const res = await uploadTemplateMediaPlatformAction({ status: "IDLE", message: "" }, formData);
        if (res.status === "SUCCESS" && res.data) {
          const data = res.data as { url: string; fileName: string; sizeBytes: number; path: string };
          onChangeUrl(data.url);
          if (onAddToLibrary) {
            onAddToLibrary({
              id: `upload-${Date.now()}`,
              nome: data.fileName,
              url: data.url,
              slot_sugerido: spec.slotId,
              tamanho_bytes: data.sizeBytes,
              data: new Date().toLocaleDateString("pt-BR"),
            });
          }
        } else {
          setUploadError(res.message || "Erro no upload da imagem.");
        }
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Erro na comunicação com o servidor.");
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    });
  };

  const poolBiblioteca = [...bibliotecaCustom, ...SYSTEM_MEDIA_PRESETS];

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/40 space-y-3.5 text-xs">
      {/* Header do Slot */}
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200/80 pb-2.5 dark:border-slate-800">
        <div>
          <span className="font-extrabold text-slate-900 dark:text-white block">{spec.slotLabel}</span>
          <span className="text-[11px] text-slate-500 font-medium">{spec.descricao}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800 dark:bg-sky-950 dark:text-sky-300">
            Recomendado: {spec.larguraRecomendada} × {spec.alturaRecomendada} px ({spec.proporcaoRecomendada})
          </span>
        </div>
      </div>

      {/* Seletor de Origem */}
      <div className="flex items-center gap-4">
        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Fonte da Imagem:</span>
        <label className="flex items-center gap-1.5 cursor-pointer font-semibold">
          <input
            type="radio"
            name={`fonte-${spec.slotId}`}
            checked={fonte === "upload"}
            onChange={() => setFonte("upload")}
            className="text-cyan-600"
          />
          <Upload className="h-3.5 w-3.5 text-slate-500" />
          <span>Upload Storage</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer font-semibold">
          <input
            type="radio"
            name={`fonte-${spec.slotId}`}
            checked={fonte === "url"}
            onChange={() => setFonte("url")}
            className="text-cyan-600"
          />
          <LinkIcon className="h-3.5 w-3.5 text-slate-500" />
          <span>URL Externa</span>
        </label>
        <button
          type="button"
          onClick={() => setModalBiblioteca(true)}
          className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        >
          <FolderOpen className="h-3.5 w-3.5 text-amber-500" />
          <span>Escolher da Biblioteca</span>
        </button>
      </div>

      {/* Input de Upload */}
      {fonte === "upload" && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
              onChange={handleFileUpload}
              className="hidden"
              id={`file-upload-${spec.slotId}`}
            />
            <label
              htmlFor={`file-upload-${spec.slotId}`}
              className={`inline-flex items-center gap-2 rounded-lg bg-cyan-700 px-3.5 py-2 font-bold text-white shadow-xs hover:bg-cyan-800 cursor-pointer ${
                isUploading ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              {isUploading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Enviando para o Storage...</span>
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  <span>Selecionar Arquivo do Computador</span>
                </>
              )}
            </label>
            <span className="text-[11px] text-slate-400">Formatos: JPG, PNG, WEBP, SVG (máx. 10MB)</span>
          </div>

          {uploadError && (
            <p className="rounded bg-rose-50 p-2 text-[11px] font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
              ❌ {uploadError}
            </p>
          )}
        </div>
      )}

      {/* Input de URL Externa */}
      {fonte === "url" && (
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Endereço da Imagem (URL pública):</label>
          <input
            value={imageUrl}
            onChange={(e) => onChangeUrl(e.target.value)}
            placeholder="https://exemplo.com/imagem.png ou /racon/..."
            className="w-full rounded-lg border border-slate-300 p-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
      )}

      {/* Presets Rápidos do Componente */}
      {spec.presets && spec.presets.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Sugestões:</span>
          {spec.presets.map((p) => (
            <button
              key={p.url}
              type="button"
              onClick={() => onChangeUrl(p.url)}
              className={`rounded px-2 py-0.5 text-[10px] font-bold border transition-colors ${
                imageUrl === p.url
                  ? "bg-cyan-50 border-cyan-500 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* Controles de Object-Fit e Posicionamento */}
      <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100 dark:border-slate-800/80">
        <div>
          <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
            Ajuste de Preenchimento (Object-Fit):
          </label>
          <select
            value={objectFit}
            onChange={(e) => onChangeObjectFit && onChangeObjectFit(e.target.value as ImageObjectFit)}
            className="w-full rounded border border-slate-300 p-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="cover">Cobrir Área (Cover — preenche sem bordas)</option>
            <option value="contain">Conter Imagem (Contain — sem cortes)</option>
          </select>
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
            Posição Focal (Object-Position):
          </label>
          <select
            value={objectPosition}
            onChange={(e) => onChangeObjectPosition && onChangeObjectPosition(e.target.value as ImageObjectPosition)}
            className="w-full rounded border border-slate-300 p-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="center">Centro</option>
            <option value="top">Topo (Ideal para cabeças/rostos)</option>
            <option value="bottom">Base</option>
            <option value="left">Esquerda</option>
            <option value="right">Direita</option>
            <option value="top-left">Topo Esquerda</option>
            <option value="top-right">Topo Direita</option>
          </select>
        </div>
      </div>

      {/* Aviso de Proporção Não Bloqueante */}
      {aspectWarning && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-[11px] text-amber-900 border border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
          <span>{aspectWarning}</span>
        </div>
      )}

      {/* Preview Visual Imediato do Slot */}
      <div className="space-y-1 pt-1">
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>Pré-visualização do Enquadramento:</span>
          {dimensoesReais && (
            <span className="font-mono text-[10px] font-semibold text-slate-600 dark:text-slate-400">
              Arquivo: {dimensoesReais.largura} × {dimensoesReais.altura} px
            </span>
          )}
        </div>
        <div
          className="relative w-full rounded-xl overflow-hidden border border-slate-300 bg-slate-900 shadow-inner"
          style={{ height: spec.slotId === "hero" ? "140px" : "110px" }}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={spec.slotLabel}
              style={{
                objectFit,
                objectPosition,
              }}
              className="h-full w-full"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-500 font-semibold italic">
              Nenhuma imagem configurada neste slot.
            </div>
          )}
        </div>
      </div>

      {/* Modal: Biblioteca de Mídia */}
      {modalBiblioteca && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-900 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Biblioteca de Mídia</h3>
                <p className="text-xs text-slate-500">
                  Selecione uma imagem já disponível ou preset oficial para o slot <strong>{spec.slotLabel}</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalBiblioteca(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[380px] overflow-y-auto p-1">
              {poolBiblioteca.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    onChangeUrl(item.url);
                    setModalBiblioteca(false);
                  }}
                  className={`group relative rounded-xl border p-2 cursor-pointer transition-all hover:border-cyan-500 hover:shadow-md ${
                    imageUrl === item.url
                      ? "border-cyan-600 bg-cyan-50/50 dark:bg-cyan-950/40"
                      : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-800"
                  }`}
                >
                  <div className="relative h-24 w-full rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-900 border">
                    <img src={item.url} alt={item.nome} className="h-full w-full object-cover" />
                  </div>
                  <div className="mt-2 space-y-0.5">
                    <span className="font-bold text-slate-800 dark:text-slate-200 block truncate text-[11px]">
                      {item.nome}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      {item.dimensoes || "Asset Mídia"}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setModalBiblioteca(false)}
                className="rounded-lg border px-4 py-2 font-bold text-slate-600 hover:bg-slate-100"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { readFileSync } from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
import { pdfImage } from "@/lib/proposta/pdf/assets";
import { primeiroNomeCliente, rotuloModalidade } from "@/lib/erp/contemplado-mensagem";
import { formatBRL } from "@/lib/formatters/money";

export const runtime = "nodejs";

const NAVY = "#061433";
const CYAN = "#22c3ff";
const OURO = "#ffd24d";

const CONFETES = Array.from({ length: 46 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  const topo = r(2) < 0.55;
  return { x: topo ? r(1) * 1080 : (r(1) < 0.5 ? r(1) * 150 : 930 + r(1) * 140), y: topo ? r(3) * 420 : 1250 + r(3) * 640, w: 10 + r(4) * 18, h: 6 + r(5) * 26, rot: r(6) * 180, cor: [CYAN, OURO, "#ffffff", "#7c5cff", "#ff6fae"][i % 5], o: 0.55 + r(7) * 0.45 };
});

const FONTES = path.join(process.cwd(), "src", "lib", "proposta", "pdf", "fonts");
let fontes: { name: string; data: Buffer; weight: 400 | 500 | 700; style: "normal" }[] | null = null;
function carregarFontes() {
  fontes ??= ([["Archivo-Regular.ttf", 400], ["Archivo-Medium.ttf", 500], ["Archivo-Bold.ttf", 700]] as const)
    .map(([f, weight]) => ({ name: "Archivo", data: readFileSync(path.join(FONTES, f)), weight, style: "normal" as const }));
  return fontes;
}

const txt = (v: string | null, max = 80) => (v ?? "").trim().slice(0, max);
const num = (v: string | null) => { const n = Number(v); return v && Number.isFinite(n) && n > 0 ? n : null; };

export async function GET(request: Request) {
  try { await requireErpRouteAccess("assembleias"); } catch { return new Response("Acesso não autorizado", { status: 403 }); }
  const q = new URL(request.url).searchParams;
  const cliente = txt(q.get("cliente"), 120) || "Cliente";
  const nomeCompleto = cliente.toLowerCase().replace(/(^|\s)\p{L}/gu, (l) => l.toUpperCase());
  const credito = num(q.get("credito"));
  const liquido = num(q.get("liquido"));
  const parcela = num(q.get("parcela"));
  const mod = rotuloModalidade(q.get("modalidade"));
  const data = txt(q.get("data"), 10).split("-").reverse().join("/");
  const logo = pdfImage("racon-gauchinho-logo.png");

  return new ImageResponse(
    (
      <div style={{ width: 1080, height: 1920, display: "flex", flexDirection: "column", alignItems: "center", position: "relative", color: "#fff", fontFamily: "Archivo",
        background: `radial-gradient(circle at 50% 38%, #12408f 0%, #0a2460 38%, ${NAVY} 75%)` }}>
        {CONFETES.map((c, i) => (
          <div key={i} style={{ position: "absolute", left: c.x, top: c.y, width: c.w, height: c.h, background: c.cor, opacity: c.o, borderRadius: 4, transform: `rotate(${c.rot}deg)` }} />
        ))}
        <div style={{ position: "absolute", top: 560, left: 90, width: 900, height: 900, borderRadius: 450, background: "radial-gradient(circle, rgba(34,195,255,0.28) 0%, rgba(34,195,255,0) 70%)" }} />

        <img src={logo} width={440} height={290} style={{ marginTop: 110, objectFit: "contain" }} />

        <div style={{ display: "flex", marginTop: 70, fontSize: 40, letterSpacing: 14, color: CYAN, fontWeight: 700 }}>PARABÉNS</div>
        <div style={{ display: "flex", marginTop: 18, fontSize: primeiroNomeCliente(cliente).length > 10 ? 104 : 128, fontWeight: 700, lineHeight: 1 }}>{primeiroNomeCliente(cliente)}!</div>
        <div style={{ display: "flex", marginTop: 26, fontSize: 46, fontWeight: 500, color: "#dfe9ff" }}>Sua cota foi contemplada!</div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 70, width: 860, padding: "56px 40px", borderRadius: 48,
          background: "linear-gradient(160deg, rgba(255,255,255,0.16), rgba(255,255,255,0.05))", border: `3px solid ${OURO}`, boxShadow: "0 30px 80px rgba(0,0,0,0.35)" }}>
          <div style={{ display: "flex", position: "absolute", top: -34, padding: "12px 36px", borderRadius: 40, background: OURO, color: NAVY, fontSize: 30, fontWeight: 700, letterSpacing: 4 }}>SEU PRESENTE</div>
          <div style={{ display: "flex", fontSize: 32, color: "#c9d8ff", letterSpacing: 3 }}>CRÉDITO CONTEMPLADO</div>
          <div style={{ display: "flex", marginTop: 10, fontSize: credito && credito >= 1e6 ? 104 : 116, fontWeight: 700, color: OURO }}>{credito ? formatBRL(credito) : "—"}</div>
          {liquido ? (
            <div style={{ display: "flex", marginTop: 18, fontSize: 38, color: "#ffffff" }}>
              Crédito líquido&nbsp;<span style={{ fontWeight: 700 }}>{formatBRL(liquido)}</span>
            </div>
          ) : null}
          <div style={{ display: "flex", marginTop: 34, gap: 18 }}>
            {[`Grupo ${txt(q.get("grupo"), 30)}`, `Cota ${txt(q.get("cota"), 12)}`].map((t) => (
              <div key={t} style={{ display: "flex", padding: "14px 30px", borderRadius: 30, background: "rgba(34,195,255,0.18)", border: `2px solid ${CYAN}`, fontSize: 34, fontWeight: 700 }}>{t}</div>
            ))}
          </div>
          {parcela || mod ? (
            <div style={{ display: "flex", marginTop: 30, fontSize: 36, color: "#e8efff" }}>
              {parcela ? `Contemplada na ${parcela}ª parcela` : "Contemplada"}{mod ? ` · ${mod}` : ""}
            </div>
          ) : null}
          {data ? <div style={{ display: "flex", marginTop: 10, fontSize: 28, color: "#9fb4e6" }}>Assembleia de {data}</div> : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 80, width: 860 }}>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 700, textAlign: "center" }}>Seu sonho saiu do papel!</div>
          <div style={{ display: "flex", marginTop: 18, fontSize: 32, color: "#c9d8ff", textAlign: "center", lineHeight: 1.4 }}>
            Disciplina e planejamento trouxeram você até aqui. Agora é transformar esse crédito em conquista.
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "absolute", bottom: 90 }}>
          <div style={{ display: "flex", fontSize: 30, color: "#ffffff", fontWeight: 700 }}>{nomeCompleto}</div>
          <div style={{ display: "flex", marginTop: 14, fontSize: 24, color: "#8ea6d9", letterSpacing: 2 }}>Gauchinho Consórcios · Franqueado Racon</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1920, fonts: carregarFontes(), headers: { "Cache-Control": "private, no-store" } },
  );
}

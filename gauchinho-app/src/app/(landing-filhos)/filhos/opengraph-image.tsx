import { ImageResponse } from "next/og";

export const alt = "A herança que você vive junto — com R$ 375 por mês, de R$ 317 mil a R$ 599 mil para o seu filho";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GOLD = "#ffc861";
const SUN = "#ff9f43";

/** Fraunces 700 (TTF) do Google Fonts; sem rede, o card sai com a fonte padrão. */
async function fonte(familia: string, peso: number, italico = false): Promise<ArrayBuffer | null> {
  try {
    const eixo = italico ? `ital,wght@1,${peso}` : `wght@${peso}`;
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${familia}:${eixo}&display=swap`)).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    const res = await fetch(url);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export default async function Image() {
  const [serif, serifIt, sans] = await Promise.all([fonte("Fraunces", 700), fonte("Fraunces", 700, true), fonte("Inter", 800)]);
  const fonts = [
    serif && { name: "Fraunces", data: serif, weight: 700 as const, style: "normal" as const },
    serifIt && { name: "Fraunces", data: serifIt, weight: 700 as const, style: "italic" as const },
    sans && { name: "Inter", data: sans, weight: 800 as const, style: "normal" as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 700 | 800; style: "normal" | "italic" }[];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "52px 64px 44px",
          color: "#fff",
          fontFamily: "Inter, sans-serif",
          background:
            "radial-gradient(circle at 78% 115%, rgba(255,159,67,0.85), rgba(255,200,97,0.25) 35%, transparent 60%), linear-gradient(180deg, #061230 0%, #0b2a63 55%, #3a2b5c 85%, #6b3a4e 100%)",
        }}
      >
        <div style={{ display: "flex", fontSize: 22, letterSpacing: 5, color: GOLD, fontWeight: 800 }}>MÉTODO HERANÇA INTELIGENTE</div>

        <div style={{ display: "flex", gap: 40, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1.2 }}>
            <div style={{ display: "flex", flexDirection: "column", fontFamily: "Fraunces, serif", fontSize: 78, lineHeight: 1.02, fontWeight: 700 }}>
              <span>A herança que</span>
              <span style={{ color: GOLD, fontStyle: "italic" }}>você vive junto.</span>
            </div>
            <div style={{ display: "flex", marginTop: 22, fontSize: 28, color: "#e3e8ff", lineHeight: 1.3 }}>
              E se você estivesse lá no dia em que seu filho recebe a chave?
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              flex: 0.8,
              padding: "26px 24px",
              borderRadius: 28,
              border: "2px solid rgba(255,255,255,0.25)",
              background: "rgba(255,255,255,0.1)",
            }}
          >
            <span style={{ display: "flex", fontSize: 24, color: "#c9d1f2" }}>Hoje</span>
            <span style={{ display: "flex", fontSize: 50, fontWeight: 800 }}>R$ 375/mês</span>
            <span style={{ display: "flex", fontSize: 24, color: GOLD, margin: "10px 0 4px", fontWeight: 800 }}>vira ↓</span>
            <span style={{ display: "flex", fontFamily: "Fraunces, serif", fontSize: 52, color: GOLD, fontWeight: 700 }}>até R$ 599 mil</span>
            <span style={{ display: "flex", fontSize: 20, color: "#e3e8ff", marginTop: 4 }}>para o futuro do seu filho</span>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 22, color: "#c9d1f2" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ display: "flex", fontSize: 28, fontWeight: 800, color: "#fff" }}>Racon Consórcios</span>
            <div style={{ width: 3, height: 30, background: "#12b5f5" }} />
            <span style={{ display: "flex", fontSize: 20, letterSpacing: 3, color: "#12b5f5", fontWeight: 800 }}>FRANQUEADO</span>
            <span style={{ display: "flex", fontSize: 26, fontWeight: 800, color: "#fff" }}>GAUCHINHO</span>
          </div>
          <div style={{ display: "flex", padding: "12px 24px", borderRadius: 999, background: `linear-gradient(135deg, ${GOLD}, ${SUN})`, color: "#2a1600", fontWeight: 800 }}>
            Encontro gratuito →
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined },
  );
}

import { ImageResponse } from "next/og";

export const alt = "Quanto o seu dólar compra no Brasil? Simule em 30 segundos — Racon Consórcios";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const NAVY = "#0a3161";
const INK = "#04112b";
const YELLOW = "#ffdf00";
const USD = "#9ec5ff";
const CYAN = "#12b5f5";

function FlagUS({ w = 54 }: { w?: number }) {
  const h = Math.round(w * 0.66);
  const stripe = h / 7;
  return (
    <div style={{ display: "flex", position: "relative", width: w, height: h, borderRadius: 6, overflow: "hidden", background: "#fff" }}>
      {[0, 2, 4, 6].map((i) => (
        <div key={i} style={{ position: "absolute", left: 0, top: i * stripe, width: w, height: stripe, background: "#b31942" }} />
      ))}
      <div style={{ position: "absolute", left: 0, top: 0, width: w * 0.42, height: stripe * 4, background: NAVY }} />
    </div>
  );
}

function FlagBR({ w = 54 }: { w?: number }) {
  const h = Math.round(w * 0.7);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: w, height: h, borderRadius: 6, background: "#009c3b" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: h * 0.82, height: h * 0.82, background: YELLOW, transform: "rotate(45deg) scaleX(1.3)" }}>
        <div style={{ width: h * 0.42, height: h * 0.42, borderRadius: 999, background: "#002776" }} />
      </div>
    </div>
  );
}

/** Inter 800 (TTF) do Google Fonts; sem rede, o card sai com a fonte padrão. */
async function fonteNegrito(): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch("https://fonts.googleapis.com/css2?family=Inter:wght@800&display=swap")).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    const res = await fetch(url);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export default async function Image() {
  const negrito = await fonteNegrito();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: `radial-gradient(circle at 92% 0%, rgba(0,156,59,0.45), transparent 45%), linear-gradient(180deg, ${NAVY} 0%, ${INK} 100%)`,
          color: "#fff",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <div style={{ display: "flex", height: 14, width: "100%" }}>
          <div style={{ flex: 22, background: NAVY }} />
          <div style={{ flex: 6, background: "#b31942" }} />
          <div style={{ flex: 4, background: "#fff" }} />
          <div style={{ flex: 18, background: "#b31942" }} />
          <div style={{ flex: 22, background: "#009c3b" }} />
          <div style={{ flex: 16, background: YELLOW }} />
          <div style={{ flex: 12, background: "#002776" }} />
        </div>

        <div style={{ display: "flex", flex: 1, padding: "46px 64px 40px", gap: 48 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1.15 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, fontWeight: 700, color: USD }}>
              <FlagUS w={46} />
              <span style={{ display: "flex" }}>→</span>
              <FlagBR w={46} />
              <span style={{ display: "flex", marginLeft: 6 }}>Para brasileiros nos EUA</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 26, fontSize: 70, fontWeight: 900, lineHeight: 1.04, letterSpacing: -2 }}>
              <span>Quanto o seu</span>
              <span style={{ color: YELLOW }}>dólar compra</span>
              <span>no Brasil?</span>
            </div>
            <div style={{ display: "flex", marginTop: 26, fontSize: 28, color: "#cfd6ff", lineHeight: 1.3 }}>
              Casa, carro ou aposentadoria em imóveis — sem juros e 100% online.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 0.85,
              alignSelf: "center",
              padding: 30,
              borderRadius: 28,
              border: "2px solid rgba(255,255,255,0.22)",
              background: "rgba(255,255,255,0.08)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", borderRadius: 18, background: "rgba(0,0,0,0.3)", borderLeft: "8px solid #b31942" }}>
              <FlagUS w={44} />
              <span style={{ display: "flex", fontSize: 46, fontWeight: 900 }}>US$ 300</span>
              <span style={{ display: "flex", fontSize: 22, color: USD, marginLeft: "auto" }}>/mês</span>
            </div>
            <div style={{ display: "flex", justifyContent: "center", margin: "12px 0", fontSize: 26, color: CYAN, fontWeight: 700 }}>vira ↓</div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", borderRadius: 18, background: "rgba(0,0,0,0.3)", borderLeft: "8px solid #009c3b" }}>
              <FlagBR w={44} />
              <span style={{ display: "flex", fontSize: 46, fontWeight: 900, color: YELLOW }}>R$</span>
              <div style={{ display: "flex", gap: 8 }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ width: 34, height: 44, borderRadius: 8, background: "rgba(255,223,0,0.85)" }} />
                ))}
              </div>
              <span style={{ display: "flex", fontSize: 40, fontWeight: 900, color: YELLOW }}>mil?</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginTop: 22,
                padding: "16px 0",
                borderRadius: 16,
                background: YELLOW,
                color: "#1b1600",
                fontSize: 28,
                fontWeight: 900,
              }}
            >
              Descubra em 30 segundos →
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 64px 34px", fontSize: 24, color: "#a9b6dc" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <span style={{ display: "flex", fontSize: 30, fontWeight: 900, color: "#fff" }}>Racon Consórcios</span>
            <div style={{ width: 3, height: 34, background: CYAN }} />
            <span style={{ display: "flex", fontSize: 22, letterSpacing: 3, color: CYAN, fontWeight: 800 }}>FRANQUEADO</span>
            <span style={{ display: "flex", fontSize: 28, fontWeight: 900, color: "#fff" }}>GAUCHINHO</span>
          </div>
          <span style={{ display: "flex" }}>Grupo Randon · desde 1949</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: negrito ? [{ name: "Inter", data: negrito, weight: 800, style: "normal" }] : undefined,
    },
  );
}

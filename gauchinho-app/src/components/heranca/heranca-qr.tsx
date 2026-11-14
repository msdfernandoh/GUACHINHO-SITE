"use client";

import { useRef, useState } from "react";
import QRCode from "react-qr-code";
import s from "./heranca.module.css";

/** QR da inscrição com download em PNG/SVG e cópia do link. */
export function HerancaQr({ url }: { url: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [copiado, setCopiado] = useState(false);

  function svgTexto() {
    const svg = box.current?.querySelector("svg");
    if (!svg) return null;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    return new XMLSerializer().serializeToString(clone);
  }

  function baixar(nome: string, href: string) {
    const a = document.createElement("a");
    a.href = href;
    a.download = nome;
    a.click();
  }

  function baixarSvg() {
    const txt = svgTexto();
    if (txt) baixar("qr-heranca-inteligente.svg", `data:image/svg+xml;charset=utf-8,${encodeURIComponent(txt)}`);
  }

  function baixarPng() {
    const txt = svgTexto();
    if (!txt) return;
    const img = new Image();
    img.onload = () => {
      const lado = 1200;
      const borda = 80;
      const canvas = document.createElement("canvas");
      canvas.width = lado;
      canvas.height = lado;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, lado, lado);
      ctx.drawImage(img, borda, borda, lado - borda * 2, lado - borda * 2);
      baixar("qr-heranca-inteligente.png", canvas.toDataURL("image/png"));
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(txt)}`;
  }

  return (
    <>
      <div className={s.qrBox} ref={box}>
        <QRCode value={url} size={512} level="M" fgColor="#12193a" bgColor="#ffffff" style={{ width: "100%", height: "auto" }} />
      </div>
      <div className={s.qrUrl}>{url.replace(/^https?:\/\//, "")}</div>
      <div className={s.qrAcoes}>
        <button type="button" className={`${s.btn} ${s.btnInk}`} onClick={baixarPng}>
          Baixar PNG
        </button>
        <button type="button" className={`${s.btn} ${s.btnGhost}`} style={{ color: "#12193a", borderColor: "#12193a" }} onClick={baixarSvg}>
          Baixar SVG
        </button>
        <button
          type="button"
          className={`${s.btn} ${s.btnGold}`}
          onClick={() => navigator.clipboard?.writeText(url).then(() => setCopiado(true))}
        >
          {copiado ? "Link copiado ✓" : "Copiar link"}
        </button>
        <button type="button" className={`${s.btn} ${s.btnGhost}`} style={{ color: "#12193a", borderColor: "#12193a" }} onClick={() => window.print()}>
          Imprimir
        </button>
      </div>
    </>
  );
}

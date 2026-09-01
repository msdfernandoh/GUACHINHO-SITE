import "server-only";
import { Font } from "@react-pdf/renderer";
import { pdfFont } from "./assets";

export const FONT_DISPLAY = "Archivo";
export const FONT_MONO = "Roboto Mono";

let registered = false;

/** Registra Archivo (display) + IBM Plex Mono (dados/rótulos) uma única vez por processo. */
export function ensureFonts(): void {
  if (registered) return;
  registered = true;

  Font.register({
    family: FONT_DISPLAY,
    fonts: [
      { src: pdfFont("Archivo-Regular.ttf"), fontWeight: 400 },
      { src: pdfFont("Archivo-Medium.ttf"), fontWeight: 500 },
      { src: pdfFont("Archivo-Bold.ttf"), fontWeight: 700 },
      { src: pdfFont("Archivo-BoldItalic.ttf"), fontWeight: 700, fontStyle: "italic" },
    ],
  });

  Font.register({
    family: FONT_MONO,
    fonts: [
      { src: pdfFont("RobotoMono-Regular.ttf"), fontWeight: 400 },
      { src: pdfFont("RobotoMono-Medium.ttf"), fontWeight: 500 },
    ],
  });

  // Não hifenizar quebras de palavra no PDF.
  Font.registerHyphenationCallback((word) => [word]);
}

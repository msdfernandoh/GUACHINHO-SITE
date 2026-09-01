import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";

const ASSET_DIR = path.join(process.cwd(), "src", "lib", "proposta", "pdf", "assets");
const FONT_DIR = path.join(process.cwd(), "src", "lib", "proposta", "pdf", "fonts");

const cache = new Map<string, string>();

function toDataUri(file: string, dir: string, mime: string): string {
  const key = `${dir}/${file}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const buf = readFileSync(path.join(dir, file));
  const uri = `data:${mime};base64,${buf.toString("base64")}`;
  cache.set(key, uri);
  return uri;
}

/** Imagem embutida como data URI (PNG/JPEG) para uso no <Image> do react-pdf. */
export function pdfImage(
  name:
    | "racon-logo.png"
    | "rubinho.png"
    | "cena-casa.jpg"
    | "grad-campanha.png"
    | "grad-padrao.png",
): string {
  const mime = name.endsWith(".jpg") ? "image/jpeg" : "image/png";
  return toDataUri(name, ASSET_DIR, mime);
}

/** Fonte .ttf embutida como data URI para Font.register do react-pdf. */
export function pdfFont(name: string): string {
  return toDataUri(name, FONT_DIR, "font/ttf");
}

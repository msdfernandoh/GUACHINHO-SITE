/**
 * Gera o convite 9:16 do Encontro Método Herança Inteligente (PDF + PNG).
 * Uso (na pasta gauchinho-app):
 *   node scripts/gerar-convite-heranca.mjs "<data>" "<local>" "<selo de vagas>"
 *   (os textos aceitam <b>negrito</b>)
 *   CONVITE_MODELO=familia node scripts/gerar-convite-heranca.mjs ...  → modelo família, sem valores
 * Modelo: docs/convites/convite-heranca-inteligente.html
 */
import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright-core";
import qrcode from "qrcode-generator";

const DOCS = new URL("../../docs/convites/", import.meta.url);
const MODELO = process.env.CONVITE_MODELO === "familia" ? "convite-heranca-familia" : "convite-heranca-inteligente";
const LINK = "https://filhos.raconsinop.com.br/evento?utm_source=convite";
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";

const qr = qrcode(0, "M");
qr.addData(LINK);
qr.make();
const svgQr = qr.createSvgTag({ cellSize: 8, margin: 0, scalable: true }).replace(/fill="black"/g, 'fill="#12193a"');
const icone = "data:image/svg+xml;base64," + (await readFile(new URL("../public/foto/ICONE.svg", import.meta.url))).toString("base64");
const data = process.argv[2] || "Data confirmada na sua inscrição";
const local = process.argv[3] || "Endereço enviado na confirmação";
const vagas = process.argv[4] || "VAGAS LIMITADAS";

const html = (await readFile(new URL(`${MODELO}.html`, DOCS), "utf8"))
  .replaceAll("{{QR}}", svgQr)
  .replaceAll("{{ICONE}}", icone)
  .replaceAll("{{LINK}}", LINK)
  .replaceAll("{{LINK_TXT}}", "filhos.raconsinop.com.br/evento")
  .replaceAll("{{DATA}}", data)
  .replaceAll("{{LOCAL}}", local)
  .replaceAll("{{VAGAS}}", vagas);

const tmp = join(await mkdtemp(join(tmpdir(), "convite-")), "convite.html");
await writeFile(tmp, html);

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto(pathToFileURL(tmp).href, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
const altura = await page.evaluate(() => Math.round(document.querySelector(".assinatura").getBoundingClientRect().bottom));
if (altura > 1920) console.warn(`Atenção: conteúdo com ${altura}px (limite 1920px).`);
await page.pdf({ path: fileURLToPath(new URL(`${MODELO}.pdf`, DOCS)), width: "1080px", height: "1920px", printBackground: true, pageRanges: "1" });
await page.screenshot({ path: fileURLToPath(new URL(`${MODELO}.png`, DOCS)) });
await browser.close();
console.log(`Convite ${MODELO} gerado (${altura}px de conteúdo) em docs/convites/.`);

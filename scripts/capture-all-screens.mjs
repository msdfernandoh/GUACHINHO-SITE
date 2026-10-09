import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const BASE_URL = process.env.BASE_URL || "https://raconsinop.com.br";
const OUTPUT_DIR = path.resolve("docs/screenshots");

const ROUTES = [
  { name: "01_home_publica", path: "/", category: "site-publico" },
  { name: "02_simulador_consorcio", path: "/simulador", category: "site-publico" },
  { name: "03_grupos_e_cotas", path: "/grupos", category: "site-publico" },
  { name: "04_oportunidades_imobiliarias", path: "/oportunidades-imobiliarias", category: "site-publico" },
  { name: "05_cartas_contempladas", path: "/cartas-contempladas", category: "site-publico" },
  { name: "06_calculadoras_financeiras", path: "/calculadoras", category: "site-publico" },
  { name: "07_eventos", path: "/eventos", category: "site-publico" },
  { name: "08_dicas_racon_blog", path: "/dicas-do-tche", category: "site-publico" },
  { name: "09_seja_parceiro_landing", path: "/parceiros", category: "portais-parceiros" },
  { name: "10_cadastro_parceiro", path: "/parceiros/cadastro", category: "portais-parceiros" },
  { name: "11_login_erp_admin", path: "/login", category: "autenticacao" },
  { name: "12_app_indicador_login", path: "/app-indicador/login", category: "app-indicador" },
  { name: "13_recuperacao_senha", path: "/esqueci-senha", category: "autenticacao" },
];

async function run() {
  console.log(`Iniciando captura automatizada de telas em segundo plano (Headless)...`);
  console.log(`URL Base: ${BASE_URL}`);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({
    channel: "chrome",
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
  });

  const page = await context.newPage();

  for (const route of ROUTES) {
    const targetUrl = `${BASE_URL}${route.path}`;
    const categoryDir = path.join(OUTPUT_DIR, route.category);
    if (!fs.existsSync(categoryDir)) {
      fs.mkdirSync(categoryDir, { recursive: true });
    }

    const filePath = path.join(categoryDir, `${route.name}.png`);
    console.log(`Capturando [${route.category}] ${route.name} (${targetUrl})...`);

    try {
      await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 30000 });
      // Pequena espera para animacoes estabilizarem
      await page.waitForTimeout(1500);
      await page.screenshot({ path: filePath, fullPage: false });
      console.log(`✓ Salvo em: ${filePath}`);
    } catch (err) {
      console.warn(`! Erro ao capturar ${targetUrl}: ${err.message}`);
      try {
        await page.screenshot({ path: filePath, fullPage: false });
        console.log(`✓ Salvo com fallback em: ${filePath}`);
      } catch (e) {
        console.error(`X Falha final: ${e.message}`);
      }
    }
  }

  await browser.close();
  console.log(`\nCapturas concluídas com sucesso em: ${OUTPUT_DIR}`);
}

run().catch((err) => {
  console.error("Erro fatal na captura:", err);
  process.exit(1);
});

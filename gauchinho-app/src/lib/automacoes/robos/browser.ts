/**
 * Gerenciador de Instancias do Navegador Playwright para Robos do Gauchinho Site.
 */

import type { Browser, BrowserContext, Page } from 'playwright-core'
import path from 'path'
import fs from 'fs'
import os from 'os'

export type ManagedBrowserSession = {
  browser: Browser
  context: BrowserContext
  page: Page
  downloadDir: string
  close: () => Promise<void>
}

async function getPlaywrightChromium() {
  try {
    const pw = await import('playwright-core')
    return pw.chromium || (pw as any).default?.chromium
  } catch (err: any) {
    throw new Error(`FALHA_CARREGAMENTO_PLAYWRIGHT: ${err?.message || String(err)}`)
  }
}

export async function launchRoboBrowser(options?: {
  headless?: boolean
  extraArgs?: string[]
}): Promise<Browser> {
  const remoteEndpoint = process.env.PLAYWRIGHT_WS_ENDPOINT || process.env.BROWSERLESS_URL
  const chromium = await getPlaywrightChromium()

  if (remoteEndpoint) {
    try {
      return await chromium.connectOverCDP(remoteEndpoint)
    } catch (e: any) {
      console.warn('[Browser] Falha ao conectar em endpoint remoto CDP:', e?.message)
      throw e
    }
  }

  return await chromium.launch({
    headless: options?.headless ?? true,
    channel: process.platform === 'win32' ? 'chrome' : undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      ...(options?.extraArgs || []),
    ],
  })
}

export async function createManagedBrowserSession(options?: {
  headless?: boolean
  customDownloadDir?: string
}): Promise<ManagedBrowserSession> {
  const downloadDir =
    options?.customDownloadDir ||
    fs.mkdtempSync(path.join(os.tmpdir(), 'gauchinho-robo-dl-'))

  const browser = await launchRoboBrowser({
    headless: options?.headless ?? true,
  })

  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 900 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  })

  const page = await context.newPage()
  page.setDefaultTimeout(45_000)
  page.setDefaultNavigationTimeout(45_000)

  const close = async () => {
    try {
      if (!page.isClosed()) await page.close().catch(() => {})
      await context.close().catch(() => {})
      await browser.close().catch(() => {})
    } finally {
      if (!options?.customDownloadDir && fs.existsSync(downloadDir)) {
        try {
          fs.rmSync(downloadDir, { recursive: true, force: true })
        } catch (e) {
          console.warn('[BrowserSession] Falha ao limpar downloadDir temporario:', e)
        }
      }
    }
  }

  return {
    browser,
    context,
    page,
    downloadDir,
    close,
  }
}

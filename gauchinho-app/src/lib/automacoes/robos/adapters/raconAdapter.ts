import type { Page } from 'playwright-core'
import { GenericConsorcioAdapter } from './genericConsorcioAdapter'
import type { PortalCredentials, ResultadoAuth } from '../types'

export class RaconAdapter extends GenericConsorcioAdapter {
  constructor() {
    super('RACON', 'Racon Consórcios')
  }

  override async login(
    page: Page,
    creds: PortalCredentials,
    siteUrl?: string,
    loginUrl?: string
  ): Promise<ResultadoAuth> {
    const targetUrl = loginUrl || siteUrl || 'https://admin.gauchinhoconsorcios.com.br/'

    try {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded' })

      // Tenta seletores conhecidos de portais parceiros Racon / Gauchinho
      const userSel = 'input[type="email"], input[name="login"], input[name="email"], #email, #usuario'
      const passSel = 'input[type="password"], #senha, #password'

      const userField = page.locator(userSel).first()
      const passField = page.locator(passSel).first()

      if (await userField.isVisible().catch(() => false) && await passField.isVisible().catch(() => false)) {
        await userField.fill(creds.usuario)
        await passField.fill(creds.senha)

        const submitBtn = page.locator('button[type="submit"], input[type="submit"]').first()
        if (await submitBtn.isVisible().catch(() => false)) {
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15_000 }).catch(() => {}),
            submitBtn.click(),
          ])
        } else {
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15_000 }).catch(() => {}),
            passField.press('Enter'),
          ])
        }

        return { ok: true }
      }

      // Fallback para o adaptador genérico
      return super.login(page, creds, siteUrl, loginUrl)
    } catch (err: any) {
      return { ok: false, erro: err?.message || 'Falha ao autenticar no portal Racon' }
    }
  }
}

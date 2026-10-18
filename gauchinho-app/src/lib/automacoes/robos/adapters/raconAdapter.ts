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
    const targetUrl = loginUrl || siteUrl || 'https://e.randonconsorcios.com.br/'

    try {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 })
      await page.waitForTimeout(2000)

      // 1. Tratamento da autenticação Microsoft Online SSO
      if (page.url().includes('login.microsoftonline.com')) {
        // Se houver seletor de conta
        const accountTile = page.locator(`div:has-text("${creds.usuario}"), div:has-text("ERONI BOLFE")`).first()
        if (await accountTile.isVisible({ timeout: 2500 }).catch(() => false)) {
          await accountTile.click()
          await page.waitForTimeout(2000)
        }

        // Email
        const emailInput = page.locator('input[name="loginfmt"], #i0116, input[type="email"]').first()
        if (await emailInput.isVisible({ timeout: 15_000 }).catch(() => false)) {
          await emailInput.click()
          await emailInput.fill(creds.usuario.trim())
          await page.waitForTimeout(600)
          const nextBtn = page.locator('#idSIButton9, input[type="submit"], button:has-text("Avançar"), button:has-text("Next")').first()
          await nextBtn.click()
          await page.waitForTimeout(2500)
        }

        // Senha
        const passInput = page.locator('input[name="passwd"], #i0118, input[type="password"]').first()
        await passInput.waitFor({ state: 'visible', timeout: 30_000 })
        await page.waitForTimeout(1000)
        await passInput.click({ delay: 100 })
        await passInput.fill(creds.senha)
        const val = await passInput.inputValue().catch(() => '')
        if (!val) {
          await passInput.pressSequentially(creds.senha, { delay: 60 })
        }
        await page.waitForTimeout(1000)

        const signBtn = page.locator('#idSIButton9, input[type="submit"], button:has-text("Entrar"), button:has-text("Sign in")').first()
        await signBtn.click()
        await page.waitForTimeout(3500)

        const passError = page.locator('#passwordError, #passwordError:has-text("incorret"), span:has-text("Sua conta ou senha")').first()
        if (await passError.isVisible({ timeout: 2000 }).catch(() => false)) {
          const errMsg = await passError.innerText().catch(() => 'Senha incorreta no portal Microsoft.')
          return { ok: false, erro: errMsg }
        }

        // Continuar conectado
        const staySignedBtn = page.locator('#idSIButton9, input[value="Sim"], button:has-text("Sim"), button:has-text("Yes")').first()
        if (await staySignedBtn.isVisible({ timeout: 6000 }).catch(() => false)) {
          await staySignedBtn.click()
          await page.waitForTimeout(2000)
        }
      }

      // Aguarda chegada no portal Randon ou Newcon
      await page.waitForURL(url => url.hostname.includes('randonconsorcios.com.br'), { timeout: 30_000 })

      // Se estiver no dashboard, acessa o NEWCON
      const newconCard = page.locator('div:has-text("NEWCON"):has-text("Consultar serviços"), a:has-text("Acessar"), div:has-text("NEWCON") a').first()
      if (await newconCard.isVisible({ timeout: 8000 }).catch(() => false)) {
        await newconCard.click()
        await page.waitForTimeout(3000)
      }

      // Se houver tela de permissões
      const acceptBtn = page.locator('#idBtn_Accept, button:has-text("Aceitar"), input[value="Aceitar"]').first()
      if (await acceptBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await acceptBtn.click()
        await page.waitForTimeout(3000)
      }

      return { ok: true }
    } catch (err: any) {
      return { ok: false, erro: err?.message || 'Falha ao autenticar no portal Racon / Newcon' }
    }
  }
}

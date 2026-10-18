import type { Page } from 'playwright-core'
import type { PortalCredentials, ResultadoAuth, PortalTipo } from './types'

export interface IPortalAdapter {
  readonly portalTipo: PortalTipo
  readonly nome: string

  login(page: Page, creds: PortalCredentials, siteUrl?: string, loginUrl?: string): Promise<ResultadoAuth>
  executarTarefas?(
    page: Page,
    tarefasConfig: Record<string, unknown>,
    downloadDir: string,
    onLog?: (msg: string) => void
  ): Promise<{ ok: boolean; resultados?: unknown; erro?: string }>
}

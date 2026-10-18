import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUsuarioNegocio } from '@/lib/auth/get-usuario'
import { isMaster } from '@/lib/auth/permissions'
import { isPlatformSuperadmin } from '@/lib/auth/is-superadmin'
import { testarConfiguracaoRobo } from '@/lib/automacoes/robos/roboConfigService'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function verificarPermissao(): Promise<boolean> {
  try {
    const usuario = await getUsuarioNegocio()
    if (usuario && (isMaster(usuario.perfil) || usuario.perfil === 'srd')) return true
    return await isPlatformSuperadmin()
  } catch {
    return false
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await verificarPermissao())) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    const { id } = await params
    const admin = createAdminClient()
    const res = await testarConfiguracaoRobo(admin, id, { testarLoginReal: true })

    return NextResponse.json(res)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao testar robô' }, { status: 500 })
  }
}

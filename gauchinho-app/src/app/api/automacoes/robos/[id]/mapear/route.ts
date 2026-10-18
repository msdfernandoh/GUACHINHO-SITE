import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUsuarioNegocio } from '@/lib/auth/get-usuario'
import { isMaster } from '@/lib/auth/permissions'
import { isPlatformSuperadmin } from '@/lib/auth/is-superadmin'
import {
  prepararMapeamentoPortal,
  executarMapeamentoPortal,
  obterUltimoMapeamentoPortal,
} from '@/lib/automacoes/robos/roboMapeamentoService'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function verificarPermissao(): Promise<{ autorizado: boolean; userId?: string }> {
  try {
    const usuario = await getUsuarioNegocio()
    if (usuario && (isMaster(usuario.perfil) || usuario.perfil === 'srd')) {
      return { autorizado: true, userId: usuario.id }
    }
    const superadmin = await isPlatformSuperadmin()
    if (superadmin) return { autorizado: true, userId: usuario?.id }
  } catch {}
  return { autorizado: false }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const perm = await verificarPermissao()
    if (!perm.autorizado) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    const { id } = await params
    const admin = createAdminClient()
    const ultimo = await obterUltimoMapeamentoPortal(admin, id)

    return NextResponse.json({ ok: true, ultimo_mapeamento: ultimo })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao consultar mapeamento' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const perm = await verificarPermissao()
    if (!perm.autorizado) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    const { id } = await params
    const admin = createAdminClient()
    const body = await req.json().catch(() => ({}))
    const acao = body?.acao || 'executar'

    if (acao === 'executar') {
      const res = await executarMapeamentoPortal(admin, { roboConfigId: id, usuarioId: perm.userId })
      return NextResponse.json(res)
    }

    const res = await prepararMapeamentoPortal(admin, { roboConfigId: id, usuarioId: perm.userId })
    return NextResponse.json(res)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao processar mapeamento' }, { status: 500 })
  }
}

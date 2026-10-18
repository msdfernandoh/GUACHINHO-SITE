import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUsuarioNegocio } from '@/lib/auth/get-usuario'
import { isMaster } from '@/lib/auth/permissions'
import { isPlatformSuperadmin } from '@/lib/auth/is-superadmin'
import {
  listarRobosConfig,
  salvarRoboConfig,
  calcularResumoExecucoesDia,
} from '@/lib/automacoes/robos/roboConfigService'
import { SalvarRoboConfigInput } from '@/lib/automacoes/robos/types'

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

export async function GET(req: NextRequest) {
  try {
    const perm = await verificarPermissao()
    if (!perm.autorizado) {
      return NextResponse.json({ error: 'Acesso restrito ao Painel Master / Superadmin' }, { status: 403 })
    }

    const admin = createAdminClient()
    const configs = await listarRobosConfig(admin)
    const resumoDia = calcularResumoExecucoesDia(configs)

    return NextResponse.json({ ok: true, robos: configs, resumo_dia: resumoDia })
  } catch (err: any) {
    console.error('[API /automacoes/robos GET]:', err)
    return NextResponse.json({ error: err?.message || 'Erro ao listar robôs' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const perm = await verificarPermissao()
    if (!perm.autorizado) {
      return NextResponse.json({ error: 'Acesso restrito ao Painel Master / Superadmin' }, { status: 403 })
    }

    const body = (await req.json().catch(() => ({}))) as SalvarRoboConfigInput
    const admin = createAdminClient()

    const res = await salvarRoboConfig(admin, body, perm.userId)
    if (!res.ok) {
      return NextResponse.json({ error: res.erro || 'Falha ao salvar configuração do robô' }, { status: 400 })
    }

    return NextResponse.json({ ok: true, id: res.id, mensagem: 'Robô configurado com sucesso' })
  } catch (err: any) {
    console.error('[API /automacoes/robos POST]:', err)
    return NextResponse.json({ error: err?.message || 'Erro ao criar robô' }, { status: 500 })
  }
}

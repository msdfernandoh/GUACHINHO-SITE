import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUsuarioNegocio } from '@/lib/auth/get-usuario'
import { isMaster } from '@/lib/auth/permissions'
import { isPlatformSuperadmin } from '@/lib/auth/is-superadmin'
import {
  obterRoboConfigPorId,
  salvarRoboConfig,
  alterarStatusAtivoRobo,
  excluirRoboConfig,
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
    const config = await obterRoboConfigPorId(admin, id)
    if (!config) {
      return NextResponse.json({ error: 'Robô não encontrado' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, robo: config })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao obter robô' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const perm = await verificarPermissao()
    if (!perm.autorizado) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    const { id } = await params
    const body = (await req.json().catch(() => ({}))) as SalvarRoboConfigInput
    const admin = createAdminClient()

    const res = await salvarRoboConfig(admin, { ...body, id }, perm.userId)
    if (!res.ok) {
      return NextResponse.json({ error: res.erro || 'Falha ao atualizar configuração' }, { status: 400 })
    }

    return NextResponse.json({ ok: true, id, mensagem: 'Configuração atualizada com sucesso' })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao atualizar robô' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const perm = await verificarPermissao()
    if (!perm.autorizado) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    const { id } = await params
    const body = (await req.json().catch(() => ({}))) as { ativo?: boolean }
    if (typeof body.ativo !== 'boolean') {
      return NextResponse.json({ error: 'Campo ativo (booleano) é obrigatório' }, { status: 400 })
    }

    const admin = createAdminClient()
    const res = await alterarStatusAtivoRobo(admin, id, body.ativo, perm.userId)
    if (!res.ok) {
      return NextResponse.json({ error: res.erro || 'Falha ao alterar status' }, { status: 400 })
    }

    return NextResponse.json({ ok: true, id, ativo: body.ativo })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao atualizar status' }, { status: 500 })
  }
}

export async function DELETE(
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
    const res = await excluirRoboConfig(admin, id)
    if (!res.ok) {
      return NextResponse.json({ error: res.erro || 'Falha ao excluir robô' }, { status: 400 })
    }

    return NextResponse.json({ ok: true, id, mensagem: 'Robô excluído com sucesso' })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao excluir robô' }, { status: 500 })
  }
}

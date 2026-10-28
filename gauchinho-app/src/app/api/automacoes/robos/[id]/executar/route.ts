import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUsuarioNegocio } from '@/lib/auth/get-usuario'
import { isMaster } from '@/lib/auth/permissions'
import { isPlatformSuperadmin } from '@/lib/auth/is-superadmin'
import { obterRoboConfigPorId } from '@/lib/automacoes/robos/roboConfigService'
import { inicioDiaCuiaba } from '@/lib/automacoes/robos/roboSchedule.mjs';

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
    const execucaoId = req.nextUrl.searchParams.get('execucaoId')

    let consulta = admin
      .from('robo_execucoes')
      .select('*')
      .eq('robo_config_id', id)

    if (execucaoId && /^[0-9a-f-]{36}$/i.test(execucaoId)) {
      consulta = consulta.eq('id', execucaoId)
    }

    const { data: execucoes, error } = await consulta
      .order('iniciado_em', { ascending: false })
      .limit(10)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ execucoes: execucoes || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao consultar execuções' }, { status: 500 })
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
    const config = await obterRoboConfigPorId(admin, id)
    if (!config) {
      return NextResponse.json({ error: 'Robô não encontrado.' }, { status: 404 })
    }

    const body = await req.json().catch(() => ({}))
    const dryRun = body?.dryRun !== undefined ? Boolean(body.dryRun) : config.modo === 'DRY_RUN'

    // Verifica se já há execução em processamento e limpa execuções órfãs/expiradas
    const { data: emAndamentoLista } = await admin
      .from('robo_execucoes')
      .select('*')
      .eq('robo_config_id', id)
      .in('status', ['PENDENTE', 'PROCESSANDO'])
      .order('iniciado_em', { ascending: false })

    const agoraMs = Date.now()
    const ativasValidas = []
    for (const item of emAndamentoLista || []) {
      const refIso = item.status === 'PROCESSANDO' ? (item.heartbeat_em || item.iniciado_em) : item.iniciado_em
      const refMs = Date.parse(refIso || '')
      const limiteMs = item.status === 'PROCESSANDO' ? 5 * 60_000 : 15 * 60_000
      const expirou = !Number.isFinite(refMs) || agoraMs - refMs > limiteMs

      if (expirou || body?.forcarReexecucao) {
        const msg = expirou
          ? 'Execução órfã encerrada automaticamente por inatividade de heartbeat.'
          : 'Execução anterior substituída por solicitação de reexecução forçada.'
        await admin
          .from('robo_execucoes')
          .update({
            status: 'CANCELADO',
            finalizado_em: new Date().toISOString(),
            erro_mensagem: msg,
            erro_sanitizado: msg,
            detalhes: {
              ...(item.detalhes || {}),
              erro: msg,
              logs: [...(item.detalhes?.logs || []), { ts: new Date().toISOString(), msg }],
            },
          })
          .eq('id', item.id)
      } else {
        ativasValidas.push(item)
      }
    }

    if (ativasValidas.length > 0) {
      return NextResponse.json(
        {
          ok: true,
          modo: 'FILA_TERMINAL',
          execucao: ativasValidas[0],
          mensagem: 'Já existe uma execução ativa pelo Runner. Acompanhando execução existente...',
        },
        { status: 202 }
      )
    }

    // Proteção contra duplicação no mesmo dia
    if (!dryRun && !body?.forcarReexecucao) {
      const inicioDiaIso = inicioDiaCuiaba()
      const { data: jaExecutados } = await admin
        .from('robo_execucoes')
        .select('*')
        .eq('robo_config_id', id)
        .eq('dry_run', false)
        .in('status', ['SUCESSO', 'JA_IMPORTADO'])
        .gte('iniciado_em', inicioDiaIso)
        .order('iniciado_em', { ascending: false })
        .limit(10)

      if (jaExecutados && jaExecutados.length > 0) {
        return NextResponse.json(
          {
            ok: false,
            ja_executado_hoje: true,
            error: 'Este robô já foi executado com sucesso hoje. Para rodar novamente, marque a opção "Forçar Reexecução".',
          },
          { status: 409 }
        )
      }
    }

    // Registra na fila de execuções
    const novoRegistroPayload = {
      empresa_id: config.empresa_id || null,
      robo_config_id: id,
      portal_tipo: config.portal_tipo,
      status: 'PENDENTE',
      iniciado_por: perm.userId || null,
      iniciado_em: new Date().toISOString(),
      dry_run: dryRun,
      detalhes: {
        origem: 'UI_MANUAL',
        parametros: {
          dryRun,
          forcarReexecucao: Boolean(body?.forcarReexecucao),
          ...(body?.parametros || {}),
        },
        logs: [{ ts: new Date().toISOString(), msg: 'Solicitação registrada na fila de automação pelo usuário' }],
      },
    }

    const { data: novoRegistro, error: errInsert } = await admin
      .from('robo_execucoes')
      .insert(novoRegistroPayload)
      .select('*')
      .single()

    if (errInsert || !novoRegistro) {
      throw new Error(`Falha ao enfileirar execução: ${errInsert?.message || 'Erro desconhecido'}`)
    }

    return NextResponse.json(
      {
        ok: true,
        modo: 'FILA_TERMINAL',
        execucao: novoRegistro,
        mensagem: 'Execução enviada para a fila com sucesso. Acompanhe os logs em tempo real.',
      },
      { status: 202 }
    )
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao processar solicitação de execução' }, { status: 500 })
  }
}

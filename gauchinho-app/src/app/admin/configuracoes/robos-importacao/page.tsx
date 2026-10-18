import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUsuarioNegocio } from '@/lib/auth/get-usuario'
import { isMaster } from '@/lib/auth/permissions'
import { isPlatformSuperadmin } from '@/lib/auth/is-superadmin'
import { RobosImportacaoContent } from './RobosImportacaoContent'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function RobosImportacaoPage() {
  const usuario = await getUsuarioNegocio()
  const isSuper = await isPlatformSuperadmin()
  if (!isSuper && (!usuario || (!isMaster(usuario.perfil) && usuario.perfil !== 'srd'))) {
    redirect('/admin')
  }

  const admin = createAdminClient()

  const [empresasRes, administradorasRes] = await Promise.all([
    admin.from('empresas').select('id, nome_fantasia').order('nome_fantasia'),
    admin.from('administradoras').select('id, nome, slug').order('nome'),
  ])

  const empresas = (empresasRes.data ?? []).map((e: { id: string; nome_fantasia: string }) => ({
    id: e.id,
    nome: e.nome_fantasia,
  }))

  const administradoras = (administradorasRes.data ?? []).map((a: { id: string; nome: string; slug?: string }) => ({
    id: a.id,
    nome: a.nome,
    slug: a.slug,
  }))

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/admin/configuracoes"
          className="flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition hover:text-zinc-900 dark:hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Configurações
        </Link>
      </div>

      <RobosImportacaoContent empresas={empresas} administradoras={administradoras} />
    </div>
  )
}

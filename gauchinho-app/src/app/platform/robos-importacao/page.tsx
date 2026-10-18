import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { isPlatformSuperadmin } from '@/lib/auth/is-superadmin'
import { RobosImportacaoContent } from '@/app/admin/configuracoes/robos-importacao/RobosImportacaoContent'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function PlatformRobosImportacaoPage() {
  const isSuper = await isPlatformSuperadmin()
  if (!isSuper) {
    redirect('/platform')
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
          href="/platform/configuracoes"
          className="flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-900 dark:hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Configurações da Plataforma
        </Link>
      </div>

      <RobosImportacaoContent empresas={empresas} administradoras={administradoras} />
    </div>
  )
}

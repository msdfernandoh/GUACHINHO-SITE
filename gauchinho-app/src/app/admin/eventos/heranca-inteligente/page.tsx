import { redirect } from "next/navigation";
import Link from "next/link";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageImobiliarias } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button, Card } from "@/components/ui/form-primitives";
import { eventoIsoToDatetimeLocal, formatarDataHoraEvento } from "@/lib/eventos-sorteio/timezone";
import { HERANCA_EVENTO_SLUG } from "@/lib/heranca-inteligente/lead";
import { HerancaEventoForm } from "./heranca-evento-form";
import { linkMapaEvento } from "@/lib/comercial-eventos/projetos";

export const dynamic = "force-dynamic";

type Evento = {
  id: string;
  nome: string;
  data_evento: string | null;
  limite_participantes: number | null;
  local: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
};

export default async function HerancaInteligenteAdminPage() {
  const u = await getUsuarioNegocio();
  if (!canManageImobiliarias(u?.perfil)) redirect("/admin");

  const admin = createAdminClient();
  const { data: evento } = await admin
    .from("eventos")
    .select("id, nome, data_evento, limite_participantes, local, endereco, cidade, estado")
    .eq("slug", HERANCA_EVENTO_SLUG)
    .maybeSingle<Evento>();

  if (!evento) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Herança Inteligente</h1>
        <Card>O evento do projeto (link /{HERANCA_EVENTO_SLUG}) não foi encontrado.</Card>
      </div>
    );
  }

  const { data: participantes } = await admin
    .from("eventos_participantes")
    .select("status, quantidade_vagas")
    .eq("evento_id", evento.id);
  const lista = participantes ?? [];
  const confirmados = lista.filter((p) => p.status === "confirmado" || p.status === "presente").reduce((s, p) => s + (p.quantidade_vagas ?? 1), 0);
  const espera = lista.filter((p) => p.status === "lista_espera").length;
  const restantes = evento.limite_participantes ? Math.max(0, evento.limite_participantes - confirmados) : null;
  const [data, hora] = eventoIsoToDatetimeLocal(evento.data_evento).split("T");
  const mapa = linkMapaEvento(evento);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/admin/eventos" className="text-sm text-zinc-500 hover:underline">
            ← Eventos
          </Link>
          <h1 className="mt-1 text-2xl font-bold">🔑 Projeto Herança Inteligente</h1>
          <p className="text-sm text-zinc-500">
            {evento.nome} · {evento.data_evento ? formatarDataHoraEvento(evento.data_evento) : "sem data"}
            {evento.local ? ` · ${evento.local}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/eventos/${evento.id}/participantes`}>
            <Button variant="outline">Ver inscritos</Button>
          </Link>
          <a href="https://filhos.raconsinop.com.br" target="_blank" rel="noopener noreferrer">
            <Button variant="outline">Abrir página</Button>
          </a>
          {mapa ? (
            <a href={mapa} target="_blank" rel="noopener noreferrer">
              <Button variant="outline">📍 Ver no mapa</Button>
            </a>
          ) : null}
          <a href="https://filhos.raconsinop.com.br/qr" target="_blank" rel="noopener noreferrer">
            <Button variant="outline">QR code</Button>
          </a>
          <Link href={`/admin/eventos/${evento.id}`}>
            <Button variant="ghost">Edição completa</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Card>
          <p className="text-xs uppercase text-zinc-500">Vagas</p>
          <p className="text-2xl font-bold">{evento.limite_participantes ?? "—"}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-zinc-500">Inscritos confirmados</p>
          <p className="text-2xl font-bold">{confirmados}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-zinc-500">Vagas restantes</p>
          <p className="text-2xl font-bold">{restantes ?? "—"}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-zinc-500">Lista de espera</p>
          <p className="text-2xl font-bold">{espera}</p>
        </Card>
      </div>

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Dia, horário, vagas e local</h2>
        <HerancaEventoForm
          inicial={{
            data: data ?? "",
            hora: hora ?? "",
            vagas: evento.limite_participantes,
            local: evento.local ?? "",
            endereco: evento.endereco ?? "",
            cidade: evento.cidade ?? "",
            estado: evento.estado ?? "",
          }}
        />
      </Card>

      <p className="text-xs text-zinc-500">
        Os leads deste projeto entram em Leads com origem “evento”, projeto “Método Herança Inteligente”, local de atendimento e data do encontro.
        Quem pede só informações entra com origem “landing_heranca”.
      </p>
    </div>
  );
}

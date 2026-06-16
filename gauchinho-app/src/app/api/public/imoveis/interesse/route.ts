import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarEvento } from "@/lib/eventos/registrar";
import { DEFAULT_LEADS, getConfigJsonPublic } from "@/server/config";
import {
  resolveWhatsappImovelInteresse,
  whatsappUrl,
} from "@/lib/whatsapp/resolve-imovel";
import { IMOVEL_TIPOS } from "@/lib/imoveis/types";

type Body = {
  imovelId: string;
  nome: string;
  whatsapp: string;
  cidade?: string;
  email?: string;
  mensagem?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    if (!body.imovelId || !body.nome?.trim() || !body.whatsapp?.trim()) {
      return NextResponse.json({ error: "Imóvel, nome e WhatsApp obrigatórios" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: imovel, error: imovelErr } = await admin
      .from("imoveis")
      .select("*, imobiliarias(*)")
      .eq("id", body.imovelId)
      .eq("ativo", true)
      .in("status", ["ativo", "reservado"])
      .maybeSingle();

    if (imovelErr || !imovel) {
      return NextResponse.json({ error: "Imóvel indisponível" }, { status: 404 });
    }

    const imob = imovel.imobiliarias as {
      id: string;
      nome: string;
      whatsapp: string | null;
      ativo: boolean;
    };
    if (!imob?.ativo) {
      return NextResponse.json({ error: "Imobiliária inativa" }, { status: 404 });
    }

    const leadsConfig = await getConfigJsonPublic("leads", DEFAULT_LEADS);
    const tipoLabel =
      IMOVEL_TIPOS.find((t) => t.value === imovel.tipo_imovel)?.label ?? imovel.tipo_imovel;

    const imovelSnapshot = {
      id: imovel.id,
      titulo: imovel.titulo,
      slug: imovel.slug,
      tipo_imovel: imovel.tipo_imovel,
      cidade: imovel.cidade,
      bairro: imovel.bairro,
      valor: imovel.valor,
      exibir_valor_publico: imovel.exibir_valor_publico,
      status: imovel.status,
      link_externo: imovel.link_externo,
      imobiliaria_id: imob.id,
      imobiliaria_nome: imob.nome,
    };

    const { data: leadRow, error: leadErr } = await admin
      .from("leads")
      .insert({
        nome: body.nome.trim(),
        whatsapp: body.whatsapp.trim(),
        email: body.email?.trim() || null,
        cidade: body.cidade?.trim() || null,
        origem: "oportunidade_imobiliaria",
        origem_detalhe: imob.nome,
        tipo_interesse: "oportunidade_imobiliaria",
        produto_interesse: imovel.titulo,
        valor_simulado: imovel.exibir_valor_publico ? imovel.valor : null,
        imobiliaria_id: imob.id,
        imovel_id: imovel.id,
        dados_simulacao: { imovel: imovelSnapshot, tipoLabel, mensagem: body.mensagem ?? null },
        resultado_resumido: `${tipoLabel} — ${imovel.titulo} (${imob.nome})`,
        observacoes: body.mensagem?.trim() || null,
        status: leadsConfig.statusInicialPadrao,
        criado_manual: false,
      })
      .select("id")
      .single();

    if (leadErr || !leadRow) {
      return NextResponse.json({ error: leadErr?.message ?? "Lead falhou" }, { status: 500 });
    }

    const leadId = leadRow.id;
    const pagina = "/oportunidades-imobiliarias";

    await registrarEvento({
      tipo_evento: "lead_criado",
      origem: "oportunidade_imobiliaria",
      pagina,
      lead_id: leadId,
      imobiliaria_id: imob.id,
      imovel_id: imovel.id,
    });
    await registrarEvento({
      tipo_evento: "imovel_interesse",
      origem: "oportunidade_imobiliaria",
      pagina,
      lead_id: leadId,
      imobiliaria_id: imob.id,
      imovel_id: imovel.id,
      entidade_tipo: "imovel",
      entidade_id: imovel.id,
    });

    const wa = await resolveWhatsappImovelInteresse(
      {
        imovelWhatsapp: imovel.whatsapp,
        usarWhatsappImobiliaria: imovel.usar_whatsapp_imobiliaria,
        imobiliariaWhatsapp: imob.whatsapp,
      },
      body.nome.trim(),
      imovel.titulo,
    );

    let whatsappLink: string | null = null;
    if (wa) {
      whatsappLink = whatsappUrl(wa.numero, wa.mensagem);
      await registrarEvento({
        tipo_evento: "clique_whatsapp_imobiliaria",
        origem: "oportunidade_imobiliaria",
        pagina,
        lead_id: leadId,
        imobiliaria_id: imob.id,
        imovel_id: imovel.id,
        dados_evento: { destino: wa.origemResolvida },
      });
    }

    return NextResponse.json({
      ok: true,
      leadId,
      whatsappLink,
      exibirWhatsapp: !!whatsappLink,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

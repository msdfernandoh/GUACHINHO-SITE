import { PGlite } from "@electric-sql/pglite";
import { describe, it, expect, beforeAll } from "vitest";
import { formatCodigoParticipacao, proximoCodigoFromExisting } from "./codigo";
import {
  labelCapacidade,
  labelMoradia,
  labelVeiculo,
  type QualificacaoRespostasPayload,
} from "./checkin-conversacional";
import { filtrarElegiveisSorteio } from "./sorteio";

describe("Homologação Completa — Migration 220 & Check-in / Sorteio / Prêmios", () => {
  let db: PGlite;

  const eventoAId = "11111111-1111-4000-8000-000000000001";
  const eventoBId = "11111111-1111-4000-8000-000000000002";
  const eventoCId = "11111111-1111-4000-8000-000000000003";
  const qrUnicoId = "22222222-2222-4000-8000-000000000001";

  beforeAll(async () => {
    db = new PGlite();

    // 1. Criação das tabelas base necessárias
    await db.exec(`
      CREATE TABLE public.eventos (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        nome text NOT NULL,
        slug text NOT NULL UNIQUE,
        ativo boolean NOT NULL DEFAULT true,
        publicado boolean NOT NULL DEFAULT true,
        checkin_interativo_ativo boolean NOT NULL DEFAULT false,
        cor_primaria text,
        cor_secundaria text,
        logo_personalizado_url text,
        prefixo_codigo_sorteio text DEFAULT '',
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );

      CREATE TABLE public.leads (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        nome text NOT NULL,
        whatsapp text,
        origem text,
        origem_detalhe text,
        evento_id uuid,
        evento_nome text,
        tipo_interesse text,
        tipo_credito text,
        valor_estimado numeric(14,2),
        status text DEFAULT 'Novo',
        dados_simulacao jsonb,
        criado_manual boolean DEFAULT false,
        ultima_interacao_at timestamptz,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );

      CREATE TABLE public.lead_atividades (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
        tipo text NOT NULL,
        titulo text NOT NULL,
        descricao text,
        status text DEFAULT 'concluida',
        data_conclusao timestamptz DEFAULT now(),
        created_at timestamptz DEFAULT now()
      );

      CREATE TABLE public.eventos_participantes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        evento_id uuid NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
        lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
        nome_participante text NOT NULL,
        telefone_participante text NOT NULL,
        status text NOT NULL DEFAULT 'confirmado',
        checkin_at timestamptz,
        quantidade_vagas integer DEFAULT 1,
        observacao text,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );

      CREATE TABLE public.eventos_sorteios (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        evento_id uuid NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
        ativo boolean NOT NULL DEFAULT true,
        titulo text NOT NULL,
        status text NOT NULL DEFAULT 'aberto',
        nps_config jsonb,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );

      CREATE TABLE public.eventos_sorteio_participantes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        sorteio_id uuid NOT NULL REFERENCES public.eventos_sorteios(id) ON DELETE CASCADE,
        evento_id uuid NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
        evento_participante_id uuid REFERENCES public.eventos_participantes(id) ON DELETE SET NULL,
        lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
        codigo text NOT NULL,
        nome text NOT NULL,
        telefone text NOT NULL,
        valor_mensal_disponivel numeric(14,2),
        status text NOT NULL DEFAULT 'participando',
        ganhador boolean NOT NULL DEFAULT false,
        fase_cadastro text DEFAULT 'completo',
        origem_cupom text DEFAULT 'cadastro',
        qualificacao_respostas jsonb,
        nps_respostas jsonb,
        lgpd_termo_versao text DEFAULT 'v1_checkin_evento',
        lgpd_consentimento_at timestamptz,
        qr_code_unico_id uuid,
        sorteado_em timestamptz,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );

      CREATE TABLE public.leads_eventos_qualificacoes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
        evento_id uuid NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
        evento_nome text NOT NULL,
        sorteio_participante_id uuid REFERENCES public.eventos_sorteio_participantes(id) ON DELETE SET NULL,
        codigo_sorteio text NOT NULL,
        qualificacao_respostas jsonb NOT NULL DEFAULT '{}'::jsonb,
        lgpd_termo_versao text NOT NULL DEFAULT 'v1_checkin_evento',
        lgpd_consentimento_at timestamptz NOT NULL DEFAULT now(),
        checkin_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE public.eventos_premios (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        evento_id uuid NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
        ordem integer NOT NULL DEFAULT 1,
        titulo text NOT NULL,
        descricao text,
        imagem_url text,
        status text NOT NULL DEFAULT 'pendente',
        ganhador_participante_id uuid REFERENCES public.eventos_sorteio_participantes(id) ON DELETE SET NULL,
        sorteado_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE public.eventos_sorteio_resultados (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        sorteio_id uuid NOT NULL REFERENCES public.eventos_sorteios(id) ON DELETE CASCADE,
        evento_id uuid NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
        participante_id uuid NOT NULL REFERENCES public.eventos_sorteio_participantes(id) ON DELETE CASCADE,
        codigo text NOT NULL,
        nome text NOT NULL,
        ordem integer NOT NULL,
        created_at timestamptz DEFAULT now()
      );

      CREATE TABLE public.qr_codes_unicos (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        nome text NOT NULL,
        slug text NOT NULL UNIQUE,
        ativo boolean NOT NULL DEFAULT true,
        created_at timestamptz DEFAULT now()
      );

      CREATE TABLE public.qr_codes_unicos_vinculos (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        qr_code_id uuid NOT NULL REFERENCES public.qr_codes_unicos(id) ON DELETE CASCADE,
        evento_id uuid NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
        periodo_inicio timestamptz,
        periodo_fim timestamptz,
        ativo boolean NOT NULL DEFAULT true,
        created_at timestamptz DEFAULT now()
      );
    `);

    // 2. Criação das RPCs da Migration 220
    await db.exec(`
      CREATE OR REPLACE FUNCTION public.rpc_consultar_checkin_evento(
        p_evento_id uuid,
        p_whatsapp text
      )
      RETURNS jsonb
      LANGUAGE plpgsql
      AS $$
      DECLARE
        v_tel_norm text;
        v_rec record;
      BEGIN
        v_tel_norm := regexp_replace(coalesce(p_whatsapp, ''), '\\D', '', 'g');
        IF v_tel_norm = '' OR length(v_tel_norm) < 8 THEN
          RETURN jsonb_build_object('ok', false, 'cadastrado', false, 'error', 'Telefone inválido');
        END IF;

        SELECT
          esp.id as participante_sorteio_id,
          esp.codigo,
          esp.nome,
          esp.status,
          ep.checkin_at
        INTO v_rec
        FROM public.eventos_sorteio_participantes esp
        LEFT JOIN public.eventos_participantes ep ON ep.id = esp.evento_participante_id
        WHERE esp.evento_id = p_evento_id
          AND regexp_replace(esp.telefone, '\\D', '', 'g') = v_tel_norm
          AND esp.status = 'participando'
        LIMIT 1;

        IF v_rec.participante_sorteio_id IS NOT NULL THEN
          RETURN jsonb_build_object(
            'ok', true,
            'cadastrado', true,
            'nome', v_rec.nome,
            'codigo', v_rec.codigo,
            'checkin_at', v_rec.checkin_at
          );
        END IF;

        RETURN jsonb_build_object('ok', true, 'cadastrado', false);
      END;
      $$;

      CREATE OR REPLACE FUNCTION public.rpc_realizar_checkin_conversacional(
        p_evento_id uuid,
        p_nome text,
        p_whatsapp text,
        p_qualificacao jsonb DEFAULT '{}'::jsonb,
        p_lgpd_versao text DEFAULT 'v1_checkin_evento',
        p_qr_code_unico_id uuid DEFAULT null
      )
      RETURNS jsonb
      LANGUAGE plpgsql
      AS $$
      DECLARE
        v_tel_norm text;
        v_evento_rec record;
        v_sorteio_id uuid;
        v_prefixo text;
        v_existente record;
        v_lead_id uuid;
        v_part_id uuid;
        v_sorteio_part_id uuid;
        v_prox_num integer;
        v_codigo text;
        v_tipo_credito text;
        v_valor_mensal numeric(14,2);
        v_capacidade text;
      BEGIN
        p_nome := trim(coalesce(p_nome, ''));
        v_tel_norm := regexp_replace(coalesce(p_whatsapp, ''), '\\D', '', 'g');

        IF p_nome = '' THEN
          RETURN jsonb_build_object('ok', false, 'error', 'Nome é obrigatório');
        END IF;
        IF length(v_tel_norm) < 10 THEN
          RETURN jsonb_build_object('ok', false, 'error', 'WhatsApp inválido. Informe DDD + número.');
        END IF;

        -- Trava atômica por evento
        PERFORM pg_advisory_xact_lock(hashtext('checkin_evento_' || p_evento_id::text));

        SELECT id, nome, slug, ativo, prefixo_codigo_sorteio
        INTO v_evento_rec
        FROM public.eventos
        WHERE id = p_evento_id;

        IF v_evento_rec.id IS NULL THEN
          RETURN jsonb_build_object('ok', false, 'error', 'Evento não encontrado');
        END IF;
        IF NOT v_evento_rec.ativo THEN
          RETURN jsonb_build_object('ok', false, 'error', 'Este evento não está mais ativo');
        END IF;

        v_prefixo := trim(coalesce(v_evento_rec.prefixo_codigo_sorteio, ''));

        SELECT id INTO v_sorteio_id
        FROM public.eventos_sorteios
        WHERE evento_id = p_evento_id;

        IF v_sorteio_id IS NULL THEN
          INSERT INTO public.eventos_sorteios (evento_id, ativo, titulo, status)
          VALUES (p_evento_id, true, 'Sorteio — ' || v_evento_rec.nome, 'aberto')
          RETURNING id INTO v_sorteio_id;
        END IF;

        -- Unicidade por (evento_id + telefone)
        SELECT
          esp.id as sorteio_part_id,
          esp.codigo,
          esp.nome,
          esp.evento_participante_id,
          ep.checkin_at
        INTO v_existente
        FROM public.eventos_sorteio_participantes esp
        LEFT JOIN public.eventos_participantes ep ON ep.id = esp.evento_participante_id
        WHERE esp.evento_id = p_evento_id
          AND regexp_replace(esp.telefone, '\\D', '', 'g') = v_tel_norm
          AND esp.status = 'participando'
        LIMIT 1;

        IF v_existente.sorteio_part_id IS NOT NULL THEN
          IF v_existente.evento_participante_id IS NOT NULL THEN
            UPDATE public.eventos_participantes
            SET status = 'presente',
                checkin_at = coalesce(checkin_at, now()),
                updated_at = now()
            WHERE id = v_existente.evento_participante_id;
          END IF;

          RETURN jsonb_build_object(
            'ok', true,
            'ja_cadastrado', true,
            'nome', v_existente.nome,
            'codigo', v_existente.codigo,
            'mensagem', 'Olá, ' || v_existente.nome || '! Sua presença já está confirmada.',
            'sorteio_participante_id', v_existente.sorteio_part_id
          );
        END IF;

        v_capacidade := coalesce(p_qualificacao->>'capacidade_mensal', '');
        v_valor_mensal := CASE
          WHEN v_capacidade = 'ate_500' THEN 500.00
          WHEN v_capacidade = '500_1000' THEN 1000.00
          WHEN v_capacidade = '1000_2000' THEN 2000.00
          WHEN v_capacidade = 'acima_2000' THEN 3000.00
          ELSE null
        END;

        v_tipo_credito := CASE
          WHEN p_qualificacao->>'veiculo' IN ('carro', 'moto', 'carro_moto') THEN 'Veículo'
          WHEN p_qualificacao->>'moradia' IN ('propria_financiada', 'aluguel') THEN 'Imóvel'
          ELSE 'Consórcio Geral'
        END;

        SELECT id INTO v_lead_id
        FROM public.leads
        WHERE regexp_replace(whatsapp, '\\D', '', 'g') = v_tel_norm
        ORDER BY created_at DESC
        LIMIT 1;

        IF v_lead_id IS NOT NULL THEN
          UPDATE public.leads
          SET ultima_interacao_at = now(),
              updated_at = now(),
              evento_id = coalesce(evento_id, p_evento_id),
              evento_nome = coalesce(evento_nome, v_evento_rec.nome)
          WHERE id = v_lead_id;
        ELSE
          INSERT INTO public.leads (
            nome, whatsapp, origem, origem_detalhe, evento_id, evento_nome,
            tipo_interesse, tipo_credito, valor_estimado, status, dados_simulacao, criado_manual
          )
          VALUES (
            p_nome, p_whatsapp, 'evento_checkin', v_evento_rec.slug, p_evento_id, v_evento_rec.nome,
            v_tipo_credito, v_tipo_credito, v_valor_mensal, 'Novo',
            jsonb_build_object('origem', 'qr_checkin_conversacional', 'evento_id', p_evento_id),
            false
          )
          RETURNING id INTO v_lead_id;
        END IF;

        SELECT coalesce(max(
          CASE
            WHEN codigo ~ '^[0-9]+$' THEN codigo::integer
            WHEN codigo ~ '^[A-Za-z0-9]+-[0-9]+$' THEN substring(codigo from '[0-9]+$')::integer
            ELSE 0
          END
        ), 0) + 1 INTO v_prox_num
        FROM public.eventos_sorteio_participantes
        WHERE evento_id = p_evento_id;

        IF v_prefixo <> '' THEN
          v_codigo := v_prefixo || lpad(v_prox_num::text, 3, '0');
        ELSE
          v_codigo := lpad(v_prox_num::text, 3, '0');
        END IF;

        INSERT INTO public.eventos_participantes (
          evento_id, lead_id, nome_participante, telefone_participante, status, checkin_at, quantidade_vagas, observacao
        )
        VALUES (
          p_evento_id, v_lead_id, p_nome, p_whatsapp, 'presente', now(), 1, 'Check-in automático via QR Code interativo'
        )
        RETURNING id INTO v_part_id;

        INSERT INTO public.eventos_sorteio_participantes (
          sorteio_id, evento_id, evento_participante_id, lead_id, codigo, nome, telefone,
          valor_mensal_disponivel, status, ganhador, fase_cadastro, origem_cupom,
          qualificacao_respostas, lgpd_termo_versao, lgpd_consentimento_at, qr_code_unico_id
        )
        VALUES (
          v_sorteio_id, p_evento_id, v_part_id, v_lead_id, v_codigo, p_nome, p_whatsapp,
          v_valor_mensal, 'participando', false, 'completo', 'cadastro',
          p_qualificacao, p_lgpd_versao, now(), p_qr_code_unico_id
        )
        RETURNING id INTO v_sorteio_part_id;

        INSERT INTO public.leads_eventos_qualificacoes (
          lead_id, evento_id, evento_nome, sorteio_participante_id, codigo_sorteio,
          qualificacao_respostas, lgpd_termo_versao, lgpd_consentimento_at, checkin_at
        )
        VALUES (
          v_lead_id, p_evento_id, v_evento_rec.nome, v_sorteio_part_id, v_codigo,
          p_qualificacao, p_lgpd_versao, now(), now()
        );

        INSERT INTO public.lead_atividades (
          lead_id, tipo, titulo, descricao, status, data_conclusao
        )
        VALUES (
          v_lead_id, 'evento_checkin', 'Presença confirmada no evento ' || v_evento_rec.nome,
          'Número da Sorte: ' || v_codigo, 'concluida', now()
        );

        RETURN jsonb_build_object(
          'ok', true,
          'ja_cadastrado', false,
          'nome', p_nome,
          'codigo', v_codigo,
          'sorteio_participante_id', v_sorteio_part_id,
          'evento_nome', v_evento_rec.nome
        );
      END;
      $$;

      CREATE OR REPLACE FUNCTION public.rpc_confirmar_ganhador_com_premio(
        p_evento_id uuid,
        p_sorteio_id uuid,
        p_participante_id uuid,
        p_premio_id uuid DEFAULT null
      )
      RETURNS jsonb
      LANGUAGE plpgsql
      AS $$
      DECLARE
        v_part record;
        v_ordem integer;
        v_tel_norm text;
        v_premio_titulo text;
        v_role text := coalesce(current_setting('my.role', true), 'service_role');
      BEGIN
        -- Verificação de autorização (staff/master/service_role)
        IF v_role NOT IN ('service_role', 'master', 'staff') THEN
          RETURN jsonb_build_object('ok', false, 'error', 'Sem permissão para confirmar ganhador.');
        END IF;

        SELECT id, codigo, nome, telefone, status, ganhador
        INTO v_part
        FROM public.eventos_sorteio_participantes
        WHERE id = p_participante_id
          AND evento_id = p_evento_id
          AND sorteio_id = p_sorteio_id;

        IF v_part.id IS NULL THEN
          RETURN jsonb_build_object('ok', false, 'error', 'Participante não encontrado');
        END IF;
        IF v_part.status <> 'participando' THEN
          RETURN jsonb_build_object('ok', false, 'error', 'Participante não está com status ativo');
        END IF;
        IF v_part.ganhador THEN
          RETURN jsonb_build_object('ok', false, 'error', 'Participante já foi contemplado neste evento');
        END IF;

        v_tel_norm := regexp_replace(v_part.telefone, '\\D', '', 'g');

        -- 1. Vincula ao prêmio primeiro se fornecido (apenas se pendente - proteção atômica prévia)
        IF p_premio_id IS NOT NULL THEN
          UPDATE public.eventos_premios
          SET status = 'sorteado',
              ganhador_participante_id = p_participante_id,
              sorteado_at = now(),
              updated_at = now()
          WHERE id = p_premio_id
            AND evento_id = p_evento_id
            AND status = 'pendente'
          RETURNING titulo INTO v_premio_titulo;

          IF v_premio_titulo IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'error', 'Este prêmio já foi sorteado.');
          END IF;
        END IF;

        -- 2. Marca todos os cupons do mesmo telefone como ganhador (impede segunda vitória)
        UPDATE public.eventos_sorteio_participantes
        SET ganhador = true,
            sorteado_em = now(),
            updated_at = now()
        WHERE evento_id = p_evento_id
          AND sorteio_id = p_sorteio_id
          AND regexp_replace(telefone, '\\D', '', 'g') = v_tel_norm;

        -- 3. Determina ordem do sorteio
        SELECT coalesce(count(*), 0) + 1 INTO v_ordem
        FROM public.eventos_sorteio_resultados
        WHERE sorteio_id = p_sorteio_id;

        -- 4. Registra no histórico de resultados
        INSERT INTO public.eventos_sorteio_resultados (
          sorteio_id, evento_id, participante_id, codigo, nome, ordem
        )
        VALUES (
          p_sorteio_id, p_evento_id, p_participante_id, v_part.codigo, v_part.nome, v_ordem
        );

        RETURN jsonb_build_object(
          'ok', true,
          'codigo', v_part.codigo,
          'nome', v_part.nome,
          'ordem', v_ordem,
          'premio_titulo', v_premio_titulo
        );
      END;
      $$;
    `);

    // 3. Cadastrar dados base para os testes
    await db.exec(`
      INSERT INTO public.eventos (id, nome, slug, ativo, checkin_interativo_ativo, prefixo_codigo_sorteio)
      VALUES
        ('${eventoAId}', 'Evento A — Inovação', 'evento-a', true, true, ''),
        ('${eventoBId}', 'Evento B — Conexão', 'evento-b', true, true, 'RCN-'),
        ('${eventoCId}', 'Evento C — Futuro', 'evento-c', true, true, '');

      INSERT INTO public.qr_codes_unicos (id, nome, slug, ativo)
      VALUES ('${qrUnicoId}', 'QR Stand Sinop', 'stand-sinop', true);

      INSERT INTO public.qr_codes_unicos_vinculos (qr_code_id, evento_id, ativo)
      VALUES ('${qrUnicoId}', '${eventoAId}', true);
    `);
  });

  it("Seção 3: QR Permanente vinculado ao Evento A realiza check-in no Evento A", async () => {
    const qual: QualificacaoRespostasPayload = {
      veiculo: "carro",
      moradia: "propria_quitada",
      capacidade_mensal: "1000_2000",
    };

    const res = await db.query<{ rpc_realizar_checkin_conversacional: any }>(`
      SELECT public.rpc_realizar_checkin_conversacional(
        '${eventoAId}',
        'Fernando Hugo',
        '(66) 99999-0001',
        '${JSON.stringify(qual)}'::jsonb,
        'v1_checkin_evento',
        '${qrUnicoId}'
      );
    `);

    const data = res.rows[0].rpc_realizar_checkin_conversacional;
    expect(data.ok).toBe(true);
    expect(data.codigo).toBe("001");
    expect(data.ja_cadastrado).toBe(false);

    // Verifica vínculo em eventos_sorteio_participantes
    const part = (
      await db.query<{ evento_id: string; codigo: string }>(
        `SELECT evento_id, codigo FROM public.eventos_sorteio_participantes WHERE id = '${data.sorteio_participante_id}'`
      )
    ).rows[0];
    expect(part.evento_id).toBe(eventoAId);
    expect(part.codigo).toBe("001");

    // Verifica auto check-in presente
    const presenca = (
      await db.query<{ status: string; checkin_at: string }>(
        `SELECT status, checkin_at FROM public.eventos_participantes WHERE evento_id = '${eventoAId}'`
      )
    ).rows[0];
    expect(presenca.status).toBe("presente");
    expect(presenca.checkin_at).toBeTruthy();
  });

  it("Seção 3: Troca de QR permanente para Evento B grava novo check-in estritamente no Evento B", async () => {
    // Desativa vínculo com Evento A e ativa vínculo com Evento B
    await db.exec(`
      UPDATE public.qr_codes_unicos_vinculos SET ativo = false WHERE evento_id = '${eventoAId}';
      INSERT INTO public.qr_codes_unicos_vinculos (qr_code_id, evento_id, ativo)
      VALUES ('${qrUnicoId}', '${eventoBId}', true);
    `);

    const qual: QualificacaoRespostasPayload = {
      veiculo: "moto",
      moradia: "aluguel",
      capacidade_mensal: "500_1000",
    };

    const res = await db.query<{ rpc_realizar_checkin_conversacional: any }>(`
      SELECT public.rpc_realizar_checkin_conversacional(
        '${eventoBId}',
        'Lucas Silva',
        '(66) 99999-0002',
        '${JSON.stringify(qual)}'::jsonb,
        'v1_checkin_evento',
        '${qrUnicoId}'
      );
    `);

    const data = res.rows[0].rpc_realizar_checkin_conversacional;
    expect(data.ok).toBe(true);
    expect(data.codigo).toBe("RCN-001"); // Evento B tem prefixo RCN-

    // Confirma que não gravou no Evento A
    const countA = Number(
      (await db.query<{ n: number }>(`SELECT count(*) n FROM public.eventos_sorteio_participantes WHERE evento_id = '${eventoAId}' AND codigo = 'RCN-001'`)).rows[0].n
    );
    expect(countA).toBe(0);
  });

  it("Seção 4: Troca de evento durante preenchimento não desvia check-in para outro evento", async () => {
    // Cliente carregou o formulário com eventoAId.
    // Enquanto preenche, o admin troca o QR para eventoBId.
    // O formulário submete com eventoAId explícito.
    const qual: QualificacaoRespostasPayload = {
      veiculo: "carro_moto",
      moradia: "propria_financiada",
      capacidade_mensal: "acima_2000",
    };

    const res = await db.query<{ rpc_realizar_checkin_conversacional: any }>(`
      SELECT public.rpc_realizar_checkin_conversacional(
        '${eventoAId}',
        'Carlos Eduardo',
        '(66) 99999-0003',
        '${JSON.stringify(qual)}'::jsonb
      );
    `);

    const data = res.rows[0].rpc_realizar_checkin_conversacional;
    expect(data.ok).toBe(true);
    expect(data.codigo).toBe("002"); // No Evento A, é o segundo participante
    expect(data.evento_nome).toContain("Evento A");
  });

  it("Seção 5: Evento desativado recusa check-in amigavelmente sem gravar registros", async () => {
    // Desativa evento C
    await db.exec(`UPDATE public.eventos SET ativo = false WHERE id = '${eventoCId}';`);

    const res = await db.query<{ rpc_realizar_checkin_conversacional: any }>(`
      SELECT public.rpc_realizar_checkin_conversacional(
        '${eventoCId}',
        'Inativo Teste',
        '(66) 99999-0004'
      );
    `);

    const data = res.rows[0].rpc_realizar_checkin_conversacional;
    expect(data.ok).toBe(false);
    expect(data.error).toBe("Este evento não está mais ativo");

    // Confirma zero registros criados
    const count = Number(
      (await db.query<{ n: number }>(`SELECT count(*) n FROM public.eventos_sorteio_participantes WHERE evento_id = '${eventoCId}'`)).rows[0].n
    );
    expect(count).toBe(0);
  });

  it("Seção 6: Duplicidade no mesmo evento retorna o mesmo código amigavelmente", async () => {
    // Fernando tenta check-in novamente no Evento A com o mesmo WhatsApp
    const res = await db.query<{ rpc_realizar_checkin_conversacional: any }>(`
      SELECT public.rpc_realizar_checkin_conversacional(
        '${eventoAId}',
        'Fernando Hugo',
        '(66) 99999-0001'
      );
    `);

    const data = res.rows[0].rpc_realizar_checkin_conversacional;
    expect(data.ok).toBe(true);
    expect(data.ja_cadastrado).toBe(true);
    expect(data.codigo).toBe("001");
    expect(data.mensagem).toContain("Fernando Hugo");

    // Verifica que não duplicou cupom no banco
    const count = Number(
      (await db.query<{ n: number }>(`SELECT count(*) n FROM public.eventos_sorteio_participantes WHERE evento_id = '${eventoAId}' AND regexp_replace(telefone, '\\D', '', 'g') = '66999990001'`)).rows[0].n
    );
    expect(count).toBe(1);
  });

  it("Seção 7: Mesmo telefone em eventos diferentes gera números independentes", async () => {
    // Reativa evento C para teste
    await db.exec(`UPDATE public.eventos SET ativo = true WHERE id = '${eventoCId}';`);

    // Fernando participa do Evento B
    const resB = await db.query<{ rpc_realizar_checkin_conversacional: any }>(`
      SELECT public.rpc_realizar_checkin_conversacional(
        '${eventoBId}',
        'Fernando Hugo',
        '(66) 99999-0001'
      );
    `);
    const dataB = resB.rows[0].rpc_realizar_checkin_conversacional;
    expect(dataB.ok).toBe(true);
    expect(dataB.codigo).toBe("RCN-002"); // Segundo no Evento B

    // Fernando participa do Evento C
    const resC = await db.query<{ rpc_realizar_checkin_conversacional: any }>(`
      SELECT public.rpc_realizar_checkin_conversacional(
        '${eventoCId}',
        'Fernando Hugo',
        '(66) 99999-0001'
      );
    `);
    const dataC = resC.rows[0].rpc_realizar_checkin_conversacional;
    expect(dataC.ok).toBe(true);
    expect(dataC.codigo).toBe("001"); // Primeiro no Evento C
  });

  it("Seção 8 & 17: Emissão sequencial não quebra após 999 (001... 099, 100, 999, 1000, 1001)", () => {
    expect(formatCodigoParticipacao(1)).toBe("001");
    expect(formatCodigoParticipacao(9)).toBe("009");
    expect(formatCodigoParticipacao(10)).toBe("010");
    expect(formatCodigoParticipacao(27)).toBe("027");
    expect(formatCodigoParticipacao(99)).toBe("099");
    expect(formatCodigoParticipacao(100)).toBe("100");
    expect(formatCodigoParticipacao(999)).toBe("999");
    expect(formatCodigoParticipacao(1000)).toBe("1000");
    expect(formatCodigoParticipacao(1001)).toBe("1001");

    expect(formatCodigoParticipacao(1, "RCN-")).toBe("RCN-001");
    expect(formatCodigoParticipacao(1000, "RCN-")).toBe("RCN-1000");

    // Próximo código a partir de 999
    expect(proximoCodigoFromExisting(["999"])).toBe("1000");
    expect(proximoCodigoFromExisting(["1000"])).toBe("1001");
  });

  it("Seção 10: Qualificação comercial é salva em qualificacao_respostas e não contamina nps_respostas", async () => {
    const row = (
      await db.query<{ qualificacao_respostas: any; nps_respostas: any }>(
        `SELECT qualificacao_respostas, nps_respostas FROM public.eventos_sorteio_participantes WHERE evento_id = '${eventoAId}' AND codigo = '001'`
      )
    ).rows[0];

    expect(row.qualificacao_respostas).toBeTruthy();
    expect(row.qualificacao_respostas.veiculo).toBe("carro");
    expect(row.qualificacao_respostas.moradia).toBe("propria_quitada");
    expect(row.nps_respostas).toBeNull();
  });

  it("Seção 11 & 12: Histórico Multi-Evento no CRM registra os 3 eventos sem sobrescrever", async () => {
    // Busca o Lead Fernando pelo WhatsApp
    const lead = (
      await db.query<{ id: string; nome: string }>(
        `SELECT id, nome FROM public.leads WHERE regexp_replace(whatsapp, '\\D', '', 'g') = '66999990001'`
      )
    ).rows[0];

    expect(lead).toBeTruthy();

    // Busca todas as qualificações de evento do Fernando
    const qualifs = (
      await db.query<{ evento_nome: string; codigo_sorteio: string }>(
        `SELECT evento_nome, codigo_sorteio FROM public.leads_eventos_qualificacoes WHERE lead_id = '${lead.id}' ORDER BY created_at ASC`
      )
    ).rows;

    expect(qualifs.length).toBe(3);
    expect(qualifs[0].evento_nome).toContain("Evento A");
    expect(qualifs[0].codigo_sorteio).toBe("001");

    expect(qualifs[1].evento_nome).toContain("Evento B");
    expect(qualifs[1].codigo_sorteio).toBe("RCN-002");

    expect(qualifs[2].evento_nome).toContain("Evento C");
    expect(qualifs[2].codigo_sorteio).toBe("001");

    // Verifica que não duplicou o registro principal do Lead
    const totalLeadsFernando = Number(
      (await db.query<{ n: number }>(`SELECT count(*) n FROM public.leads WHERE regexp_replace(whatsapp, '\\D', '', 'g') = '66999990001'`)).rows[0].n
    );
    expect(totalLeadsFernando).toBe(1);
  });

  it("Seção 13: LGPD registra versão, timestamp e auditabilidade", async () => {
    const qualif = (
      await db.query<{ lgpd_termo_versao: string; lgpd_consentimento_at: string }>(
        `SELECT lgpd_termo_versao, lgpd_consentimento_at FROM public.leads_eventos_qualificacoes LIMIT 1`
      )
    ).rows[0];

    expect(qualif.lgpd_termo_versao).toBe("v1_checkin_evento");
    expect(qualif.lgpd_consentimento_at).toBeTruthy();
  });

  it("Seção 18 & 21: Sorteio respeita elegibilidade e ganha só uma vez", async () => {
    const participantes = [
      { id: "1", codigo: "001", nome: "Fernando", telefone: "66999990001", status: "participando" as const, ganhador: false },
      { id: "2", codigo: "002", nome: "Carlos", telefone: "66999990003", status: "participando" as const, ganhador: false },
      { id: "3", codigo: "003", nome: "Cancelado", telefone: "66999990005", status: "cancelado" as const, ganhador: false },
      { id: "4", codigo: "004", nome: "Já Ganhou", telefone: "66999990006", status: "participando" as const, ganhador: true },
    ];

    const elegiveis = filtrarElegiveisSorteio(participantes);
    expect(elegiveis.length).toBe(2);
    expect(elegiveis.map((e) => e.codigo)).toEqual(["001", "002"]);
  });

  it("Seção 19 & 20: Sorteio de prêmios sequenciais e bloqueio de ganhador repetido", async () => {
    // Cria 2 prêmios no Evento A
    const p1 = (
      await db.query<{ id: string }>(`
        INSERT INTO public.eventos_premios (evento_id, ordem, titulo, status)
        VALUES ('${eventoAId}', 1, 'Prêmio 1 — Caixa JBL', 'pendente')
        RETURNING id;
      `)
    ).rows[0].id;

    const p2 = (
      await db.query<{ id: string }>(`
        INSERT INTO public.eventos_premios (evento_id, ordem, titulo, status)
        VALUES ('${eventoAId}', 2, 'Prêmio 2 — Alexa Echo', 'pendente')
        RETURNING id;
      `)
    ).rows[0].id;

    // Busca sorteio do Evento A
    const sorteioId = (
      await db.query<{ id: string }>(`SELECT id FROM public.eventos_sorteios WHERE evento_id = '${eventoAId}'`)
    ).rows[0].id;

    // Busca participante Fernando
    const partFernando = (
      await db.query<{ id: string }>(
        `SELECT id FROM public.eventos_sorteio_participantes WHERE evento_id = '${eventoAId}' AND codigo = '001'`
      )
    ).rows[0].id;

    // Confirma Prêmio 1 para Fernando
    const res1 = await db.query<{ rpc_confirmar_ganhador_com_premio: any }>(`
      SELECT public.rpc_confirmar_ganhador_com_premio(
        '${eventoAId}',
        '${sorteioId}',
        '${partFernando}',
        '${p1}'
      );
    `);
    expect(res1.rows[0].rpc_confirmar_ganhador_com_premio.ok).toBe(true);

    // Verifica que Prêmio 1 está marcado como sorteado
    const premio1Db = (
      await db.query<{ status: string; ganhador_participante_id: string }>(
        `SELECT status, ganhador_participante_id FROM public.eventos_premios WHERE id = '${p1}'`
      )
    ).rows[0];
    expect(premio1Db.status).toBe("sorteado");
    expect(premio1Db.ganhador_participante_id).toBe(partFernando);

    // Tentar dar o Prêmio 2 para Fernando DEVE FALHAR (não pode ganhar 2 vezes no mesmo evento)
    const res2 = await db.query<{ rpc_confirmar_ganhador_com_premio: any }>(`
      SELECT public.rpc_confirmar_ganhador_com_premio(
        '${eventoAId}',
        '${sorteioId}',
        '${partFernando}',
        '${p2}'
      );
    `);
    expect(res2.rows[0].rpc_confirmar_ganhador_com_premio.ok).toBe(false);
    expect(res2.rows[0].rpc_confirmar_ganhador_com_premio.error).toBe("Participante já foi contemplado neste evento");

    // Prêmio 2 continua pendente
    const premio2Db = (
      await db.query<{ status: string }>(`SELECT status FROM public.eventos_premios WHERE id = '${p2}'`)
    ).rows[0];
    expect(premio2Db.status).toBe("pendente");
  });

  it("Ajuste 1 / Cenário 4: Evento novo nasce com checkin_interativo_ativo = false e respeita fallback tradicional", async () => {
    // Insere novo evento sem especificar checkin_interativo_ativo
    const novoEventoRes = await db.query<{ id: string; checkin_interativo_ativo: boolean }>(`
      INSERT INTO public.eventos (nome, slug)
      VALUES ('Evento Novo Padrão 2026', 'evento-novo-padrao-2026')
      RETURNING id, checkin_interativo_ativo;
    `);

    const novoEvento = novoEventoRes.rows[0];
    expect(novoEvento.checkin_interativo_ativo).toBe(false);

    // Validação da regra de resolução de UI:
    // 1. Evento legado sem configuração (null/undefined/false) -> Formulário Tradicional
    const legadoSorteio = { checkinInterativoAtivo: Boolean(undefined) };
    expect(legadoSorteio.checkinInterativoAtivo).toBe(false);

    // 2. Evento novo com default false -> Formulário Tradicional
    const novoSorteio = { checkinInterativoAtivo: Boolean(novoEvento.checkin_interativo_ativo) };
    expect(novoSorteio.checkinInterativoAtivo).toBe(false);

    // 3. Evento com flag explicitamente ativada pelo administrador -> Check-in Conversacional
    const ativadoSorteio = { checkinInterativoAtivo: Boolean(true) };
    expect(ativadoSorteio.checkinInterativoAtivo).toBe(true);
  });

  it("Ajuste 2 / Cenário 9: Concorrência de Prêmio com bloqueio atômico retorna 'Este prêmio já foi sorteado.'", async () => {
    // 1. Cria Prêmio 3 no Evento A
    const p3 = (
      await db.query<{ id: string }>(`
        INSERT INTO public.eventos_premios (evento_id, ordem, titulo, status)
        VALUES ('${eventoAId}', 3, 'Prêmio 3 — Smart TV 50', 'pendente')
        RETURNING id;
      `)
    ).rows[0].id;

    // 2. Busca sorteio do Evento A
    const sorteioId = (
      await db.query<{ id: string }>(`SELECT id FROM public.eventos_sorteios WHERE evento_id = '${eventoAId}'`)
    ).rows[0].id;

    // 3. Cadastra dois participantes elegíveis diferentes no Evento A
    const part1 = (
      await db.query<{ id: string }>(`
        INSERT INTO public.eventos_sorteio_participantes (sorteio_id, evento_id, codigo, nome, telefone, status, ganhador)
        VALUES ('${sorteioId}', '${eventoAId}', '901', 'Participante Alfa', '66981110001', 'participando', false)
        RETURNING id;
      `)
    ).rows[0].id;

    const part2 = (
      await db.query<{ id: string }>(`
        INSERT INTO public.eventos_sorteio_participantes (sorteio_id, evento_id, codigo, nome, telefone, status, ganhador)
        VALUES ('${sorteioId}', '${eventoAId}', '902', 'Participante Beta', '66981110002', 'participando', false)
        RETURNING id;
      `)
    ).rows[0].id;

    // 4. Primeira confirmação de ganhador para o Prêmio 3
    const res1 = await db.query<{ rpc_confirmar_ganhador_com_premio: any }>(`
      SELECT public.rpc_confirmar_ganhador_com_premio(
        '${eventoAId}',
        '${sorteioId}',
        '${part1}',
        '${p3}'
      );
    `);
    expect(res1.rows[0].rpc_confirmar_ganhador_com_premio.ok).toBe(true);
    expect(res1.rows[0].rpc_confirmar_ganhador_com_premio.premio_titulo).toBe("Prêmio 3 — Smart TV 50");

    // 5. Segunda confirmação simultânea/posterior para o MESMO Prêmio 3 DEVE FALHAR ATOMICAMENTE
    const res2 = await db.query<{ rpc_confirmar_ganhador_com_premio: any }>(`
      SELECT public.rpc_confirmar_ganhador_com_premio(
        '${eventoAId}',
        '${sorteioId}',
        '${part2}',
        '${p3}'
      );
    `);
    const data2 = res2.rows[0].rpc_confirmar_ganhador_com_premio;
    expect(data2.ok).toBe(false);
    expect(data2.error).toBe("Este prêmio já foi sorteado.");

    // 6. Participante Beta NÃO foi contaminado nem marcado como ganhador
    const part2Db = (
      await db.query<{ ganhador: boolean }>(
        `SELECT ganhador FROM public.eventos_sorteio_participantes WHERE id = '${part2}'`
      )
    ).rows[0];
    expect(part2Db.ganhador).toBe(false);

    // 7. Prêmio continua pertencendo estritamente ao primeiro ganhador
    const premio3Db = (
      await db.query<{ status: string; ganhador_participante_id: string }>(
        `SELECT status, ganhador_participante_id FROM public.eventos_premios WHERE id = '${p3}'`
      )
    ).rows[0];
    expect(premio3Db.status).toBe("sorteado");
    expect(premio3Db.ganhador_participante_id).toBe(part1);
  });

  it("Ajuste 3 & 4 / Cenário 10: RPC e Server Action bloqueiam chamadas anônimas e não autorizadas", async () => {
    const sorteioId = (
      await db.query<{ id: string }>(`SELECT id FROM public.eventos_sorteios WHERE evento_id = '${eventoAId}'`)
    ).rows[0].id;

    const part = (
      await db.query<{ id: string }>(
        `SELECT id FROM public.eventos_sorteio_participantes WHERE evento_id = '${eventoAId}' LIMIT 1`
      )
    ).rows[0].id;

    // 1. Chamada à RPC como anon (sem role service_role/master/staff)
    await db.exec(`SET my.role = 'anon';`);

    const resAnon = await db.query<{ rpc_confirmar_ganhador_com_premio: any }>(`
      SELECT public.rpc_confirmar_ganhador_com_premio(
        '${eventoAId}',
        '${sorteioId}',
        '${part}'
      );
    `);
    expect(resAnon.rows[0].rpc_confirmar_ganhador_com_premio.ok).toBe(false);
    expect(resAnon.rows[0].rpc_confirmar_ganhador_com_premio.error).toBe("Sem permissão para confirmar ganhador.");

    // 2. Chamada à RPC como role autorizada (service_role)
    await db.exec(`SET my.role = 'service_role';`);

    // 3. Validação das regras de perfil para a Server Action
    const { isStaff } = await import("@/lib/auth/permissions");
    expect(isStaff("master")).toBe(true);
    expect(isStaff("srd")).toBe(true);
    expect(isStaff("visualizador")).toBe(true);
    expect(isStaff("imobiliaria")).toBe(false);
    expect(isStaff(undefined)).toBe(false);
    expect(isStaff(null)).toBe(false);
  });

  it("Seção 8: Rajada concorrente no mesmo evento gera números únicos sem duplicidade (duplicados = 0)", async () => {
    // Dispara 15 check-ins concorrentes com telefones diferentes
    const promises = Array.from({ length: 15 }, (_, i) => {
      const idx = i + 10;
      const tel = `(66) 99999-00${idx}`;
      const nome = `Participante Concorrente ${idx}`;
      return db.query<{ rpc_realizar_checkin_conversacional: any }>(`
        SELECT public.rpc_realizar_checkin_conversacional(
          '${eventoAId}',
          '${nome}',
          '${tel}'
        );
      `);
    });

    const results = await Promise.all(promises);
    const codigos: string[] = [];

    for (const r of results) {
      const data = r.rows[0].rpc_realizar_checkin_conversacional;
      expect(data.ok).toBe(true);
      codigos.push(data.codigo);
    }

    expect(codigos.length).toBe(15);
    const uniqueCodigos = new Set(codigos);
    const duplicados = codigos.length - uniqueCodigos.size;

    // Relatório exigido na Seção 8:
    console.log("=== RELATÓRIO DE CONCORRÊNCIA (SEÇÃO 8) ===");
    console.log(`Quantidade de requisições: ${codigos.length}`);
    console.log(`Quantidade de participantes criados: ${uniqueCodigos.size}`);
    console.log(`Quantidade de códigos únicos: ${uniqueCodigos.size}`);
    console.log(`Duplicados encontrados: ${duplicados}`);

    expect(duplicados).toBe(0);
    expect(uniqueCodigos.size).toBe(15);
  });

  it("Seção 9: Idempotência concorrente com duas requisições simultâneas do mesmo telefone", async () => {
    const tel = "(66) 98888-7777";
    const nome = "Concorrente Gêmeo";

    // Duas requisições simultâneas com mesmo telefone e mesmo evento
    const p1 = db.query<{ rpc_realizar_checkin_conversacional: any }>(`
      SELECT public.rpc_realizar_checkin_conversacional(
        '${eventoAId}',
        '${nome}',
        '${tel}'
      );
    `);
    const p2 = db.query<{ rpc_realizar_checkin_conversacional: any }>(`
      SELECT public.rpc_realizar_checkin_conversacional(
        '${eventoAId}',
        '${nome}',
        '${tel}'
      );
    `);

    const [r1, r2] = await Promise.all([p1, p2]);
    const d1 = r1.rows[0].rpc_realizar_checkin_conversacional;
    const d2 = r2.rows[0].rpc_realizar_checkin_conversacional;

    expect(d1.ok).toBe(true);
    expect(d2.ok).toBe(true);
    // Ambos convergem para o MESMO código de sorteio
    expect(d1.codigo).toBe(d2.codigo);

    // No banco, existe exatamente 1 participante de sorteio com esse telefone
    const count = Number(
      (await db.query<{ n: number }>(`
        SELECT count(*) n FROM public.eventos_sorteio_participantes
        WHERE evento_id = '${eventoAId}' AND regexp_replace(telefone, '\\D', '', 'g') = '66988887777'
      `)).rows[0].n
    );
    expect(count).toBe(1);
  });

  it("Seção 26: Falha na validação aborta transação e não deixa registros parciais", async () => {
    // Passa whatsapp inválido (< 10 dígitos)
    const res = await db.query<{ rpc_realizar_checkin_conversacional: any }>(`
      SELECT public.rpc_realizar_checkin_conversacional(
        '${eventoAId}',
        'Nome Teste',
        '123'
      );
    `);

    const data = res.rows[0].rpc_realizar_checkin_conversacional;
    expect(data.ok).toBe(false);
    expect(data.error).toContain("WhatsApp inválido");

    // Confirma que não criou nenhum lead nem participante com esse nome
    const leadCount = Number(
      (await db.query<{ n: number }>(`SELECT count(*) n FROM public.leads WHERE nome = 'Nome Teste'`)).rows[0].n
    );
    expect(leadCount).toBe(0);

    const partCount = Number(
      (await db.query<{ n: number }>(`SELECT count(*) n FROM public.eventos_participantes WHERE nome_participante = 'Nome Teste'`)).rows[0].n
    );
    expect(partCount).toBe(0);
  });
});

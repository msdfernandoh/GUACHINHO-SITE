-- Migration 051: Fase 4 — Contract: revoga RLS pública legada de cartas contempladas
-- Data: 09/08/2026
-- Objetivo: Fechar o SELECT público direto de anon/authenticated em public.cartas_contempladas.
-- O catálogo comercial passa a ser lido exclusivamente via runtime server-side tenant-scoped (createAdminClient).

DROP POLICY IF EXISTS cartas_public_read ON public.cartas_contempladas;

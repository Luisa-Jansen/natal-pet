import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { json } from '../../lib/http';
import { carregarConfig } from '../../lib/db';
import { SITE } from '../../config.js';

export const prerender = false;

// GET /api/config  ->  dados públicos da campanha (para as telas de modalidade)
export const GET: APIRoute = async () => {
  const db = (env as any).DB as import('@cloudflare/workers-types').D1Database | undefined;
  let cfg: Record<string, string> = {};
  if (db) {
    try {
      cfg = await carregarConfig(db);
    } catch {
      /* usa defaults abaixo */
    }
  }

  let telefones: string[] = SITE.whatsapp;
  try {
    if (cfg.telefones) telefones = JSON.parse(cfg.telefones);
  } catch {}

  return json({
    ano: cfg.campanha_ano || String(SITE.ano),
    nome: cfg.campanha_nome || SITE.nome,
    marca: cfg.campanha_marca || SITE.marca,
    slogan: cfg.campanha_slogan || SITE.slogan,
    descricao: cfg.campanha_descricao || SITE.descricao,
    pix_chave: cfg.pix_chave || '',
    pix_qr_url: cfg.pix_qr_url || '',
    endereco_entrega: cfg.endereco_entrega || '',
    orientacoes_entrega: cfg.orientacoes_entrega || '',
    telefones,
  });
};

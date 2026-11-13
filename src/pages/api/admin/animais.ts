import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { D1Database } from '@cloudflare/workers-types';
import { json } from '../../../lib/http';
import { categorizar } from '../../../lib/categorias.js';
import { obterAnimal, registrarHistorico } from '../../../lib/db';

export const prerender = false;

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'pet';

// Normaliza o enquadramento da foto para "X% Y%" (0–100). Default: '50% 42%'.
function normalizarPosicao(v: unknown): string {
  const m = String(v ?? '').trim().match(/^(\d{1,3})%?\s+(\d{1,3})%?$/);
  if (!m) return '50% 42%';
  const x = Math.min(100, Math.max(0, parseInt(m[1], 10)));
  const y = Math.min(100, Math.max(0, parseInt(m[2], 10)));
  return `${x}% ${y}%`;
}

// Salva o object-position em separado (best-effort): se a coluna ainda não
// existir no banco, não quebra o salvamento principal do animal.
async function salvarPosicao(db: D1Database, id: string, pos: string): Promise<void> {
  try {
    await db.prepare("UPDATE animais SET foto_posicao = ? WHERE id = ?").bind(pos, id).run();
  } catch {
    /* coluna foto_posicao ausente — rode a migração 001_foto_posicao.sql */
  }
}

// POST /api/admin/animais
//  acao: 'salvar'  -> cria/edita um animal
//  acao: 'ativo'   -> ativa/desativa a cartinha
export const POST: APIRoute = async ({ request, locals }) => {
  const db = (env as any).DB as D1Database | undefined;
  if (!db) return json({ erro: 'Banco indisponível' }, 503);
  const quem = locals.admin?.email || 'admin';

  let b: Record<string, unknown>;
  try {
    b = await request.json();
  } catch {
    return json({ erro: 'Requisição inválida' }, 400);
  }
  const acao = String(b.acao ?? 'salvar');
  const str = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

  // ----- ativar / desativar -----
  if (acao === 'ativo') {
    const id = str(b.id, 60);
    const ativo = b.ativo ? 1 : 0;
    if (!id) return json({ erro: 'id obrigatório' }, 400);
    await db.prepare("UPDATE animais SET ativo = ?, atualizado_em = datetime('now') WHERE id = ?").bind(ativo, id).run();
    await registrarHistorico(db, 'animal', id, ativo ? 'ativado' : 'desativado', '', quem);
    return json({ ok: true });
  }

  // ----- criar / editar -----
  const nome = str(b.nome, 80);
  if (nome.length < 1) return json({ erro: 'Informe o nome.' }, 400);

  const especie = ['cachorro', 'gato', 'indefinido'].includes(String(b.especie)) ? String(b.especie) : 'indefinido';
  const historia = str(b.historia, 1000);
  const pedido = str(b.pedido, 400);
  const cartinha = str(b.cartinha, 2000) || `${historia} Papai Noel, neste Natal eu queria muito ganhar ${pedido}.`.trim();
  const foto = str(b.foto, 300);
  const fotoPosicao = normalizarPosicao(b.foto_posicao);
  const categoria = ['cama', 'conforto', 'brinquedo', 'petisco', 'outros'].includes(String(b.categoria))
    ? String(b.categoria)
    : categorizar(pedido);

  let linksCompra = '[]';
  if (Array.isArray(b.links_compra)) {
    const limpos = (b.links_compra as Array<Record<string, unknown>>)
      .map((l) => ({ label: str(l.label, 80), url: str(l.url, 400) }))
      .filter((l) => l.url);
    linksCompra = JSON.stringify(limpos);
  }

  const idExistente = str(b.id, 60);
  if (idExistente) {
    // editar
    const atual = await obterAnimal(db, idExistente);
    if (!atual) return json({ erro: 'Animal não encontrado.' }, 404);
    await db
      .prepare(
        `UPDATE animais SET nome=?, especie=?, historia=?, pedido=?, cartinha=?, foto=?, categoria=?, links_compra=?, atualizado_em=datetime('now') WHERE id=?`
      )
      .bind(nome, especie, historia, pedido, cartinha, foto, categoria, linksCompra, idExistente)
      .run();
    await salvarPosicao(db, idExistente, fotoPosicao);
    await registrarHistorico(db, 'animal', idExistente, 'editado', nome, quem);
    return json({ ok: true, id: idExistente });
  }

  // criar com id único a partir do nome
  let id = slug(nome);
  for (let i = 2; await obterAnimal(db, id); i++) id = `${slug(nome)}-${i}`;
  const ordem = (await db.prepare('SELECT COALESCE(MAX(ordem),0)+1 AS n FROM animais').first<{ n: number }>())?.n ?? 0;
  await db
    .prepare(
      `INSERT INTO animais (id, nome, especie, historia, pedido, cartinha, foto, categoria, links_compra, ativo, status, ordem)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'disponivel', ?)`
    )
    .bind(id, nome, especie, historia, pedido, cartinha, foto, categoria, linksCompra, ordem)
    .run();
  await salvarPosicao(db, id, fotoPosicao);
  await registrarHistorico(db, 'animal', id, 'criado', nome, quem);
  return json({ ok: true, id }, 201);
};

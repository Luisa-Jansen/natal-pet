import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { D1Database, KVNamespace } from '@cloudflare/workers-types';
import { json } from '../../lib/http';
import { registrarHistorico } from '../../lib/db';

export const prerender = false;

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const TIPOS_OK = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

// POST /api/comprovante  (multipart/form-data: codigo, arquivo)
// Sobe o comprovante do PIX para o KV e marca a reserva como aguardando_presente.
export const POST: APIRoute = async ({ request }) => {
  const db = (env as any).DB as D1Database | undefined;
  const uploads = (env as any).UPLOADS as KVNamespace | undefined;
  if (!db || !uploads) return json({ erro: 'Armazenamento indisponível' }, 503);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ erro: 'Envio inválido' }, 400);
  }

  const codigo = String(form.get('codigo') ?? '').trim();
  const arquivo = form.get('arquivo');
  if (!codigo) return json({ erro: 'Reserva não informada' }, 400);
  if (!(arquivo instanceof File) || arquivo.size === 0) return json({ erro: 'Selecione um arquivo' }, 400);
  if (arquivo.size > MAX_BYTES) return json({ erro: 'Arquivo muito grande (máx. 8 MB)' }, 413);

  const tipo = arquivo.type || 'application/octet-stream';
  if (!TIPOS_OK.includes(tipo)) return json({ erro: 'Envie uma imagem (PNG/JPG) ou PDF' }, 415);

  const reserva = await db
    .prepare('SELECT id, animal_id, status FROM reservas WHERE codigo = ?')
    .bind(codigo)
    .first<{ id: number; animal_id: string; status: string }>();
  if (!reserva) return json({ erro: 'Reserva não encontrada' }, 404);
  if (reserva.status === 'cancelada') return json({ erro: 'Esta reserva foi cancelada.' }, 409);

  const chave = `comprovantes/${codigo}-${Date.now()}.${EXT[tipo] || 'bin'}`;
  await uploads.put(chave, await arquivo.arrayBuffer(), { metadata: { contentType: tipo } });
  const url = `/uploads/${chave}`;

  const novoStatus = reserva.status === 'reservada' ? 'aguardando_presente' : reserva.status;
  await db.batch([
    db
      .prepare("UPDATE reservas SET comprovante_url = ?, status = ?, atualizado_em = datetime('now') WHERE id = ?")
      .bind(url, novoStatus, reserva.id),
    db
      .prepare("UPDATE animais SET status = ?, atualizado_em = datetime('now') WHERE id = ?")
      .bind(novoStatus, reserva.animal_id),
  ]);

  await registrarHistorico(db, 'reserva', codigo, 'comprovante_enviado', chave);
  return json({ ok: true, url, status: novoStatus });
};

// ============================================================================
//  Autenticação do painel administrativo.
//  Sessão guardada no banco (tabela `sessoes`); o cookie carrega só o token.
// ============================================================================
import type { D1Database } from '@cloudflare/workers-types';

export const COOKIE = 'np_sessao';
const DIAS = 7;

export interface Admin {
  id: number;
  email: string;
  nome: string | null;
}

/** Cria uma sessão e devolve o token (a ser gravado no cookie). */
export async function criarSessao(db: D1Database, usuarioId: number): Promise<string> {
  const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');
  const expira = new Date(Date.now() + DIAS * 86400_000).toISOString();
  await db
    .prepare('INSERT INTO sessoes (id, usuario_id, expira_em) VALUES (?, ?, ?)')
    .bind(token, usuarioId, expira)
    .run();
  return token;
}

/** Remove a sessão (logout). */
export async function destruirSessao(db: D1Database, token: string): Promise<void> {
  await db.prepare('DELETE FROM sessoes WHERE id = ?').bind(token).run();
}

/** Valida o token e devolve o admin, ou null. Limpa sessões expiradas. */
export async function adminDoToken(db: D1Database, token: string | undefined): Promise<Admin | null> {
  if (!token) return null;
  const linha = await db
    .prepare(
      `SELECT u.id, u.email, u.nome, s.expira_em
       FROM sessoes s JOIN usuarios_admin u ON u.id = s.usuario_id
       WHERE s.id = ?`
    )
    .bind(token)
    .first<{ id: number; email: string; nome: string | null; expira_em: string }>();
  if (!linha) return null;
  if (new Date(linha.expira_em).getTime() < Date.now()) {
    await destruirSessao(db, token).catch(() => {});
    return null;
  }
  return { id: linha.id, email: linha.email, nome: linha.nome };
}

/** Opções do cookie de sessão. */
export function opcoesCookie(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: DIAS * 86400,
  };
}

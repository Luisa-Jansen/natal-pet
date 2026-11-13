# 🎄 Adote uma Carta de Natal PET

Plataforma da campanha **"Adote uma Carta"** do Shopping Cerrado: pets de abrigo
escreveram cartinhas de Natal e o visitante pode **se tornar padrinho**, escolher como
presentear e acompanhar tudo — enquanto o abrigo administra a campanha por um painel próprio.

Feita em **Astro + Cloudflare Workers + D1 + R2**, hospedada no GitHub e publicada no Cloudflare.

## ✨ O que o site faz

### Para o visitante (padrinho)
- Galeria com os pets, cada um com foto, história e cartinha completa.
- **Busca** por nome/pedido e **filtros** por espécie (cão/gato), tipo de presente e disponibilidade.
- **Reserva da cartinha dentro do site** (não depende mais de atendimento manual):
  1. Escolhe o pet → vê a cartinha → **Adotar esta carta**
  2. Preenche nome, WhatsApp e e-mail
  3. Escolhe a modalidade: **PIX** (chave + QR + comprovante), **Compra online** (links) ou **Entrega presencial** (endereço)
  4. Recebe uma **tela de sucesso** com o código da reserva
- A cartinha vira **Reservada** na hora e some das disponíveis. **Reserva dupla é bloqueada** no banco.
- Os **contadores são calculados do banco de dados** (nada fixo).

### Para o abrigo (painel administrativo em `/admin`)
- **Login protegido** por sessão.
- **Dashboard** com total de animais, disponíveis, reservadas, aguardando presente, recebidos e concluídas.
- **Animais**: cadastrar, editar, enviar/trocar foto, links de compra, ativar/desativar.
- **Presentes**: confirmar recebimento, ver comprovantes, concluir e **liberar** cartinhas (desistência).
- **Padrinhos**: nome, contato, animal, modalidade, status e data.
- **Configurações**: chave PIX, QR Code, endereço, telefones, textos e **ano da campanha**.

## 🗂️ Estrutura do projeto

```
├── public/pets/            # fotos iniciais dos pets (.png)
├── db/
│   ├── schema.sql          # todas as tabelas (idempotente)
│   └── seed.mjs            # gera db/seed.sql a partir de pets.json (83 animais, config, admin)
├── src/
│   ├── data/pets.json      # dados originais (fonte do seed + fallback)
│   ├── config.js           # textos/contatos de fallback
│   ├── lib/
│   │   ├── db.ts           # acesso ao banco, status, senhas (PBKDF2)
│   │   ├── auth.ts         # sessões do admin
│   │   └── categorias.js   # categorias de presente (filtros)
│   ├── middleware.ts       # protege /admin e /api/admin
│   ├── pages/
│   │   ├── index.astro     # home (lê do D1, fallback no JSON)
│   │   ├── admin/*.astro   # painel (login, dashboard, animais, presentes, padrinhos, configurações)
│   │   ├── uploads/[...chave].ts   # serve arquivos do R2
│   │   └── api/            # status, config, reservar, reserva/[codigo], comprovante, admin/*
│   ├── scripts/            # app.js (site) + admin-animais.js (painel)
│   └── styles/global.css
└── wrangler.toml           # bindings do Cloudflare (D1 + R2)
```

## 💻 Rodar no seu computador

Pré-requisito: [Node.js](https://nodejs.org) 20+.

```bash
npm install          # instala as dependências (só na primeira vez)
npm run setup:local  # cria o banco LOCAL + popula os 83 animais, config e admin
npm run dev          # abre em http://localhost:4321
```

Painel: http://localhost:4321/admin
- **Login inicial:** `admin@natalpet.com.br` · senha `natal2026`
- **Troque a senha** no primeiro acesso em **Configurações → Trocar minha senha**.

> Para usar outro e-mail/senha inicial: `ADMIN_EMAIL=... ADMIN_SENHA=... npm run db:seed` antes do `setup:local`.

## 🚀 Publicar na internet (Cloudflare)

### 1. Criar o bucket de arquivos R2 (uma única vez)
```bash
npx wrangler login
npm run r2:create          # cria o bucket "natal-pet-uploads" (fotos e comprovantes)
```

### 2. Criar o banco D1 e popular (uma única vez)
O `database_id` já está no `wrangler.toml`. Se precisar recriar:
```bash
npm run db:create          # mostra um novo database_id (cole no wrangler.toml)
```
Aplique o schema e o seed no banco de produção:
```bash
npm run setup:remote       # schema + 83 animais + config + admin no banco remoto
```

### 3. Deploy
```bash
git add . && git commit -m "..." && git push    # se o deploy automático estiver ligado
# ou, manualmente:
npm run deploy
```

### Consultar reservas de produção
```bash
npm run db:reservas
```

## 🔧 Observações técnicas

- As rotas `/api/*`, `/admin/*` e `/uploads/*` rodam no Worker e falam com D1/R2.
- A home cai para `src/data/pets.json` se o banco estiver indisponível (o site nunca quebra).
- Reserva dupla é impedida por um índice único parcial em `reservas(animal_id)`.
- Nenhuma contribuição é marcada como recebida automaticamente — o abrigo confirma no painel.
- Senhas de admin usam PBKDF2 (WebCrypto), compatível entre o seed (Node) e o Worker.
- **Editar o conteúdo** agora é pelo painel; `pets.json`/`config.js` servem de base inicial e fallback.

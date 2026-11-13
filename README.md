# 🎄 Adote uma Carta de Natal PET

Site da campanha **"Adote uma Carta"** do Shopping Cerrado: 83 pets de abrigo
escreveram cartinhas de Natal e esperam que alguém realize seus pedidos.

Versão nova, independente e dinâmica — feita em **Astro + Cloudflare Workers + D1**,
hospedada no GitHub e publicada no Cloudflare.

## ✨ O que o site faz

- Galeria com os **83 pets**, cada um com foto, história e cartinha completa.
- **Busca** por nome/pedido e **filtros** por espécie (cão/gato), tipo de presente e disponibilidade.
- **Modal** com a cartinha de cada pet.
- Botão **"Adotar esta carta"**: o padrinho deixa o nome e é levado ao **WhatsApp** com uma mensagem pronta.
- A adoção é **salva no banco de dados (D1)** — a cartinha passa a aparecer como "realizada" e **não pode ser adotada duas vezes** (contador ao vivo).

## 🗂️ Estrutura do projeto

```
├── public/pets/            # as 83 fotos dos pets (.png)
├── src/
│   ├── data/pets.json      # TODOS os dados: nome, história, cartinha, pedido, foto
│   ├── config.js           # textos da campanha e números de WhatsApp
│   ├── lib/categorias.js   # categorias de presente (para os filtros)
│   ├── layouts/Layout.astro
│   ├── pages/
│   │   ├── index.astro     # a página inteira (hero, galeria, modal)
│   │   └── api/
│   │       ├── status.ts   # GET  -> cartinhas já adotadas
│   │       └── adotar.ts   # POST -> registra uma adoção
│   ├── scripts/app.js      # busca, filtros, modal, adoção, contador
│   └── styles/global.css   # tema de Natal
├── db/schema.sql           # estrutura da tabela de adoções
└── wrangler.toml           # configuração do Cloudflare (bindings)
```

## ✏️ Como editar o conteúdo

- **Textos da campanha / WhatsApp:** edite `src/config.js`.
- **Pets (nome, história, cartinha, pedido):** edite `src/data/pets.json`.
- **Trocar uma foto:** substitua o arquivo em `public/pets/` (mantendo o mesmo nome) ou aponte o campo `foto` no JSON.
- **Cores / visual:** variáveis de cor no topo de `src/styles/global.css`.

Toda alteração, ao ser enviada para o GitHub, publica sozinha (veja o deploy automático).

## 💻 Rodar no seu computador

Pré-requisito: [Node.js](https://nodejs.org) 20+.

```bash
npm install          # instala as dependências (só na primeira vez)
npm run db:local     # cria o banco de dados LOCAL (só na primeira vez)
npm run dev          # abre em http://localhost:4321
```

## 🚀 Publicar na internet (GitHub + Cloudflare)

### 1. Enviar o código para o GitHub

```bash
git add .
git commit -m "Primeira versão do site"
git push
```

(O repositório já está configurado: `github.com/Luisa-Jansen/natal-pet`.)

### 2. Criar o banco de dados D1 (uma única vez)

Faça login no Cloudflare e crie o banco:

```bash
npx wrangler login
npm run db:create          # cria o banco e mostra um "database_id"
```

Copie o **`database_id`** que apareceu e cole no arquivo `wrangler.toml`,
no lugar de `COLE-AQUI-O-ID-GERADO-PELO-WRANGLER`. Depois crie a tabela:

```bash
npm run db:remote          # cria a tabela de adoções no banco de produção
```

### 3. Conectar o repositório no Cloudflare (deploy automático)

No painel da Cloudflare: **Workers & Pages → Create → Workers → Import a repository**
e selecione o repositório `natal-pet`. A Cloudflare detecta o Astro sozinho.
Confirme as configurações:

- **Build command:** `npm run build`
- **Deploy command:** `npx wrangler deploy`

A partir daí, **todo `git push` publica o site automaticamente**. 🎉

> **Alternativa manual (sem GitHub):** `npm run deploy` publica direto do seu computador.

### 4. Ver quem adotou as cartinhas

```bash
npm run db:adocoes         # lista todas as adoções registradas
```

## 🔧 Observações técnicas

- O site é renderizado estático (rápido, servido pela borda da Cloudflare); apenas
  as rotas `/api/*` rodam no Worker e falam com o banco D1.
- `pet_id` é único no banco: garante que cada cartinha só seja adotada uma vez.
- As fotos foram baixadas para `public/pets/` — o site **não depende** mais do RD Station.

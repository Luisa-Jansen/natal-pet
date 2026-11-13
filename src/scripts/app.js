// ====== Lógica do cliente: busca, filtros, modal e adoção em etapas ======

const PETS = JSON.parse(document.getElementById('dados-pets').textContent);
const CONFIG = JSON.parse(document.getElementById('dados-config').textContent);
const porId = Object.fromEntries(PETS.map((p) => [p.id, p]));

const adotadas = new Set(); // ids indisponíveis (reservada/aguardando/etc.)
let petAtual = null;
let reservaAtual = null; // { codigo, modalidade, ...detalhes }
let CAMPANHA = null; // dados públicos (PIX, endereço, telefones...) — carregados sob demanda

// ---------- elementos ----------
const grade = document.getElementById('grade');
const cards = [...grade.querySelectorAll('.card')];
const inputBusca = document.getElementById('busca');
const nResultado = document.getElementById('n-resultado');
const vazio = document.getElementById('vazio');
const modal = document.getElementById('modal');
const toastEl = document.getElementById('toast');
const conteudo = document.querySelector('.modal-conteudo');

const filtros = { especie: 'todos', categoria: 'todos', status: 'todos', texto: '' };

const especieLabel = { cachorro: 'Cachorro', gato: 'Gato', indefinido: 'Pet' };
const modalidadeLabel = { pix: 'PIX', compra_online: 'Compra online', entrega_presencial: 'Entrega presencial' };
const semAcento = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const $ = (id) => document.getElementById(id);

// ---------- contador / estatísticas ----------
function atualizarContadores() {
  const n = adotadas.size;
  const disp = PETS.length - n;
  $('chip-num').textContent = n;
  $('stat-adotadas').textContent = n;
  $('stat-disponiveis').textContent = disp;
}

function marcarAdotada(id) {
  adotadas.add(id);
  const card = cards.find((c) => c.dataset.id === id);
  if (card) card.classList.add('adotada');
}

// ---------- status do backend ----------
async function carregarStatus() {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) return;
    const data = await res.json();
    (data.adotadas || []).forEach(marcarAdotada);
    atualizarContadores();
    aplicarFiltros();
  } catch (e) {
    console.warn('Não foi possível carregar o status das cartinhas.', e);
  }
}

// ---------- config pública (lazy) ----------
async function carregarCampanha() {
  if (CAMPANHA) return CAMPANHA;
  try {
    const res = await fetch('/api/config');
    CAMPANHA = res.ok ? await res.json() : {};
  } catch {
    CAMPANHA = {};
  }
  return CAMPANHA;
}

// ---------- filtros ----------
function aplicarFiltros() {
  let visiveis = 0;
  for (const card of cards) {
    const id = card.dataset.id;
    const estaAdotada = adotadas.has(id);
    const okEspecie = filtros.especie === 'todos' || card.dataset.especie === filtros.especie;
    const okCategoria = filtros.categoria === 'todos' || card.dataset.categoria === filtros.categoria;
    const okStatus =
      filtros.status === 'todos' ||
      (filtros.status === 'adotada' && estaAdotada) ||
      (filtros.status === 'disponivel' && !estaAdotada);
    const okTexto = !filtros.texto || card.dataset.busca.includes(filtros.texto);
    const mostrar = okEspecie && okCategoria && okStatus && okTexto;
    card.style.display = mostrar ? '' : 'none';
    if (mostrar) visiveis++;
  }
  nResultado.textContent = visiveis;
  vazio.style.display = visiveis === 0 ? 'block' : 'none';
}

document.querySelectorAll('.pilula').forEach((btn) => {
  btn.addEventListener('click', () => {
    filtros[btn.dataset.f] = btn.dataset.v;
    btn.parentElement.querySelectorAll('.pilula').forEach((b) =>
      b.setAttribute('aria-pressed', String(b === btn))
    );
    aplicarFiltros();
  });
});

let debounce;
inputBusca.addEventListener('input', () => {
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    filtros.texto = semAcento(inputBusca.value.trim());
    aplicarFiltros();
  }, 150);
});

// ---------- navegação entre telas do modal ----------
function mostrarTela(nome) {
  conteudo.querySelectorAll('.tela').forEach((t) => {
    t.classList.toggle('ativa', t.dataset.tela === nome);
  });
  conteudo.scrollTop = 0;
}

// ---------- modal ----------
function abrirModal(id) {
  const pet = porId[id];
  if (!pet) return;
  petAtual = pet;
  reservaAtual = null;

  $('modal-img').src = pet.foto;
  $('modal-img').alt = 'Foto de ' + pet.nome;
  $('modal-img').style.objectPosition = pet.pos || '50% 42%';
  $('modal-nome').textContent = pet.nome;
  $('modal-especie').textContent = especieLabel[pet.especie] || especieLabel.indefinido;
  $('modal-carta').textContent = pet.cartinha;
  $('modal-pedido').textContent = pet.pedido;

  const jaAdotada = adotadas.has(id);
  $('btn-adotar').style.display = jaAdotada ? 'none' : '';
  $('aviso-adotada').style.display = jaAdotada ? 'block' : 'none';

  limparErro();
  $('form-cadastro').reset();
  mostrarTela('carta');

  modal.classList.add('aberto');
  document.body.style.overflow = 'hidden';
}

function fecharModal() {
  modal.classList.remove('aberto');
  document.body.style.overflow = '';
  petAtual = null;
  reservaAtual = null;
}

cards.forEach((card) => {
  card.addEventListener('click', () => abrirModal(card.dataset.id));
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      abrirModal(card.dataset.id);
    }
  });
});

$('fechar').addEventListener('click', fecharModal);
modal.addEventListener('click', (e) => {
  if (e.target === modal) fecharModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal.classList.contains('aberto')) fecharModal();
});

// botões "Voltar" e "ir para tela" declarativos
conteudo.addEventListener('click', (e) => {
  const voltar = e.target.closest('[data-voltar]');
  if (voltar) {
    mostrarTela(voltar.dataset.voltar);
    return;
  }
  const ir = e.target.closest('[data-ir]');
  if (ir) {
    mostrarTela(ir.dataset.ir);
  }
});

$('btn-adotar').addEventListener('click', () => {
  mostrarTela('cadastro');
  carregarCampanha();
  $('f-nome').focus();
});

$('btn-fechar-sucesso').addEventListener('click', fecharModal);

// ---------- erros ----------
function mostrarErro(msg) {
  $('form-erro').textContent = msg;
}
function limparErro() {
  $('form-erro').textContent = '';
}

// ---------- toast ----------
let toastTimer;
function toast(msg, erro = false) {
  toastEl.textContent = msg;
  toastEl.classList.toggle('erro', erro);
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 4000);
}

// ---------- ETAPA 2: cria a reserva ----------
$('form-cadastro').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!petAtual) return;
  limparErro();

  const nome = $('f-nome').value.trim();
  const whatsapp = $('f-whatsapp').value.trim();
  const email = $('f-email').value.trim();
  const modalidade = (conteudo.querySelector('input[name="modalidade"]:checked') || {}).value;

  if (nome.length < 2) return mostrarErro('Informe seu nome completo.');
  if (!whatsapp && !email) return mostrarErro('Informe um WhatsApp ou e-mail para contato.');
  if (!modalidade) return mostrarErro('Escolha como deseja presentear.');

  const btn = $('btn-confirmar-reserva');
  btn.disabled = true;
  btn.textContent = 'Reservando...';

  try {
    const res = await fetch('/api/reservar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ animalId: petAtual.id, nome, whatsapp, email, modalidade }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.status === 409) {
      marcarAdotada(petAtual.id);
      atualizarContadores();
      aplicarFiltros();
      toast(data.erro || 'Essa cartinha acabou de ser reservada. Escolha outra.', true);
      fecharModal();
      return;
    }
    if (!res.ok) throw new Error(data.erro || 'Falha no servidor');

    // sucesso: a cartinha agora está reservada
    reservaAtual = { codigo: data.codigo, modalidade, nome };
    marcarAdotada(petAtual.id);
    atualizarContadores();
    aplicarFiltros();
    await irParaModalidade(modalidade);
  } catch (err) {
    console.error(err);
    mostrarErro('Não foi possível reservar agora. Tente novamente em instantes.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirmar reserva';
  }
});

// ---------- ETAPA 3/4/5: telas de cada modalidade ----------
async function irParaModalidade(modalidade) {
  const campanha = await carregarCampanha();

  if (modalidade === 'pix') {
    const chave = campanha.pix_chave || '';
    $('pix-chave').textContent = chave || '—';
    $('pix-chave-wrap').style.display = chave ? '' : 'none';
    $('pix-sem').style.display = chave ? 'none' : 'block';
    if (campanha.pix_qr_url) {
      $('pix-qr').src = campanha.pix_qr_url;
      $('pix-qr').style.display = '';
    } else {
      $('pix-qr').style.display = 'none';
    }
    $('comprovante-status').textContent = '';
    $('f-comprovante').value = '';
    mostrarTela('pix');
  } else if (modalidade === 'compra_online') {
    const cont = $('compra-links');
    cont.innerHTML = '';
    const links = await carregarLinksCompra();
    if (links.length) {
      $('compra-sem').style.display = 'none';
      links.forEach((l) => {
        const a = document.createElement('a');
        a.href = l.url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.className = 'btn btn-whatsapp btn-link-compra';
        a.textContent = l.label || 'Comprar presente';
        cont.appendChild(a);
      });
    } else {
      $('compra-sem').style.display = 'block';
    }
    mostrarTela('compra');
  } else {
    $('presencial-orientacoes').textContent =
      campanha.orientacoes_entrega || 'Leve o presente até o abrigo no horário combinado.';
    $('presencial-endereco').textContent = campanha.endereco_entrega || 'Endereço a combinar pelo WhatsApp.';
    $('f-previsao').value = '';
    mostrarTela('presencial');
  }
}

async function carregarLinksCompra() {
  if (!reservaAtual) return [];
  try {
    const res = await fetch('/api/reserva/' + encodeURIComponent(reservaAtual.codigo));
    if (!res.ok) return [];
    const d = await res.json();
    return (d.animal && d.animal.links_compra) || [];
  } catch {
    return [];
  }
}

// copiar chave PIX
$('btn-copiar-pix').addEventListener('click', async () => {
  const chave = $('pix-chave').textContent;
  try {
    await navigator.clipboard.writeText(chave);
    toast('Chave PIX copiada!');
  } catch {
    toast('Copie a chave manualmente.', true);
  }
});

// enviar comprovante
$('btn-enviar-comprovante').addEventListener('click', async () => {
  const input = $('f-comprovante');
  const file = input.files && input.files[0];
  if (!file) {
    $('comprovante-status').textContent = 'Selecione um arquivo primeiro.';
    return;
  }
  const btn = $('btn-enviar-comprovante');
  btn.disabled = true;
  $('comprovante-status').textContent = 'Enviando...';
  try {
    const fd = new FormData();
    fd.append('codigo', reservaAtual.codigo);
    fd.append('arquivo', file);
    const res = await fetch('/api/comprovante', { method: 'POST', body: fd });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.erro || 'Falha');
    $('comprovante-status').textContent = 'Comprovante enviado! Aguardando confirmação do abrigo.';
    atualizarStatusCartinha(petAtual && petAtual.id, 'aguardando_presente');
  } catch (err) {
    $('comprovante-status').textContent = 'Não foi possível enviar: ' + (err.message || 'tente de novo.');
  } finally {
    btn.disabled = false;
  }
});

// registrar compromisso de compra
$('btn-compra-registrar').addEventListener('click', async () => {
  await registrarCompromisso({});
  mostrarTela('sucesso');
});

// registrar previsão de entrega
$('btn-presencial-registrar').addEventListener('click', async () => {
  await registrarCompromisso({ previsao_entrega: $('f-previsao').value.trim() });
  mostrarTela('sucesso');
});

async function registrarCompromisso(extra) {
  if (!reservaAtual) return;
  try {
    await fetch('/api/reserva/' + encodeURIComponent(reservaAtual.codigo), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(extra || {}),
    });
    atualizarStatusCartinha(petAtual && petAtual.id, 'aguardando_presente');
  } catch (e) {
    console.warn('compromisso', e);
  }
}

function atualizarStatusCartinha(id, status) {
  if (!id) return;
  const card = cards.find((c) => c.dataset.id === id);
  if (card) card.dataset.status = status;
}

// ---------- ETAPA 6: tela de sucesso ----------
// preenche sempre que a tela de sucesso é exibida
const obsSucesso = new MutationObserver(() => {
  const tela = conteudo.querySelector('[data-tela="sucesso"]');
  if (tela && tela.classList.contains('ativa')) preencherSucesso();
});
obsSucesso.observe(conteudo.querySelector('[data-tela="sucesso"]'), {
  attributes: true,
  attributeFilter: ['class'],
});

function preencherSucesso() {
  if (!reservaAtual || !petAtual) return;
  $('suc-sub').textContent = `Você é padrinho(a) do(a) ${petAtual.nome}!`;
  $('suc-codigo').textContent = reservaAtual.codigo;
  $('suc-modalidade').textContent = modalidadeLabel[reservaAtual.modalidade] || reservaAtual.modalidade;
  $('suc-orientacoes').textContent = orientacaoPara(reservaAtual.modalidade);
}

function orientacaoPara(modalidade) {
  if (modalidade === 'pix')
    return 'Assim que o abrigo confirmar seu PIX, a cartinha ganha o selo de presente recebido. Guarde o código da reserva.';
  if (modalidade === 'compra_online')
    return 'Compromisso registrado! Finalize a compra pelo link escolhido. O abrigo confirma quando o presente chegar.';
  return 'Previsão registrada! Leve o presente até o abrigo no período combinado. O abrigo confirma o recebimento.';
}

// compartilhar no WhatsApp (canal complementar, nunca obrigatório)
$('btn-whatsapp-share').addEventListener('click', () => {
  if (!reservaAtual || !petAtual) return;
  const num = (CAMPANHA && CAMPANHA.telefones && CAMPANHA.telefones[0]) || (CONFIG.whatsapp && CONFIG.whatsapp[0]);
  const marca = (CAMPANHA && CAMPANHA.marca) || CONFIG.marca || '';
  const msg =
    `Olá! Acabei de apadrinhar a cartinha do(a) *${petAtual.nome}* na campanha "Adote uma Carta"${marca ? ' do ' + marca : ''}.\n` +
    `Quero presentear com: ${petAtual.pedido}.\n` +
    `Código da minha reserva: ${reservaAtual.codigo}.\n` +
    `Modalidade escolhida: ${modalidadeLabel[reservaAtual.modalidade] || reservaAtual.modalidade}.`;
  if (num) window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  else toast('WhatsApp não configurado.', true);
});

// ---------- início ----------
atualizarContadores();
carregarStatus();
carregarCampanha();

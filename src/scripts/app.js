// ====== Lógica do cliente: busca, filtros, modal, adoção, contador ======

const PETS = JSON.parse(document.getElementById('dados-pets').textContent);
const CONFIG = JSON.parse(document.getElementById('dados-config').textContent);
const porId = Object.fromEntries(PETS.map((p) => [p.id, p]));

const adotadas = new Set(); // ids já adotados
let petAtual = null;

// ---------- elementos ----------
const grade = document.getElementById('grade');
const cards = [...grade.querySelectorAll('.card')];
const inputBusca = document.getElementById('busca');
const nResultado = document.getElementById('n-resultado');
const vazio = document.getElementById('vazio');
const modal = document.getElementById('modal');
const toastEl = document.getElementById('toast');

const filtros = { especie: 'todos', categoria: 'todos', status: 'todos', texto: '' };

const especieLabel = { cachorro: 'Cachorro 🐶', gato: 'Gato 🐱', indefinido: 'Pet 🐾' };
const semAcento = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ---------- contador / estatísticas ----------
function atualizarContadores() {
  const n = adotadas.size;
  const disp = PETS.length - n;
  document.getElementById('chip-num').textContent = n;
  document.getElementById('stat-adotadas').textContent = n;
  document.getElementById('stat-disponiveis').textContent = disp;
}

// ---------- marca cards como adotados ----------
function marcarAdotada(id) {
  adotadas.add(id);
  const card = cards.find((c) => c.dataset.id === id);
  if (card) card.classList.add('adotada');
}

// ---------- busca o status no backend ----------
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
    const f = btn.dataset.f;
    const v = btn.dataset.v;
    filtros[f] = v;
    // atualiza o estado visual do grupo
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

// ---------- modal ----------
function abrirModal(id) {
  const pet = porId[id];
  if (!pet) return;
  petAtual = pet;

  document.getElementById('modal-img').src = pet.foto;
  document.getElementById('modal-img').alt = 'Foto de ' + pet.nome;
  document.getElementById('modal-nome').textContent = pet.nome;
  document.getElementById('modal-especie').textContent = especieLabel[pet.especie] || especieLabel.indefinido;
  document.getElementById('modal-carta').textContent = pet.cartinha;
  document.getElementById('modal-pedido').textContent = pet.pedido;

  const jaAdotada = adotadas.has(id);
  document.getElementById('btn-adotar').style.display = jaAdotada ? 'none' : '';
  document.getElementById('aviso-adotada').style.display = jaAdotada ? 'block' : 'none';

  // sempre volta para a tela de ações (não o formulário)
  mostrarFormulario(false);
  limparErro();

  modal.classList.add('aberto');
  document.body.style.overflow = 'hidden';
}

function fecharModal() {
  modal.classList.remove('aberto');
  document.body.style.overflow = '';
  petAtual = null;
}

function mostrarFormulario(mostrar) {
  document.getElementById('form-adocao').classList.toggle('ativo', mostrar);
  document.getElementById('acoes').classList.toggle('oculto', mostrar);
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

document.getElementById('fechar').addEventListener('click', fecharModal);
modal.addEventListener('click', (e) => {
  if (e.target === modal) fecharModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal.classList.contains('aberto')) fecharModal();
});

document.getElementById('btn-adotar').addEventListener('click', () => {
  mostrarFormulario(true);
  document.getElementById('f-nome').focus();
});
document.getElementById('btn-voltar').addEventListener('click', () => mostrarFormulario(false));

// ---------- erro do formulário ----------
function mostrarErro(msg) {
  document.getElementById('form-erro').textContent = msg;
}
function limparErro() {
  document.getElementById('form-erro').textContent = '';
}

// ---------- WhatsApp ----------
function abrirWhatsApp(pet, nome) {
  const num = CONFIG.whatsapp[0];
  const msg =
    `Olá! 🎄 Acabei de adotar a cartinha do(a) *${pet.nome}* na campanha "Adote uma Carta" do ${CONFIG.marca}.\n` +
    `Quero presentear com: ${pet.pedido}.\n` +
    (nome ? `Meu nome é ${nome}. ` : '') +
    `Como faço para entregar o presente? 🐾`;
  const url = `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank', 'noopener');
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

// ---------- envio da adoção ----------
document.getElementById('form-adocao').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!petAtual) return;
  limparErro();

  const nome = document.getElementById('f-nome').value.trim();
  const contato = document.getElementById('f-contato').value.trim();
  const cidade = document.getElementById('f-cidade').value.trim();
  if (nome.length < 2) {
    mostrarErro('Por favor, informe seu nome.');
    return;
  }

  const btn = document.getElementById('btn-confirmar');
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  try {
    const res = await fetch('/api/adotar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        petId: petAtual.id,
        petNome: petAtual.nome,
        pedido: petAtual.pedido,
        nome,
        contato,
        cidade,
      }),
    });

    if (res.status === 409) {
      // alguém adotou primeiro
      marcarAdotada(petAtual.id);
      atualizarContadores();
      aplicarFiltros();
      toast('Ahh! Alguém adotou essa cartinha agora há pouco. Escolha outra 💚', true);
      fecharModal();
      return;
    }
    if (!res.ok) throw new Error('Falha no servidor');

    const pet = petAtual;
    marcarAdotada(pet.id);
    atualizarContadores();
    aplicarFiltros();
    toast(`🎉 Obrigada! Você realizou o Natal do(a) ${pet.nome}!`);
    abrirWhatsApp(pet, nome);
    fecharModal();
  } catch (err) {
    console.error(err);
    mostrarErro('Não foi possível registrar agora. Tente novamente em instantes.');
  } finally {
    btn.disabled = false;
    btn.textContent = '✅ Confirmar e abrir o WhatsApp';
  }
});

// ---------- início ----------
atualizarContadores();
carregarStatus();

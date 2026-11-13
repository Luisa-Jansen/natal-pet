// ====== Painel admin: gestão de animais ======
const ANIMAIS = JSON.parse(document.getElementById('dados-animais').textContent);
const porId = Object.fromEntries(ANIMAIS.map((a) => [a.id, a]));
const $ = (id) => document.getElementById(id);

const painel = $('painel-form');
const msg = $('form-msg');

function setMsg(t, erro) {
  msg.textContent = t;
  msg.className = 'admin-msg ' + (erro ? 'err' : 'ok');
}

// ===== Enquadramento da foto (object-position) =====
const foco = $('enquadra-foco');
const enquadraImg = $('enquadra-img');
const enquadraValor = $('enquadra-valor');
const enquadraPreview = $('enquadra-preview');

function setPosicao(pos) {
  const m = String(pos || '').match(/(\d{1,3})%?\s+(\d{1,3})%?/);
  const x = m ? Math.min(100, Math.max(0, +m[1])) : 50;
  const y = m ? Math.min(100, Math.max(0, +m[2])) : 42;
  const valor = `${x}% ${y}%`;
  $('a-foto-posicao').value = valor;
  if (enquadraImg) enquadraImg.style.objectPosition = valor;
  if (foco) { foco.style.left = x + '%'; foco.style.top = y + '%'; }
  if (enquadraValor) enquadraValor.textContent = valor;
}

function posPeloEvento(e) {
  const r = enquadraPreview.getBoundingClientRect();
  const cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
  const cy = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
  const x = Math.round(Math.min(100, Math.max(0, (cx / r.width) * 100)));
  const y = Math.round(Math.min(100, Math.max(0, (cy / r.height) * 100)));
  setPosicao(`${x}% ${y}%`);
}

if (enquadraPreview) {
  let arrastando = false;
  const iniciar = (e) => { arrastando = true; posPeloEvento(e); e.preventDefault(); };
  const mover = (e) => { if (arrastando) posPeloEvento(e); };
  const parar = () => { arrastando = false; };
  enquadraPreview.addEventListener('mousedown', iniciar);
  window.addEventListener('mousemove', mover);
  window.addEventListener('mouseup', parar);
  enquadraPreview.addEventListener('touchstart', iniciar, { passive: false });
  enquadraPreview.addEventListener('touchmove', (e) => { if (arrastando) { posPeloEvento(e); e.preventDefault(); } }, { passive: false });
  enquadraPreview.addEventListener('touchend', parar);
}

document.querySelectorAll('[data-foco]').forEach((b) =>
  b.addEventListener('click', () => setPosicao(b.dataset.foco.replace(' ', '% ') + '%'))
);

// ---- links de compra (lista dinâmica) ----
function addLinha(label = '', url = '') {
  const div = document.createElement('div');
  div.className = 'link-linha';
  div.style.cssText = 'display:flex;gap:6px;margin-bottom:6px';
  div.innerHTML =
    '<input class="lk-label" placeholder="Nome da loja" maxlength="80" style="flex:1" />' +
    '<input class="lk-url" placeholder="https://..." maxlength="400" style="flex:2" />' +
    '<button type="button" class="btn-mini perigo lk-rm">×</button>';
  div.querySelector('.lk-label').value = label;
  div.querySelector('.lk-url').value = url;
  div.querySelector('.lk-rm').addEventListener('click', () => div.remove());
  $('links-lista').appendChild(div);
}
function lerLinks() {
  return [...document.querySelectorAll('.link-linha')]
    .map((d) => ({ label: d.querySelector('.lk-label').value.trim(), url: d.querySelector('.lk-url').value.trim() }))
    .filter((l) => l.url);
}

$('btn-add-link').addEventListener('click', () => addLinha());

// ---- abrir formulário ----
function abrirForm(animal) {
  painel.style.display = '';
  $('links-lista').innerHTML = '';
  setMsg('');
  if (animal) {
    $('form-titulo').textContent = 'Editar: ' + animal.nome;
    $('a-id').value = animal.id;
    $('a-nome').value = animal.nome || '';
    $('a-especie').value = animal.especie || 'indefinido';
    $('a-categoria').value = animal.categoria || 'outros';
    $('a-pedido').value = animal.pedido || '';
    $('a-historia').value = animal.historia || '';
    $('a-cartinha').value = animal.cartinha || '';
    $('a-foto').value = animal.foto || '';
    $('a-foto-preview').src = animal.foto || '';
    if (enquadraImg) enquadraImg.src = animal.foto || '';
    setPosicao(animal.foto_posicao || '50% 42%');
    let links = [];
    try { links = JSON.parse(animal.links_compra || '[]'); } catch {}
    links.forEach((l) => addLinha(l.label, l.url));
  } else {
    $('form-titulo').textContent = 'Novo animal';
    ['a-id', 'a-nome', 'a-pedido', 'a-historia', 'a-cartinha', 'a-foto'].forEach((i) => ($(i).value = ''));
    $('a-especie').value = 'indefinido';
    $('a-categoria').value = 'outros';
    $('a-foto-preview').src = '';
    if (enquadraImg) enquadraImg.src = '';
    setPosicao('50% 42%');
  }
  painel.scrollIntoView({ behavior: 'smooth' });
}

$('btn-novo').addEventListener('click', () => abrirForm(null));
$('btn-cancelar').addEventListener('click', () => (painel.style.display = 'none'));

document.querySelectorAll('.btn-editar').forEach((b) =>
  b.addEventListener('click', () => abrirForm(porId[b.dataset.id]))
);

// atualiza preview ao digitar URL
$('a-foto').addEventListener('input', () => {
  $('a-foto-preview').src = $('a-foto').value;
  if (enquadraImg) enquadraImg.src = $('a-foto').value;
});

// ---- upload de foto ----
$('btn-upload-foto').addEventListener('click', async () => {
  const f = $('a-foto-file').files[0];
  if (!f) return setMsg('Escolha um arquivo de imagem.', true);
  const btn = $('btn-upload-foto');
  btn.disabled = true;
  setMsg('Enviando foto...');
  try {
    const fd = new FormData();
    fd.append('arquivo', f);
    fd.append('pasta', 'fotos');
    const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
    const d = await res.json();
    if (!res.ok) throw new Error(d.erro || 'Falha no upload');
    $('a-foto').value = d.url;
    $('a-foto-preview').src = d.url;
    if (enquadraImg) enquadraImg.src = d.url;
    setMsg('Foto enviada!');
  } catch (e) {
    setMsg(e.message, true);
  } finally {
    btn.disabled = false;
  }
});

// ---- salvar ----
$('form-animal').addEventListener('submit', async (e) => {
  e.preventDefault();
  setMsg('Salvando...');
  const body = {
    acao: 'salvar',
    id: $('a-id').value,
    nome: $('a-nome').value,
    especie: $('a-especie').value,
    categoria: $('a-categoria').value,
    pedido: $('a-pedido').value,
    historia: $('a-historia').value,
    cartinha: $('a-cartinha').value,
    foto: $('a-foto').value,
    foto_posicao: $('a-foto-posicao').value,
    links_compra: lerLinks(),
  };
  try {
    const res = await fetch('/api/admin/animais', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.erro || 'Falha ao salvar');
    setMsg('Salvo! Atualizando...');
    location.reload();
  } catch (e) {
    setMsg(e.message, true);
  }
});

// ---- ativar / desativar ----
document.querySelectorAll('.chk-ativo').forEach((chk) =>
  chk.addEventListener('change', async () => {
    const span = chk.parentElement.querySelector('span');
    try {
      const res = await fetch('/api/admin/animais', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'ativo', id: chk.dataset.id, ativo: chk.checked }),
      });
      if (!res.ok) throw new Error();
      span.textContent = chk.checked ? 'Sim' : 'Não';
    } catch {
      chk.checked = !chk.checked;
      alert('Não foi possível atualizar.');
    }
  })
);

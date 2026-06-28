// ============================================================
//  MÖRK BORG COMPANION — script.js  (versão Supabase)
//  Salva personagens na nuvem via Supabase
// ============================================================

'use strict';

import {
  signIn, signUp, signOut,
  onAuthChange, getCurrentUser,
  saveCharacter, listCharacters,
  loadCharacter, deleteCharacter,
  uploadPortrait
} from './supabase.js';

// ── ESTADO GLOBAL ────────────────────────────────────────────
const State = {
  data: {
    classes:   [],
    equipment: [],
    names:     { prefixos: [], sufixos: [], titulos: [], origens: [] },
    scrolls:   [],
    items:     []
  },
  char: newEmptyChar(),
  user: null
};

function newEmptyChar(keepId = false) {
  return {
    id:             keepId || null,
    nome:           '',
    classe:         '',
    idade:          '',
    origem:         '',
    descricao:      '',
    retrato:        '',          // URL pública (Supabase Storage) ou ''
    forca:          0,
    agilidade:      0,
    presenca:       0,
    resistencia:    0,
    hpAtual:        8,
    hpMax:          8,
    armadura:       'Nenhuma',
    armaduraCustom: '',
    equipamentos:   [],
    ouro:           0,
    poderes:        [],
    maldições:      '',
    ferimentos:     [],
    notas:          '',
    modificado:     null
  };
}

// ── ARMADURAS ─────────────────────────────────────────────────
const ARMADURAS = {
  'Nenhuma': 0,
  'Couro':   1,
  'Malha':   2,
  'Placas':  3,
  'Personalizada': null
};

// ── MODIFICADORES ─────────────────────────────────────────────
function getModifier(val) {
  if (val <= -3) return -3;
  if (val <= -2) return -2;
  if (val <= -1) return -1;
  if (val <=  0) return  0;
  if (val <=  2) return  0;
  if (val <=  4) return +1;
  if (val <=  6) return +2;
  return +3;
}

function formatMod(n) {
  return n > 0 ? `+${n}` : `${n}`;
}

// ── DADOS ─────────────────────────────────────────────────────
function roll(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

function rollDice(notation) {
  const match = notation.match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!match) return 1;
  const num   = parseInt(match[1]) || 1;
  const sides = parseInt(match[2]);
  const bonus = parseInt(match[3]) || 0;
  let total = bonus;
  for (let i = 0; i < num; i++) total += roll(sides);
  return Math.max(1, total);
}

// ── TOAST ─────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ── MODAL CONFIRMAR ───────────────────────────────────────────
function confirmDialog(title, msg, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <h3>${title}</h3>
      <p>${msg}</p>
      <div class="modal-actions">
        <button class="btn btn-danger" id="modal-confirm">Confirmar</button>
        <button class="btn" id="modal-cancel">Cancelar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('modal-confirm').onclick = () => { overlay.remove(); onConfirm(); };
  document.getElementById('modal-cancel').onclick  = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
}

// ── CARREGAR JSONS LOCAIS ─────────────────────────────────────
async function loadData() {
  const files = ['classes', 'equipment', 'names', 'scrolls', 'items'];
  await Promise.all(files.map(async (name) => {
    try {
      const res = await fetch(`data/${name}.json`);
      State.data[name] = await res.json();
    } catch (e) {
      console.warn(`Não foi possível carregar data/${name}.json:`, e);
    }
  }));
}

// ── AUTH UI ───────────────────────────────────────────────────

window.switchAuthTab = function(tab) {
  document.getElementById('form-login').style.display  = tab === 'login'  ? 'flex' : 'none';
  document.getElementById('form-signup').style.display = tab === 'signup' ? 'flex' : 'none';
  document.getElementById('tab-login').classList.toggle('active',  tab === 'login');
  document.getElementById('tab-signup').classList.toggle('active', tab === 'signup');
};

function initAuthEvents() {
  // LOGIN
  document.getElementById('btn-login')?.addEventListener('click', async () => {
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl    = document.getElementById('login-error');

    if (!email || !password) {
      errEl.textContent = 'Preencha e-mail e senha.';
      errEl.style.display = 'block';
      return;
    }
    errEl.style.display = 'none';

    try {
      await signIn(email, password);
      // onAuthChange vai chamar showScreen('home') automaticamente
    } catch (err) {
      errEl.textContent = translateAuthError(err.message);
      errEl.style.display = 'block';
    }
  });

  // CADASTRO
  document.getElementById('btn-signup')?.addEventListener('click', async () => {
    const email    = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const errEl    = document.getElementById('signup-error');
    const okEl     = document.getElementById('signup-success');

    if (!email || !password) {
      errEl.textContent = 'Preencha e-mail e senha.';
      errEl.style.display = 'block';
      okEl.style.display = 'none';
      return;
    }
    errEl.style.display = 'none';
    okEl.style.display  = 'none';

    try {
      await signUp(email, password);
      okEl.style.display = 'block';
    } catch (err) {
      errEl.textContent = translateAuthError(err.message);
      errEl.style.display = 'block';
    }
  });

  // Enter nos inputs de login
  ['login-email','login-password'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('btn-login').click();
    });
  });
}

function translateAuthError(msg) {
  if (msg.includes('Invalid login')) return 'E-mail ou senha incorretos.';
  if (msg.includes('Email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (msg.includes('already registered')) return 'Este e-mail já possui uma conta.';
  if (msg.includes('Password should be')) return 'A senha deve ter pelo menos 6 caracteres.';
  return msg;
}

// ── SCREENS ───────────────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${name}`)?.classList.add('active');
  if (name === 'home')  renderHomeScreen();
  if (name === 'sheet') renderSheet();
}

// ── TELA HOME ─────────────────────────────────────────────────
async function renderHomeScreen() {
  const user  = State.user;
  const email = document.getElementById('user-email-display');
  if (email && user) email.textContent = user.email;

  const list    = document.getElementById('saved-chars-list');
  const loading = document.getElementById('cloud-loading');

  loading.style.display = 'flex';
  list.innerHTML = '';

  try {
    const chars = await listCharacters();
    loading.style.display = 'none';

    if (chars.length === 0) {
      list.innerHTML = '<p class="empty-saves">Nenhum personagem na nuvem. Crie um novo!</p>';
      return;
    }

    list.innerHTML = chars.map(c => `
      <div class="saved-item" data-id="${c.char_id}">
        <div style="display:flex;align-items:center;gap:0.75rem">
          ${c.retrato_url
            ? `<img src="${escapeHtml(c.retrato_url)}" class="saved-thumb" alt="">`
            : '<span class="saved-thumb-placeholder">☠</span>'}
          <div>
            <div class="char-name">${escapeHtml(c.nome || '(Sem nome)')}</div>
            <div class="char-class">${escapeHtml(c.classe || '—')}</div>
            <div class="char-cloud-badge">${formatDate(c.modificado)}</div>
          </div>
        </div>
        <div class="char-actions">
          <button class="btn btn-sm btn-primary" onclick="openChar('${c.char_id}')">📂 Abrir</button>
          <button class="btn btn-sm btn-danger"  onclick="confirmDeleteChar('${c.char_id}', event)">🗑</button>
        </div>
      </div>`).join('');

  } catch (err) {
    loading.style.display = 'none';
    list.innerHTML = `<p class="auth-error">Erro ao carregar personagens: ${escapeHtml(err.message)}</p>`;
  }
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
}

window.openChar = async function(id) {
  try {
    const charData = await loadCharacter(id);
    State.char = charData;
    showScreen('sheet');
  } catch (err) {
    toast('Erro ao abrir personagem: ' + err.message, 'error');
  }
};

window.confirmDeleteChar = function(id, e) {
  e.stopPropagation();
  confirmDialog('Apagar personagem?', 'Esta ação não pode ser desfeita. O personagem será removido da nuvem.', async () => {
    try {
      await deleteCharacter(id);
      toast('🗑 Personagem apagado da nuvem.', 'error');
      renderHomeScreen();
    } catch (err) {
      toast('Erro ao apagar: ' + err.message, 'error');
    }
  });
};

// ── SALVAR NA NUVEM ───────────────────────────────────────────
async function saveChar() {
  syncFromForm();

  const label   = document.getElementById('save-label');
  const spinner = document.getElementById('save-spinner');
  const btn     = document.getElementById('btn-salvar');

  label.style.display   = 'none';
  spinner.style.display = 'inline';
  btn.disabled = true;

  try {
    if (!State.char.id) State.char.id = Date.now().toString();
    State.char.modificado = new Date().toISOString();

    await saveCharacter(State.char);
    toast('☁ Personagem salvo na nuvem!');
  } catch (err) {
    toast('Erro ao salvar: ' + err.message, 'error');
  } finally {
    label.style.display   = 'inline';
    spinner.style.display = 'none';
    btn.disabled = false;
  }
}

// ── GERAR PERSONAGEM ──────────────────────────────────────────
function generateChar() {
  const d = State.data;

  const pref   = d.names.prefixos[Math.floor(Math.random() * d.names.prefixos.length)] || 'Vorn';
  const suf    = d.names.sufixos [Math.floor(Math.random() * d.names.sufixos.length)]  || 'ax';
  const tit    = d.names.titulos [Math.floor(Math.random() * d.names.titulos.length)]  || '';
  const origem = d.names.origens [Math.floor(Math.random() * d.names.origens.length)]  || '';

  const cls = d.classes.length > 0
    ? d.classes[Math.floor(Math.random() * d.classes.length)]
    : { nome: 'Vagabundo', hp: 'd6', hpBonus: 0, equipamentos: [], poderes: false };

  function rollAttr() {
    const r = roll(6) + roll(6) + roll(6) - 9;
    return Math.max(-3, Math.min(6, r));
  }

  const hpDie   = parseInt((cls.hp || 'd6').replace('d', '')) || 6;
  const hpBonus = cls.hpBonus || 0;
  const hpMax   = Math.max(1, roll(hpDie) + hpBonus);

  const equips = [...(cls.equipamentos || [])];
  const pool   = [...d.equipment];
  for (let i = 0; i < 2 && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    equips.push(pool.splice(idx, 1)[0]);
  }

  let poderes = [];
  if (cls.poderes && d.scrolls.length > 0) {
    const num = cls.numPoderes || 1;
    const shuffled = [...d.scrolls].sort(() => Math.random() - 0.5);
    poderes = shuffled.slice(0, num).map(s => ({ ...s }));
  }

  State.char = {
    id:             State.char.id,
    nome:           `${pref}${suf} ${tit}`,
    classe:         cls.nome,
    idade:          String(Math.floor(Math.random() * 30) + 15),
    origem,
    descricao:      '',
    retrato:        '',
    forca:          rollAttr(),
    agilidade:      rollAttr(),
    presenca:       rollAttr(),
    resistencia:    rollAttr(),
    hpAtual:        hpMax,
    hpMax,
    armadura:       'Nenhuma',
    armaduraCustom: '',
    equipamentos:   equips.map((e, i) => ({ id: i, nome: e, checked: false })),
    ouro:           roll(6) * roll(3),
    poderes,
    maldições:      '',
    ferimentos:     [],
    notas:          '',
    modificado:     null
  };

  showScreen('sheet');
  toast('🎲 Personagem gerado!');
}

// ── GERAR NOME ────────────────────────────────────────────────
function generateName() {
  const d    = State.data.names;
  const pref = d.prefixos[Math.floor(Math.random() * d.prefixos.length)] || 'Grak';
  const suf  = d.sufixos [Math.floor(Math.random() * d.sufixos.length)]  || 'or';
  const tit  = d.titulos [Math.floor(Math.random() * d.titulos.length)]  || '';
  const nome = `${pref}${suf} ${tit}`;
  State.char.nome = nome;
  const input = document.getElementById('char-nome');
  if (input) {
    input.value = nome;
    input.classList.add('shake');
    setTimeout(() => input.classList.remove('shake'), 400);
  }
}

// ── RENDER SHEET ──────────────────────────────────────────────
function renderSheet() {
  const c = State.char;
  setVal('char-nome',      c.nome);
  setVal('char-classe',    c.classe);
  setVal('char-idade',     c.idade);
  setVal('char-origem',    c.origem);
  setVal('char-descricao', c.descricao);
  renderPortrait();
  ['forca', 'agilidade', 'presenca', 'resistencia'].forEach(a => renderAttr(a));
  renderHP();
  setVal('char-armadura', c.armadura);
  toggleArmaduraCustom();
  renderEquipamentos();
  setVal('char-ouro', c.ouro);
  renderPoderes();
  setVal('char-maldicoes', c.maldições);
  setVal('char-notas',     c.notas);
  renderFerimentos();
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val ?? '';
}

function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

// ── PORTRAIT ──────────────────────────────────────────────────
function renderPortrait() {
  const box = document.getElementById('portrait-preview');
  if (!box) return;
  if (State.char.retrato) {
    box.innerHTML = `<img src="${State.char.retrato}" alt="Retrato">`;
  } else {
    box.innerHTML = '<span class="portrait-placeholder">☠</span>';
  }
}

// ── ATRIBUTOS ─────────────────────────────────────────────────
function renderAttr(attr) {
  const val   = State.char[attr] ?? 0;
  const mod   = getModifier(val);
  const valEl = document.getElementById(`attr-${attr}-val`);
  const modEl = document.getElementById(`attr-${attr}-mod`);
  if (valEl) valEl.value = val;
  if (modEl) modEl.textContent = `Mod: ${formatMod(mod)}`;
}

function changeAttr(attr, delta) {
  State.char[attr] = Math.max(-3, Math.min(6, (State.char[attr] ?? 0) + delta));
  renderAttr(attr);
}

function rollAttrSingle(attr) {
  const r     = roll(20);
  const val   = State.char[attr] ?? 0;
  const mod   = getModifier(val);
  const total = r + mod;
  const el    = document.getElementById(`attr-${attr}-dice`);
  if (el) {
    el.textContent  = `d20: ${r} + (${formatMod(mod)}) = ${total}`;
    el.style.display = 'inline';
    setTimeout(() => { el.style.display = 'none'; }, 3000);
  }
  toast(`${attr}: ${r} + ${formatMod(mod)} = ${total}`);
}

// ── HP ────────────────────────────────────────────────────────
function renderHP() {
  const c   = State.char;
  const cur = parseInt(c.hpAtual) || 0;
  const max = parseInt(c.hpMax)   || 1;
  const pct = Math.max(0, Math.min(100, (cur / max) * 100));
  const bar = document.getElementById('hp-bar');
  if (bar) {
    bar.style.width      = pct + '%';
    bar.style.background = pct > 50 ? '#8b1a1a' : pct > 25 ? '#c0392b' : '#ff0000';
  }
}

// ── ARMADURA ──────────────────────────────────────────────────
function toggleArmaduraCustom() {
  const custom = document.getElementById('armadura-custom-row');
  const val    = document.getElementById('char-armadora-val');
  if (!custom) return;
  if (State.char.armadura === 'Personalizada') {
    custom.style.display = 'flex';
    if (val) val.textContent = State.char.armaduraCustom || '—';
  } else {
    custom.style.display = 'none';
    if (val) val.textContent = ARMADURAS[State.char.armadura] ?? 0;
  }
}

// ── EQUIPAMENTOS ─────────────────────────────────────────────
function renderEquipamentos() {
  const list  = document.getElementById('equip-list');
  if (!list) return;
  const items = State.char.equipamentos || [];
  if (items.length === 0) {
    list.innerHTML = '<li style="color:var(--muted);font-style:italic;font-size:0.85rem;padding:0.5rem 0">Nenhum equipamento.</li>';
    return;
  }
  list.innerHTML = items.map((item, i) => `
    <li class="equipment-item">
      <input type="checkbox" id="equip-${i}" ${item.checked ? 'checked' : ''}
             onchange="toggleEquip(${i})">
      <label for="equip-${i}" class="${item.checked ? 'checked' : ''}">${escapeHtml(item.nome)}</label>
      <button class="equip-remove" onclick="removeEquip(${i})" title="Remover">✕</button>
    </li>`).join('');
}

window.toggleEquip  = (i) => { State.char.equipamentos[i].checked = !State.char.equipamentos[i].checked; renderEquipamentos(); };
window.removeEquip  = (i) => { State.char.equipamentos.splice(i, 1); renderEquipamentos(); };

function addEquipamento(nome) {
  if (!nome.trim()) return;
  State.char.equipamentos.push({ id: Date.now(), nome: nome.trim(), checked: false });
  renderEquipamentos();
}

function addRandomEquip() {
  const pool = State.data.equipment;
  if (pool.length === 0) { toast('Nenhum equipamento disponível.', 'error'); return; }
  const item = pool[Math.floor(Math.random() * pool.length)];
  addEquipamento(item);
  toast(`🎲 ${item} adicionado!`);
}

// ── PODERES ───────────────────────────────────────────────────
function renderPoderes() {
  const container = document.getElementById('poderes-container');
  if (!container) return;
  const poderes = State.char.poderes || [];
  if (poderes.length === 0) {
    container.innerHTML = '<p style="color:var(--muted);font-style:italic;font-size:0.85rem">Nenhum poder ou pergaminho.</p>';
    return;
  }
  container.innerHTML = poderes.map((p, i) => `
    <div class="power-item">
      <div class="power-header">
        <input class="power-name" value="${escapeHtml(p.nome || '')}"
               onchange="updatePoder(${i},'nome',this.value)" placeholder="Nome do poder…">
        <button class="btn btn-sm btn-danger" onclick="removePoder(${i})">✕</button>
      </div>
      <textarea class="power-desc" rows="2"
                onchange="updatePoder(${i},'descricao',this.value)"
                placeholder="Descrição e efeito…">${escapeHtml(p.descricao || '')}</textarea>
      <div class="power-cost">Custo: <input style="background:transparent;border:none;border-bottom:1px solid var(--stone);color:var(--crimson);font-family:var(--font-mono);font-size:0.72rem;width:140px"
           value="${escapeHtml(p.custo || '')}" onchange="updatePoder(${i},'custo',this.value)"
           placeholder="ex: 2 HP"></div>
    </div>`).join('');
}

window.updatePoder = (i, field, val) => { if (State.char.poderes[i]) State.char.poderes[i][field] = val; };
window.removePoder = (i) => { State.char.poderes.splice(i, 1); renderPoderes(); };

function addPoder(data = null) {
  State.char.poderes.push(data || { nome: '', descricao: '', custo: '' });
  renderPoderes();
}

function addRandomPoder() {
  const pool = State.data.scrolls;
  if (pool.length === 0) { toast('Nenhum pergaminho disponível.', 'error'); return; }
  const s = pool[Math.floor(Math.random() * pool.length)];
  addPoder({ ...s });
  toast(`✨ ${s.nome} adicionado!`);
}

// ── FERIMENTOS ────────────────────────────────────────────────
function renderFerimentos() {
  const list = document.getElementById('ferimentos-list');
  if (!list) return;
  const arr = State.char.ferimentos || [];
  list.innerHTML = arr.map((f, i) => `
    <li class="wound-item">
      <span style="flex:1">${escapeHtml(f)}</span>
      <button class="equip-remove" onclick="removeFerimento(${i})">✕</button>
    </li>`).join('');
}

window.removeFerimento = (i) => { State.char.ferimentos.splice(i, 1); renderFerimentos(); };

function addFerimento(texto) {
  if (!texto.trim()) return;
  State.char.ferimentos.push(texto.trim());
  renderFerimentos();
}

// ── EXPORTAR / COPIAR ─────────────────────────────────────────
function copiarFicha() {
  const c = State.char;
  const linhas = [
    `╔══ MÖRK BORG ══════════════════════════╗`,
    `  ${c.nome || '(Sem nome)'}`,
    `  ${c.classe || '—'} | Idade: ${c.idade || '?'} | Origem: ${c.origem || '—'}`,
    ``,
    `  ATRIBUTOS`,
    `  Força:       ${c.forca}  (mod ${formatMod(getModifier(c.forca))})`,
    `  Agilidade:   ${c.agilidade}  (mod ${formatMod(getModifier(c.agilidade))})`,
    `  Presença:    ${c.presenca}  (mod ${formatMod(getModifier(c.presenca))})`,
    `  Resistência: ${c.resistencia}  (mod ${formatMod(getModifier(c.resistencia))})`,
    ``,
    `  HP: ${c.hpAtual}/${c.hpMax}   Armadura: ${c.armadura}`,
    `  Ouro: ${c.ouro}`,
    ``,
    `  EQUIPAMENTOS`,
    ...(c.equipamentos || []).map(e => `  [${e.checked ? 'X' : ' '}] ${e.nome}`),
    ``,
    `  PODERES`,
    ...(c.poderes || []).map(p => `  • ${p.nome}: ${p.descricao} [${p.custo}]`),
    ``,
    c.maldições ? `  MALDIÇÕES\n  ${c.maldições}` : '',
    c.notas     ? `  NOTAS\n  ${c.notas}`     : '',
    `╚══════════════════════════════════════╝`
  ].filter(l => l !== '').join('\n');

  navigator.clipboard.writeText(linhas)
    .then(() => toast('📋 Ficha copiada!'))
    .catch(() => toast('Erro ao copiar.', 'error'));
}

// ── SYNC FORMULÁRIO → STATE ───────────────────────────────────
function syncFromForm() {
  const c = State.char;
  c.nome           = getVal('char-nome');
  c.classe         = getVal('char-classe');
  c.idade          = getVal('char-idade');
  c.origem         = getVal('char-origem');
  c.descricao      = getVal('char-descricao');
  c.hpAtual        = parseInt(getVal('char-hp-atual'))  || 0;
  c.hpMax          = parseInt(getVal('char-hp-max'))    || 1;
  c.armadura       = getVal('char-armadura');
  c.armaduraCustom = getVal('char-armadura-custom') || '';
  c.ouro           = parseInt(getVal('char-ouro'))      || 0;
  c.maldições      = getVal('char-maldicoes');
  c.notas          = getVal('char-notas');
  renderHP();
}

// ── RESETAR ───────────────────────────────────────────────────
function resetChar() {
  confirmDialog('Resetar personagem?', 'Todos os dados não salvos serão perdidos.', () => {
    const id = State.char.id;
    State.char = newEmptyChar(id);
    renderSheet();
    toast('🗑 Personagem resetado.', 'error');
  });
}

// ── HELPERS ───────────────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── INICIALIZAR EVENTOS DA SHEET ──────────────────────────────
function initSheetEvents() {
  const textFields = ['char-nome','char-classe','char-idade','char-origem','char-descricao','char-maldicoes','char-notas'];
  textFields.forEach(id => {
    document.getElementById(id)?.addEventListener('input', syncFromForm);
  });

  ['char-hp-atual','char-hp-max'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => { syncFromForm(); renderHP(); });
  });

  document.getElementById('char-armadura')?.addEventListener('change', (e) => {
    State.char.armadura = e.target.value;
    toggleArmaduraCustom();
  });

  document.getElementById('char-armadura-custom')?.addEventListener('input', (e) => {
    State.char.armaduraCustom = e.target.value;
    const val = document.getElementById('char-armadora-val');
    if (val) val.textContent = e.target.value || '—';
  });

  document.getElementById('char-ouro')?.addEventListener('input', (e) => {
    State.char.ouro = parseInt(e.target.value) || 0;
  });

  // Retrato — agora faz upload para o Supabase Storage
  document.getElementById('portrait-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Preview local imediato
    const reader = new FileReader();
    reader.onload = (ev) => {
      State.char.retrato = ev.target.result;
      renderPortrait();
    };
    reader.readAsDataURL(file);

    // Upload para o Supabase Storage
    const statusEl = document.getElementById('portrait-upload-status');
    if (statusEl) statusEl.style.display = 'block';

    try {
      if (!State.char.id) State.char.id = Date.now().toString();
      const url = await uploadPortrait(file, State.char.id);
      State.char.retrato = url;   // Substitui base64 pela URL
      renderPortrait();
      toast('🖼 Retrato enviado para a nuvem!');
    } catch (err) {
      toast('Aviso: retrato salvo só localmente. ' + err.message, 'error');
    } finally {
      if (statusEl) statusEl.style.display = 'none';
    }
  });

  // Equipamentos
  const addEquipInput = document.getElementById('equip-add-input');
  document.getElementById('equip-add-btn')?.addEventListener('click', () => {
    addEquipamento(addEquipInput?.value || '');
    if (addEquipInput) addEquipInput.value = '';
  });
  addEquipInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { addEquipamento(addEquipInput.value); addEquipInput.value = ''; }
  });

  // Ferimentos
  const addFerInput = document.getElementById('ferimento-add-input');
  document.getElementById('ferimento-add-btn')?.addEventListener('click', () => {
    addFerimento(addFerInput?.value || '');
    if (addFerInput) addFerInput.value = '';
  });
  addFerInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { addFerimento(addFerInput.value); addFerInput.value = ''; }
  });
}

// ── BOOT ──────────────────────────────────────────────────────
async function init() {
  await loadData();
  initAuthEvents();

  // Escuta estado de autenticação
  onAuthChange((user) => {
    State.user = user;
    if (user) {
      showScreen('home');
    } else {
      showScreen('auth');
    }
  });

  // Botões da Home
  document.getElementById('btn-create')?.addEventListener('click', () => {
    State.char = newEmptyChar();
    generateChar();
  });

  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    try { await signOut(); } catch (err) { toast(err.message, 'error'); }
  });

  document.getElementById('btn-refresh-chars')?.addEventListener('click', renderHomeScreen);

  // Botões da Sheet
  document.getElementById('btn-gerar-char')?.addEventListener('click',  generateChar);
  document.getElementById('btn-gerar-nome')?.addEventListener('click',  () => { syncFromForm(); generateName(); });
  document.getElementById('btn-gerar-equip')?.addEventListener('click', () => { syncFromForm(); addRandomEquip(); });
  document.getElementById('btn-gerar-poder')?.addEventListener('click', () => { syncFromForm(); addRandomPoder(); });
  document.getElementById('btn-salvar')?.addEventListener('click',      () => { syncFromForm(); saveChar(); });
  document.getElementById('btn-exportar')?.addEventListener('click',    () => { syncFromForm(); window.print(); });
  document.getElementById('btn-copiar')?.addEventListener('click',      () => { syncFromForm(); copiarFicha(); });
  document.getElementById('btn-resetar')?.addEventListener('click',     resetChar);
  document.getElementById('btn-home')?.addEventListener('click',        () => { syncFromForm(); showScreen('home'); });

  // Atributos
  ['forca','agilidade','presenca','resistencia'].forEach(attr => {
    document.getElementById(`attr-${attr}-plus`)?.addEventListener('click',  () => changeAttr(attr, +1));
    document.getElementById(`attr-${attr}-minus`)?.addEventListener('click', () => changeAttr(attr, -1));
    document.getElementById(`attr-${attr}-roll`)?.addEventListener('click',  () => rollAttrSingle(attr));
    const valEl = document.getElementById(`attr-${attr}-val`);
    valEl?.addEventListener('change', () => {
      State.char[attr] = Math.max(-3, Math.min(6, parseInt(valEl.value) || 0));
      renderAttr(attr);
    });
  });

  document.getElementById('btn-add-poder')?.addEventListener('click', () => addPoder());
  document.getElementById('portrait-box')?.addEventListener('click',  () => {
    document.getElementById('portrait-input')?.click();
  });

  initSheetEvents();

  // Tela inicial é controlada pelo onAuthChange
}

document.addEventListener('DOMContentLoaded', init);

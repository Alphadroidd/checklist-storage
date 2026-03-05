/* =========================================
   CHECKLIST OBRA — app.js
   Vanilla JS, localStorage persistence
   ========================================= */

'use strict';

// ── State ────────────────────────────────────────────────────────────────────
let allItems = [];
let state = {
  checked:  {},   // id → true
  deleted:  {},   // id → true
  cart:     {},   // id → true
  bought:   {},   // id → true
};

let currentView     = 'all';
let searchQuery     = '';
let categoryFilter  = '';

// ── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  loadState();
  await loadData();
  buildCategoryFilter();
  render();
  updateStats();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
});

// ── Data loading ─────────────────────────────────────────────────────────────
async function loadData() {
  try {
    const res = await fetch('data.json');
    allItems = await res.json();
  } catch (e) {
    console.error('Erro ao carregar data.json:', e);
    allItems = [];
  }
}

// ── LocalStorage ─────────────────────────────────────────────────────────────
const STORAGE_KEY = 'checklist_obra_v1';

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) { /* quota exceeded, ignore */ }
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      state = { checked: {}, deleted: {}, cart: {}, bought: {}, ...parsed };
    }
  } catch (e) {
    state = { checked: {}, deleted: {}, cart: {}, bought: {} };
  }
}

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
  renderChecklist();
  renderCart();
  updateCartBadge();
}

function getFilteredItems() {
  return allItems.filter(item => {
    if (state.deleted[item.id]) return false;

    if (categoryFilter && item.categoria !== categoryFilter) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const inName  = item.item.toLowerCase().includes(q);
      const inModel = (item.modelo || '').toLowerCase().includes(q);
      const inBrand = (item.marca  || '').toLowerCase().includes(q);
      const inCat   = (item.categoria || '').toLowerCase().includes(q);
      if (!inName && !inModel && !inBrand && !inCat) return false;
    }

    if (currentView === 'pending' && state.checked[item.id]) return false;

    return true;
  });
}

function renderChecklist() {
  const list = document.getElementById('checklist-list');
  const filtered = getFilteredItems();

  document.getElementById('visible-count').textContent =
    `${filtered.length} ${filtered.length === 1 ? 'item' : 'itens'}`;

  if (filtered.length === 0) {
    list.innerHTML = `<div class="no-results">Nenhum item encontrado</div>`;
    return;
  }

  // Group by category
  const grouped = {};
  filtered.forEach(item => {
    const cat = item.categoria;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });

  let html = '';
  Object.entries(grouped).forEach(([cat, items]) => {
    html += `
      <div class="category-header">
        ${escHtml(cat)}
        <span class="category-count">${items.length}</span>
      </div>
    `;
    items.forEach(item => {
      html += buildItemCard(item);
    });
  });

  list.innerHTML = html;
}

function buildItemCard(item) {
  const checked = !!state.checked[item.id];
  const inCart  = !!state.cart[item.id];

  return `
    <div class="item-card${checked ? ' is-checked' : ''}" id="card-${item.id}" data-id="${item.id}">
      <button class="check-btn" onclick="toggleCheck('${item.id}')" title="Marcar como presente">
        ${checked ? '✓' : ''}
      </button>
      <div class="item-body" onclick="openDetail('${item.id}')">
        <div class="item-name">${escHtml(item.item)}</div>
        <div class="item-meta">${escHtml(item.marca || '')}${item.modelo ? ' · ' + escHtml(item.modelo) : ''}</div>
      </div>
      <div class="item-actions">
        <button class="action-btn cart-btn${inCart ? ' in-cart' : ''}" onclick="toggleCart('${item.id}')"
          title="${inCart ? 'Remover do carrinho' : 'Adicionar à lista de compras'}">
          🛒
        </button>
        <button class="action-btn delete-btn" onclick="deleteItem('${item.id}')" title="Remover da lista">
          🗑
        </button>
      </div>
    </div>
  `;
}

function renderCart() {
  const list  = document.getElementById('cart-list');
  const empty = document.getElementById('cart-empty');
  const clearBtn = document.getElementById('clear-cart-btn');

  const cartItems = allItems.filter(item => state.cart[item.id]);

  if (cartItems.length === 0) {
    list.innerHTML = '';
    empty.classList.add('visible');
    clearBtn.style.display = 'none';
    document.getElementById('cart-subtitle').textContent = 'Itens adicionados durante a conferência';
    return;
  }

  empty.classList.remove('visible');
  clearBtn.style.display = 'block';
  const bought = cartItems.filter(i => state.bought[i.id]).length;
  document.getElementById('cart-subtitle').textContent =
    `${cartItems.length} ${cartItems.length === 1 ? 'item' : 'itens'} · ${bought} comprado${bought !== 1 ? 's' : ''}`;

  list.innerHTML = cartItems.map(item => {
    const isBought = !!state.bought[item.id];
    return `
      <div class="item-card${isBought ? ' is-bought' : ''}" id="cart-card-${item.id}">
        <input type="checkbox" class="check-btn"
          style="width:20px;height:20px;min-width:20px;accent-color:#22c55e;cursor:pointer;"
          ${isBought ? 'checked' : ''}
          onchange="toggleBought('${item.id}')"
          title="Marcar como comprado" />
        <div class="item-body" onclick="openDetail('${item.id}')">
          <div class="item-name">${escHtml(item.item)}</div>
          <div class="item-meta">${escHtml(item.marca || '')}${item.modelo ? ' · ' + escHtml(item.modelo) : ''}</div>
          <span class="item-category-tag">${escHtml(item.categoria)}</span>
        </div>
        <div class="item-actions">
          <button class="action-btn delete-btn" onclick="removeFromCart('${item.id}')" title="Remover da lista">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

// ── Actions ───────────────────────────────────────────────────────────────────
function toggleCheck(id) {
  state.checked[id] = !state.checked[id];
  if (!state.checked[id]) delete state.checked[id];
  saveState();
  render();
  updateStats();
  showToast(state.checked[id] ? '✓ Material conferido' : 'Marcação removida', state.checked[id] ? 'green' : null);
}

function toggleCart(id) {
  const wasInCart = !!state.cart[id];
  state.cart[id] = !state.cart[id];
  if (!state.cart[id]) {
    delete state.cart[id];
    delete state.bought[id];
  }
  saveState();
  render();
  showToast(wasInCart ? 'Removido do carrinho' : '🛒 Adicionado à lista de compras', 'amber');
}

function deleteItem(id) {
  state.deleted[id] = true;
  delete state.checked[id];
  delete state.cart[id];
  delete state.bought[id];
  saveState();
  render();
  updateStats();
  showToast('Item removido da lista', 'red');
}

function removeFromCart(id) {
  delete state.cart[id];
  delete state.bought[id];
  saveState();
  render();
  updateCartBadge();
  showToast('Removido da lista de compras', 'red');
}

function toggleBought(id) {
  state.bought[id] = !state.bought[id];
  if (!state.bought[id]) delete state.bought[id];
  saveState();
  renderCart();
}

function clearCart() {
  if (!confirm('Limpar toda a lista de compras?')) return;
  Object.keys(state.cart).forEach(id => {
    delete state.cart[id];
    delete state.bought[id];
  });
  saveState();
  render();
  showToast('Lista de compras limpa', 'red');
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function updateStats() {
  const active  = allItems.filter(i => !state.deleted[i.id]);
  const total   = active.length;
  const checked = active.filter(i => state.checked[i.id]).length;
  const missing = total - checked;
  const pct     = total > 0 ? Math.round((checked / total) * 100) : 0;

  document.getElementById('count-total').textContent   = total;
  document.getElementById('count-checked').textContent = checked;
  document.getElementById('count-missing').textContent = missing;
  document.getElementById('progress-bar').style.width  = pct + '%';
  document.getElementById('progress-text').textContent = pct + '%';
}

function updateCartBadge() {
  const count = Object.keys(state.cart).length;
  const badge = document.getElementById('cart-badge');
  badge.textContent = count;
  badge.style.display = count > 0 ? 'inline-block' : 'none';
}

// ── Search & Filter ────────────────────────────────────────────────────────────
function handleSearch() {
  const input = document.getElementById('search-input');
  searchQuery = input.value.trim();
  document.getElementById('search-clear').style.display = searchQuery ? 'flex' : 'none';
  renderChecklist();
}

function clearSearch() {
  document.getElementById('search-input').value = '';
  searchQuery = '';
  document.getElementById('search-clear').style.display = 'none';
  renderChecklist();
}

function handleFilter() {
  categoryFilter = document.getElementById('category-filter').value;
  renderChecklist();
}

function setView(view) {
  currentView = view;
  document.getElementById('view-all-btn').classList.toggle('active', view === 'all');
  document.getElementById('view-pending-btn').classList.toggle('active', view === 'pending');
  renderChecklist();
}

function buildCategoryFilter() {
  const cats = [...new Set(allItems.map(i => i.categoria))].sort();
  const sel  = document.getElementById('category-filter');
  cats.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    sel.appendChild(opt);
  });
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function switchTab(tab) {
  document.getElementById('panel-checklist').classList.toggle('active', tab === 'checklist');
  document.getElementById('panel-cart').classList.toggle('active', tab === 'cart');
  document.getElementById('tab-checklist').classList.toggle('active', tab === 'checklist');
  document.getElementById('tab-cart').classList.toggle('active', tab === 'cart');
}

// ── Detail Modal ──────────────────────────────────────────────────────────────
function openDetail(id) {
  const item = allItems.find(i => i.id === id);
  if (!item) return;

  document.getElementById('modal-categoria').textContent = item.categoria;
  document.getElementById('modal-item').textContent      = item.item;
  setModalField('modal-modelo',   'modal-modelo-row',   item.modelo);
  setModalField('modal-marca',    'modal-marca-row',    item.marca);
  setModalField('modal-cor',      'modal-cor-row',      item.cor);
  setModalField('modal-tamanho',  'modal-tamanho-row',  item.tamanho);
  setModalField('modal-material', 'modal-material-row', item.material);

  const specsSection = document.getElementById('modal-specs-section');
  const specsList    = document.getElementById('modal-specs');
  if (item.especificacoes && item.especificacoes.length > 0) {
    specsList.innerHTML = item.especificacoes
      .map(s => `<li>${escHtml(s)}</li>`)
      .join('');
    specsSection.style.display = 'block';
  } else {
    specsSection.style.display = 'none';
  }

  const obsSection = document.getElementById('modal-obs-section');
  const obsEl      = document.getElementById('modal-obs');
  if (item.observacoes && item.observacoes !== '-') {
    obsEl.textContent = item.observacoes;
    obsSection.style.display = 'block';
  } else {
    obsSection.style.display = 'none';
  }

  document.getElementById('detail-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function setModalField(valId, rowId, val) {
  const row = document.getElementById(rowId);
  if (val && val !== '-') {
    document.getElementById(valId).textContent = val;
    row.style.display = 'grid';
  } else {
    row.style.display = 'none';
  }
}

function closeModal(event) {
  if (event && event.target !== document.getElementById('detail-modal')) return;
  document.getElementById('detail-modal').classList.remove('open');
  document.body.style.overflow = '';
}

// Close modal with Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.getElementById('detail-modal').classList.remove('open');
    document.body.style.overflow = '';
  }
});

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2200);
}

// ── Utils ─────────────────────────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const state = {
  cards: [],
  filtered: [],
  view: 'grid',
};

const els = {
  summary: document.querySelector('#summary'),
  search: document.querySelector('#searchInput'),
  set: document.querySelector('#setFilter'),
  feature: document.querySelector('#featureFilter'),
  type: document.querySelector('#typeFilter'),
  rarity: document.querySelector('#rarityFilter'),
  sort: document.querySelector('#sortSelect'),
  reset: document.querySelector('#resetFilters'),
  grid: document.querySelector('#cardsGrid'),
  empty: document.querySelector('#emptyState'),
  shownCount: document.querySelector('#shownCount'),
  totalCount: document.querySelector('#totalCount'),
  setCount: document.querySelector('#setCount'),
  rarityCount: document.querySelector('#rarityCount'),
  gridView: document.querySelector('#gridView'),
  listView: document.querySelector('#listView'),
  panel: document.querySelector('#detailPanel'),
  backdrop: document.querySelector('#detailBackdrop'),
  close: document.querySelector('#closeDetail'),
  detailImage: document.querySelector('#detailImage'),
  detailCode: document.querySelector('#detailCode'),
  detailTitle: document.querySelector('#detailTitle'),
  detailBadges: document.querySelector('#detailBadges'),
  detailStats: document.querySelector('#detailStats'),
  detailEffect: document.querySelector('#detailEffect'),
  detailOther: document.querySelector('#detailOther'),
  detailProducts: document.querySelector('#detailProducts'),
};

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

init();

async function init() {
  try {
    const response = await fetch('card-database.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const database = await response.json();
    state.cards = Array.isArray(database.cards) ? database.cards : [];
    state.filtered = state.cards.slice();
    buildFilters();
    bindEvents();
    updateStats();
    render();
  } catch (error) {
    els.summary.textContent = `Unable to load card-database.json: ${error.message}`;
    els.empty.hidden = false;
    els.empty.textContent = 'card-database.json could not be loaded.';
  }
}

function bindEvents() {
  [els.search, els.set, els.feature, els.type, els.rarity, els.sort].forEach((el) => {
    el.addEventListener('input', applyFilters);
  });

  els.reset.addEventListener('click', () => {
    els.search.value = '';
    els.set.value = '';
    els.feature.value = '';
    els.type.value = '';
    els.rarity.value = '';
    els.sort.value = 'code';
    applyFilters();
  });

  els.gridView.addEventListener('click', () => setView('grid'));
  els.listView.addEventListener('click', () => setView('list'));
  els.close.addEventListener('click', closeDetail);
  els.backdrop.addEventListener('click', closeDetail);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeDetail();
  });
}

function buildFilters() {
  fillSelect(els.set, 'All sets', uniqueValues((card) => firstCommodity(card)?.name));
  fillSelect(els.feature, 'All features', uniqueValues((card) => card.featureText));
  fillSelect(els.type, 'All types', uniqueValues((card) => card.typeText));
  fillSelect(els.rarity, 'All rarities', uniqueValues((card) => card.rarityText));
}

function fillSelect(select, label, values) {
  select.replaceChildren(new Option(label, ''));
  values.forEach((value) => select.add(new Option(value, value)));
}

function uniqueValues(getter) {
  return [...new Set(state.cards.map(getter).filter(Boolean))]
    .sort((a, b) => collator.compare(a, b));
}

function applyFilters() {
  const query = normalize(els.search.value);
  const setValue = els.set.value;
  const featureValue = els.feature.value;
  const typeValue = els.type.value;
  const rarityValue = els.rarity.value;

  state.filtered = state.cards.filter((card) => {
    if (setValue && !card.commodityList?.some((item) => item.name === setValue)) return false;
    if (featureValue && card.featureText !== featureValue) return false;
    if (typeValue && card.typeText !== typeValue) return false;
    if (rarityValue && card.rarityText !== rarityValue) return false;
    if (!query) return true;
    return searchText(card).includes(query);
  });

  sortCards();
  updateStats();
  render();
}

function sortCards() {
  const mode = els.sort.value;
  state.filtered.sort((a, b) => {
    if (mode === 'name') return collator.compare(a.name || '', b.name || '');
    if (mode === 'rarity') return numeric(a.rarity) - numeric(b.rarity) || collator.compare(a.code || '', b.code || '');
    if (mode === 'level') return numeric(a.level) - numeric(b.level) || collator.compare(a.code || '', b.code || '');
    if (mode === 'power') return maxPower(b) - maxPower(a);
    if (mode === 'year') return numeric(a.yearOfBirth) - numeric(b.yearOfBirth) || collator.compare(a.code || '', b.code || '');
    return collator.compare(a.code || '', b.code || '');
  });
}

function updateStats() {
  els.summary.textContent = `${state.filtered.length.toLocaleString()} of ${state.cards.length.toLocaleString()} cards`;
  els.shownCount.textContent = state.filtered.length.toLocaleString();
  els.totalCount.textContent = state.cards.length.toLocaleString();
  els.setCount.textContent = uniqueValues((card) => firstCommodity(card)?.name).length.toLocaleString();
  els.rarityCount.textContent = uniqueValues((card) => card.rarityText).length.toLocaleString();
}

function render() {
  const fragment = document.createDocumentFragment();
  state.filtered.forEach((card) => fragment.appendChild(cardTile(card)));
  els.grid.replaceChildren(fragment);
  els.empty.hidden = state.filtered.length !== 0;
}

function cardTile(card) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'card-tile';
  button.addEventListener('click', () => openDetail(card));

  const imageWrap = document.createElement('div');
  imageWrap.className = 'card-image';
  const img = document.createElement('img');
  img.loading = 'lazy';
  img.src = card.cdnImageUrl || card.imageUrl || '';
  img.alt = `${card.name || 'Card'} ${card.code || ''}`.trim();
  imageWrap.appendChild(img);

  const info = document.createElement('div');
  info.className = 'card-info';
  info.innerHTML = `
    <div class="card-code">${escapeHtml(card.code || '')}</div>
    <h2 class="card-name">${escapeHtml(card.name || 'Unnamed card')}</h2>
    <div class="meta-row">
      ${badge(card.rarityText, 'rarity')}
      ${badge(card.featureText)}
      ${badge(card.typeText)}
      ${badge(firstCommodity(card)?.name)}
    </div>
    <div class="power-row">
      ${card.levelText ? `<span class="power-pill"><em>LV</em><strong>${escapeHtml(card.levelText)}</strong></span>` : ''}
      ${powerValues(card).map((item) => `<span class="power-pill"><em>${escapeHtml(powerShortLabel(item.label))}</em><strong>${number(item.value)}</strong></span>`).join('')}
    </div>
  `;

  button.append(imageWrap, info);
  return button;
}

function openDetail(card) {
  els.detailImage.src = card.cdnImageUrl || card.imageUrl || '';
  els.detailImage.alt = `${card.name || 'Card'} ${card.code || ''}`.trim();
  els.detailCode.textContent = card.code || '';
  els.detailTitle.textContent = card.name || 'Unnamed card';
  els.detailBadges.innerHTML = [
    badge(card.rarityText, 'rarity'),
    badge(card.featureText),
    badge(card.typeText),
    badge(card.characterName),
    badge(card.filmography),
  ].join('');
  els.detailStats.innerHTML = statRows([
    ['Level', card.levelText],
    ...powerValues(card).map((item) => [item.label, number(item.value)]),
    ['Year', card.yearOfBirth],
    ['Illustrator', card.illustratorName],
    ['Rarity Code', card.rarity],
  ]);
  els.detailEffect.textContent = card.effect || 'None';
  els.detailOther.textContent = card.other || 'None';
  els.detailProducts.textContent = (card.commodityList || []).map((item) => `${item.name}${item.code ? ` (${item.code})` : ''}`).join(', ') || 'None';
  els.panel.classList.add('open');
  els.panel.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeDetail() {
  els.panel.classList.remove('open');
  els.panel.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function setView(view) {
  state.view = view;
  els.grid.classList.toggle('list-mode', view === 'list');
  els.gridView.classList.toggle('active', view === 'grid');
  els.listView.classList.toggle('active', view === 'list');
}

function statRows(rows) {
  return rows
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(String(value))}</dd></div>`)
    .join('');
}

function badge(value, extraClass = '') {
  if (!value) return '';
  return `<span class="badge ${extraClass}">${escapeHtml(String(value))}</span>`;
}

function firstCommodity(card) {
  return Array.isArray(card.commodityList) ? card.commodityList[0] : null;
}

function searchText(card) {
  return normalize([
    card.name,
    card.code,
    card.characterName,
    card.featureText,
    card.typeText,
    card.rarityText,
    card.effect,
    card.other,
    card.filmography,
    card.yearOfBirth,
    ...(card.commodityList || []).map((item) => `${item.name} ${item.code}`),
  ].filter(Boolean).join(' '));
}

function normalize(value) {
  return String(value || '').toLowerCase().trim();
}

function numeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function powerValues(card) {
  return [
    ['Single', card.singleVal],
    ['Double', card.doubleVal],
    ['Triple', card.tripleVal],
    ['Quad', card.quattroVal],
    ['EXTRA', card.extraVal],
  ]
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([label, value]) => ({ label, value }));
}

function powerShortLabel(label) {
  const labels = {
    Single: 'S',
    Double: 'D',
    Triple: 'T',
    Quad: 'Q',
    EXTRA: 'EX',
  };
  return labels[label] || label;
}

function maxPower(card) {
  return Math.max(0, ...powerValues(card).map((item) => numeric(item.value)));
}

function number(value) {
  return Number(value).toLocaleString();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

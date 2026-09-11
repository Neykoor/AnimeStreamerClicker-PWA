const STORAGE_KEY = 'streamerClickerState';
const OFFLINE_CAP_SECONDS = 28800;
const GEM_INTERVAL_SECONDS = 60;
const YANDERE_ENDPOINT = 'https://yande.re/post.json?tags=rating:safe+order:random&limit=1';
const GACHA_COST = 50;

const UPGRADES = [
  { id: 'mic', name: 'Micrófono nuevo', type: 'click', value: 1, baseCost: 10, costMult: 1.15 },
  { id: 'webcam', name: 'Webcam HD', type: 'passive', value: 1, baseCost: 25, costMult: 1.15 },
  { id: 'lights', name: 'Luces RGB', type: 'click', value: 5, baseCost: 100, costMult: 1.17 },
  { id: 'setup', name: 'Setup de streaming', type: 'passive', value: 10, baseCost: 300, costMult: 1.17 },
  { id: 'collab', name: 'Colaboración viral', type: 'click', value: 25, baseCost: 1500, costMult: 1.2 },
  { id: 'editing', name: 'Equipo de edición', type: 'passive', value: 100, baseCost: 5000, costMult: 1.2 }
];

const HAIR_COLORS = [
  { id: 'white', hex: '#e8ecf5' },
  { id: 'blonde', hex: '#e8b568' },
  { id: 'black', hex: '#3a2f28' },
  { id: 'red', hex: '#c1401f' }
];
const EXPRESSION_HOLD_MS = 500;

let state = null;
let previewCharacterRoot = null;
let expressionTimeout = null;

function defaultState() {
  return {
    followers: 0,
    gems: 0,
    gemAccumulator: 0,
    owned: {},
    ownedImageIds: [],
    gallery: [],
    character: {
      hairColorId: 'white'
    },
    lastSave: Date.now()
  };
}

function clickPower() {
  let power = 1;
  for (const upgrade of UPGRADES) {
    if (upgrade.type === 'click') {
      power += (state.owned[upgrade.id] || 0) * upgrade.value;
    }
  }
  return power;
}

function followersPerSecond() {
  let rate = 0;
  for (const upgrade of UPGRADES) {
    if (upgrade.type === 'passive') {
      rate += (state.owned[upgrade.id] || 0) * upgrade.value;
    }
  }
  return rate;
}

function upgradeCost(upgrade) {
  const owned = state.owned[upgrade.id] || 0;
  return Math.ceil(upgrade.baseCost * Math.pow(upgrade.costMult, owned));
}

function tierFor(owned) {
  if (!owned) return 0;
  if (owned < 5) return 1;
  if (owned < 15) return 2;
  return 3;
}

function formatNumber(value) {
  if (value < 1000) return Math.floor(value).toString();
  const units = ['K', 'M', 'B', 'T'];
  let unitIndex = -1;
  let scaled = value;
  while (scaled >= 1000 && unitIndex < units.length - 1) {
    scaled /= 1000;
    unitIndex += 1;
  }
  return scaled.toFixed(2) + units[unitIndex];
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const loaded = raw ? JSON.parse(raw) : {};
  state = defaultState();
  Object.assign(state, loaded);
  state.character = Object.assign(defaultState().character, loaded.character || {});
  applyOfflineProgress();
}

function saveState() {
  state.lastSave = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function applyOfflineProgress() {
  const elapsedSeconds = Math.min(
    OFFLINE_CAP_SECONDS,
    Math.max(0, Math.floor((Date.now() - state.lastSave) / 1000))
  );
  if (elapsedSeconds < 5) return;
  const earnedFollowers = elapsedSeconds * followersPerSecond();
  const totalGemSeconds = state.gemAccumulator + elapsedSeconds;
  const earnedGems = Math.floor(totalGemSeconds / GEM_INTERVAL_SECONDS);
  state.gemAccumulator = totalGemSeconds % GEM_INTERVAL_SECONDS;
  state.followers += earnedFollowers;
  state.gems += earnedGems;
  showOfflineModal(earnedFollowers, earnedGems, elapsedSeconds);
}

function showOfflineModal(followersEarned, gemsEarned, elapsedSeconds) {
  if (followersEarned <= 0 && gemsEarned <= 0) return;
  const minutes = Math.floor(elapsedSeconds / 60);
  const text = document.getElementById('offlineText');
  text.textContent = 'Estuviste ' + minutes + ' min offline y ganaste ' +
    formatNumber(followersEarned) + ' seguidores y ' + gemsEarned + ' gemas.';
  document.getElementById('offlineModal').classList.remove('hidden');
}

function renderTopbar() {
  document.getElementById('followersDisplay').textContent = formatNumber(state.followers);
  document.getElementById('gemsDisplay').textContent = formatNumber(state.gems);
}

function renderRateInfo() {
  document.getElementById('perClickDisplay').textContent = '+' + formatNumber(clickPower()) + ' / clic';
  document.getElementById('perSecDisplay').textContent = formatNumber(followersPerSecond()) + ' / seg';
}

/* ---------- Character appearance (shared by room + customization preview) ---------- */

function applyCharacterAppearance(root, character) {
  const hairBack = root.querySelector('[data-role="hairBack"]');
  const hairFront = root.querySelector('[data-role="hairFront"]');
  if (hairBack) hairBack.setAttribute('href', 'assets/character/hair_back_' + character.hairColorId + '.png');
  if (hairFront) hairFront.setAttribute('href', 'assets/character/hair_front_' + character.hairColorId + '.png');
}

function renderCharacterEverywhere() {
  applyCharacterAppearance(document.getElementById('character'), state.character);
  if (previewCharacterRoot) {
    applyCharacterAppearance(previewCharacterRoot, state.character);
  }
}

function setupCharacterPreview() {
  const svg = document.getElementById('charPreviewSvg');
  const source = document.getElementById('character');
  const clone = source.cloneNode(true);
  clone.querySelectorAll('[data-role]').forEach(img => {
    img.setAttribute('x', '-35.5');
    img.setAttribute('y', '-56');
    img.setAttribute('width', '71');
    img.setAttribute('height', '299');
  });
  svg.appendChild(clone);
  previewCharacterRoot = clone;
}

function setCharacterExpression(root, happy) {
  const brows = root.querySelector('[data-role="brows"]');
  const mouth = root.querySelector('[data-role="mouth"]');
  const suffix = happy ? 'happy' : 'neutral';
  if (brows) brows.setAttribute('href', 'assets/character/brows_' + suffix + '.png');
  if (mouth) mouth.setAttribute('href', 'assets/character/mouth_' + suffix + '.png');
}

function flashHappyExpression() {
  setCharacterExpression(document.getElementById('character'), true);
  if (previewCharacterRoot) setCharacterExpression(previewCharacterRoot, true);
  clearTimeout(expressionTimeout);
  expressionTimeout = setTimeout(() => {
    setCharacterExpression(document.getElementById('character'), false);
    if (previewCharacterRoot) setCharacterExpression(previewCharacterRoot, false);
  }, EXPRESSION_HOLD_MS);
}

function buildSwatchRow(container, items, isActive, onPick) {
  container.innerHTML = '';
  for (const item of items) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatchBtn colorSwatch';
    btn.style.setProperty('--swatch-color', item.hex);
    btn.title = item.id;
    if (isActive(item.id)) btn.classList.add('active');
    btn.addEventListener('click', () => onPick(item.id));
    container.appendChild(btn);
  }
}

function renderCustomizePanel() {
  const ch = state.character;

  buildSwatchRow(
    document.getElementById('hairColorRow'), HAIR_COLORS,
    value => ch.hairColorId === value,
    value => { ch.hairColorId = value; saveState(); renderCharacterEverywhere(); renderCustomizePanel(); }
  );
}

/* ---------- Room scene (each upgrade becomes visible) ---------- */

function setTierState(el, tier) {
  if (!el) return;
  el.classList.remove('tier-0', 'tier-1', 'tier-2', 'tier-3');
  el.classList.add('tier-' + tier);
  el.classList.toggle('owned', tier > 0);
}

function showSub(el, shown) {
  if (!el) return;
  el.classList.toggle('shown', shown);
}

function renderRoom() {
  const owned = state.owned;

  const micTier = tierFor(owned.mic || 0);
  setTierState(document.getElementById('mic'), micTier);
  setTierState(document.getElementById('onAirTag'), micTier >= 3 ? 3 : 0);

  const webcamTier = tierFor(owned.webcam || 0);
  setTierState(document.getElementById('webcam'), webcamTier);
  const ringLight = document.getElementById('ringLight');
  const ringOpacity = webcamTier === 0 ? 0 : webcamTier === 1 ? 0.35 : webcamTier === 2 ? 0.6 : 0.9;
  ringLight.style.opacity = ringOpacity;
  ringLight.classList.toggle('tier-3', webcamTier >= 3);

  const lightsTier = tierFor(owned.lights || 0);
  setTierState(document.getElementById('rgbStrip'), lightsTier);
  const ambientGlow = document.getElementById('ambientGlow');
  const ambientOpacity = [0, 0.04, 0.08, 0.14][lightsTier];
  ambientGlow.style.opacity = ambientOpacity;
  ambientGlow.classList.toggle('tier-3', lightsTier >= 3);

  const setupTier = tierFor(owned.setup || 0);
  setTierState(document.getElementById('monitorGroup'), setupTier);
  showSub(document.getElementById('monitorSingle'), setupTier === 1);
  showSub(document.getElementById('monitorDouble'), setupTier >= 2);
  showSub(document.getElementById('liveBadge'), setupTier >= 3);

  const collabTier = tierFor(owned.collab || 0);
  setTierState(document.getElementById('guestCharacter'), collabTier);

  const editingTier = tierFor(owned.editing || 0);
  setTierState(document.getElementById('editHelper'), editingTier);
  setTierState(document.getElementById('wallDecor'), editingTier >= 2 ? editingTier : 0);

  renderCharacterEverywhere();
  renderRateInfo();
}

/* ---------- Shop ---------- */

function renderShop() {
  const list = document.getElementById('shopList');
  list.innerHTML = '';
  for (const upgrade of UPGRADES) {
    const owned = state.owned[upgrade.id] || 0;
    const cost = upgradeCost(upgrade);
    const affordable = state.followers >= cost;
    const row = document.createElement('div');
    row.className = 'shopRow';
    row.innerHTML =
      '<div class="shopInfo">' +
        '<div class="shopName">' + upgrade.name + '</div>' +
        '<div class="shopMeta">Nivel ' + owned + ' · +' + upgrade.value +
        (upgrade.type === 'click' ? ' por clic' : ' por seg') + '</div>' +
      '</div>' +
      '<button class="buyButton" ' + (affordable ? '' : 'disabled') + '>' +
        formatNumber(cost) + '</button>';
    row.querySelector('.buyButton').addEventListener('click', () => buyUpgrade(upgrade));
    list.appendChild(row);
  }
}

function buyUpgrade(upgrade) {
  const cost = upgradeCost(upgrade);
  if (state.followers < cost) return;
  state.followers -= cost;
  state.owned[upgrade.id] = (state.owned[upgrade.id] || 0) + 1;
  saveState();
  renderAll();
}

/* ---------- Gacha ---------- */

function renderGachaView() {
  document.getElementById('pullCostDisplay').textContent = GACHA_COST;
  document.getElementById('pullButton').disabled = state.gems < GACHA_COST;
  const gallery = document.getElementById('gachaGallery');
  gallery.innerHTML = '';
  for (const card of state.gallery) {
    const img = document.createElement('img');
    img.src = card.previewUrl;
    img.className = 'galleryCard rarity-' + card.rarity;
    gallery.appendChild(img);
  }
}

function rarityForScore(score) {
  if (score >= 50) return 'legendary';
  if (score >= 15) return 'rare';
  return 'common';
}

async function pullGacha() {
  if (state.gems < GACHA_COST) return;
  state.gems -= GACHA_COST;
  document.getElementById('pullButton').disabled = true;
  try {
    const response = await fetch(YANDERE_ENDPOINT);
    const posts = await response.json();
    const post = posts[0];
    if (!post) throw new Error('sin resultados');
    const rarity = rarityForScore(post.score || 0);
    if (state.ownedImageIds.includes(post.id)) {
      state.gems += Math.floor(GACHA_COST / 2);
      showPullResult(null, rarity, true, false);
    } else {
      state.ownedImageIds.push(post.id);
      const card = {
        id: post.id,
        previewUrl: post.preview_url,
        fullUrl: post.sample_url || post.file_url,
        rarity: rarity
      };
      state.gallery.unshift(card);
      showPullResult(card, rarity, false, false);
    }
    saveState();
  } catch (error) {
    state.gems += GACHA_COST;
    showPullResult(null, null, false, true);
  }
  renderAll();
}

function showPullResult(card, rarity, wasDuplicate, wasError) {
  const modal = document.getElementById('pullModal');
  const image = document.getElementById('pullImage');
  const rarityText = document.getElementById('pullRarity');
  if (wasError) {
    image.removeAttribute('src');
    rarityText.textContent = 'No se pudo conectar. Se devolvieron tus gemas.';
  } else if (wasDuplicate) {
    image.removeAttribute('src');
    rarityText.textContent = 'Repetida, la convertimos en gemas.';
  } else {
    image.src = card.fullUrl;
    rarityText.textContent = 'Rareza: ' + rarity;
  }
  modal.classList.remove('hidden');
}

/* ---------- Click feedback ---------- */

function spawnFloatText(amount) {
  const layer = document.getElementById('floatLayer');
  const el = document.createElement('div');
  el.className = 'floatText';
  el.textContent = '+' + formatNumber(amount);
  el.style.left = (40 + Math.random() * 20) + '%';
  layer.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

function bounceCharacter() {
  const scene = document.getElementById('roomScene');
  scene.classList.remove('pressed');
  void scene.offsetWidth;
  scene.classList.add('pressed');
  flashHappyExpression();
}

/* ---------- View plumbing ---------- */

function renderAll() {
  renderTopbar();
  renderRoom();
  renderCustomizePanel();
  renderShop();
  renderGachaView();
}

function switchView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
  document.querySelectorAll('.tabButton').forEach(b => b.classList.remove('active'));
  document.querySelector('[data-view="' + viewId + '"]').classList.add('active');
}

function tick() {
  const rate = followersPerSecond();
  if (rate > 0) state.followers += rate;
  state.gemAccumulator += 1;
  if (state.gemAccumulator >= GEM_INTERVAL_SECONDS) {
    state.gems += 1;
    state.gemAccumulator -= GEM_INTERVAL_SECONDS;
  }
  renderTopbar();
  renderRateInfo();
}

function setupListeners() {
  document.getElementById('clickZone').addEventListener('click', () => {
    const amount = clickPower();
    state.followers += amount;
    spawnFloatText(amount);
    renderTopbar();
    bounceCharacter();
  });
  document.getElementById('pullButton').addEventListener('click', pullGacha);
  document.getElementById('offlineCloseButton').addEventListener('click', () => {
    document.getElementById('offlineModal').classList.add('hidden');
  });
  document.getElementById('pullCloseButton').addEventListener('click', () => {
    document.getElementById('pullModal').classList.add('hidden');
  });
  document.querySelectorAll('.tabButton').forEach(button => {
    button.addEventListener('click', () => switchView(button.dataset.view));
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveState();
  });
  window.addEventListener('pagehide', saveState);
}

function startLoop() {
  setInterval(tick, 1000);
  setInterval(saveState, 5000);
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
  }
}

function init() {
  loadState();
  setupCharacterPreview();
  setupListeners();
  renderAll();
  startLoop();
  registerServiceWorker();
}

init();

'use strict';
/* Albion Craft · Placas, Arcos & Bestas — lógica de refino integrado + craft (mesma matemática da planilha). */

let GD = null;      // dados do jogo (receitas/artefatos)
let ST = null;      // estado do usuário (preços, config, plano)
let VIEW = 'plan';
let priceTab = 'ore';
let refineTab = 'bar';
let rankFilter = { cat: '', variant: '', piece: '', tier: '', ench: '', minVol: '0', quality: 'mix', onlyPriced: true, sort: 'profitDaily', sellPricing: 'spot', healthFilter: 'all' };
let gearFilter = { cat: '', variant: 'SET1', piece: '', tmin: 4, quality: '1' };
let histModalState = { itemId: null, loc: 'Black Market' };
let foodTab = 'rank';
let foodFilter = {
  family: '', tier: '', ench: '', city: 'Caerleon', focus: false,
  retRate: 0.248, feeFood: 465, sellLoc: '', sellPricing: 'smart',
  autoArbitrage: true, onlyPriced: true, healthFilter: 'all', sort: 'profitDaily',
  priceSubtab: 'meals', stationUse: ''
};
let recommendFilter = {
  cat: '',
  slot: 'SHOES',
  variantType: 'all',
  variant: '',
  tmin: 4,
  tmax: 7,
  ench0: true,
  ench1: true,
  ench2: true,
  ench3: false,
  targetPieces: 50,
  horizon: 'fast',
  minMargin: 0.10,
  prioritizeBonus: true,
  safeOnly: true,
  variety: 'balanced'
};
let activeRecommendation = null;

function getDailyBonusBySlot(slotNum = 1) {
  const key = slotNum === 2 ? 'activeDailyBonus2' : 'activeDailyBonus';
  const bonusId = (ST && ST[key]) ? ST[key] : 'none';
  return ((GD && GD.dailyBonuses) ? GD.dailyBonuses.find(b => b.id === bonusId) : null)
    || (GD && GD.dailyBonuses ? GD.dailyBonuses[0] : { id: 'none', name: 'Nenhum (Sem Bônus)' });
}

function getActiveDailyBonuses() {
  const b1 = getDailyBonusBySlot(1);
  const b2 = getDailyBonusBySlot(2);
  const out = [];
  if (b1 && b1.id !== 'none') out.push({ ...b1, slotNum: 1 });
  if (b2 && b2.id !== 'none' && (!b1 || b2.id !== b1.id)) out.push({ ...b2, slotNum: 2 });
  return out;
}

function getActiveDailyBonus() {
  return getDailyBonusBySlot(1);
}

function dailyBonusOptionsHtml(selectedId = 'none', placeholder = 'Nenhum (Sem Bônus)') {
  if (!GD || !GD.dailyBonuses) return `<option value="none">${esc(placeholder)}</option>`;
  const groups = [];
  const groupMap = {};
  let noneOpt = '';
  for (const b of GD.dailyBonuses) {
    if (b.id === 'none') {
      noneOpt = `<option value="none"${selectedId === 'none' || !selectedId ? ' selected' : ''}>${esc(placeholder)}</option>`;
      continue;
    }
    const g = b.group || 'Outros';
    if (!groupMap[g]) {
      groupMap[g] = [];
      groups.push(g);
    }
    groupMap[g].push(b);
  }
  return noneOpt + groups.map(g =>
    `<optgroup label="${esc(g)}">${groupMap[g].map(b =>
      `<option value="${esc(b.id)}"${b.id === selectedId ? ' selected' : ''}>${esc(b.name)}${b.foodName ? ' · 🍽️ ' + esc(b.foodName) + ' (2x)' : ''}</option>`
    ).join('')}</optgroup>`
  ).join('');
}

function getItemDailyBonus(v, p) {
  const active = getActiveDailyBonuses();
  if (!active.length || !v || !p) return null;
  const cat = v.cat || 'plate';
  for (const b of active) {
    if (b.craftCat === cat) {
      if (!b.craftSlot || b.craftSlot === p.slot) return b;
    }
  }
  return null;
}

function getStationsFedByFood(foodId) {
  if (!GD || !GD.stationNutrition) return [];
  const baseId = foodId.split('@')[0];
  return GD.stationNutrition.filter(s => s.favoriteFoodId === baseId);
}

const QUALITIES = [
  { q: 1, name: 'Normal', short: 'Q1', weight: 0.45 },
  { q: 2, name: 'Bom', short: 'Q2', weight: 0.42 },
  { q: 3, name: 'Notável', short: 'Q3', weight: 0.11 },
  { q: 4, name: 'Excelente', short: 'Q4', weight: 0.02 },
  { q: 5, name: 'Obra-prima', short: 'Q5', weight: 0.00 }
];

const TIERS = [];
for (let t = 4; t <= 8; t++) for (let e = 0; e <= 4; e++) TIERS.push(`${t}.${e}`);
const BAR_KEYS = ['2.0', '3.0', ...TIERS];
const ORE_QTY = { 2: 1, 3: 2, 4: 2, 5: 3, 6: 4, 7: 5, 8: 5 };
const WOOD_QTY = { 2: 1, 3: 2, 4: 2, 5: 3, 6: 4, 7: 5, 8: 5 };
const LOC_PT = { 'Black Market': 'Mercado Negro' };

/* ---------------- utilidades ---------------- */
const $ = (s, el = document) => el.querySelector(s);
const tv = k => k.split('.').map(Number);
const fmt = (v, d = 0) => (v === null || v === undefined || v === '' || isNaN(v)) ? '—'
  : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = v => (v === null || v === undefined || isNaN(v)) ? '—' : (v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
const cls = v => v > 0 ? 'pos' : v < 0 ? 'neg' : '';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const locName = l => LOC_PT[l] || l;
const getFoodSaleLocs = () => ((GD && GD.saleLocs) || []).filter(l => l !== 'Black Market');
function toast(msg, ms = 3500) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), ms);
}

/* ---------------- IDs do jogo ---------------- */
const suf = e => e ? `_LEVEL${e}@${e}` : '';
const barId = k => { const [t, e] = tv(k); return `T${t}_METALBAR${suf(e)}`; };
const oreId = k => { const [t, e] = tv(k); return `T${t}_ORE${suf(e)}`; };
const plankId = k => { const [t, e] = tv(k); return `T${t}_PLANKS${suf(e)}`; };
const woodId = k => { const [t, e] = tv(k); return `T${t}_WOOD${suf(e)}`; };
const variant = code => GD.variants.find(v => v.code === code);
const piece = slot => GD.pieces.find(p => p.slot === slot);
const piecesOf = codeOrV => {
  const v = typeof codeOrV === 'string' ? variant(codeOrV) : codeOrV;
  const cat = (v && v.cat) || 'plate';
  return GD.pieces.filter(p => (p.cat || 'plate') === cat);
};
const matReq = (v, p) => ({
  bars: (v && v.bars !== undefined) ? v.bars : (p ? p.bars || 0 : 0),
  planks: (v && v.planks !== undefined) ? v.planks : (p ? p.planks || 0 : 0)
});
const itemId = (code, slot, k) => {
  const [t, e] = tv(k);
  const v = variant(code);
  if (v && (v.cat === 'bow' || v.cat === 'crossbow')) {
    return `T${t}_${code}${e ? '@' + e : ''}`;
  }
  return `T${t}_${slot}_PLATE_${code}${e ? '@' + e : ''}`;
};
const artOf = (code, slot, t) => GD.artifacts[`${code}_${slot}_${t}`] || null;
function lowerBar(k) {
  const [t, e] = tv(k);
  if (t === 2) return null;
  if (t === 3) return '2.0';
  if (t === 4) return '3.0';            // T4.x sempre usa a barra/tábua T3.0
  return `${t - 1}.${e}`;               // T5+ usa a barra/tábua inferior do mesmo encantamento
}

/* ---------------- preços e qualidades ---------------- */
function getP(id, loc) { const p = ST.prices[id]; return p && p[loc] > 0 ? p[loc] : null; }
function setP(id, loc, v) {
  ST.prices[id] = ST.prices[id] || {};
  if (v === null || v === '' || isNaN(v) || v <= 0) delete ST.prices[id][loc];
  else ST.prices[id][loc] = Number(v);
  if (ST.dates[id]) delete ST.dates[id][loc];   // preço manual: remove data da API
}

function getQP(id, loc, q = 1) {
  const qStr = String(q || 1);
  if (ST.qualityPrices && ST.qualityPrices[id] && ST.qualityPrices[id][qStr] && ST.qualityPrices[id][qStr][loc] > 0) {
    return ST.qualityPrices[id][qStr][loc];
  }
  if (qStr === '1') return getP(id, loc);
  return null;
}

function setQP(id, loc, q, v) {
  const qStr = String(q || 1);
  ST.qualityPrices = ST.qualityPrices || {};
  ST.qualityPrices[id] = ST.qualityPrices[id] || {};
  ST.qualityPrices[id][qStr] = ST.qualityPrices[id][qStr] || {};
  if (v === null || v === '' || isNaN(v) || v <= 0) {
    delete ST.qualityPrices[id][qStr][loc];
    if (qStr === '1') setP(id, loc, null);
  } else {
    ST.qualityPrices[id][qStr][loc] = Number(v);
    if (qStr === '1') setP(id, loc, Number(v));
  }
  if (ST.qualityDates && ST.qualityDates[id] && ST.qualityDates[id][qStr]) {
    delete ST.qualityDates[id][qStr][loc];
  }
}

function minBuy(id, locs = null) {
  let best = null;
  const list = locs || GD.cities;
  for (const c of list) { const v = getP(id, c); if (v && (!best || v < best.price)) best = { price: v, loc: c }; }
  return best;
}

function getQualityBreakdown(id) {
  const bd = {};
  let lastKnownPrice = null, lastKnownLoc = null, lastKnownQ = null;
  for (const qObj of QUALITIES) {
    let best = null;
    for (const c of GD.saleLocs) {
      const v = getQP(id, c, qObj.q);
      if (v && (!best || v > best.price)) best = { price: v, loc: c, quality: qObj.q, isFallback: false };
    }
    if (best) {
      bd[qObj.q] = best;
      lastKnownPrice = best.price;
      lastKnownLoc = best.loc;
      lastKnownQ = qObj.q;
    } else if (lastKnownPrice !== null) {
      bd[qObj.q] = { price: lastKnownPrice, loc: lastKnownLoc, quality: lastKnownQ, isFallback: true };
    }
  }
  return bd;
}

function bestSellForQuality(id, targetQ = 1) {
  const qNum = Number(targetQ) || 1;
  let best = null;
  for (const c of GD.saleLocs) {
    const v = getQP(id, c, qNum);
    if (v && (!best || v > best.price)) best = { price: v, loc: c, quality: qNum, isFallback: false };
  }
  if (!best && qNum > 1) {
    for (let fallbackQ = qNum - 1; fallbackQ >= 1; fallbackQ--) {
      for (const c of GD.saleLocs) {
        const v = getQP(id, c, fallbackQ);
        if (v && (!best || v > best.price)) best = { price: v, loc: c, quality: fallbackQ, isFallback: true, reqQuality: qNum };
      }
      if (best) break;
    }
  }
  return best;
}

function bestSellQuality(id, mode = 'mix') {
  const bd = getQualityBreakdown(id);
  const q1 = bd[1];

  if (mode && mode !== 'mix' && mode !== 'best') {
    const qNum = Number(mode) || 1;
    const s = bestSellForQuality(id, qNum);
    if (!s) return null;
    const qObj = QUALITIES.find(x => x.q === qNum) || { short: `Q${qNum}`, name: `Qualidade ${qNum}` };
    return {
      price: s.price,
      loc: s.loc,
      quality: String(qNum),
      qualityLabel: qObj.short,
      qualityName: qObj.name,
      isFallback: s.isFallback,
      breakdown: bd
    };
  }

  if (mode === 'best') {
    let top = null;
    for (const qObj of QUALITIES) {
      const s = bd[qObj.q];
      if (s && (!top || s.price > top.price)) {
        top = { price: s.price, loc: s.loc, quality: String(qObj.q), qualityLabel: qObj.short, qualityName: qObj.name, isFallback: s.isFallback };
      }
    }
    if (top) top.breakdown = bd;
    return top;
  }

  // Modo 'mix': Mix Real do Craft ponderado pelas probabilidades de rolagem
  if (!q1 || !q1.price) return null;
  let expectedSilver = 0;
  for (const qObj of QUALITIES) {
    const qData = bd[qObj.q];
    const p = (qData && qData.price) ? qData.price : q1.price;
    expectedSilver += qObj.weight * p;
  }
  return {
    price: Math.round(expectedSilver),
    loc: q1.loc,
    quality: 'mix',
    qualityLabel: 'Mix',
    qualityName: 'Mix Real do Craft (~45% Q1, 42% Q2, 11% Q3, 2% Q4)',
    breakdown: bd
  };
}

function bestSell(id) {
  return bestSellQuality(id, rankFilter.quality || ST.config.targetQuality || 'mix');
}

function formatQualityTooltip(bd, curPrice, curLabel) {
  const lines = [`Preço atual (${curLabel}): ${fmt(curPrice)}s`];
  lines.push('-------------------------');
  lines.push('Preço de venda por qualidade:');
  for (const qObj of QUALITIES) {
    const item = bd ? bd[qObj.q] : null;
    if (item && item.price > 0) {
      lines.push(`${qObj.short} (${qObj.name}): ${fmt(item.price)}s em ${locName(item.loc)}${item.isFallback ? ' [ref Q' + item.quality + ']' : ''}`);
    } else {
      lines.push(`${qObj.short} (${qObj.name}): sem preço`);
    }
  }
  return lines.join('\n');
}

/* ---------------- volumes e demanda ---------------- */
function getVol(id, loc) {
  if (!ST.volumes || !ST.volumes[id]) return null;
  if (loc) return ST.volumes[id][loc] || null;
  return null;
}
function getBestVol(id, preferredLoc) {
  if (!ST.volumes || !ST.volumes[id]) return null;
  const isFood = classifyPriceItem(id) === 'food';
  if (preferredLoc && (!isFood || preferredLoc !== 'Black Market') && ST.volumes[id][preferredLoc]) {
    return { ...ST.volumes[id][preferredLoc], loc: preferredLoc };
  }
  let best = null;
  for (const [loc, data] of Object.entries(ST.volumes[id])) {
    if (isFood && loc === 'Black Market') continue;
    if (!best || (data.daily || 0) > (best.daily || 0)) {
      best = { ...data, loc };
    }
  }
  return best;
}
function itemIconUrl(id, quality = 1) {
  if (!id) return '';
  return `https://render.albiononline.com/v1/item/${encodeURIComponent(id)}.png?quality=${quality || 1}`;
}

function getItemDisplayInfo(id) {
  if (!id) return { name: 'Item', tier: '', sub: '', icon: '' };
  for (const k of BAR_KEYS) {
    if (oreId(k) === id) return { name: `Minério T${k}`, tier: `T${k}`, sub: 'Matéria-prima', icon: itemIconUrl(id) };
    if (barId(k) === id) return { name: `Barra de Metal T${k}`, tier: `T${k}`, sub: 'Material Refinado', icon: itemIconUrl(id) };
    if (woodId(k) === id) return { name: `Madeira T${k}`, tier: `T${k}`, sub: 'Matéria-prima', icon: itemIconUrl(id) };
    if (plankId(k) === id) return { name: `Tábua T${k}`, tier: `T${k}`, sub: 'Material Refinado', icon: itemIconUrl(id) };
  }
  if (GD.royal) {
    for (const t of [4, 5, 6, 7, 8]) {
      const s = GD.royal.sigils[t];
      if (s && s.id === id) return { name: `Emblema Real (${s.name})`, tier: `T${t}`, sub: 'Emblema Real', icon: itemIconUrl(id) };
    }
  }
  for (const [artKey, art] of Object.entries(GD.artifacts || {})) {
    if (art.id === id) return { name: art.name, tier: `T${art.id[1] || 4}`, sub: 'Artefato', icon: itemIconUrl(id) };
  }
  for (const v of GD.variants) {
    for (const p of piecesOf(v)) {
      for (const k of TIERS) {
        if (itemId(v.code, p.slot, k) === id) {
          return {
            name: `${v.name} · ${p.name}`,
            tier: `T${k}`,
            sub: `${v.cat === 'bow' ? 'Arco' : v.cat === 'crossbow' ? 'Besta' : 'Armadura de Placas'} · ${p.name}`,
            icon: itemIconUrl(id)
          };
        }
      }
    }
  }
  if (GD.itemNames && GD.itemNames[id]) {
    const rawName = GD.itemNames[id];
    const isFood = id.includes('_MEAL_');
    const isMeat = id.includes('_MEAT');
    const isFarm = id.includes('_FARM_');
    const isSauce = id.includes('FISHSAUCE');
    const isBreadFlourButter = id.includes('FLOUR') || id.includes('BREAD') || id.includes('BUTTER');
    const sub = isFood ? 'Culinária · Comida' : isMeat ? 'Açougue · Carne' : isFarm ? 'Fazenda · Animal' : isSauce ? 'Pesca · Molho' : isBreadFlourButter ? 'Processamento' : 'Insumo de Culinária';
    const tier = id.startsWith('T') ? id.split('_')[0] : '';
    return { name: rawName, tier, sub, icon: itemIconUrl(id) };
  }
  return { name: id, tier: '', sub: 'Item de Mercado', icon: itemIconUrl(id) };
}

function volBadge(vol, locLabel = '', itemId = '', loc = '') {
  const dataAttr = itemId ? ` data-hist-id="${esc(itemId)}" data-hist-loc="${esc(loc || '')}" style="cursor:pointer"` : '';
  if (!vol) return `<span class="vol-badge vol-none" ${dataAttr} title="Demanda ainda não consultada. Clique para ver o histórico.">— <span class="vol-sub">s/ dados</span></span>`;
  const d = vol.daily !== undefined ? vol.daily : 0;
  const tip = `${locLabel ? locLabel + ': ' : ''}${fmt(d, 1)} peças/dia (Total 28d: ${fmt(vol.total28 || 0)} un)${vol.vwap ? ' · Preço médio (VWAP): ' + fmt(vol.vwap) + 's' : ''}${vol.lastDate ? ' · Última: ' + vol.lastDate : ''} — Clique para ver o gráfico e histórico`;
  if (d >= 20) return `<span class="vol-badge vol-high badge-tip" ${dataAttr} title="${esc(tip)}">🟢 <span class="vol-num">${fmt(d, 1)}</span><span class="vol-sub">/dia</span></span>`;
  if (d >= 5) return `<span class="vol-badge vol-med badge-tip" ${dataAttr} title="${esc(tip)}">🟡 <span class="vol-num">${fmt(d, 1)}</span><span class="vol-sub">/dia</span></span>`;
  if (d >= 1) return `<span class="vol-badge vol-low badge-tip" ${dataAttr} title="${esc(tip)}">🟠 <span class="vol-num">${fmt(d, 1)}</span><span class="vol-sub">/dia</span></span>`;
  if (d > 0) return `<span class="vol-badge vol-danger badge-tip" ${dataAttr} title="${esc(tip)}">🔴 <span class="vol-num">${fmt(d, 1)}</span><span class="vol-sub">/dia (lento)</span></span>`;
  return `<span class="vol-badge vol-danger badge-tip" ${dataAttr} title="${esc(tip)}">⛔ <span class="vol-num">0</span><span class="vol-sub">/dia (parado)</span></span>`;
}
function riskBadge(vol) {
  if (!vol) return `<span class="muted">—</span>`;
  const d = vol.daily !== undefined ? vol.daily : 0;
  if (d >= 20) return `<span class="pill win" title="Alta liquidez: venda rápida no mercado!">Alto Giro</span>`;
  if (d >= 5) return `<span class="pill win" style="background:#3b3214;color:#f0c04b" title="Média liquidez: demanda moderada e consistente">Médio Giro</span>`;
  if (d >= 1) return `<span class="pill" style="background:#3b2314;color:#f0854b" title="Baixa liquidez: cuidado ao produzir em lote grande">Baixo Giro</span>`;
  return `<span class="pill" style="background:#3b1414;color:#ef6b6b" title="Risco alto: pouca ou nenhuma venda nos últimos 28 dias!">⚠️ Prata Parada</span>`;
}
function calcVolumeSummary(pts) {
  if (!pts || !pts.length) return null;
  const now = Date.now();
  let total28 = 0, total7 = 0, lastDate = null, latestTs = 0;
  let silver28 = 0, silver7 = 0;
  let minPrice = Infinity, maxPrice = 0;
  const validPts = [];
  for (const pt of pts) {
    const ptTs = new Date(pt.timestamp + (pt.timestamp.endsWith('Z') ? '' : 'Z')).getTime();
    if (isNaN(ptTs)) continue;
    const count = pt.item_count || 0;
    const avg = pt.avg_price || 0;
    if (count <= 0 || avg <= 0) continue;
    validPts.push({ ts: ptTs, date: pt.timestamp.slice(0, 10), count, avg: Math.round(avg) });
  }
  validPts.sort((a, b) => a.ts - b.ts);
  const recentRawPrices = validPts
    .filter(pt => (now - pt.ts) / (1000 * 3600 * 24) <= 28)
    .map(pt => pt.avg)
    .sort((a, b) => a - b);
  const rawMed28 = recentRawPrices.length > 0
    ? (recentRawPrices.length % 2 !== 0
      ? recentRawPrices[Math.floor(recentRawPrices.length / 2)]
      : Math.round((recentRawPrices[recentRawPrices.length / 2 - 1] + recentRawPrices[recentRawPrices.length / 2]) / 2))
    : null;

  const series28 = [];
  const prices28 = [];
  for (const pt of validPts) {
    const diffDays = (now - pt.ts) / (1000 * 3600 * 24);
    // Protege o VWAP contra dias isolados com venda troll/RMT (ex: 1 un. vendida a 10x a mediana)
    const isSpikeDay = rawMed28 && recentRawPrices.length >= 3 && pt.avg > rawMed28 * 2.5;
    const safeAvg = isSpikeDay ? Math.round(rawMed28 * 1.35) : pt.avg;
    if (diffDays <= 28) {
      total28 += pt.count;
      silver28 += pt.count * safeAvg;
      if (safeAvg < minPrice) minPrice = safeAvg;
      if (safeAvg > maxPrice) maxPrice = safeAvg;
      prices28.push(safeAvg);
      series28.push({ date: pt.date, count: pt.count, avg: safeAvg });
    }
    if (diffDays <= 7) {
      total7 += pt.count;
      silver7 += pt.count * safeAvg;
    }
    if (pt.ts > latestTs) { latestTs = pt.ts; lastDate = pt.date; }
  }
  const daysSinceLast = latestTs ? (now - latestTs) / (1000 * 3600 * 24) : 999;
  let daily = 0;
  if (daysSinceLast <= 28 && total28 > 0) {
    daily = +(total28 / 28).toFixed(1);
    if (daily < 0.1 && total28 > 0) daily = 0.1;
  }
  const vwap28 = total28 > 0 ? Math.round(silver28 / total28) : null;
  const vwap7 = total7 > 0 ? Math.round(silver7 / total7) : null;
  const vwap = vwap7 || vwap28;

  prices28.sort((a, b) => a - b);
  let medianPrice = null;
  if (prices28.length > 0) {
    const mid = Math.floor(prices28.length / 2);
    medianPrice = prices28.length % 2 !== 0 ? prices28[mid] : Math.round((prices28[mid - 1] + prices28[mid]) / 2);
  }

  const volatility = (minPrice < Infinity && maxPrice > 0 && vwap > 0)
    ? Math.round(((maxPrice - minPrice) / vwap) * 100)
    : 0;

  let trend = 'stable';
  const totalPrior = total28 - total7;
  const silverPrior = silver28 - silver7;
  const vwapPrior = totalPrior > 0 ? (silverPrior / totalPrior) : null;
  if (vwap7 && vwapPrior) {
    if (vwap7 >= vwapPrior * 1.08) trend = 'up';
    else if (vwap7 <= vwapPrior * 0.92) trend = 'down';
  } else if (vwap7 && vwap28) {
    if (vwap7 >= vwap28 * 1.08) trend = 'up';
    else if (vwap7 <= vwap28 * 0.92) trend = 'down';
  }

  return {
    daily, total28, total7, lastDate, daysSinceLast: Math.round(daysSinceLast),
    vwap, vwap28, vwap7,
    minPrice: minPrice < Infinity ? minPrice : null,
    maxPrice: maxPrice > 0 ? maxPrice : null,
    medianPrice, volatility, trend,
    series: series28
  };
}

function analyzePriceHealth(spotPrice, vol, refPrice = null) {
  if (!spotPrice || spotPrice <= 0) {
    return {
      status: 'none',
      label: 'Sem preço',
      badgeClass: 'health-nodata',
      icon: '⚪',
      title: 'Sem oferta de mercado registrada',
      diffPct: null,
      vwap: null,
      desc: 'Este item ainda não possui ordem de venda ou compra registrada nas cidades.'
    };
  }
  if (!vol || (!vol.vwap && !vol.daily && !vol.total28)) {
    if (refPrice && refPrice > 0 && spotPrice >= refPrice * 1.45) {
      const diffPct = Math.round(((spotPrice - refPrice) / refPrice) * 100);
      return {
        status: 'inflated',
        label: `Anormal (+${diffPct}%)`,
        badgeClass: 'health-inflated',
        icon: '⚠️',
        title: `Preço Anormalmente Alto (+${diffPct}% vs Referência ${fmt(refPrice)}s)`,
        diffPct, vwap: refPrice, daily: 0, daysSince: 999,
        desc: `A oferta spot (${fmt(spotPrice)}s) está +${diffPct}% acima da referência de mercado/custo (${fmt(refPrice)}s), indicando anúncio isolado ou leitura da última página do mercado.`
      };
    }
    return {
      status: 'nodata',
      label: 'Sem histórico',
      badgeClass: 'health-nodata',
      icon: '❓',
      title: 'Histórico de vendas ainda não consultado',
      diffPct: null,
      vwap: null,
      desc: 'Ainda não foram baixados dados de volume ou histórico para esta cidade/item. Clique no botão de buscar volumes para carregar o histórico do Albion Data Project.'
    };
  }

  const rawVwap = vol.vwap || vol.vwap28 || vol.vwap7 || 0;
  const vwap = (refPrice && refPrice > 0 && rawVwap > refPrice * 2.2) ? refPrice : (rawVwap || refPrice || 0);
  const daily = vol.daily !== undefined ? vol.daily : 0;
  const daysSince = vol.daysSinceLast !== undefined ? vol.daysSinceLast : 999;

  if (daily === 0 || daysSince > 21) {
    return {
      status: 'nosales',
      label: 'Sem Vendas',
      badgeClass: 'health-nosales',
      icon: '⛔',
      title: 'Sem vendas recentes / Risco de Prata Parada',
      diffPct: vwap ? Math.round(((spotPrice - vwap) / vwap) * 100) : null,
      vwap, daily, daysSince,
      desc: `Este item teve pouca ou nenhuma venda nos últimos 28 dias (${fmt(daily, 1)} un/dia; última venda registrada há ${daysSince} dias). Mesmo que a margem pareça atraente na tela, há grande risco de sua prata ficar presa sem compradores no mercado.`
    };
  }

  if (vwap > 0) {
    const diffPct = Math.round(((spotPrice - vwap) / vwap) * 100);
    if (diffPct >= 25) {
      return {
        status: 'inflated',
        label: `Anormal (+${diffPct}%)`,
        badgeClass: 'health-inflated',
        icon: '⚠️',
        title: `Preço Anormalmente Alto (+${diffPct}% vs VWAP)`,
        diffPct, vwap, daily, daysSince,
        desc: `A menor oferta de venda atual (${fmt(spotPrice)}s) está +${diffPct}% acima do Preço Médio Ponderado Histórico (VWAP: ${fmt(vwap)}s). Isso geralmente é causado por mercado esvaziado ou anúncio troll de 1 unidade. Cuidado: vender a esse valor pode demorar muito tempo ou nunca ser comprado!`
      };
    }
    if (diffPct <= -25) {
      return {
        status: 'dump',
        label: `Abaixo (${diffPct}%)`,
        badgeClass: 'health-dump',
        icon: '📉',
        title: `Preço Abaixo da Média Histórica (${diffPct}% vs VWAP)`,
        diffPct, vwap, daily, daysSince,
        desc: `A oferta atual (${fmt(spotPrice)}s) está ${Math.abs(diffPct)}% abaixo do preço médio real histórico (VWAP: ${fmt(vwap)}s). Pode ser queima de estoque temporária (dump). Para craft, você pode obter lucros maiores se aguardar o preço voltar à média.`
      };
    }
    if (Math.abs(diffPct) <= 12 && daysSince <= 7) {
      return {
        status: 'stable',
        label: `Estável (${diffPct >= 0 ? '+' : ''}${diffPct}%)`,
        badgeClass: 'health-stable',
        icon: '🟢',
        title: `Preço Confiável e Saudável (${diffPct >= 0 ? '+' : ''}${diffPct}% do VWAP)`,
        diffPct, vwap, daily, daysSince,
        desc: `O preço atual de ${fmt(spotPrice)}s está perfeitamente alinhado com o Preço Médio Histórico de ${fmt(vwap)}s (variação de apenas ${diffPct}%). Há vendas regulares ativas (${fmt(daily, 1)} un/dia, última há ${daysSince}d). O lucro estimado aqui é sólido e confiável!`
      };
    }
    return {
      status: 'moderate',
      label: `Oscilando (${diffPct >= 0 ? '+' : ''}${diffPct}%)`,
      badgeClass: 'health-moderate',
      icon: '🟡',
      title: `Preço com Variação Moderada (${diffPct >= 0 ? '+' : ''}${diffPct}% vs VWAP)`,
      diffPct, vwap, daily, daysSince,
      desc: `O preço atual varia moderadamente em relação ao histórico (VWAP: ${fmt(vwap)}s; variação de ${diffPct}%). Acompanhe o fluxo diário de vendas (${fmt(daily, 1)} un/dia) para planejar o tamanho do lote.`
    };
  }

  return {
    status: 'nodata',
    label: 'Sem Histórico',
    badgeClass: 'health-nodata',
    icon: '❓',
    title: 'Histórico insuficiente',
    diffPct: null,
    vwap: null,
    desc: 'Volume registrado mas sem dados suficientes de valor ponderado.'
  };
}

function priceHealthBadge(spotPrice, vol, itemId = '', loc = '', refPrice = null) {
  const h = analyzePriceHealth(spotPrice, vol, refPrice);
  const dataAttrs = itemId ? `data-hist-id="${esc(itemId)}" data-hist-loc="${esc(loc)}"` : '';
  return `<span class="health-pill ${h.badgeClass}" ${dataAttrs} title="${esc(h.title + ' — Clique para ver o gráfico e histórico completo')}">${h.icon} ${h.label}</span>`;
}

/* ---------------- compra de materiais e proteção de volume ---------------- */
function getMaterialBuy(id, reqQty = 1) {
  const spot = minBuy(id);
  if (!spot) return null;
  const vol = getVol(id, spot.loc) || getBestVol(id);
  const vwap = (vol && vol.vwap > 0) ? vol.vwap : null;
  const availAmount = (ST.amounts && ST.amounts[id] && ST.amounts[id][spot.loc]) || null;
  const mode = ST.config.materialPricing || 'smart';

  let effectivePrice = spot.price;
  let slippageRisk = false;
  let reason = '';

  const hasVwap = (vwap !== null);
  const isAbnormallyLow = hasVwap && (spot.price < vwap * 0.82);
  const isDepthExceeded = (availAmount !== null && reqQty > availAmount);
  const isBulkSlippage = (reqQty >= 50 && hasVwap && vwap > spot.price * 1.08);

  if (isAbnormallyLow) {
    slippageRisk = true;
    reason = `Menor oferta spot (${fmt(spot.price)}s) é >18% menor que a média de volume (${fmt(vwap)}s). Risco de ser apenas 1 un./troll.`;
  } else if (isDepthExceeded) {
    slippageRisk = true;
    reason = `Apenas ${fmt(availAmount)} un. disponíveis a ${fmt(spot.price)}s, mas o plano precisa de ${fmt(Math.ceil(reqQty))} un.`;
  } else if (isBulkSlippage) {
    slippageRisk = true;
    reason = `Lote grande (${fmt(Math.ceil(reqQty))} un.): menor oferta é ${fmt(spot.price)}s, mas o preço médio ponderado real é ${fmt(vwap)}s.`;
  }

  if (mode === 'vwap') {
    if (hasVwap) effectivePrice = vwap;
  } else if (mode === 'smart') {
    if (isAbnormallyLow || (reqQty >= 50 && hasVwap && vwap > spot.price)) {
      effectivePrice = vwap;
    }
  } else if (mode === 'buffer5') {
    effectivePrice = Math.round(spot.price * 1.05);
  } else if (mode === 'buffer10') {
    effectivePrice = Math.round(spot.price * 1.10);
  }

  return {
    price: effectivePrice,
    spotPrice: spot.price,
    vwap,
    loc: spot.loc,
    reqQty,
    availAmount,
    slippageRisk,
    reason,
    diff: vwap ? vwap - spot.price : 0
  };
}

/* ---------------- cálculos ---------------- */
function computeRefinedChain(rawIdFn, refinedIdFn, qtyMap, originsMap) {
  const c = ST.config, out = {};
  for (const k of BAR_KEYS) {
    const [t, e] = tv(k);
    const iv = 2 ** t * 2 ** e;
    const q = qtyMap[t];
    const lw = lowerBar(k);
    const rawBuy = getMaterialBuy(rawIdFn(k), q * 20);
    const refBuy = getMaterialBuy(refinedIdFn(k), 20);
    const ore = rawBuy ? { price: rawBuy.price, loc: rawBuy.loc, spotPrice: rawBuy.spotPrice, vwap: rawBuy.vwap, slippageRisk: rawBuy.slippageRisk, reason: rawBuy.reason } : null;
    const buy = refBuy ? { price: refBuy.price, loc: refBuy.loc, spotPrice: refBuy.spotPrice, vwap: refBuy.vwap, slippageRisk: refBuy.slippageRisk, reason: refBuy.reason } : null;
    const fee = iv * 0.1125 * c.feeRefine / 100;
    const buyC = buy ? buy.price * (1 + c.taxBuy) : null;
    const oreC = ore ? ore.price * (1 + c.taxBuy) : null;

    // 1. Cascata Completa (refinando cada etapa desde o T2)
    const lwCascade = lw ? (out[lw] ? out[lw].cascade : null) : 0;
    const cascade = (oreC !== null && lwCascade !== null)
      ? (q * oreC + lwCascade) * (1 - c.retRefine) + fee
      : null;

    // 2. Refino com Anterior Pronta (comprando T-1 pronta no mercado)
    const lwBuy = lw ? (out[lw] ? out[lw].buyC : null) : null;
    const step = !lw
      ? cascade
      : (oreC !== null && lwBuy !== null)
        ? (q * oreC + lwBuy) * (1 - c.retRefine) + fee
        : null;

    const refine = cascade;

    const stepDiff = (step !== null && cascade !== null && lw) ? step - cascade : null;

    let bestRefine = null, bestRefineMethod = null;
    if (cascade !== null && step !== null) {
      if (cascade <= step) { bestRefine = cascade; bestRefineMethod = 'cascade'; }
      else { bestRefine = step; bestRefineMethod = 'step'; }
    } else if (cascade !== null) {
      bestRefine = cascade; bestRefineMethod = 'cascade';
    } else if (step !== null) {
      bestRefine = step; bestRefineMethod = 'step';
    }

    let origin = (originsMap && originsMap[k]) || 'auto';
    if (origin === 'refine') origin = 'auto';

    let eff = null, dec = null;
    if (origin === 'buy') {
      eff = buyC; dec = 'buy';
    } else if (origin === 'cascade') {
      eff = cascade; dec = 'cascade';
    } else if (origin === 'step') {
      eff = step; dec = 'step';
    } else { // 'auto'
      const candidates = [];
      if (buyC !== null) candidates.push({ cost: buyC, dec: 'buy' });
      if (step !== null) candidates.push({ cost: step, dec: 'step' });
      if (cascade !== null) candidates.push({ cost: cascade, dec: 'cascade' });

      if (candidates.length) {
        candidates.sort((a, b) => a.cost - b.cost);
        eff = candidates[0].cost;
        dec = candidates[0].dec;
      }
    }

    const saveVsBuy = (buyC !== null && eff !== null) ? buyC - eff : null;

    out[k] = {
      k, t, e, iv, q, lw, ore, oreC, buy, buyC, fee,
      cascade, step, stepDiff,
      refine,
      bestRefine, bestRefineMethod,
      eff, dec, origin, saveVsBuy
    };
  }
  return out;
}

function computeBars() {
  return computeRefinedChain(oreId, barId, ORE_QTY, ST.origins || {});
}

function computePlanks() {
  return computeRefinedChain(woodId, plankId, WOOD_QTY, ST.plankOrigins || {});
}

function computeBaseItem(bars, code, slot, k, targetQ = null, planks = null, sellMode = null) {
  const c = ST.config, v = variant(code) || GD.variants[0];
  let p = piece(slot);
  if (!p || (p.cat || 'plate') !== (v.cat || 'plate')) {
    p = piecesOf(v)[0] || GD.pieces[0];
    slot = p.slot;
  }
  const [t] = tv(k);
  const b = bars[k];
  const plMap = planks || computePlanks();
  const pl = plMap[k];
  const req = matReq(v, p);
  const art = v.artifact ? artOf(code, slot, t) : null;
  const artBuy = art ? getMaterialBuy(art.id, 1) : null;

  const metalCost = req.bars > 0 ? (b && b.eff !== null ? req.bars * b.eff * (1 - c.retCraft) : null) : 0;
  const planksCost = req.planks > 0 ? (pl && pl.eff !== null ? req.planks * pl.eff * (1 - c.retCraft) : null) : 0;
  const barsCost = (metalCost !== null && planksCost !== null) ? metalCost + planksCost : null;
  const artCost = art ? (artBuy ? artBuy.price * (1 + c.taxBuy) : null) : 0;
  const iv = (req.bars * b.iv) + (req.planks * pl.iv) + (art ? art.iv : 0);
  const fee = iv * 0.1125 * c.feeCraft / 100;
  const cost = (barsCost !== null && artCost !== null) ? barsCost + artCost + fee : null;
  const itId = itemId(code, slot, k);
  const qMode = targetQ || rankFilter.quality || ST.config.targetQuality || 'mix';
  const sell = bestSellQuality(itId, qMode);
  const spotPrice = sell ? sell.price : null;
  const vol = sell ? (getVol(itId, sell.loc) || getBestVol(itId)) : getBestVol(itId);
  const health = analyzePriceHealth(spotPrice, vol);
  const sellPricingMode = sellMode || rankFilter.sellPricing || 'spot';

  let effectiveSellPrice = spotPrice;
  if (vol && vol.vwap > 0) {
    if (sellPricingMode === 'vwap') {
      effectiveSellPrice = vol.vwap;
    } else if (sellPricingMode === 'safe') {
      effectiveSellPrice = spotPrice ? Math.min(spotPrice, vol.vwap) : vol.vwap;
    } else if (sellPricingMode === 'smart' && health.status === 'inflated') {
      effectiveSellPrice = vol.vwap;
    }
  }

  const revenue = effectiveSellPrice ? effectiveSellPrice * (1 - c.taxSell) : null;
  const profit = (cost !== null && revenue !== null) ? revenue - cost : null;
  const dailyVol = vol ? (vol.daily !== undefined ? vol.daily : 0) : null;
  const profitDaily = (dailyVol !== null) ? ((profit !== null && profit > 0) ? profit * dailyVol : (profit !== null && profit < 0 ? profit : 0)) : profit;
  return {
    id: itId, code, slot, k, t, v, p,
    nBars: req.bars, nPlanks: req.planks, metalCost, planksCost,
    art, artBuy, barsCost, artCost, iv, fee, cost, sell,
    spotPrice, effectiveSellPrice, revenue, profit,
    vol, dailyVol, profitDaily, health,
    margin: profit !== null && cost ? profit / cost : null,
    name: `${v.name} · ${p.name} · T${k}`,
  };
}

function computeItem(bars, code, slot, k, targetQ = null, planks = null, sellMode = null) {
  const c = ST.config, v = variant(code) || GD.variants[0];
  let p = piece(slot);
  if (!p || (p.cat || 'plate') !== (v.cat || 'plate')) {
    p = piecesOf(v)[0] || GD.pieces[0];
    slot = p.slot;
  }
  const [t] = tv(k);
  const qMode = targetQ || rankFilter.quality || ST.config.targetQuality || 'mix';

  if (v && v.royal && GD.royal) {
    const roy = GD.royal;
    const sigilInfo = (roy.sigils && roy.sigils[t]) || null;
    const sigilQty = (roy.sigilQty && roy.sigilQty[slot] && roy.sigilQty[slot][t]) || 0;
    const sigilBuy = sigilInfo ? getMaterialBuy(sigilInfo.id, sigilQty) : null;
    const sigilCost = (sigilBuy && sigilQty > 0) ? sigilQty * sigilBuy.price * (1 + c.taxBuy) : null;

    let bestBase = null;
    for (const bCode of roy.baseSets) {
      const bV = variant(bCode);
      const bIt = computeBaseItem(bars, bCode, slot, k, targetQ, planks, sellMode);
      const bBuy = getMaterialBuy(itemId(bCode, slot, k), 1);
      const bBuyCost = bBuy ? bBuy.price * (1 + c.taxBuy) : null;

      if (bBuyCost !== null) {
        if (!bestBase || bBuyCost < bestBase.cost) {
          bestBase = { code: bCode, name: `${bV.name} · ${p.name}`, method: 'buy', cost: bBuyCost, buy: bBuy, bIt };
        }
      }
      if (bIt && bIt.cost !== null) {
        if (!bestBase || bIt.cost < bestBase.cost) {
          bestBase = { code: bCode, name: `${bV.name} · ${p.name}`, method: 'craft', cost: bIt.cost, bIt };
        }
      }
    }

    const baseCost = bestBase ? bestBase.cost : null;
    const fee = 0;
    const cost = (baseCost !== null && sigilCost !== null) ? baseCost + sigilCost + fee : null;
    const itId = itemId(code, slot, k);
    const sell = bestSellQuality(itId, qMode);
    const spotPrice = sell ? sell.price : null;
    const vol = sell ? (getVol(itId, sell.loc) || getBestVol(itId)) : getBestVol(itId);
    const health = analyzePriceHealth(spotPrice, vol);
    const sellPricingMode = sellMode || rankFilter.sellPricing || 'spot';

    let effectiveSellPrice = spotPrice;
    if (vol && vol.vwap > 0) {
      if (sellPricingMode === 'vwap') {
        effectiveSellPrice = vol.vwap;
      } else if (sellPricingMode === 'safe') {
        effectiveSellPrice = spotPrice ? Math.min(spotPrice, vol.vwap) : vol.vwap;
      } else if (sellPricingMode === 'smart' && health.status === 'inflated') {
        effectiveSellPrice = vol.vwap;
      }
    }

    const revenue = effectiveSellPrice ? effectiveSellPrice * (1 - c.taxSell) : null;
    const profit = (cost !== null && revenue !== null) ? revenue - cost : null;
    const dailyVol = vol ? (vol.daily !== undefined ? vol.daily : 0) : null;
    const profitDaily = (dailyVol !== null) ? ((profit !== null && profit > 0) ? profit * dailyVol : (profit !== null && profit < 0 ? profit : 0)) : profit;

    return {
      id: itId, code, slot, k, t, v, p,
      isRoyal: true,
      nBars: p.bars || 0, nPlanks: 0, metalCost: baseCost, planksCost: 0,
      sigilInfo, sigilQty, sigilBuy, sigilCost,
      bestBase, baseCost,
      barsCost: baseCost,
      artCost: sigilCost,
      art: sigilInfo ? { id: sigilInfo.id, name: `${sigilQty}x ${sigilInfo.name}` } : null,
      artBuy: sigilBuy,
      iv: 0, fee, cost, sell,
      spotPrice, effectiveSellPrice, revenue, profit,
      vol, dailyVol, profitDaily, health,
      margin: profit !== null && cost ? profit / cost : null,
      name: `${v.name} · ${p.name} · T${k}`,
    };
  }

  return computeBaseItem(bars, code, slot, k, targetQ, planks, sellMode);
}

function decomposeChainDemands(directMap, chainMap, rawIdFn, refIdFn, rawName, refName, missing) {
  const c = ST.config;
  const demands = Object.fromEntries(BAR_KEYS.map(k => [k, directMap[k] || 0]));
  const buyRefMap = {};
  const buyRawMap = {};
  const refineStats = {};

  for (const k of [...BAR_KEYS].reverse()) {
    const reqQty = demands[k];
    if (!reqQty || reqQty < 1e-9) continue;
    const b = chainMap[k];
    const dec = b.dec || 'buy';

    if (dec === 'buy') {
      buyRefMap[k] = (buyRefMap[k] || 0) + reqQty;
    } else if (dec === 'step') {
      const oq = reqQty * b.q * (1 - c.retRefine);
      buyRawMap[k] = (buyRawMap[k] || 0) + oq;
      refineStats[k] = (refineStats[k] || 0) + reqQty;
      if (b.lw) {
        const prevQty = reqQty * (1 - c.retRefine);
        buyRefMap[b.lw] = (buyRefMap[b.lw] || 0) + prevQty;
      }
    } else { // 'cascade'
      const oq = reqQty * b.q * (1 - c.retRefine);
      buyRawMap[k] = (buyRawMap[k] || 0) + oq;
      refineStats[k] = (refineStats[k] || 0) + reqQty;
      if (b.lw) {
        const prevQty = reqQty * (1 - c.retRefine);
        demands[b.lw] = (demands[b.lw] || 0) + prevQty;
      }
    }
  }

  const buyRef = [], buyRaw = [];
  let slippageCount = 0;

  for (const k of BAR_KEYS) {
    const q = buyRefMap[k];
    if (q && q > 1e-9) {
      const b = chainMap[k];
      const refBuy = getMaterialBuy(refIdFn(k), q);
      const effPrice = refBuy ? refBuy.price * (1 + c.taxBuy) : (b.buyC || null);
      if (effPrice === null) missing.push(`${refName} T${k}`);
      if (refBuy && refBuy.slippageRisk) slippageCount++;
      buyRef.push({
        k, qty: q,
        loc: refBuy ? refBuy.loc : (b.buy ? b.buy.loc : '—'),
        price: effPrice,
        total: effPrice ? q * effPrice : null,
        slippageRisk: refBuy ? refBuy.slippageRisk : false,
        spotPrice: refBuy ? refBuy.spotPrice : null,
        vwap: refBuy ? refBuy.vwap : null,
        reason: refBuy ? refBuy.reason : ''
      });
    }
  }
  for (const k of BAR_KEYS) {
    const q = buyRawMap[k];
    if (q && q > 1e-9) {
      const b = chainMap[k];
      const rawBuy = getMaterialBuy(rawIdFn(k), q);
      const effPrice = rawBuy ? rawBuy.price * (1 + c.taxBuy) : (b.oreC || null);
      if (!b.ore && !rawBuy) missing.push(`${rawName} T${k}`);
      if (rawBuy && rawBuy.slippageRisk) slippageCount++;
      buyRaw.push({
        k, qty: q,
        refineQty: refineStats[k] || 0,
        loc: rawBuy ? rawBuy.loc : (b.ore ? b.ore.loc : '—'),
        price: effPrice,
        total: effPrice ? q * effPrice : null,
        slippageRisk: rawBuy ? rawBuy.slippageRisk : false,
        spotPrice: rawBuy ? rawBuy.spotPrice : null,
        vwap: rawBuy ? rawBuy.vwap : null,
        reason: rawBuy ? rawBuy.reason : ''
      });
    }
  }

  return { demands, buyRef, buyRaw, refineStats, slippageCount };
}

function computePlan(bars, planks = null) {
  const c = ST.config;
  const plMap = planks || computePlanks();
  const rows = ST.plan.map(r => {
    const it = computeItem(bars, r.code, r.slot, r.k, r.quality || null, plMap);
    const qty = Number(r.qty) || 0;
    return { ...r, slot: it.slot, qty, it, totalCost: it.cost !== null ? it.cost * qty : null, totalProfit: it.profit !== null ? it.profit * qty : null };
  });

  // Demanda direta de barras e tábuas originada pelo craft de equipamentos
  const directBars = Object.fromEntries(BAR_KEYS.map(k => [k, 0]));
  const directPlanks = Object.fromEntries(BAR_KEYS.map(k => [k, 0]));
  const arts = {};
  const royalSigils = {};
  const buyGearPieces = {};
  const missing = [];

  for (const r of rows) {
    if (r.it.isRoyal) {
      if (r.it.sigilInfo) {
        const sId = r.it.sigilInfo.id;
        royalSigils[sId] = royalSigils[sId] || { id: sId, name: r.it.sigilInfo.name, qty: 0, buy: r.it.sigilBuy, price: r.it.sigilBuy ? r.it.sigilBuy.price * (1 + c.taxBuy) : null };
        royalSigils[sId].qty += r.qty * r.it.sigilQty;
        if (!r.it.sigilBuy) missing.push(r.it.sigilInfo.name);
      }
      if (r.it.bestBase) {
        if (r.it.bestBase.method === 'buy') {
          const gId = itemId(r.it.bestBase.code, r.slot, r.k);
          buyGearPieces[gId] = buyGearPieces[gId] || { id: gId, name: r.it.bestBase.name + ' T' + r.k, qty: 0, buy: r.it.bestBase.buy, price: r.it.bestBase.cost };
          buyGearPieces[gId].qty += r.qty;
        } else {
          directBars[r.k] += r.qty * r.it.p.bars * (1 - c.retCraft);
        }
      } else {
        missing.push(`Peça base para ${r.it.name}`);
      }
    } else {
      if (r.it.nBars > 0) directBars[r.k] += r.qty * r.it.nBars * (1 - c.retCraft);
      if (r.it.nPlanks > 0) directPlanks[r.k] += r.qty * r.it.nPlanks * (1 - c.retCraft);
      if (r.it.art) {
        const id = r.it.art.id;
        arts[id] = arts[id] || { art: r.it.art, qty: 0, buy: r.it.artBuy };
        arts[id].qty += r.qty;
      }
    }
  }

  const barDecomp = decomposeChainDemands(directBars, bars, oreId, barId, 'Minério', 'Barra pronta', missing);
  const plankDecomp = decomposeChainDemands(directPlanks, plMap, woodId, plankId, 'Madeira', 'Tábua pronta', missing);

  const buyBars = barDecomp.buyRef;
  const buyOre = barDecomp.buyRaw;
  const buyPlanks = plankDecomp.buyRef;
  const buyWood = plankDecomp.buyRaw;
  const slippageCount = barDecomp.slippageCount + plankDecomp.slippageCount;

  const artList = Object.values(arts).map(a => {
    const artBuy = getMaterialBuy(a.art.id, a.qty);
    const effPrice = artBuy ? artBuy.price * (1 + c.taxBuy) : (a.buy ? a.buy.price * (1 + c.taxBuy) : null);
    return {
      ...a,
      price: effPrice,
      total: effPrice ? a.qty * effPrice : null,
      slippageRisk: artBuy ? artBuy.slippageRisk : false,
      spotPrice: artBuy ? artBuy.spotPrice : null,
      vwap: artBuy ? artBuy.vwap : null,
      reason: artBuy ? artBuy.reason : ''
    };
  });
  artList.filter(a => a.price === null).forEach(a => missing.push(a.art.name));

  const sigilsList = Object.values(royalSigils).map(s => ({
    ...s,
    total: s.price ? s.qty * s.price : null
  }));

  const baseGearList = Object.values(buyGearPieces).map(g => ({
    ...g,
    total: g.price ? g.qty * g.price : null
  }));

  const sum = arr => arr.reduce((s, x) => s + (x.total || 0), 0);
  const fees = rows.reduce((s, r) => s + r.it.fee * r.qty, 0)
    + Object.entries(barDecomp.refineStats).reduce((s, [k, q]) => s + (q * bars[k].fee), 0)
    + Object.entries(plankDecomp.refineStats).reduce((s, [k, q]) => s + (q * plMap[k].fee), 0);

  return {
    rows, buyBars, buyOre, buyPlanks, buyWood, artList, sigilsList, baseGearList, missing,
    total: barDecomp.demands, totalPlanks: plankDecomp.demands,
    slippageCount,
    invest: sum(buyBars) + sum(buyOre) + sum(buyPlanks) + sum(buyWood) + sum(artList) + sum(sigilsList) + sum(baseGearList), fees,
    cost: rows.reduce((s, r) => s + (r.totalCost || 0), 0),
    revenue: rows.reduce((s, r) => s + (r.it.revenue !== null ? r.it.revenue * r.qty : 0), 0),
    profit: rows.reduce((s, r) => s + (r.totalProfit || 0), 0),
  };
}

/* ---------------- culinária & alimentos (cálculos) ---------------- */
function updateFoodReturnRate() {
  if (foodFilter.city === 'Caerleon') {
    foodFilter.retRate = foodFilter.focus ? 0.479 : 0.248;
  } else if (foodFilter.city === 'Ilha' || foodFilter.city === 'Island') {
    foodFilter.retRate = foodFilter.focus ? 0.435 : 0.0;
  } else {
    foodFilter.retRate = foodFilter.focus ? 0.435 : 0.152;
  }
}

function getFoodReferenceStats(itemId, unitCost = null) {
  const locs = getFoodSaleLocs();
  const citySpots = [];
  for (const c of locs) {
    const p = getP(itemId, c);
    if (p && p > 0) citySpots.push(p);
  }
  citySpots.sort((a, b) => a - b);
  const lowMedCity = citySpots.length > 0 ? citySpots[Math.floor((citySpots.length - 1) / 2)] : null;

  const vwaps = [];
  const vMap = (ST.volumes && ST.volumes[itemId]) || {};
  for (const c of locs) {
    const d = vMap[c];
    if (d && d.vwap > 0 && (d.daily || 0) >= 0.2) vwaps.push(d.vwap);
  }
  vwaps.sort((a, b) => a - b);
  const medVwap = vwaps.length > 0 ? vwaps[Math.floor((vwaps.length - 1) / 2)] : null;

  // Define âncora confiável combinando mediana das cidades, VWAP e custo de produção
  let anchorPrice = null;
  if (lowMedCity && medVwap) {
    anchorPrice = Math.min(lowMedCity, Math.max(medVwap * 1.25, unitCost || 0));
  } else if (medVwap) {
    anchorPrice = Math.max(medVwap, (unitCost || 0) * 0.9);
  } else if (lowMedCity) {
    anchorPrice = lowMedCity;
  }
  if (unitCost && unitCost > 0) {
    const isEnch = itemId.includes('@');
    const costCapMult = isEnch ? 2.6 : 2.1;
    if (!anchorPrice || anchorPrice > unitCost * costCapMult) {
      anchorPrice = Math.round(unitCost * (isEnch ? 1.35 : 1.25));
    }
  }

  let maxSaneSpot = Infinity;
  const baseForMax = Math.max(anchorPrice || 0, unitCost || 0);
  if (baseForMax > 0) {
    const isEnch = itemId.includes('@');
    maxSaneSpot = Math.round(baseForMax * (isEnch ? 2.15 : 1.95));
    if (lowMedCity && citySpots.length >= 2) {
      maxSaneSpot = Math.min(maxSaneSpot, Math.round(lowMedCity * 2.1));
    }
    if (unitCost && unitCost > 0) {
      maxSaneSpot = Math.max(maxSaneSpot, Math.round(unitCost * (isEnch ? 2.4 : 1.85)));
    }
  }

  return { lowMedCity, medVwap, anchorPrice, maxSaneSpot, cityCount: citySpots.length };
}

function getFoodIngredientBuy(id, reqQty = 1, options = {}) {
  const allowAllCities = options.allowAllCities !== false;
  const preferLoc = options.preferLoc || foodFilter.city || 'Caerleon';
  const autoArbitrage = options.autoArbitrage !== false && (foodFilter.autoArbitrage !== false);
  const taxBuy = ST.config.taxBuy || 0;

  // 1. Compra Direta de Mercado (filtrando outliers de cidades contaminadas na API)
  const allCities = getFoodSaleLocs();
  const refStats = getFoodReferenceStats(id, null);
  const searchCities = allowAllCities ? allCities : [preferLoc];

  let spot = null;
  for (const c of searchCities) {
    const v = getP(id, c);
    if (!v || v <= 0) continue;
    // Ignora cidade se o preço do insumo estiver absurdo (>2.5x a mediana das cidades)
    if (refStats.lowMedCity && v > refStats.lowMedCity * 2.5 && allCities.length > 1) continue;
    if (!spot || v < spot.price) spot = { price: v, loc: c };
  }
  if (!spot && !allowAllCities) {
    spot = minBuy(id, allCities);
  }
  const vol = spot ? (getVol(id, spot.loc) || getBestVol(id)) : null;
  const vwap = (vol && vol.vwap > 0) ? vol.vwap : null;
  const mode = ST.config.materialPricing || 'smart';

  let effDirectPrice = spot ? spot.price : null;
  let slippageRisk = false;
  let reason = '';

  if (spot && vwap) {
    if (spot.price < vwap * 0.82) {
      slippageRisk = true;
      reason = `Oferta spot (${fmt(spot.price)}s) é >18% abaixo do VWAP (${fmt(vwap)}s). Risco de profundidade.`;
    } else if (reqQty >= 50 && vwap > spot.price * 1.08) {
      slippageRisk = true;
      reason = `Lote grande (${fmt(Math.ceil(reqQty))} un.): menor oferta é ${fmt(spot.price)}s, VWAP é ${fmt(vwap)}s.`;
    }
    if (mode === 'vwap') {
      effDirectPrice = vwap;
    } else if (mode === 'smart' && (spot.price < vwap * 0.82 || (reqQty >= 50 && vwap > spot.price))) {
      effDirectPrice = vwap;
    }
  }

  // 2. Arbitragem com Açougue e Processamento
  let altMethod = null;
  if (autoArbitrage) {
    // A) Açougue: carne crua (T3_MEAT .. T8_MEAT)
    const butch = GD.butchering ? GD.butchering.find(b => b.meatId === id) : null;
    if (butch) {
      const animalsNeeded = reqQty / butch.yield;
      const animalBuy = getFoodIngredientBuy(butch.animalId, animalsNeeded, { ...options, autoArbitrage: false });
      if (animalBuy && animalBuy.price > 0) {
        const butcherCostPerMeat = animalBuy.price / butch.yield;
        altMethod = {
          method: 'butcher',
          name: `Abate de ${butch.animalName}`,
          sourceId: butch.animalId,
          sourceName: butch.animalName,
          yield: butch.yield,
          sourcePrice: animalBuy.price,
          sourceLoc: animalBuy.loc,
          costPerUnit: butcherCostPerMeat,
          savings: effDirectPrice ? (effDirectPrice - butcherCostPerMeat) : null
        };
      }
    }

    // B) Processamento: Farinha, Pão, Manteiga
    const proc = GD.foodProcessing ? GD.foodProcessing.find(p => p.id === id) : null;
    if (proc) {
      const fromBuy = getFoodIngredientBuy(proc.fromId, reqQty, { ...options, autoArbitrage: false });
      if (fromBuy && fromBuy.price > 0) {
        const procCostPerUnit = fromBuy.price / proc.count;
        altMethod = {
          method: 'process',
          name: `${proc.building}: ${proc.fromName}`,
          sourceId: proc.fromId,
          sourceName: proc.fromName,
          yield: proc.count,
          sourcePrice: fromBuy.price,
          sourceLoc: fromBuy.loc,
          costPerUnit: procCostPerUnit,
          savings: effDirectPrice ? (effDirectPrice - procCostPerUnit) : null
        };
      }
    }
  }

  if (altMethod && (effDirectPrice === null || altMethod.costPerUnit < effDirectPrice)) {
    return {
      id,
      method: altMethod.method,
      methodLabel: altMethod.name,
      price: altMethod.costPerUnit,
      spotPrice: altMethod.costPerUnit,
      loc: altMethod.sourceLoc,
      sourceId: altMethod.sourceId,
      sourceName: altMethod.sourceName,
      directPrice: effDirectPrice,
      savings: altMethod.savings,
      isArbitrage: true,
      slippageRisk: false,
      reason: ''
    };
  }

  if (spot) {
    return {
      id,
      method: 'market',
      methodLabel: 'Mercado',
      price: effDirectPrice,
      spotPrice: spot.price,
      vwap,
      loc: spot.loc,
      isArbitrage: false,
      slippageRisk,
      reason
    };
  }

  return null;
}

function computeMealItem(foodId, enchLevel = 0, options = {}) {
  const f = GD.foods ? GD.foods.find(item => item.id === foodId) : null;
  if (!f) return null;

  const ench = Number(enchLevel) || 0;
  const fullItemId = ench > 0 ? `${foodId}@${ench}` : foodId;
  const enchData = ench > 0 && f.enchantments ? f.enchantments.find(e => e.level === ench) : null;

  const city = options.city || foodFilter.city || 'Caerleon';
  const focus = options.focus !== undefined ? options.focus : foodFilter.focus;
  const feeFood = options.feeFood !== undefined ? options.feeFood : (foodFilter.feeFood || ST.config.feeCraft || 465);
  const taxBuy = ST.config.taxBuy || 0;
  const taxSell = ST.config.taxSell || 0.065;
  const sellPricingMode = options.sellPricing || foodFilter.sellPricing || 'spot';
  const filterSellLoc = options.sellLoc || foodFilter.sellLoc || '';

  // Taxa de retorno de recursos
  let ret = options.retRate !== undefined ? options.retRate : foodFilter.retRate;
  if (ret === null || ret === undefined) {
    if (city === 'Caerleon') ret = focus ? 0.479 : 0.248;
    else if (city === 'Ilha' || city === 'Island') ret = focus ? 0.435 : 0.0;
    else ret = focus ? 0.435 : 0.152;
  }

  const amountCrafted = f.amountCrafted || 10;

  // Insumos base por lote de 10
  let batchIngCost = 0;
  let hasMissingIng = false;
  const ingDetails = [];

  for (const ing of f.ingredients) {
    const buy = getFoodIngredientBuy(ing.id, ing.count, options);
    const effCount = ing.count * (1 - ret);
    if (!buy || buy.price === null) {
      hasMissingIng = true;
      ingDetails.push({ ...ing, buy: null, effCount, costPerUnit: null, totalCost: null });
    } else {
      const ingCost = effCount * buy.price * (1 + taxBuy);
      batchIngCost += ingCost;
      ingDetails.push({ ...ing, buy, effCount, costPerUnit: buy.price, totalCost: ingCost });
    }
  }

  // Molho de peixe (para encantamentos .1, .2, .3) — 0% de retorno de recursos
  let sauceCost = 0;
  let sauceDetails = null;
  if (ench > 0 && enchData) {
    const sId = enchData.sauceId;
    const sCount = enchData.sauceCount;
    const sBuy = getFoodIngredientBuy(sId, sCount, { ...options, autoArbitrage: false });
    if (!sBuy || sBuy.price === null) {
      hasMissingIng = true;
      sauceDetails = { id: sId, name: enchData.sauceName, count: sCount, perMeal: enchData.saucePerItem, buy: null, costPerUnit: null, totalCost: null };
    } else {
      sauceCost = sCount * sBuy.price * (1 + taxBuy);
      sauceDetails = { id: sId, name: enchData.sauceName, count: sCount, perMeal: enchData.saucePerItem, buy: sBuy, costPerUnit: sBuy.price, totalCost: sauceCost };
    }
  }

  // Taxa da estação (Cozinha) por lote
  const batchIv = f.batchIv || (f.iv * amountCrafted);
  const batchStationFee = batchIv * 0.1125 * (feeFood / 100);
  const unitStationFee = batchStationFee / amountCrafted;

  // Custo por lote e custo unitário
  const batchCost = hasMissingIng ? null : (batchIngCost + sauceCost + batchStationFee);
  const unitCost = batchCost !== null ? (batchCost / amountCrafted) : null;

  // Venda e liquidez (com filtro anti-outlier e anti-inflação)
  const searchSaleLocs = filterSellLoc ? [filterSellLoc] : getFoodSaleLocs();
  const refStats = getFoodReferenceStats(fullItemId, unitCost);
  const refPrice = refStats.anchorPrice;

  const candidates = [];
  for (const loc of searchSaleLocs) {
    const rawP = getP(fullItemId, loc);
    if (!rawP || rawP <= 0) continue;
    const locVol = getVol(fullItemId, loc);
    const rawLocVwap = (locVol && locVol.vwap > 0) ? locVol.vwap : null;
    const safeLocVwap = (rawLocVwap && refStats.maxSaneSpot < Infinity && rawLocVwap > refStats.maxSaneSpot * 1.2)
      ? refPrice
      : rawLocVwap;
    const locHealth = analyzePriceHealth(rawP, locVol, refPrice);
    const isExtremeOutlier = (refStats.maxSaneSpot < Infinity && rawP > refStats.maxSaneSpot)
      || (safeLocVwap && rawP > safeLocVwap * 1.75)
      || (refStats.lowMedCity && refStats.cityCount >= 2 && rawP > refStats.lowMedCity * 2.1);

    let effP = rawP;
    if (sellPricingMode === 'vwap') {
      effP = safeLocVwap || (isExtremeOutlier ? refPrice : rawP);
    } else if (sellPricingMode === 'safe') {
      const cap = safeLocVwap || refPrice || rawP;
      effP = Math.min(rawP, cap);
    } else if (sellPricingMode === 'smart') {
      if (isExtremeOutlier || locHealth.status === 'inflated') {
        effP = safeLocVwap || refPrice || rawP;
        if (refStats.maxSaneSpot < Infinity && effP > refStats.maxSaneSpot) {
          effP = refPrice || Math.round(refStats.maxSaneSpot * 0.85);
        }
      }
    } else if (sellPricingMode === 'spot') {
      // Mesmo no modo Spot, descarta anomalias extremas da API (>2.2x mediana/teto, como ordens de 9.9M ou última página)
      if (isExtremeOutlier && (rawP > (refPrice || 1) * 2.2 || rawP > refStats.maxSaneSpot * 1.15)) {
        effP = safeLocVwap || refPrice || rawP;
      }
    }

    candidates.push({
      loc,
      rawSpot: rawP,
      effPrice: effP ? Math.round(effP) : null,
      vol: locVol,
      health: locHealth,
      isOutlier: isExtremeOutlier
    });
  }

  // Prioriza cidades com cotação legítima (não-outlier); só usa cidade outlier se for a única opção (e já com preço corrigido)
  const cleanCandidates = candidates.filter(c => !c.isOutlier && c.effPrice > 0);
  const pool = cleanCandidates.length > 0 ? cleanCandidates : candidates.filter(c => c.effPrice > 0);
  let bestSell = null;
  for (const c of pool) {
    if (!bestSell || c.effPrice > bestSell.effPrice) {
      bestSell = c;
    }
  }

  const spotPrice = bestSell ? bestSell.rawSpot : null;
  const effectiveSellPrice = bestSell ? bestSell.effPrice : null;
  const sellLoc = bestSell ? bestSell.loc : (filterSellLoc || '—');
  const vol = bestSell ? (bestSell.vol || getBestVol(fullItemId)) : null;
  const health = analyzePriceHealth(effectiveSellPrice || spotPrice, vol, refPrice);
  const wasPriceCapped = !!(spotPrice && effectiveSellPrice && spotPrice > effectiveSellPrice * 1.05);

  const revenue = effectiveSellPrice ? effectiveSellPrice * (1 - taxSell) : null;
  const profit = (unitCost !== null && revenue !== null) ? revenue - unitCost : null;
  const margin = (profit !== null && unitCost && unitCost > 0) ? profit / unitCost : null;
  const dailyVol = vol ? (vol.daily !== undefined ? vol.daily : 0) : null;
  const profitDaily = (dailyVol !== null) ? ((profit !== null && profit > 0) ? profit * dailyVol : (profit !== null && profit < 0 ? profit : 0)) : profit;

  const focusCostPerMeal = (f.craftFocus || 0) / amountCrafted;

  return {
    id: fullItemId,
    baseId: foodId,
    name: ench > 0 ? `${f.name} .${ench}` : f.name,
    nameEn: f.nameEn,
    family: f.family,
    familyLabel: f.familyLabel,
    tier: f.tier,
    ench,
    amountCrafted,
    batchIv,
    unitIv: f.iv,
    ingredients: ingDetails,
    sauce: sauceDetails,
    batchIngCost,
    sauceCost,
    batchStationFee,
    unitStationFee,
    batchCost,
    unitCost,
    hasMissingIng,
    spotPrice,
    effectiveSellPrice,
    wasPriceCapped,
    refPrice,
    sellLoc,
    vol,
    dailyVol,
    health,
    revenue,
    profit,
    margin,
    profitDaily,
    focusCostPerMeal,
    city,
    focus,
    retRate: ret
  };
}

function computeFoodPlan() {
  const plan = ST.foodPlan || [];
  const rows = plan.map((r, idx) => {
    const [baseId, enchStr] = r.id.split('@');
    const ench = enchStr ? Number(enchStr) : 0;
    const it = computeMealItem(baseId, ench);
    const batches = Number(r.batches) || 1;
    const totalUnits = batches * (it ? it.amountCrafted : 10);
    const totalCost = (it && it.batchCost !== null) ? it.batchCost * batches : null;
    const totalRevenue = (it && it.revenue !== null) ? it.revenue * totalUnits : null;
    const totalProfit = (it && it.profit !== null) ? it.profit * totalUnits : null;
    const totalFocus = (it && foodFilter.focus) ? (it.focusCostPerMeal * totalUnits) : 0;
    return { ...r, idx, it, batches, totalUnits, totalCost, totalRevenue, totalProfit, totalFocus };
  });

  // Lista consolidada de compras
  const buyItems = {};
  let totalFees = 0;
  let totalMissing = 0;

  for (const row of rows) {
    if (!row.it) continue;
    totalFees += (row.it.batchStationFee || 0) * row.batches;
    if (row.it.hasMissingIng) totalMissing++;

    for (const ing of row.it.ingredients) {
      const grossNeeded = ing.count * row.batches;
      const netToBuy = ing.effCount * row.batches;
      const key = ing.id;
      if (!buyItems[key]) {
        const dInfo = getItemDisplayInfo(ing.id);
        buyItems[key] = {
          id: ing.id,
          name: dInfo.name,
          icon: dInfo.icon,
          tier: dInfo.tier,
          grossQty: 0,
          netQty: 0,
          buy: ing.buy,
          costPerUnit: ing.costPerUnit,
          totalCost: 0
        };
      }
      buyItems[key].grossQty += grossNeeded;
      buyItems[key].netQty += netToBuy;
      if (ing.totalCost !== null) {
        buyItems[key].totalCost += ing.totalCost * row.batches;
      }
    }

    if (row.it.sauce) {
      const s = row.it.sauce;
      const key = s.id;
      if (!buyItems[key]) {
        const dInfo = getItemDisplayInfo(s.id);
        buyItems[key] = {
          id: s.id,
          name: dInfo.name,
          icon: dInfo.icon,
          tier: dInfo.tier,
          grossQty: 0,
          netQty: 0,
          buy: s.buy,
          costPerUnit: s.costPerUnit,
          totalCost: 0
        };
      }
      buyItems[key].grossQty += s.count * row.batches;
      buyItems[key].netQty += s.count * row.batches;
      if (s.totalCost !== null) {
        buyItems[key].totalCost += s.totalCost * row.batches;
      }
    }
  }

  const shoppingList = Object.values(buyItems).sort((a, b) => (b.totalCost || 0) - (a.totalCost || 0));
  const totalMeals = rows.reduce((s, r) => s + r.totalUnits, 0);
  const totalInvestment = rows.reduce((s, r) => s + (r.totalCost || 0), 0);
  const totalRevenue = rows.reduce((s, r) => s + (r.totalRevenue || 0), 0);
  const totalProfit = rows.reduce((s, r) => s + (r.totalProfit || 0), 0);
  const totalFocus = rows.reduce((s, r) => s + r.totalFocus, 0);

  return {
    rows,
    shoppingList,
    totalMeals,
    totalInvestment,
    totalRevenue,
    totalProfit,
    totalFocus,
    totalFees,
    totalMissing
  };
}

/* ---------------- persistência ---------------- */
let saveTimer = null;
function save() {
  $('#saveStatus').textContent = 'salvando…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await fetch('/api/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ST) });
      $('#saveStatus').textContent = 'salvo ✓';
    } catch { $('#saveStatus').textContent = 'erro ao salvar!'; }
  }, 400);
}
function changed() { save(); render(); }

/* ---------------- render ---------------- */
function updateHeaderDailyBonusSelect() {
  if (!GD || !GD.dailyBonuses) return;
  const cur1 = (ST && ST.activeDailyBonus) ? ST.activeDailyBonus : 'none';
  const cur2 = (ST && ST.activeDailyBonus2) ? ST.activeDailyBonus2 : 'none';
  const el1 = $('#headerDailyBonusSelect1') || $('#headerDailyBonusSelect');
  const el2 = $('#headerDailyBonusSelect2');
  if (el1) el1.innerHTML = dailyBonusOptionsHtml(cur1, '1º Bônus: Nenhum');
  if (el2) el2.innerHTML = dailyBonusOptionsHtml(cur2, '2º Bônus: Nenhum');
}

function render() {
  updateHeaderDailyBonusSelect();
  const active = document.activeElement;
  const focusKey = active && active.dataset ? active.dataset.fk : null;
  const scrollers = [...document.querySelectorAll('.tablewrap')].map(e => [e.scrollTop, e.scrollLeft]);
  const views = { plan: viewPlan, recommend: viewRecommend, rank: viewRank, refine: viewRefine, food: viewFood, prices: viewPrices, config: viewConfig };
  $('#view').innerHTML = views[VIEW]();
  document.querySelectorAll('.tablewrap').forEach((e, i) => { if (scrollers[i]) [e.scrollTop, e.scrollLeft] = scrollers[i]; });
  if (focusKey) { const el = document.querySelector(`[data-fk="${CSS.escape(focusKey)}"]`); if (el) { el.focus(); if (el.select) el.select(); } }
}

const opt = (val, label, sel) => `<option value="${esc(val)}"${String(val) === String(sel) ? ' selected' : ''}>${esc(label)}</option>`;
const catOpts = sel => (GD.categories || [
  { id: 'plate', name: '🛡️ Placas' },
  { id: 'bow', name: '🏹 Arcos' },
  { id: 'crossbow', name: '🎯 Bestas' }
]).map(c => opt(c.id, c.name, sel)).join('');

const variantOpts = (sel, catFilter = '') => {
  const cats = GD.categories || [
    { id: 'plate', name: '🛡️ Placas' },
    { id: 'bow', name: '🏹 Arcos' },
    { id: 'crossbow', name: '🎯 Bestas' }
  ];
  if (catFilter) {
    return GD.variants
      .filter(v => (v.cat || 'plate') === catFilter)
      .map(v => opt(v.code, v.name + (v.royal ? ' 👑' : v.artifact ? ' ★' : ''), sel))
      .join('');
  }
  return cats.map(c => {
    const vs = GD.variants.filter(v => (v.cat || 'plate') === c.id);
    if (!vs.length) return '';
    return `<optgroup label="${esc(c.name)}">${vs.map(v => opt(v.code, v.name + (v.royal ? ' 👑' : v.artifact ? ' ★' : ''), sel)).join('')}</optgroup>`;
  }).join('');
};

const pieceOpts = (sel, catFilter = '') => GD.pieces
  .filter(p => !catFilter || (p.cat || 'plate') === catFilter)
  .map(p => opt(p.slot, p.name, sel))
  .join('');

const tierOpts = sel => TIERS.map(k => opt(k, 'T' + k, sel)).join('');

function matBreakdownTip(it) {
  if (it.isRoyal) {
    return it.bestBase ? `Base: ${it.bestBase.name} (${it.bestBase.method === 'craft' ? 'craftar com barras' : 'comprar pronta'})` : 'Sem peça base';
  }
  const parts = [];
  if (it.nPlanks > 0) parts.push(`${it.nPlanks}x Tábuas: ${fmt(it.planksCost)}s`);
  if (it.nBars > 0) parts.push(`${it.nBars}x Barras: ${fmt(it.metalCost)}s`);
  return parts.join(' + ');
}

function liquiditySummary(rows) {
  if (!rows || !rows.length) return '—';
  let hasDanger = false;
  let hasVolData = false;
  let maxDays = 0;
  for (const r of rows) {
    if (r.it && r.it.vol) {
      hasVolData = true;
      const d = r.it.vol.daily !== undefined ? r.it.vol.daily : 0;
      if (d === 0) hasDanger = true;
      else {
        const days = Math.ceil(r.qty / d);
        if (days > maxDays) maxDays = days;
        if (days > 15) hasDanger = true;
      }
    }
  }
  if (!hasVolData) return '<span class="muted" style="font-size:13px">Sem dados de volume</span>';
  if (hasDanger) return `<span class="neg" style="font-size:16px">⚠️ Lote lento (~${maxDays}d)</span>`;
  return `<span class="pos" style="font-size:16px">🟢 Giro rápido (~${maxDays || 1}d)</span>`;
}

/* ----- Planejador ----- */
function viewPlan() {
  const bars = computeBars();
  const planks = computePlanks();
  const P = computePlan(bars, planks);
  const rows = P.rows.map((r, i) => {
    let timeStr = '<span class="muted">—</span>';
    if (r.it.vol) {
      const d = r.it.vol.daily !== undefined ? r.it.vol.daily : 0;
      if (d > 0) {
        const days = Math.ceil(r.qty / d);
        if (days <= 1) timeStr = `<span class="pill win" title="Lote escoa em menos de 24h">~1 dia 🟢</span>`;
        else if (days <= 5) timeStr = `<span class="pill win" title="Giro rápido no mercado">~${days} dias 🟢</span>`;
        else if (days <= 15) timeStr = `<span class="pill" style="background:#3b3214;color:#f0c04b" title="Giro moderado">~${days} dias 🟡</span>`;
        else timeStr = `<span class="pill" style="background:#3b1414;color:#ef6b6b" title="Atenção: lote muito grande para a demanda diária!">~${days} dias 🔴</span>`;
      } else {
        timeStr = `<span class="pill" style="background:#3b1414;color:#ef6b6b" title="Sem vendas recentes: risco altíssimo de prata parada!">⛔ Sem saída</span>`;
      }
    }
    const sellHtml = r.it.sell
      ? `<span class="q-badge q-${r.it.sell.quality || '1'}" title="${esc(r.it.sell.qualityName || '')}">${r.it.sell.qualityLabel || 'Q1'}</span><span class="badge-tip" title="${esc(formatQualityTooltip(r.it.sell.breakdown, r.it.sell.price, r.it.sell.qualityLabel))}">${fmt(r.it.sell.price)}</span>`
      : '<span class="muted">sem preço</span>';

    const validPieces = piecesOf(r.code);
    const matHtml = r.it.isRoyal
      ? (r.it.bestBase ? `<span class="badge-tip" title="${esc(matBreakdownTip(r.it))}">${fmt(r.it.barsCost)}</span>` : '<span class="neg">sem base</span>')
      : `<span class="badge-tip" title="${esc(matBreakdownTip(r.it))}">${fmt(r.it.barsCost)}</span>`;
    const itemBonus = getItemDailyBonus(r.it.v, r.it.p);
    const bonusBadge = itemBonus ? ` <span class="tag pos" style="background:#3a2910;border-color:var(--accent);color:var(--accent);font-weight:700" title="Bônus Diário Ativo hoje: ${esc(itemBonus.name)}">🔥 BÔNUS</span>` : '';

    return `
    <tr class="${itemBonus ? 'bonus-glow' : ''}">
      <td class="l"><select data-plan="${i}" data-f="code">${variantOpts(r.code)}</select>${bonusBadge}</td>
      <td class="l"><select data-plan="${i}" data-f="slot">${validPieces.map(p => opt(p.slot, p.name, r.slot)).join('')}</select></td>
      <td class="l"><select data-plan="${i}" data-f="k">${tierOpts(r.k)}</select></td>
      <td><input class="num" type="number" min="0" data-plan="${i}" data-f="qty" data-fk="plan-${i}" value="${r.qty}"></td>
      <td>${matHtml}</td>
      <td class="l muted">${r.it.isRoyal ? (r.it.sigilInfo ? `<span title="${r.it.sigilQty * r.qty}x ${esc(r.it.sigilInfo.name)}">👑 ${fmt(r.it.artCost)}</span>` : '—') : (r.it.art ? `<span title="${esc(r.it.art.name)}">${fmt(r.it.artCost)}</span>` : '—')}</td>
      <td>${fmt(r.it.fee)}</td>
      <td><b>${fmt(r.it.cost)}</b></td>
      <td class="best">${sellHtml}</td>
      <td class="l">${r.it.sell ? locName(r.it.sell.loc) : ''}</td>
      <td>${priceHealthBadge(r.it.spotPrice, r.it.vol, r.it.id, r.it.sell ? r.it.sell.loc : '')}</td>
      <td class="${cls(r.it.profit)}">${fmt(r.it.profit)}</td>
      <td class="${cls(r.it.margin)}">${pct(r.it.margin)}</td>
      <td class="${cls(r.totalProfit)}"><b>${fmt(r.totalProfit)}</b></td>
      <td>${volBadge(r.it.vol, r.it.sell ? locName(r.it.sell.loc) : '', r.it.id, r.it.sell ? r.it.sell.loc : '')}</td>
      <td>${timeStr}</td>
      <td><button class="icon" data-del="${i}" title="Remover">✕</button></td>
    </tr>`;
  }).join('');
  const list = (title, items, cols) => `
    <div class="card"><h3 style="margin-top:0">${title}</h3>
    ${items.length ? `<table><tr>${cols.map(c => `<th class="${c[2] || ''}">${c[0]}</th>`).join('')}</tr>
      ${items.map(x => `<tr>${cols.map(c => `<td class="${c[2] || ''}">${c[1](x)}</td>`).join('')}</tr>`).join('')}</table>`
      : '<div class="empty">Nada a comprar</div>'}</div>`;

  const slippageBanner = P.slippageCount > 0 ? `
    <div class="slippage-banner">
      <span>🛡️ <b>Proteção de Volume Ativa (${P.slippageCount} material/materiais protegidos):</b> O sistema detectou menores ofertas com risco de derrapagem (apenas 1 unidade disponível ou preço anormalmente baixo) e utilizou o Preço Médio Ponderado por Volume (VWAP) para o cálculo do seu investimento ser 100% realista ao comprar em grandes lotes.</span>
    </div>` : '';

  return `
  <h2>Planejador de craft · Placas, Arcos & Bestas</h2>
  <div class="muted">Escolha o que vai craftar. A lista de compras decompõe automaticamente Barras, Minérios, Tábuas, Madeiras, Artefatos e Emblemas Reais considerando o retorno de recursos, demanda diária e proteção contra ofertas falsas de 1 unidade.</div>
  <div class="cards">
    <div class="stat"><div class="label">Total a investir (compras)</div><div class="value">${fmt(P.invest)}</div></div>
    <div class="stat"><div class="label">Taxas de barraca (refino + craft)</div><div class="value">${fmt(P.fees)}</div></div>
    <div class="stat"><div class="label">Receita líquida esperada</div><div class="value">${fmt(P.revenue)}</div></div>
    <div class="stat"><div class="label">Lucro esperado</div><div class="value ${cls(P.profit)}">${fmt(P.profit)}</div></div>
    <div class="stat"><div class="label">Giro Estimado do Lote</div><div class="value">${liquiditySummary(P.rows)}</div></div>
  </div>
  ${slippageBanner}
  <div class="rec-banner-plan">
    <div>
      <span style="font-weight:700;color:var(--green);font-size:14px">🎯 Precisa de ideias de mix lucrativo e rápido?</span>
      <div class="muted" style="font-size:12px;margin-top:2px">Use o <b>Recomendador de Mix</b> para combinar botas, armaduras ou arcos em múltiplos tiers seguros (ex: T5.1 + T6.1) sem saturar o mercado local.</div>
    </div>
    <button class="btn" data-gotoview="recommend" style="font-size:12px;padding:6px 14px">Abrir Recomendações ➔</button>
  </div>
  ${P.missing.length ? `<div class="card" style="border-color:#6b5a2a">⚠️ Faltam preços para: <b>${esc([...new Set(P.missing)].join(', '))}</b> — preencha na aba Preços ou use “Buscar preços”.</div>` : ''}
  <div class="tablewrap"><table>
    <tr><th class="l">Item / Variante</th><th class="l">Peça / Tipo</th><th class="l">Tier</th><th>Qtd</th><th title="Custo líquido de Barras e/ou Tábuas (ou Peça Base para Reais)">Materiais / Base</th><th>Artefato / Emblema</th><th>Taxa estação</th>
    <th>Custo / peça</th><th>Melhor venda</th><th class="l">Local</th><th>Saúde</th><th>Lucro / peça</th><th>Margem</th><th>Lucro total</th>
    <th title="Volume de compra diário no mercado de venda (média últimos 28 dias)">Demanda / dia</th>
    <th title="Tempo estimado para escoar o lote com base na demanda diária">Tempo p/ vender</th><th></th></tr>
    ${rows || '<tr><td colspan="17" class="empty">Nenhum item planejado. Clique em “Adicionar item” ou use o Ranking.</td></tr>'}
  </table></div>
  <div class="toolbar">
    <button class="btn" id="addPlan">+ Adicionar item</button>
    ${ST.plan.length ? '<button class="ghost" id="clearPlan">Limpar plano</button><button class="ghost" id="fetchPlan">↻ Buscar preços só do plano</button><button class="ghost" id="fetchPlanVolumes">📊 Buscar volumes só do plano</button>' : ''}
    <label style="margin-left:auto">Modo Compra Materiais<select data-cfg="materialPricing">
      ${opt('smart', '🛡️ Inteligente (Anti-Fake/Slippage)', ST.config.materialPricing)}
      ${opt('vwap', '📊 Preço Médio Real (VWAP)', ST.config.materialPricing)}
      ${opt('spot', '⚡ Menor Oferta Spot (Cru)', ST.config.materialPricing)}
      ${opt('buffer5', '🛡️ Spot + 5% Margem', ST.config.materialPricing)}
      ${opt('buffer10', '🛡️ Spot + 10% Margem', ST.config.materialPricing)}
    </select></label>
  </div>
  <h3>Lista de compras</h3>
  <div class="grid3">
    ${list('⛏️ Minério (para refinar)', P.buyOre, [
      ['Minério', x => 'T' + x.k, 'l'],
      ['Qtd', x => fmt(Math.ceil(x.qty))],
      ['Cidade', x => x.loc, 'l'],
      ['Preço Unit.', x => fmt(x.price) + (x.slippageRisk ? ` <span class="slippage-pill badge-tip" title="${esc(x.reason)}">⚠️ Spot: ${fmt(x.spotPrice)}s | Média: ${fmt(x.vwap)}s</span>` : '')],
      ['Total', x => fmt(x.total)],
      ['Barras a refinar', x => fmt(Math.ceil(x.refineQty))]
    ])}
    ${list('🔩 Barras prontas', P.buyBars, [
      ['Barra', x => 'T' + x.k, 'l'],
      ['Qtd', x => fmt(Math.ceil(x.qty))],
      ['Cidade', x => x.loc || '', 'l'],
      ['Preço Unit.', x => fmt(x.price) + (x.slippageRisk ? ` <span class="slippage-pill badge-tip" title="${esc(x.reason)}">⚠️ Spot: ${fmt(x.spotPrice)}s | Média: ${fmt(x.vwap)}s</span>` : '')],
      ['Total', x => fmt(x.total)]
    ])}
    ${list('🪵 Madeira (para refinar)', P.buyWood, [
      ['Madeira', x => 'T' + x.k, 'l'],
      ['Qtd', x => fmt(Math.ceil(x.qty))],
      ['Cidade', x => x.loc, 'l'],
      ['Preço Unit.', x => fmt(x.price) + (x.slippageRisk ? ` <span class="slippage-pill badge-tip" title="${esc(x.reason)}">⚠️ Spot: ${fmt(x.spotPrice)}s | Média: ${fmt(x.vwap)}s</span>` : '')],
      ['Total', x => fmt(x.total)],
      ['Tábuas a refinar', x => fmt(Math.ceil(x.refineQty))]
    ])}
    ${list('🪚 Tábuas prontas', P.buyPlanks, [
      ['Tábua', x => 'T' + x.k, 'l'],
      ['Qtd', x => fmt(Math.ceil(x.qty))],
      ['Cidade', x => x.loc || '', 'l'],
      ['Preço Unit.', x => fmt(x.price) + (x.slippageRisk ? ` <span class="slippage-pill badge-tip" title="${esc(x.reason)}">⚠️ Spot: ${fmt(x.spotPrice)}s | Média: ${fmt(x.vwap)}s</span>` : '')],
      ['Total', x => fmt(x.total)]
    ])}
    ${list('★ Artefatos', P.artList, [
      ['Artefato', x => esc(x.art.name) + ` <span class="muted">T${x.art.id[1]}</span>`, 'l'],
      ['Qtd', x => fmt(x.qty)],
      ['Cidade', x => x.buy ? x.buy.loc : '<span class="neg">sem preço</span>', 'l'],
      ['Preço Unit.', x => fmt(x.price) + (x.slippageRisk ? ` <span class="slippage-pill badge-tip" title="${esc(x.reason)}">⚠️ Spot: ${fmt(x.spotPrice)}s | Média: ${fmt(x.vwap)}s</span>` : '')],
      ['Total', x => fmt(x.total)]
    ])}
    ${P.sigilsList && P.sigilsList.length ? list('👑 Emblemas Reais', P.sigilsList, [
      ['Emblema', x => esc(x.name), 'l'],
      ['Qtd', x => fmt(x.qty)],
      ['Cidade', x => x.buy ? x.buy.loc : '<span class="neg">sem preço</span>', 'l'],
      ['Preço Unit.', x => fmt(x.price)],
      ['Total', x => fmt(x.total)]
    ]) : ''}
    ${P.baseGearList && P.baseGearList.length ? list('🛡️ Peças Base (comprar prontas)', P.baseGearList, [
      ['Peça', x => esc(x.name), 'l'],
      ['Qtd', x => fmt(x.qty)],
      ['Cidade', x => x.buy ? x.buy.loc : '<span class="neg">sem preço</span>', 'l'],
      ['Preço Unit.', x => fmt(x.price)],
      ['Total', x => fmt(x.total)]
    ]) : ''}
  </div>
  <div class="muted">Quantidades arredondadas para cima. Se a proteção de volume estiver ativa, grandes lotes usam o Preço Médio Real de Volume (VWAP) para proteger seu investimento contra ofertas de 1 unidade no mercado.</div>`;
}

/* ----- Recomendações de Mix Inteligente ----- */
function generateCraftRecommendation(customOpts = {}) {
  const f = { ...recommendFilter, ...customOpts };
  const bars = computeBars();
  const planks = computePlanks();
  const candidates = [];

  for (const v of GD.variants) {
    if (f.cat && (v.cat || 'plate') !== f.cat) continue;
    if (f.variantType === 'standard' && (v.artifact || v.royal)) continue;
    if (f.variantType === 'artifact' && !v.artifact) continue;
    if (f.variantType === 'royal' && !v.royal) continue;
    if (f.variant && v.code !== f.variant) continue;

    for (const p of piecesOf(v)) {
      if (f.slot && p.slot !== f.slot) continue;

      for (const k of TIERS) {
        const [tierNum, enchNum] = tv(k);
        if (tierNum < Number(f.tmin) || tierNum > Number(f.tmax)) continue;
        if (enchNum === 0 && !f.ench0) continue;
        if (enchNum === 1 && !f.ench1) continue;
        if (enchNum === 2 && !f.ench2) continue;
        if (enchNum === 3 && !f.ench3) continue;

        const it = computeItem(bars, v.code, p.slot, k, 'mix', planks, 'smart');
        if (it.profit === null || it.margin === null || it.profit <= 0) continue;
        if (it.margin < Number(f.minMargin)) continue;

        const daily = (it.dailyVol !== null && it.dailyVol !== undefined && it.dailyVol > 0)
          ? it.dailyVol
          : (it.vol?.daily || getBestVol(it.id)?.daily || 0);

        if (f.safeOnly && (daily <= 0 || (it.health && it.health.status === 'nosales'))) continue;
        if (f.safeOnly && it.health && it.health.status === 'inflated' && (!it.effectiveSellPrice || it.effectiveSellPrice === it.spotPrice)) continue;

        // Bônus Diário
        const itemBonus = getItemDailyBonus(it.v, it.p);

        // Pontuação algorítmica:
        // Margem (até 45 pts), volume diário/liquidez (até 65 pts), lucro unitário (até 25 pts)
        const marginScore = Math.min(Math.max(0, it.margin), 0.60) * 75;
        const volScore = Math.min(Math.sqrt(daily) * 7.5, 65);
        const profitScore = Math.min(Math.max(0, it.profit) / 1000, 25);

        let score = marginScore + volScore + profitScore;
        if (f.prioritizeBonus && itemBonus) {
          score *= 1.35; // 35% de bônus para itens com bônus diário de produção ativo hoje
        }

        // Horizonte e limite de segurança para venda rápida sem derrubar o mercado:
        // 'fast' (~1-2 dias): absorve no máximo 35% da demanda diária
        // 'normal' (~2-4 dias): absorve até 50% da demanda diária
        // 'slow' (~4-7 dias): absorve até 75% da demanda diária
        const horizonFactor = f.horizon === 'fast' ? 0.35 : (f.horizon === 'slow' ? 0.75 : 0.50);
        const horizonDays = f.horizon === 'fast' ? 1.5 : (f.horizon === 'slow' ? 5.0 : 2.5);
        let maxSafeQty = Math.max(2, Math.floor(daily * horizonDays * horizonFactor));

        // Nenhuma peça única pode monopolizar uma fatia exagerada do lote
        const target = Number(f.targetPieces) || 50;
        const maxBatchShare = Math.max(5, Math.floor(target * 0.40));
        maxSafeQty = Math.min(maxSafeQty, maxBatchShare);

        candidates.push({
          it,
          score,
          daily,
          itemBonus,
          maxSafeQty,
          allocatedQty: 0
        });
      }
    }
  }

  const target = Number(f.targetPieces) || 50;

  if (!candidates.length) {
    return {
      items: [],
      targetPieces: target,
      totalUnits: 0,
      totalCost: 0,
      totalRevenue: 0,
      totalProfit: 0,
      avgMargin: 0,
      estDays: 0,
      bonusCount: 0
    };
  }

  // Ordenar do maior score para o menor
  candidates.sort((a, b) => b.score - a.score);

  // Seleção de variedade equilibrada:
  let targetVariety = f.variety === 'focused' ? 3 : (f.variety === 'high' ? 8 : 5);
  if (target <= 20) targetVariety = Math.min(targetVariety, 3);
  if (target <= 40) targetVariety = Math.min(targetVariety, 5);

  const selected = [];
  const variantUsage = {};

  for (const c of candidates) {
    if (selected.length >= targetVariety) break;
    const vCode = c.it.code;
    const count = variantUsage[vCode] || 0;
    if (count >= 2 && selected.length < targetVariety - 1) continue;
    selected.push(c);
    variantUsage[vCode] = count + 1;
  }

  if (selected.length < targetVariety) {
    for (const c of candidates) {
      if (!selected.includes(c)) {
        selected.push(c);
        if (selected.length >= targetVariety) break;
      }
    }
  }

  // Fase 1: Distribuição base de partida (ex: 5 a 10 unidades por item selecionado)
  let remaining = target;
  for (const c of selected) {
    const base = Math.min(Math.max(2, Math.min(5, Math.floor(remaining / selected.length))), c.maxSafeQty);
    c.allocatedQty = base;
    remaining -= base;
  }

  // Fase 2: Distribuição do restante de acordo com o score e headroom seguro
  let attempts = 0;
  while (remaining > 0 && attempts < 60) {
    attempts++;
    let addedAny = false;
    for (const c of selected) {
      if (remaining <= 0) break;
      const headroom = c.maxSafeQty - c.allocatedQty;
      if (headroom >= 5 && remaining >= 5) {
        c.allocatedQty += 5;
        remaining -= 5;
        addedAny = true;
      } else if (headroom > 0) {
        const step = Math.min(headroom, remaining);
        c.allocatedQty += step;
        remaining -= step;
        addedAny = true;
      }
    }
    if (!addedAny) break;
  }

  // Arredondamento limpo (múltiplos de 5 para lotes maiores)
  for (const c of selected) {
    if (c.allocatedQty >= 8) {
      const rem = c.allocatedQty % 5;
      if (rem === 4) c.allocatedQty += 1;
      else if (rem === 1) c.allocatedQty -= 1;
    }
  }

  // Montagem da lista final recomendada
  const recItems = selected.filter(c => c.allocatedQty > 0).map(c => {
    const it = c.it;
    const qty = c.allocatedQty;
    const daysToSell = c.daily > 0 ? (qty / c.daily).toFixed(1) : '—';
    const totalCost = it.cost !== null ? it.cost * qty : 0;
    const totalProfit = it.profit !== null ? it.profit * qty : 0;
    const revenue = it.effectiveSellPrice !== null ? it.effectiveSellPrice * qty : 0;

    const reasons = [];
    if (c.itemBonus) {
      reasons.push({ cls: 'bonus', text: `🔥 Bônus Hoje (${c.itemBonus.name})` });
    }
    if (c.daily >= 20) {
      reasons.push({ cls: 'highvol', text: `⚡ Alta Demanda (~${Math.round(c.daily)} un/dia)` });
    }
    if (it.margin >= 0.18) {
      reasons.push({ cls: 'margin', text: `💰 Margem ${pct(it.margin)}` });
    }
    if (it.health && it.health.status === 'stable') {
      reasons.push({ cls: '', text: '🛡️ Preço Confiável' });
    }
    if (it.effectiveSellPrice !== null && it.effectiveSellPrice !== it.spotPrice) {
      reasons.push({ cls: '', text: '🛡️ Protegido via VWAP' });
    }

    return {
      ...it,
      recQty: qty,
      daysToSell,
      totalCost,
      totalProfit,
      revenue,
      reasons,
      score: c.score
    };
  });

  const totalUnits = recItems.reduce((acc, r) => acc + r.recQty, 0);
  const totalCost = recItems.reduce((acc, r) => acc + r.totalCost, 0);
  const totalProfit = recItems.reduce((acc, r) => acc + r.totalProfit, 0);
  const totalRevenue = recItems.reduce((acc, r) => acc + r.revenue, 0);
  const avgMargin = totalCost > 0 ? totalProfit / totalCost : 0;
  const estDays = recItems.length ? Math.max(...recItems.map(r => Number(r.daysToSell) || 1)).toFixed(1) : '1.0';
  const bonusCount = recItems.filter(r => r.reasons.some(x => x.cls === 'bonus')).length;

  return {
    items: recItems,
    targetPieces: target,
    totalUnits,
    totalCost,
    totalProfit,
    totalRevenue,
    avgMargin,
    estDays,
    bonusCount
  };
}

function viewRecommend() {
  if (!activeRecommendation) {
    activeRecommendation = generateCraftRecommendation();
  }
  const f = recommendFilter;
  const rec = activeRecommendation;

  const rowsHtml = rec.items.map((it, i) => {
    const isVwapUsed = it.effectiveSellPrice !== null && it.effectiveSellPrice !== it.spotPrice;
    const sellPriceDisplay = isVwapUsed
      ? `${fmt(it.effectiveSellPrice)} <span class="muted" style="font-size:10px" title="Preço ajustado via VWAP">(VWAP)</span>`
      : fmt(it.spotPrice);

    const sellHtml = it.sell ? `
      <span class="q-badge q-${it.sell.quality || '1'}" title="${esc(it.sell.qualityName || '')}">${it.sell.qualityLabel || 'Q1'}</span>
      <span class="badge-tip" title="${esc(formatQualityTooltip(it.sell.breakdown, it.spotPrice, it.sell.qualityLabel))}">${sellPriceDisplay}</span>
    ` : '—';

    const reasonsHtml = it.reasons.map(r => `<span class="rec-reason ${r.cls}">${esc(r.text)}</span>`).join(' ');

    const itemBonus = getItemDailyBonus(it.v, it.p);
    const bonusBadge = itemBonus ? ` <span class="tag pos" style="background:#3a2910;border-color:var(--accent);color:var(--accent);font-weight:700" title="Bônus Ativo: ${esc(itemBonus.name)}">🔥 BÔNUS</span>` : '';

    return `
    <tr class="${itemBonus ? 'bonus-glow' : ''}">
      <td class="l"><b>${esc(it.v.name)}</b>${bonusBadge}</td>
      <td class="l">${esc(it.p.name)}</td>
      <td class="l"><span class="tag">T${it.k}</span></td>
      <td><input class="num" type="number" min="1" max="500" data-rec-qty="${i}" value="${it.recQty}" style="width:65px;font-weight:700"></td>
      <td><span class="badge-tip" title="${esc(matBreakdownTip(it))}">${fmt(it.cost)}</span></td>
      <td><b>${fmt(it.totalCost)}</b></td>
      <td class="best">${sellHtml}</td>
      <td class="l">${it.sell ? locName(it.sell.loc) : '—'}</td>
      <td>${priceHealthBadge(it.spotPrice, it.vol, it.id, it.sell ? it.sell.loc : '')}</td>
      <td class="${cls(it.profit)}">${fmt(it.profit)}</td>
      <td class="${cls(it.margin)}">${pct(it.margin)}</td>
      <td class="${cls(it.totalProfit)}"><b>${fmt(it.totalProfit)}</b></td>
      <td>${volBadge(it.vol, it.sell ? locName(it.sell.loc) : '', it.id, it.sell ? it.sell.loc : '')}</td>
      <td><span class="pill win" title="Tempo estimado para escoar este lote no mercado">~${it.daysToSell} dias 🟢</span></td>
      <td class="l">${reasonsHtml}</td>
      <td><button class="icon" data-rec-del="${i}" title="Remover este item do mix">✕</button></td>
    </tr>`;
  }).join('');

  return `
  <div class="rec-hero">
    <h2>🎯 Recomendador de Mix Inteligente de Craft</h2>
    <div style="font-size:13px;color:rgba(255,255,255,0.85);max-width:960px;line-height:1.5">
      Escolha o que você quer craftar (ex: <b>Botas</b>, <b>Armaduras</b> ou <b>Arcos</b>) e o sistema calcula a combinação ideal de variantes e tiers (ex: <i>15x Botas de Soldado T5.1, 15x Botas de Guardião T5.1, 10x Botas de Cavaleiro T5.1, 5x Soldado T6.1, 5x Guardião T5.0</i>).
      Em vez de despejar 50 itens iguais e estragar o preço da cidade, o mix garante <b>venda rápida em 1 a 3 dias</b> com <b>lucros altos</b> e proteção de mercado.
    </div>
  </div>

  <div class="card" style="margin-bottom:16px">
    <div class="toolbar" style="margin:0;gap:12px;align-items:flex-start">
      <label>Peça / Equipamento<select data-rec="slot">
        <option value="SHOES"${f.slot === 'SHOES' ? ' selected' : ''}>👢 Botas / Calçados</option>
        <option value="ARMOR"${f.slot === 'ARMOR' ? ' selected' : ''}>🛡️ Armaduras / Peitorais</option>
        <option value="HEAD"${f.slot === 'HEAD' ? ' selected' : ''}>👑 Elmos / Capacetes</option>
        <option value="BOW"${f.slot === 'BOW' ? ' selected' : ''}>🏹 Arcos</option>
        <option value="CROSSBOW"${f.slot === 'CROSSBOW' ? ' selected' : ''}>🎯 Bestas</option>
        <option value=""${f.slot === '' ? ' selected' : ''}>⚡ Todas as Peças (Mix Completo)</option>
      </select></label>

      <label>Categoria<select data-rec="cat">
        <option value="">Todas as Categorias</option>
        ${catOpts(f.cat)}
      </select></label>

      <label>Variante Específica<select data-rec="variant">
        <option value="">🎲 Qualquer / Variadas (Recomendado)</option>
        ${variantOpts(f.variant, f.cat)}
      </select></label>

      <label>Família<select data-rec="variantType">
        ${opt('all', 'Todos os Tipos', f.variantType)}
        ${opt('standard', 'Apenas Padrão (Sem Artefatos)', f.variantType)}
        ${opt('artifact', 'Apenas Artefatos', f.variantType)}
        ${opt('royal', 'Apenas Reais (com Emblemas)', f.variantType)}
      </select></label>

      <label>Tier Mínimo<select data-rec="tmin">
        ${[4, 5, 6, 7, 8].map(t => opt(t, 'T' + t, f.tmin)).join('')}
      </select></label>

      <label>Tier Máximo<select data-rec="tmax">
        ${[4, 5, 6, 7, 8].map(t => opt(t, 'T' + t, f.tmax)).join('')}
      </select></label>

      <div style="display:flex;flex-direction:column;gap:4px">
        <span class="label">Encantamentos</span>
        <div class="rec-chip-group">
          <span class="rec-chip ${f.ench0 ? 'active' : ''}" data-rec-ench="0" title="Sem encantamento (.0)">.0</span>
          <span class="rec-chip ${f.ench1 ? 'active' : ''}" data-rec-ench="1" title="Encantamento Verde (.1)">.1</span>
          <span class="rec-chip ${f.ench2 ? 'active' : ''}" data-rec-ench="2" title="Encantamento Azul (.2)">.2</span>
          <span class="rec-chip ${f.ench3 ? 'active' : ''}" data-rec-ench="3" title="Encantamento Roxo (.3)">.3</span>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:4px">
        <span class="label">Meta de Peças</span>
        <div style="display:flex;align-items:center;gap:6px">
          <div class="rec-chip-group">
            <span class="rec-chip ${f.targetPieces === 30 ? 'active' : ''}" data-rec-target="30">30</span>
            <span class="rec-chip ${f.targetPieces === 50 ? 'active' : ''}" data-rec-target="50">50</span>
            <span class="rec-chip ${f.targetPieces === 75 ? 'active' : ''}" data-rec-target="75">75</span>
            <span class="rec-chip ${f.targetPieces === 100 ? 'active' : ''}" data-rec-target="100">100</span>
          </div>
          <input class="num" type="number" min="5" max="500" step="5" data-rec="targetPieces" value="${f.targetPieces}" style="width:65px">
        </div>
      </div>

      <label>Velocidade de Venda<select data-rec="horizon">
        ${opt('fast', '⚡ Giro Ultra Rápido (~1 a 2 dias)', f.horizon)}
        ${opt('normal', '🟢 Giro Normal (~2 a 4 dias)', f.horizon)}
        ${opt('slow', '🟡 Giro Moderado (~4 a 7 dias)', f.horizon)}
      </select></label>

      <label>Diversificação<select data-rec="variety">
        ${opt('balanced', '🎯 Equilibrado (4 a 6 itens)', f.variety)}
        ${opt('high', '🎲 Alta Variedade (6 a 9 itens)', f.variety)}
        ${opt('focused', '🔍 Focado (2 a 4 itens)', f.variety)}
      </select></label>

      <label>Margem Mínima<select data-rec="minMargin">
        ${opt('0.05', '≥ 5%', f.minMargin)}
        ${opt('0.10', '≥ 10%', f.minMargin)}
        ${opt('0.15', '≥ 15%', f.minMargin)}
        ${opt('0.20', '≥ 20%', f.minMargin)}
        ${opt('0.25', '≥ 25%', f.minMargin)}
      </select></label>
    </div>

    <div style="display:flex;gap:20px;align-items:center;margin-top:14px;flex-wrap:wrap">
      <label style="flex-direction:row;align-items:center;gap:6px"><input type="checkbox" data-rec="prioritizeBonus" ${f.prioritizeBonus ? 'checked' : ''}> 🔥 Priorizar itens com Bônus Diário Ativo (+10%/+20%)</label>
      <label style="flex-direction:row;align-items:center;gap:6px"><input type="checkbox" data-rec="safeOnly" ${f.safeOnly ? 'checked' : ''}> 🛡️ Apenas preços confiáveis (ocultar sem vendas ou inflados)</label>
      <button class="btn" id="generateRecBtn" style="margin-left:auto;font-weight:700">🎲 Gerar Recomendação de Mix</button>
    </div>
  </div>

  <div class="cards">
    <div class="stat"><div class="label">Total de Peças Recomendadas</div><div class="value">${rec.totalUnits} <span class="muted" style="font-size:13px">(${rec.items.length} variações)</span></div></div>
    <div class="stat"><div class="label">Investimento Total (Custo)</div><div class="value">${fmt(rec.totalCost)}</div></div>
    <div class="stat"><div class="label">Receita Líquida Estimada</div><div class="value">${fmt(rec.totalRevenue)}</div></div>
    <div class="stat"><div class="label">Lucro Líquido Esperado</div><div class="value ${cls(rec.totalProfit)}">+${fmt(rec.totalProfit)}</div></div>
    <div class="stat"><div class="label">Margem Média Ponderada</div><div class="value ${cls(rec.avgMargin)}">${pct(rec.avgMargin)}</div></div>
    <div class="stat"><div class="label">Giro Estimado do Lote</div><div class="value"><span class="pos" style="font-size:16px">🟢 ~${rec.estDays} dias</span></div></div>
  </div>

  <div class="tablewrap"><table>
    <tr>
      <th class="l">Item / Variante</th>
      <th class="l">Peça</th>
      <th class="l">Tier</th>
      <th>Qtd Recomendada</th>
      <th>Custo / un</th>
      <th>Custo Total</th>
      <th>Melhor Venda</th>
      <th class="l">Local</th>
      <th>Saúde</th>
      <th>Lucro / un</th>
      <th>Margem</th>
      <th>Lucro Total</th>
      <th title="Volume médio diário de compras nos últimos 28 dias">Demanda / dia</th>
      <th title="Tempo estimado para escoar este lote">Tempo p/ Vender</th>
      <th class="l">Motivos & Selos</th>
      <th></th>
    </tr>
    ${rowsHtml || '<tr><td colspan="16" class="empty">Nenhum item encontrado com os filtros atuais. Experimente reduzir a margem mínima ou liberar mais encantamentos.</td></tr>'}
  </table></div>

  <div class="toolbar" style="margin-top:14px">
    <button class="btn" id="applyRecPlanBtn" style="font-weight:700;font-size:14px;padding:8px 18px" ${!rec.items.length ? 'disabled' : ''}>⚡ Aplicar este Mix ao Planejador (Substituir)</button>
    <button class="ghost" id="addRecPlanBtn" ${!rec.items.length ? 'disabled' : ''}>➕ Adicionar ao Planejador Existente</button>
    <button class="ghost" id="regenRecBtn">🎲 Gerar Outra Opção</button>
  </div>`;
}

/* ----- Ranking ----- */
function viewRank() {
  const bars = computeBars(), planks = computePlanks(), f = rankFilter;
  let items = [];
  for (const v of GD.variants) {
    if (f.cat && (v.cat || 'plate') !== f.cat) continue;
    if (f.variant && v.code !== f.variant) continue;
    for (const p of piecesOf(v)) {
      if (f.piece && p.slot !== f.piece) continue;
      for (const k of TIERS) {
        if (f.tier && tv(k)[0] !== Number(f.tier)) continue;
        if (f.ench !== '' && tv(k)[1] !== Number(f.ench)) continue;
        const it = computeItem(bars, v.code, p.slot, k, null, planks);
        if (f.onlyPriced && it.profit === null) continue;
        if (f.minVol && Number(f.minVol) > 0 && (it.dailyVol === null || it.dailyVol < Number(f.minVol))) continue;
        if (f.healthFilter === 'stable_only' && it.health.status !== 'stable') continue;
        if (f.healthFilter === 'no_inflated' && it.health.status === 'inflated') continue;
        if (f.healthFilter === 'with_sales' && (it.health.status === 'nosales' || !it.dailyVol)) continue;
        items.push(it);
      }
    }
  }
  const key = {
    profitDaily: 'profitDaily',
    vol: 'dailyVol',
    profit: 'profit',
    margin: 'margin',
    cost: 'cost'
  }[f.sort] || 'profitDaily';
  items.sort((a, b) => (b[key] ?? -Infinity) - (a[key] ?? -Infinity));
  const body = items.slice(0, 600).map(it => {
    const isVwapUsed = it.effectiveSellPrice !== null && it.effectiveSellPrice !== it.spotPrice;
    const sellPriceDisplay = isVwapUsed
      ? `${fmt(it.effectiveSellPrice)} <span class="muted" style="font-size:10px" title="Preço de venda ajustado por ${f.sellPricing} (Spot original: ${fmt(it.spotPrice)}s)">(VWAP)</span>`
      : fmt(it.spotPrice);

    const sellHtml = it.sell ? `
      <span class="q-badge q-${it.sell.quality || '1'}" title="${esc(it.sell.qualityName || '')}">${it.sell.qualityLabel || 'Q1'}</span>
      <span class="badge-tip" title="${esc(formatQualityTooltip(it.sell.breakdown, it.spotPrice, it.sell.qualityLabel))}">${sellPriceDisplay}</span>
    ` : '—';
    const itemBonus = getItemDailyBonus(it.v, it.p);
    const bonusBadge = itemBonus ? ` <span class="tag pos" style="background:#3a2910;border-color:var(--accent);color:var(--accent);font-weight:700" title="Bônus Diário Ativo hoje: ${esc(itemBonus.name)}">🔥 BÔNUS HOJE</span>` : '';
    return `
    <tr class="${itemBonus ? 'bonus-glow' : ''}"><td class="l">${esc(it.v.name)}</td><td class="l">${it.p.name}${bonusBadge}</td><td class="l">T${it.k}</td>
    <td><span class="badge-tip" title="${esc(matBreakdownTip(it))}">${fmt(it.barsCost)}</span></td><td>${it.art ? fmt(it.artCost) : '—'}</td><td class="l muted">${it.art ? esc(it.art.name) + (it.artBuy ? ' · ' + it.artBuy.loc : '') : ''}</td>
    <td>${fmt(it.fee)}</td><td><b>${fmt(it.cost)}</b></td>
    <td class="best">${sellHtml}</td><td class="l">${it.sell ? locName(it.sell.loc) : ''}</td>
    <td>${priceHealthBadge(it.spotPrice, it.vol, it.id, it.sell ? it.sell.loc : '')}</td>
    <td class="${cls(it.profit)}"><b>${fmt(it.profit)}</b></td><td class="${cls(it.margin)}">${pct(it.margin)}</td>
    <td>${volBadge(it.vol, it.sell ? locName(it.sell.loc) : '', it.id, it.sell ? it.sell.loc : '')}</td>
    <td class="${(it.profitDaily && it.profitDaily > 0) ? 'pos' : ''}"><b>${it.profitDaily !== null ? (it.profitDaily > 0 ? '+' : '') + fmt(it.profitDaily) : '—'}</b></td>
    <td>${riskBadge(it.vol)}</td>
    <td><button class="ghost" data-addrank="${it.code}|${it.slot}|${it.k}">+ planejar</button></td></tr>`;
  }).join('');
  return `
  <h2>Ranking de lucro e demanda diária</h2>
  <div class="muted">Cruzamento de lucratividade real (Placas, Arcos e Bestas) com volume de compra por dia, preço por qualidade e proteção contra ofertas falsas de 1 unidade.</div>
  <div class="toolbar">
    <label>Categoria<select data-rf="cat"><option value="">Todas</option>${catOpts(f.cat)}</select></label>
    <label>Item / Variante<select data-rf="variant"><option value="">Todas</option>${variantOpts(f.variant, f.cat)}</select></label>
    <label>Peça / Tipo<select data-rf="piece"><option value="">Todas</option>${pieceOpts(f.piece, f.cat)}</select></label>
    <label>Tier<select data-rf="tier"><option value="">Todos</option>${[4, 5, 6, 7, 8].map(t => opt(t, 'T' + t, f.tier)).join('')}</select></label>
    <label>Encantamento<select data-rf="ench"><option value="">Todos</option>${[0, 1, 2, 3, 4].map(e => opt(e, '.' + e, f.ench)).join('')}</select></label>
    <label>Qualidade de Venda<select data-rf="quality">
      ${opt('mix', '⚡ Mix Real do Craft (~45% Q1, 42% Q2, 11% Q3...)', f.quality)}
      ${opt('1', 'Q1 · Normal', f.quality)}
      ${opt('2', 'Q2 · Bom', f.quality)}
      ${opt('3', 'Q3 · Notável', f.quality)}
      ${opt('4', 'Q4 · Excelente', f.quality)}
      ${opt('5', 'Q5 · Obra-prima', f.quality)}
      ${opt('best', '★ Maior Preço (Qualquer Qualidade)', f.quality)}
    </select></label>
    <label>Base Preço Venda<select data-rf="sellPricing">
      ${opt('spot', '⚡ Mercado Atual (Spot - Menor Sell/Maior Buy)', f.sellPricing)}
      ${opt('vwap', '📊 Preço Médio Histórico (VWAP - Anti-Troll)', f.sellPricing)}
      ${opt('safe', '🛡️ Mais Seguro (Menor entre Spot e VWAP)', f.sellPricing)}
      ${opt('smart', '💡 Inteligente (Usa VWAP se Preço For Inflado)', f.sellPricing)}
    </select></label>
    <label>Saúde do Preço<select data-rf="healthFilter">
      ${opt('all', 'Todas as saúdes', f.healthFilter)}
      ${opt('stable_only', '🟢 Apenas Estáveis & Confiáveis', f.healthFilter)}
      ${opt('no_inflated', '🛡️ Ocultar Preços Anormais / Inflados', f.healthFilter)}
      ${opt('with_sales', '⚡ Apenas com Vendas Ativas (Sem Mercado Parado)', f.healthFilter)}
    </select></label>
    <label>Modo Compra Materiais<select data-cfg="materialPricing">
      ${opt('smart', '🛡️ Inteligente (Anti-Fake/Slippage)', ST.config.materialPricing)}
      ${opt('vwap', '📊 Preço Médio Real (VWAP)', ST.config.materialPricing)}
      ${opt('spot', '⚡ Menor Oferta Spot (Cru)', ST.config.materialPricing)}
      ${opt('buffer5', '🛡️ Spot + 5% Margem', ST.config.materialPricing)}
      ${opt('buffer10', '🛡️ Spot + 10% Margem', ST.config.materialPricing)}
    </select></label>
    <label>Ordenar por<select data-rf="sort">
      ${opt('profitDaily', '🔥 Lucro Diário Est. (Lucro × Volume)', f.sort)}
      ${opt('vol', '📊 Demanda Diária (Maior Volume)', f.sort)}
      ${opt('profit', 'Lucro por Peça', f.sort)}
      ${opt('margin', 'Margem (%)', f.sort)}
      ${opt('cost', 'Menor Custo', f.sort)}
    </select></label>
    <label>Demanda mín.<select data-rf="minVol">
      ${opt('0', 'Todas as demandas', f.minVol)}
      ${opt('1', '≥ 1 un/dia (Ativos)', f.minVol)}
      ${opt('5', '≥ 5 un/dia (Moderado)', f.minVol)}
      ${opt('20', '≥ 20 un/dia (Giro Rápido)', f.minVol)}
      ${opt('50', '≥ 50 un/dia (Altíssimo Giro)', f.minVol)}
    </select></label>
    <label style="flex-direction:row;align-items:center;gap:6px;margin-top:14px"><input type="checkbox" data-rf="onlyPriced" ${f.onlyPriced ? 'checked' : ''}> só com preço completo</label>
    <button class="btn" id="fetchPricesRank" style="margin-top:14px" ${FETCHING ? 'disabled' : ''} title="Busca preços apenas da categoria/filtro selecionado + seus materiais e artefatos">↻ Buscar preços (deste filtro)</button>
    <button class="btn" id="fetchVolumesRank" style="margin-top:14px" ${FETCHING ? 'disabled' : ''} title="Busca volumes diários apenas dos equipamentos filtrados">📊 Buscar volumes (deste filtro)</button>
    ${FETCHING ? '<button class="btn" id="cancelFetchBtn" style="margin-top:14px;background:#ef6b6b;color:#111">⏹ Parar busca</button>' : ''}
    <span class="muted" style="margin-top:14px">${items.length} itens</span>
  </div>
  <div class="tablewrap"><table>
    <tr><th class="l">Item / Variante</th><th class="l">Peça / Tipo</th><th class="l">Tier</th><th title="Custo líquido de Barras e/ou Tábuas após retorno">Materiais (líq.)</th><th>Artefato</th><th class="l">Artefato / cidade</th>
    <th>Taxa</th><th>Custo</th><th>Melhor venda</th><th class="l">Local</th><th>Saúde Preço</th><th>Lucro / un.</th><th>Margem</th>
    <th title="Volume de compra diário no mercado de venda (média últimos 28 dias)">Demanda / dia</th>
    <th title="Lucro diário estimado = Lucro unitário × Volume diário">Lucro / dia est.</th>
    <th title="Classificação de liquidez e risco de prata parada">Giro / Risco</th><th></th></tr>
    ${body || '<tr><td colspan="17" class="empty">Nenhum item encontrado com os filtros atuais. Busque preços/volumes ou ajuste os filtros.</td></tr>'}
  </table></div>`;
}

/* ----- Refino ----- */
function viewRefine() {
  const isPlank = refineTab === 'plank';
  const chain = isPlank ? computePlanks() : computeBars();
  const refNoun = isPlank ? 'Tábua' : 'Barra';
  const rawNoun = isPlank ? 'Madeira' : 'Minério';
  const originAttr = isPlank ? 'data-plankorigin' : 'data-origin';
  const activeBonuses = getActiveDailyBonuses();
  const hasBarBonus = activeBonuses.some(b => b.refineMatch === 'bar');
  const hasPlankBonus = activeBonuses.some(b => b.refineMatch === 'plank');

  const decLabel = {
    buy: 'Comprar Pronta',
    step: `${refNoun} Anterior`,
    cascade: 'Cascata Total'
  };

  const body = BAR_KEYS.map(k => {
    const b = chain[k];
    const lwBar = b.lw ? chain[b.lw] : null;

    let compareHtml = '—';
    if (b.lw && b.step !== null && b.cascade !== null) {
      if (b.stepDiff > 1e-2) {
        compareHtml = `<span class="pill win" title="Cascata economiza ${fmt(b.stepDiff, 1)} de prata por ${refNoun.toLowerCase()}">Cascata (-${fmt(b.stepDiff, 0)})</span>`;
      } else if (b.stepDiff < -1e-2) {
        compareHtml = `<span class="pill win" style="background:#3b2a14;color:#f0a04b" title="Comprar a ${refNoun.toLowerCase()} T-${b.lw} pronta economiza ${fmt(-b.stepDiff, 1)} de prata por ${refNoun.toLowerCase()}">${refNoun} Ant. (-${fmt(-b.stepDiff, 0)})</span>`;
      } else {
        compareHtml = `<span class="pill tie">Empate</span>`;
      }
    } else if (!b.lw) {
      compareHtml = `<span class="muted">Base (T2)</span>`;
    }

    const tagClass = b.dec ? b.dec : 'muted';
    const tagText = b.dec ? (decLabel[b.dec] || b.dec) : 'Sem Preço';

    return `<tr>
      <td class="l"><b>T${k}</b></td>
      <td class="l">${b.q}× ${rawNoun} ${b.ore ? `<span class="muted">(${fmt(b.ore.price)} em ${b.ore.loc})</span>${b.ore.slippageRisk ? ` <span class="slippage-pill badge-tip" title="${esc(b.ore.reason)}">⚠️ Média: ${fmt(b.ore.vwap)}s</span>` : ''}` : '<span class="neg">s/ preço</span>'}</td>
      <td class="l">${b.lw ? `T${b.lw} <span class="muted">(Mkt: ${fmt(lwBar?.buyC, 0)} | Cascat: ${fmt(lwBar?.cascade, 0)})</span>` : '—'}</td>
      <td class="${b.step !== null && b.bestRefineMethod === 'step' && b.lw ? 'pos' : ''}">${b.lw ? fmt(b.step, 1) : '—'}</td>
      <td class="${b.cascade !== null && b.bestRefineMethod === 'cascade' ? 'pos' : ''}">${fmt(b.cascade, 1)}</td>
      <td>${compareHtml}</td>
      <td>${b.buyC !== null ? fmt(b.buyC, 1) + (b.buy ? ` <span class="muted">(${b.buy.loc})</span>${b.buy.slippageRisk ? ` <span class="slippage-pill badge-tip" title="${esc(b.buy.reason)}">⚠️ Média: ${fmt(b.buy.vwap)}s</span>` : ''}` : '') : '<span class="muted">—</span>'}</td>
      <td class="l">
        <select ${originAttr}="${k}">
          ${opt('auto', 'Automático (Mais Barato)', b.origin)}
          ${b.lw ? opt('step', `Refinar: ${refNoun} Anterior Pronta`, b.origin) : ''}
          ${opt('cascade', 'Refinar: Cascata Completa', b.origin)}
          ${opt('buy', `Comprar ${refNoun} Pronta`, b.origin)}
        </select>
      </td>
      <td><b class="pos">${fmt(b.eff, 1)}</b></td>
      <td><span class="tag ${tagClass}">${tagText}</span></td>
      <td class="${cls(b.saveVsBuy)}">${b.saveVsBuy !== null ? (b.saveVsBuy > 0 ? '+' : '') + fmt(b.saveVsBuy, 1) : '—'}</td>
    </tr>`;
  }).join('');

  return `
  <h2>Refino · Comparativo Estratégico (Cascata vs ${refNoun} Anterior)</h2>
  <div class="muted">
    Compare o custo real de refino entre dois métodos:
    <b>[${refNoun} Anterior]</b> (compra a ${refNoun.toLowerCase()} T-1 pronta no mercado mais barato + ${rawNoun.toLowerCase()} do tier) e 
    <b>[Cascata Completa]</b> (refina desde o T2 aproveitando os retornos acumulados).
    O sistema indica qual método gera o menor custo e abastece a Lista de Compras do Planejador de acordo com a sua escolha.
  </div>
  <div class="subtabs" style="margin-top:12px">
    <button data-rtab="bar" class="${refineTab === 'bar' ? 'active' : ''}">⛏️ Barras de Metal (Minério → Barra)${hasBarBonus ? ' 🔥 BÔNUS HOJE' : ''}</button>
    <button data-rtab="plank" class="${refineTab === 'plank' ? 'active' : ''}">🪵 Tábuas de Madeira (Madeira → Tábua)${hasPlankBonus ? ' 🔥 BÔNUS HOJE' : ''}</button>
  </div>
  <div class="toolbar" style="margin-top:10px;margin-bottom:14px">
    <label>Modo de Compra de Materiais<select data-cfg="materialPricing">
      ${opt('smart', '🛡️ Inteligente (Anti-Fake/Slippage)', ST.config.materialPricing)}
      ${opt('vwap', '📊 Preço Médio Real (VWAP)', ST.config.materialPricing)}
      ${opt('spot', '⚡ Menor Oferta Spot (Cru)', ST.config.materialPricing)}
      ${opt('buffer5', '🛡️ Spot + 5% Margem', ST.config.materialPricing)}
      ${opt('buffer10', '🛡️ Spot + 10% Margem', ST.config.materialPricing)}
    </select></label>
    <button class="ghost" id="fetchMaterialsVolume" style="margin-top:14px">📊 Buscar volumes & VWAP de todos os materiais (Minério, Barra, Madeira, Tábua)</button>
  </div>
  <div class="tablewrap"><table>
    <tr>
      <th class="l">${refNoun}</th>
      <th class="l">${rawNoun} Bruto</th>
      <th class="l">${refNoun} Anterior (T-1)</th>
      <th>Custo [${refNoun} Anterior]</th>
      <th>Custo [Cascata]</th>
      <th>Melhor Método</th>
      <th>${refNoun} Pronta (Mercado)</th>
      <th class="l">Origem / Estratégia</th>
      <th>Custo Efetivo</th>
      <th>Decisão</th>
      <th>Economia vs Mercado</th>
    </tr>
    ${body}
  </table></div>`;
}

/* ----- Preços ----- */
function priceInput(id, loc, q = 1) {
  const v = getQP(id, loc, q);
  const qStr = String(q || 1);
  const d = (ST.qualityDates && ST.qualityDates[id] && ST.qualityDates[id][qStr] && ST.qualityDates[id][qStr][loc])
    || (qStr === '1' && ST.dates[id] && ST.dates[id][loc]);
  const stale = d && (Date.now() - new Date(d + 'Z').getTime()) > 48 * 3600e3;
  const title = d ? `Albion Data (Q${q}): ${new Date(d + 'Z').toLocaleString('pt-BR')}` : `manual (Q${q})`;
  return `<input class="num${stale ? ' stale' : ''}" type="number" min="0" data-pid="${id}" data-loc="${loc}" data-q="${q}" data-fk="${id}|${q}|${loc}" value="${v ?? ''}" title="${esc(title)}">`;
}
function priceTable(rows, locs, extraHead = '', extra = () => '', q = 1) {
  return `<div class="tablewrap"><table><tr><th class="l">Item</th>${extraHead}${locs.map(l => `<th>${locName(l)}</th>`).join('')}<th>Menor</th><th>Maior</th></tr>
    ${rows.map(r => {
      const vals = locs.map(l => getQP(r.id, l, q)).filter(Boolean);
      return `<tr><td class="l">${r.label}</td>${extra(r)}${locs.map(l => `<td>${priceInput(r.id, l, q)}</td>`).join('')}
        <td class="pos">${vals.length ? fmt(Math.min(...vals)) : '—'}</td><td class="best">${vals.length ? fmt(Math.max(...vals)) : '—'}</td></tr>`;
    }).join('')}</table></div>`;
}
/* ---------------- culinária & alimentos (telas & interface) ---------------- */
function viewFood() {
  const tabs = [
    ['rank', '🏆 Ranking de Comidas'],
    ['nutrition', '🏛️ Nutrição & Bônus Diários'],
    ['processing', '🔪 Açougue & Insumos'],
    ['plan', `📋 Planejador (${(ST.foodPlan || []).length})`],
    ['prices', '📈 Cotações de Culinária']
  ];
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:12px">
      <div>
        <h2>🍲 Culinária · Craft de Comidas Meta</h2>
        <div class="muted">Cálculo de produção para as 21 comidas meta (.0 a .3) com rendimento de 10 un./lote, bônus de Caerleon/Ilha, taxas e arbitragem de açougue.</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button id="fetchFoodPrices" class="btn" style="font-size:12px;padding:6px 12px">🔄 Atualizar Preços de Comida</button>
        <button id="fetchFoodVolumes" class="ghost" style="font-size:12px;padding:6px 12px">📊 Atualizar Volumes & Histórico</button>
      </div>
    </div>
    <div class="subtabs">
      ${tabs.map(([id, label]) => `<button class="${foodTab === id ? 'active' : ''}" data-foodtab="${id}">${label}</button>`).join('')}
    </div>
    ${foodTab === 'rank' ? viewFoodRank() :
      foodTab === 'nutrition' ? viewFoodNutrition() :
      foodTab === 'processing' ? viewFoodProcessing() :
      foodTab === 'plan' ? viewFoodPlan() :
      viewFoodPrices()}
  `;
}

function viewFoodRank() {
  const f = foodFilter;
  const activeBonuses = getActiveDailyBonuses();
  const allMeals = [];
  
  if (GD.foods) {
    for (const food of GD.foods) {
      if (f.family && food.family !== f.family) continue;
      if (f.tier && String(food.tier) !== String(f.tier)) continue;
      if (f.stationUse) {
        const fed = getStationsFedByFood(food.id);
        if (f.stationUse === 'any' && !fed.length) continue;
        if (f.stationUse !== 'any' && !fed.some(s => s.id === f.stationUse)) continue;
      }

      const enchLevels = f.ench !== '' ? [Number(f.ench)] : [0, 1, 2, 3];
      for (const e of enchLevels) {
        const item = computeMealItem(food.id, e);
        if (!item) continue;
        if (f.onlyPriced && (item.unitCost === null || item.spotPrice === null)) continue;
        if (f.healthFilter && f.healthFilter !== 'all' && item.health && item.health.status !== f.healthFilter) continue;
        allMeals.push(item);
      }
    }
  }

  // Ordenação
  allMeals.sort((a, b) => {
    if (f.sort === 'profit') return (b.profit || -1e9) - (a.profit || -1e9);
    if (f.sort === 'margin') return (b.margin || -1e9) - (a.margin || -1e9);
    if (f.sort === 'vol') return (b.dailyVol || 0) - (a.dailyVol || 0);
    return (b.profitDaily || -1e9) - (a.profitDaily || -1e9);
  });

  const profitableCount = allMeals.filter(m => m.profit > 0).length;
  const bestDaily = allMeals.length ? allMeals[0] : null;
  const bestMargin = [...allMeals].sort((a, b) => (b.margin || -1e9) - (a.margin || -1e9))[0] || null;

  const bonusBanner = activeBonuses.length ? `
    <div class="bonus-hero" style="padding:12px 16px;margin:8px 0 10px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div style="display:flex;flex-direction:column;gap:4px">
          ${activeBonuses.map(b => `
            <div>
              <span style="font-weight:700;color:var(--accent);font-size:13px">🔥 BÔNUS ${b.slotNum}: ${esc(b.name)}</span>
              <span class="muted" style="font-size:12px;margin-left:8px">→ Estação: <b>${esc(b.stationName)}</b> · Comida 2x em alta: <b>${esc(b.foodName)}</b></span>
            </div>
          `).join('')}
        </div>
        <button class="btn" style="font-size:11px;padding:4px 10px" data-foodtab="nutrition">Ver Análise de Nutrição ➜</button>
      </div>
    </div>
  ` : '';

  return `
    ${bonusBanner}
    <div class="card toolbar" style="margin-top:8px">
      <label>Família:
        <select data-ff="family">
          <option value="">Todas as Comidas</option>
          ${(GD.foodFamilies || []).map(fam => `<option value="${fam.id}"${f.family === fam.id ? ' selected' : ''}>${fam.name}</option>`).join('')}
        </select>
      </label>
      <label>Tier:
        <select data-ff="tier">
          <option value="">Todos</option>
          ${[1, 2, 3, 4, 5, 6, 7, 8].map(t => `<option value="${t}"${String(f.tier) === String(t) ? ' selected' : ''}>T${t}</option>`).join('')}
        </select>
      </label>
      <label>Encantamento:
        <select data-ff="ench">
          <option value="">Todos (.0 a .3)</option>
          <option value="0"${f.ench === '0' ? ' selected' : ''}>.0 (Comum)</option>
          <option value="1"${f.ench === '1' ? ' selected' : ''}>.1 (Molho Básico)</option>
          <option value="2"${f.ench === '2' ? ' selected' : ''}>.2 (Molho Extravagante)</option>
          <option value="3"${f.ench === '3' ? ' selected' : ''}>.3 (Molho Especial)</option>
        </select>
      </label>
      <label>Alimenta Construção:
        <select data-ff="stationUse">
          <option value="">Todas as Comidas</option>
          <option value="any"${f.stationUse === 'any' ? ' selected' : ''}>🏛️ Apenas Comidas de Lojas (2x Nutrição)</option>
          ${(GD.stationNutrition || []).map(st => `<option value="${st.id}"${f.stationUse === st.id ? ' selected' : ''}>${st.name} (${st.favoriteFoodName})</option>`).join('')}
        </select>
      </label>
      <label>Local de Produção:
        <select data-ff="city">
          <option value="Caerleon"${f.city === 'Caerleon' ? ' selected' : ''}>Caerleon (Bônus Culinária: 24.8%)</option>
          <option value="Ilha"${f.city === 'Ilha' || f.city === 'Island' ? ' selected' : ''}>Ilha Particular (0.0% s/ foco)</option>
          <option value="Thetford"${f.city === 'Thetford' ? ' selected' : ''}>Thetford (15.2%)</option>
          <option value="Martlock"${f.city === 'Martlock' ? ' selected' : ''}>Martlock (15.2%)</option>
          <option value="Bridgewatch"${f.city === 'Bridgewatch' ? ' selected' : ''}>Bridgewatch (15.2%)</option>
          <option value="Lymhurst"${f.city === 'Lymhurst' ? ' selected' : ''}>Lymhurst (15.2%)</option>
          <option value="Fort Sterling"${f.city === 'Fort Sterling' ? ' selected' : ''}>Fort Sterling (15.2%)</option>
          <option value="Brecilien"${f.city === 'Brecilien' ? ' selected' : ''}>Brecilien (15.2%)</option>
        </select>
      </label>
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;flex-direction:row;margin-top:14px">
        <input type="checkbox" data-ff="focus"${f.focus ? ' checked' : ''}>
        <span>Usar Foco (${f.city === 'Caerleon' ? '47.9%' : '43.5%'})</span>
      </label>
      <label>Retorno RRF:
        <input class="num" type="number" step="0.1" min="0" max="100" style="width:70px" value="${(f.retRate * 100).toFixed(1)}" data-ff="retRate">
      </label>
      <label>Taxa Cozinha:
        <input class="num" type="number" min="0" max="5000" style="width:70px" value="${f.feeFood}" data-ff="feeFood" title="Taxa por 100 de nutrição">
      </label>
      <label>Venda:
        <select data-ff="sellLoc">
          <option value="">Melhor Cidade</option>
          ${getFoodSaleLocs().map(l => `<option value="${l}"${f.sellLoc === l ? ' selected' : ''}>${locName(l)}</option>`).join('')}
        </select>
      </label>
      <label>Precificação:
        <select data-ff="sellPricing">
          <option value="smart"${f.sellPricing === 'smart' ? ' selected' : ''}>🛡️ Inteligente (Anti-inflado)</option>
          <option value="safe"${f.sellPricing === 'safe' ? ' selected' : ''}>Seguro (Min Spot/VWAP)</option>
          <option value="vwap"${f.sellPricing === 'vwap' ? ' selected' : ''}>VWAP (Média 7d)</option>
          <option value="spot"${f.sellPricing === 'spot' ? ' selected' : ''}>Preço Spot</option>
        </select>
      </label>
      <label>Ordenar por:
        <select data-ff="sort">
          <option value="profitDaily"${f.sort === 'profitDaily' ? ' selected' : ''}>Lucro Diário Est.</option>
          <option value="profit"${f.sort === 'profit' ? ' selected' : ''}>Lucro Unitário</option>
          <option value="margin"${f.sort === 'margin' ? ' selected' : ''}>Margem (%)</option>
          <option value="vol"${f.sort === 'vol' ? ' selected' : ''}>Demanda Diária</option>
        </select>
      </label>
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;flex-direction:row;margin-top:14px">
        <input type="checkbox" data-ff="autoArbitrage"${f.autoArbitrage ? ' checked' : ''}>
        <span title="Compara automaticamente carne do açougue vs carne pronta, farinha do moinho vs mercado">Auto-Arbitragem Insumos</span>
      </label>
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;flex-direction:row;margin-top:14px">
        <input type="checkbox" data-ff="onlyPriced"${f.onlyPriced ? ' checked' : ''}>
        <span>Apenas c/ Preço</span>
      </label>
    </div>

    <div class="cards">
      <div class="stat"><div class="label">Comidas Avaliadas</div><div class="value">${allMeals.length}</div></div>
      <div class="stat"><div class="label">Lucro Positivo</div><div class="value pos">${profitableCount}</div></div>
      <div class="stat"><div class="label">Maior Lucro Diário Est.</div><div class="value pos">${bestDaily ? fmt(bestDaily.profitDaily) + 's' : '—'}</div></div>
      <div class="stat"><div class="label">Maior Margem</div><div class="value pos">${bestMargin && bestMargin.margin ? pct(bestMargin.margin) : '—'}</div></div>
    </div>

    <div class="tablewrap">
      <table>
        <thead>
          <tr>
            <th class="l">Comida</th>
            <th>Tier</th>
            <th class="l">Insumos por Lote (10 un.)</th>
            <th>Molho de Peixe</th>
            <th>Custo Unit.</th>
            <th>Melhor Venda</th>
            <th>Demanda / Saúde</th>
            <th>Lucro Unit.</th>
            <th>Margem</th>
            <th>Lucro Diário Est.</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody>
          ${allMeals.map(m => {
            const fedStations = getStationsFedByFood(m.baseId);
            const matchingBonuses = activeBonuses.filter(b => b.foodId === m.baseId);
            const isTodayBonus = matchingBonuses.length > 0;
            const stationBadges = fedStations.map(st => `<span class="nutri-pill x2" title="Comida favorita de: ${st.name} (+100% / 2x Nutrição)">🏛️ ${st.name} (2x)</span>`).join(' ');
            const bonusTag = isTodayBonus
              ? `<span class="tag pos" style="background:#3a2910;border-color:var(--accent);color:var(--accent);font-weight:700" title="BÔNUS DO DIA ATIVO (${matchingBonuses.map(b => b.shortName || b.name).join(' + ')}): Demanda explosiva nas lojas!">🔥 BÔNUS HOJE (${matchingBonuses.map(b => esc(b.shortName || b.name)).join(' + ')})</span> `
              : '';
            const sauceChip = m.sauce ? `<span class="food-chip"><img src="${itemIconUrl(m.sauce.id)}"> ${m.sauce.count}x (${fmt(m.sauce.totalCost)}s)</span>` : '<span class="muted">—</span>';
            const ingsChips = m.ingredients.map(ing => {
              const arbTag = ing.buy && ing.buy.isArbitrage ? ' <span class="tag step" title="Obtido via abate ou processamento">arbitrado</span>' : '';
              return `<span class="food-chip" title="${ing.name}: ${ing.count} un. brutas (${fmt(ing.effCount, 1)} líquidas c/ retorno) — ${ing.costPerUnit ? fmt(ing.costPerUnit) + 's/un' : 's/ preço'}"><img src="${itemIconUrl(ing.id)}"> ${ing.count}x${arbTag}</span>`;
            }).join(' ');
            return `
              <tr class="${isTodayBonus ? 'bonus-glow' : ''}">
                <td class="l" style="display:flex;align-items:center;gap:8px">
                  <img src="${itemIconUrl(m.id)}" class="food-icon" alt="">
                  <div>
                    <div style="font-weight:600">${bonusTag}${esc(m.name)}</div>
                    <div class="muted">${esc(m.familyLabel)} · ${esc(m.nameEn)} ${stationBadges ? ' · ' + stationBadges : ''}</div>
                  </div>
                </td>
                <td><span class="tag ${m.family}">${m.tier}.${m.ench}</span></td>
                <td class="l">${ingsChips}</td>
                <td>${sauceChip}</td>
                <td><b>${fmt(m.unitCost)}</b>s</td>
                <td>
                  ${m.effectiveSellPrice ? `<b>${fmt(m.effectiveSellPrice)}</b>s <span class="muted">(${locName(m.sellLoc)})</span>${m.wasPriceCapped ? `<div class="muted" style="font-size:10px;color:#f0c04b" title="O preço spot bruto em ${locName(m.sellLoc)} (${fmt(m.spotPrice)}s) estava inflado/outlier e foi ajustado para a referência real (${fmt(m.effectiveSellPrice)}s)">🛡️ Spot inflado: ${fmt(m.spotPrice)}s</div>` : ''}` : '<span class="muted">—</span>'}
                </td>
                <td>
                  <div style="display:inline-flex;gap:4px;align-items:center">
                    ${volBadge(m.vol, m.sellLoc, m.id, m.sellLoc)}
                    ${priceHealthBadge(m.effectiveSellPrice || m.spotPrice, m.vol, m.id, m.sellLoc, m.refPrice)}
                  </div>
                </td>
                <td class="${cls(m.profit)}">${fmt(m.profit)}s</td>
                <td><span class="pill ${m.margin > 0.15 ? 'win' : m.margin > 0 ? 'tie' : 'neg'}">${pct(m.margin)}</span></td>
                <td class="${cls(m.profitDaily)}"><b>${fmt(m.profitDaily)}</b>s</td>
                <td>
                  <button class="ghost" style="font-size:11px;padding:3px 8px" data-addfood="${m.id}" title="Adicionar 1 lote (10 comidas) ao Planejador de Culinária">+ Planejador</button>
                </td>
              </tr>
            `;
          }).join('')}
          ${!allMeals.length ? '<tr><td colspan="11" class="empty">Nenhuma comida encontrada com os filtros selecionados.</td></tr>' : ''}
        </tbody>
      </table>
    </div>
  `;
}

function viewFoodNutrition() {
  const b1 = getDailyBonusBySlot(1);
  const b2 = getDailyBonusBySlot(2);
  const activeBonuses = getActiveDailyBonuses();
  const stations = GD.stationNutrition || [];

  const bonusCardsHtml = activeBonuses.length ? activeBonuses.map(b => {
    const meal = b.foodId ? computeMealItem(b.foodId, 0) : null;
    if (!meal) return '';
    return `
      <div style="background:var(--panel2);border:1px solid var(--accent);border-radius:10px;padding:12px 16px;min-width:295px;flex:1">
        <div style="font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:0.5px">⭐ ${b.slotNum}º Bônus: ${esc(b.name)}</div>
        <div style="display:flex;align-items:center;gap:10px;margin:8px 0">
          <img src="${itemIconUrl(meal.id)}" class="food-icon" style="width:44px;height:44px" alt="">
          <div>
            <div style="font-size:16px;font-weight:700">${esc(meal.name)}</div>
            <div class="muted">Alimenta: <b>${esc(b.stationName)}</b> (2x Nutrição)</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;margin-top:6px">
          <div>Custo Craft: <b>${fmt(meal.unitCost)}s</b></div>
          <div>Venda Real: <b>${fmt(meal.effectiveSellPrice)}s</b></div>
          <div class="${cls(meal.profit)}">Lucro/un: <b>${fmt(meal.profit)}s</b></div>
          <div>Giro Diário: <b>${fmt(meal.dailyVol)} un/dia</b></div>
        </div>
        <div style="margin-top:10px;display:flex;gap:6px">
          <button class="btn" style="font-size:11px;padding:4px 10px;flex:1" data-addfood="${meal.id}">+ 1 Lote (10 un.)</button>
          <button class="ghost" style="font-size:11px;padding:4px 10px;flex:1" data-addfoodbulk="${meal.id}|10">+ 10 Lotes (100 un.)</button>
        </div>
      </div>
    `;
  }).join('') : `
    <div style="background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:14px 18px;max-width:360px;color:var(--muted);font-size:13px">
      💡 Selecione os 2 bônus diários ativos no Albion (ex.: Arcos, Bestas, Botas de Placa, Refino de Minério, Ferramentas...) para identificar as comidas com pico de demanda hoje e planejar sua produção.
    </div>
  `;

  return `
    <div class="bonus-hero" style="margin-top:12px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px">
        <div style="flex:1;min-width:300px">
          <h3><span>🔥</span> 2 Bônus Diários de Produção (Albion Online)</h3>
          <div class="muted" style="margin-bottom:12px">
            No Albion Online, todos os dias há <b>2 bônus diários específicos por item/linha</b> (+10% ou +20% em Arcos, Bestas, Armadura de Placa, Bota de Placa, Ferramentas de Coleta, Poções, Comidas ou Refino). Quando ativos, os crafters esvaziam a nutrição da barraca correspondente, <b>disparando a procura pela Comida Favorita (2x Nutrição)</b> daquela estação!
          </div>
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <label style="font-weight:700;color:var(--text);display:flex;flex-direction:column;gap:4px">
              <span>1º Bônus Diário Ativo:</span>
              <select data-ff="dailyBonus1" style="font-size:13px;font-weight:700;padding:6px 12px;background:var(--input);border:1px solid var(--accent);border-radius:8px;min-width:260px">
                ${dailyBonusOptionsHtml(b1.id, 'Nenhum (Sem 1º Bônus)')}
              </select>
            </label>
            <label style="font-weight:700;color:var(--text);display:flex;flex-direction:column;gap:4px">
              <span>2º Bônus Diário Ativo:</span>
              <select data-ff="dailyBonus2" style="font-size:13px;font-weight:700;padding:6px 12px;background:var(--input);border:1px solid var(--accent);border-radius:8px;min-width:260px">
                ${dailyBonusOptionsHtml(b2.id, 'Nenhum (Sem 2º Bônus)')}
              </select>
            </label>
          </div>
        </div>

        <div style="display:flex;gap:12px;flex-wrap:wrap;flex:1.2;min-width:300px">
          ${bonusCardsHtml}
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <h3>🏛️ Guia de Nutrição das Estações de Craft (Comidas Favoritas = 2x Nutrição)</h3>
      <div class="muted" style="margin-bottom:12px">
        Cada estação de craft consome nutrição para cada ciclo de fabricação/refino. Donos de lojas compram massivamente a <b>Comida Favorita</b> porque ela fornece <b>o dobro de nutrição (+100%)</b> por prata gasta.
      </div>
      <div class="tablewrap">
        <table>
          <thead>
            <tr>
              <th class="l">Estação de Craft</th>
              <th>Categoria</th>
              <th class="l">Comida Favorita</th>
              <th>Nutrição Base</th>
              <th>Nutrição Dobrada (2x)</th>
              <th class="l">Itens Fabricados</th>
              <th>Custo Craft</th>
              <th>Venda Spot</th>
              <th>Lucro Unit.</th>
              <th>Demanda</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            ${stations.map(st => {
              const meal = computeMealItem(st.favoriteFoodId, 0);
              const stBonuses = activeBonuses.filter(b => b.targetStation === st.id);
              const isToday = stBonuses.length > 0;
              return `
                <tr class="${isToday ? 'bonus-glow' : ''}">
                  <td class="l" style="display:flex;align-items:center;gap:6px">
                    <img src="${st.icon}" class="building-icon" alt="">
                    <div>
                      <b>${esc(st.name)}</b>
                      ${isToday ? stBonuses.map(b => ` <span class="tag pos" style="font-size:10px">🔥 HOJE: ${esc(b.shortName || b.name)}</span>`).join('') : ''}
                      <div class="muted">${esc(st.nameEn)}</div>
                    </div>
                  </td>
                  <td><span class="tag">${esc(st.category)}</span></td>
                  <td class="l">
                    <div style="display:flex;align-items:center;gap:6px">
                      <img src="${itemIconUrl(st.favoriteFoodId)}" style="width:24px;height:24px;border-radius:4px;vertical-align:middle">
                      <div>
                        <b>${esc(st.favoriteFoodName)}</b> <span class="tag ${meal ? meal.family : ''}">T${st.favoriteFoodTier}</span>
                      </div>
                    </div>
                  </td>
                  <td>${fmt(st.baseNutrition)}</td>
                  <td><span class="nutri-pill x2">+100% (${fmt(st.bonusNutrition)})</span></td>
                  <td class="l" style="max-width:260px;white-space:normal;font-size:12px">${esc(st.craftedItems)}</td>
                  <td>${meal && meal.unitCost !== null ? `<b>${fmt(meal.unitCost)}</b>s` : '<span class="muted">—</span>'}</td>
                  <td>${meal && meal.effectiveSellPrice ? `<b>${fmt(meal.effectiveSellPrice)}</b>s <span class="muted">(${locName(meal.sellLoc)})</span>` : '<span class="muted">—</span>'}</td>
                  <td class="${meal ? cls(meal.profit) : ''}">${meal && meal.profit !== null ? fmt(meal.profit) + 's' : '—'}</td>
                  <td>${meal ? volBadge(meal.vol, meal.sellLoc, meal.id, meal.sellLoc) : '—'}</td>
                  <td>
                    <button class="ghost" style="font-size:11px;padding:3px 8px" data-addfood="${st.favoriteFoodId}" title="Adicionar ao Planejador de Culinária">+ Planejador</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function viewFoodProcessing() {
  const butchList = (GD.butchering || []).map(b => {
    const animalBuy = getFoodIngredientBuy(b.animalId, 1, { autoArbitrage: false });
    const meatBuy = getFoodIngredientBuy(b.meatId, 18, { autoArbitrage: false });
    const animalPrice = animalBuy ? animalBuy.price : null;
    const meatDirectPrice = meatBuy ? meatBuy.price : null;
    const meatViaButcher = animalPrice ? (animalPrice / b.yield) : null;
    const diffPerMeat = (meatDirectPrice !== null && meatViaButcher !== null) ? (meatDirectPrice - meatViaButcher) : null;
    const diffPct = (diffPerMeat !== null && meatDirectPrice > 0) ? (diffPerMeat / meatDirectPrice) : null;
    const totalSavingsPerAnimal = diffPerMeat !== null ? (diffPerMeat * b.yield) : null;
    return { ...b, animalBuy, meatBuy, animalPrice, meatDirectPrice, meatViaButcher, diffPerMeat, diffPct, totalSavingsPerAnimal };
  });

  const procList = (GD.foodProcessing || []).map(p => {
    const rawBuy = getFoodIngredientBuy(p.fromId, 1, { autoArbitrage: false });
    const readyBuy = getFoodIngredientBuy(p.id, 1, { autoArbitrage: false });
    const rawPrice = rawBuy ? rawBuy.price : null;
    const readyPrice = readyBuy ? readyBuy.price : null;
    const costViaProc = rawPrice ? (rawPrice / p.count) : null;
    const diff = (readyPrice !== null && costViaProc !== null) ? (readyPrice - costViaProc) : null;
    const diffPct = (diff !== null && readyPrice > 0) ? (diff / readyPrice) : null;
    return { ...p, rawBuy, readyBuy, rawPrice, readyPrice, costViaProc, diff, diffPct };
  });

  return `
    <div class="card" style="margin-top:12px">
      <h3>🔪 Açougueiro · Arbitragem de Carnes (Animal Vivo vs Carne Crua)</h3>
      <div class="muted" style="margin-bottom:12px">
        No Albion, abater 1 animal adulto no Açougueiro gera <b>18 unidades de carne crua</b>. Compare se vale a pena comprar o animal vivo ou comprar a carne pronta no mercado.
      </div>
      <div class="tablewrap">
        <table>
          <thead>
            <tr>
              <th class="l">Animal Vivo (Fazenda)</th>
              <th>Preço Animal</th>
              <th>Rendimento</th>
              <th>Custo Carne (Abate)</th>
              <th class="l">Carne Pronta (Mercado)</th>
              <th>Preço Carne Mercado</th>
              <th>Economia / Carne</th>
              <th>Economia / Animal</th>
              <th>Veredito</th>
            </tr>
          </thead>
          <tbody>
            ${butchList.map(b => {
              const isWin = b.diffPerMeat > 0;
              return `
                <tr>
                  <td class="l" style="display:flex;align-items:center;gap:6px">
                    <img src="${itemIconUrl(b.animalId)}" class="food-icon" alt="">
                    <b>${esc(b.animalName)}</b> <span class="muted">(T${b.tier})</span>
                  </td>
                  <td>${b.animalPrice ? `<b>${fmt(b.animalPrice)}</b>s <span class="muted">(${locName(b.animalBuy.loc)})</span>` : '<span class="muted">—</span>'}</td>
                  <td>18x carnes</td>
                  <td class="${isWin ? 'pos' : ''}"><b>${fmt(b.meatViaButcher, 1)}</b>s</td>
                  <td class="l">
                    <img src="${itemIconUrl(b.meatId)}" style="width:20px;height:20px;vertical-align:middle">
                    ${esc(b.meatName)}
                  </td>
                  <td>${b.meatDirectPrice ? `<b>${fmt(b.meatDirectPrice)}</b>s <span class="muted">(${locName(b.meatBuy.loc)})</span>` : '<span class="muted">—</span>'}</td>
                  <td class="${cls(b.diffPerMeat)}">${b.diffPerMeat !== null ? fmt(b.diffPerMeat, 1) + 's' : '—'}</td>
                  <td class="${cls(b.totalSavingsPerAnimal)}">${b.totalSavingsPerAnimal !== null ? fmt(b.totalSavingsPerAnimal) + 's' : '—'}</td>
                  <td>
                    ${b.diffPct !== null ?
                      (b.diffPct > 0.05 ? `<span class="arb-badge arb-win">🔪 Abater! Economia de ${pct(b.diffPct)}</span>` :
                       b.diffPct < -0.05 ? `<span class="arb-badge arb-loss">Comprar pronta (+${pct(-b.diffPct)} mais cara no abate)</span>` :
                       `<span class="arb-badge arb-loss">Empate de preço (~${pct(b.diffPct)})</span>`)
                      : '<span class="muted">Sem dados</span>'}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <h3>🌾 Moinho, Padaria & Laticínios (Processamento Intermediário)</h3>
      <div class="muted" style="margin-bottom:12px">
        Conversões diretas: 1 Trigo = 1 Farinha (Moinho); 1 Farinha = 1 Pão (Cozinha); 1 Leite = 1 Manteiga (Cozinha).
      </div>
      <div class="tablewrap">
        <table>
          <thead>
            <tr>
              <th class="l">Item Processado</th>
              <th>Estação</th>
              <th class="l">Matéria-Prima</th>
              <th>Preço Matéria-Prima</th>
              <th>Preço Item Pronto</th>
              <th>Economia / Un.</th>
              <th>Veredito</th>
            </tr>
          </thead>
          <tbody>
            ${procList.map(p => {
              const isWin = p.diff > 0;
              return `
                <tr>
                  <td class="l" style="display:flex;align-items:center;gap:6px">
                    <img src="${itemIconUrl(p.id)}" class="food-icon" alt="">
                    <b>${esc(p.name)}</b>
                  </td>
                  <td><span class="tag step">${esc(p.building)}</span></td>
                  <td class="l">
                    <img src="${itemIconUrl(p.fromId)}" style="width:20px;height:20px;vertical-align:middle">
                    ${esc(p.fromName)}
                  </td>
                  <td>${p.rawPrice ? `<b>${fmt(p.rawPrice)}</b>s <span class="muted">(${locName(p.rawBuy.loc)})</span>` : '<span class="muted">—</span>'}</td>
                  <td>${p.readyPrice ? `<b>${fmt(p.readyPrice)}</b>s <span class="muted">(${locName(p.readyBuy.loc)})</span>` : '<span class="muted">—</span>'}</td>
                  <td class="${cls(p.diff)}">${p.diff !== null ? fmt(p.diff) + 's' : '—'}</td>
                  <td>
                    ${p.diffPct !== null ?
                      (p.diffPct > 0.05 ? `<span class="arb-badge arb-win">Produzir! Economia de ${pct(p.diffPct)}</span>` :
                       p.diffPct < -0.05 ? `<span class="arb-badge arb-loss">Comprar pronto</span>` :
                       `<span class="arb-badge arb-loss">Equivalente</span>`)
                      : '<span class="muted">Sem dados</span>'}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function viewFoodPlan() {
  const p = computeFoodPlan();
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin:12px 0">
      <div style="display:flex;gap:8px">
        <button id="addFoodMealBtn" class="btn" style="font-size:12px">+ Adicionar Comida ao Plano</button>
        <button id="clearFoodPlan" class="ghost" style="font-size:12px">🗑️ Limpar Plano</button>
      </div>
      <div class="muted">
        Local de Craft: <b>${esc(foodFilter.city)}</b> (${(foodFilter.retRate * 100).toFixed(1)}% retorno) ${foodFilter.focus ? '· <b>Foco Ativo</b>' : ''}
      </div>
    </div>

    <div class="cards">
      <div class="stat"><div class="label">Total de Comidas</div><div class="value">${fmt(p.totalMeals)} un.</div></div>
      <div class="stat"><div class="label">Investimento Total</div><div class="value">${fmt(p.totalInvestment)}s</div></div>
      <div class="stat"><div class="label">Receita Bruta Estimada</div><div class="value">${fmt(p.totalRevenue)}s</div></div>
      <div class="stat"><div class="label">Lucro Líquido Estimado</div><div class="value pos">${fmt(p.totalProfit)}s</div></div>
      ${foodFilter.focus ? `<div class="stat"><div class="label">Foco Necessário</div><div class="value">${fmt(p.totalFocus)}</div></div>` : ''}
    </div>

    <div class="card" style="margin-top:12px">
      <h3>Receitas Selecionadas</h3>
      <div class="tablewrap">
        <table>
          <thead>
            <tr>
              <th class="l">Comida</th>
              <th>Lotes (10 un./lote)</th>
              <th>Total Produzido</th>
              <th>Custo Unit.</th>
              <th>Custo Total</th>
              <th>Melhor Venda</th>
              <th>Lucro Unit.</th>
              <th>Lucro Total</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            ${p.rows.map(r => {
              const it = r.it;
              if (!it) return '';
              const allFoodOpts = (GD.foods || []).flatMap(f => [
                opt(f.id, `${f.name} (T${f.tier})`, it.id),
                ...(f.enchantments || []).map(e => opt(e.id, `${f.name} .${e.level} (T${f.tier}.${e.level})`, it.id))
              ]).join('');
              return `
                <tr>
                  <td class="l" style="display:flex;align-items:center;gap:8px">
                    <img src="${itemIconUrl(it.id)}" class="food-icon" alt="">
                    <div>
                      <select data-foodplanselect="${r.idx}" style="font-weight:600">
                        ${allFoodOpts}
                      </select>
                      <div class="muted">${esc(it.familyLabel)} · ${esc(it.nameEn)}</div>
                    </div>
                  </td>
                  <td>
                    <input class="num" type="number" min="1" max="10000" style="width:75px" value="${r.batches}" data-foodplan="${r.idx}">
                  </td>
                  <td><b>${fmt(r.totalUnits)}</b> un.</td>
                  <td>${fmt(it.unitCost)}s</td>
                  <td>${fmt(r.totalCost)}s</td>
                  <td>${it.effectiveSellPrice ? `<b>${fmt(it.effectiveSellPrice)}</b>s <span class="muted">(${locName(it.sellLoc)})</span>` : '—'}</td>
                  <td class="${cls(it.profit)}">${fmt(it.profit)}s</td>
                  <td class="${cls(r.totalProfit)}"><b>${fmt(r.totalProfit)}</b>s</td>
                  <td>
                    <button class="icon" data-delfood="${r.idx}" title="Remover do plano">✕</button>
                  </td>
                </tr>
              `;
            }).join('')}
            ${!p.rows.length ? '<tr><td colspan="9" class="empty">Nenhuma comida adicionada ao plano. Use o botão acima ou adicione pelo Ranking de Comidas.</td></tr>' : ''}
          </tbody>
        </table>
      </div>
    </div>

    ${p.shoppingList.length ? `
      <div class="card" style="margin-top:16px">
        <h3>🛒 Lista de Compras Consolidada de Culinária</h3>
        <div class="muted" style="margin-bottom:12px">
          Quantidades líquidas já consideram a taxa de retorno de recursos da cidade (${(foodFilter.retRate * 100).toFixed(1)}%). Molhos de peixe têm 0% de retorno conforme regra oficial do jogo.
        </div>
        <div class="tablewrap">
          <table>
            <thead>
              <tr>
                <th class="l">Ingrediente</th>
                <th>Qtd Bruta</th>
                <th>Qtd Líquida (Comprar)</th>
                <th>Método de Obtenção</th>
                <th>Onde Comprar</th>
                <th>Preço Unitário</th>
                <th>Custo Total</th>
              </tr>
            </thead>
            <tbody>
              ${p.shoppingList.map(item => {
                const buy = item.buy;
                const isArb = buy && buy.isArbitrage;
                const methodTag = isArb ? `<span class="tag step">${esc(buy.methodLabel)}</span>` : `<span class="tag comprar">Mercado</span>`;
                return `
                  <tr>
                    <td class="l" style="display:flex;align-items:center;gap:6px">
                      <img src="${item.icon}" style="width:24px;height:24px;vertical-align:middle">
                      <b>${esc(item.name)}</b>
                    </td>
                    <td>${fmt(Math.ceil(item.grossQty))} un.</td>
                    <td><b class="pos">${fmt(Math.ceil(item.netQty))}</b> un.</td>
                    <td>${methodTag}</td>
                    <td>${buy ? `<b>${locName(buy.loc)}</b>` : '<span class="muted">—</span>'}</td>
                    <td>${item.costPerUnit ? fmt(item.costPerUnit, 1) + 's' : '—'}</td>
                    <td><b>${fmt(item.totalCost)}</b>s</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}
  `;
}

function viewFoodPrices() {
  const sub = foodFilter.priceSubtab || 'meals';
  const subtabs = [
    ['meals', '🍲 Comidas Meta (.0 a .3)'],
    ['ingredients', '🌾 Cultivos & Insumos'],
    ['animals', '🐄 Animais (Açougue)'],
    ['processing', '🥖 Farinhas, Pães & Molhos']
  ];

  let itemsToShow = [];
  if (sub === 'meals') {
    for (const f of GD.foods || []) {
      itemsToShow.push({ id: f.id, label: `${f.name} (T${f.tier})` });
      for (const e of f.enchantments || []) {
        itemsToShow.push({ id: e.id, label: `${f.name} .${e.level} (T${f.tier}.${e.level})` });
      }
    }
  } else if (sub === 'ingredients') {
    const rawIds = ['T1_CARROT', 'T2_BEAN', 'T3_WHEAT', 'T4_TURNIP', 'T5_CABBAGE', 'T6_POTATO', 'T7_CORN', 'T8_PUMPKIN', 'T3_EGG', 'T5_EGG', 'T4_MILK', 'T6_MILK', 'T8_MILK', 'T3_MEAT', 'T4_MEAT', 'T5_MEAT', 'T6_MEAT', 'T7_MEAT', 'T8_MEAT'];
    itemsToShow = rawIds.map(id => ({ id, label: (GD.itemNames && GD.itemNames[id]) || id }));
  } else if (sub === 'animals') {
    const animIds = (GD.butchering || []).map(b => b.animalId);
    itemsToShow = animIds.map(id => ({ id, label: (GD.itemNames && GD.itemNames[id]) || id }));
  } else if (sub === 'processing') {
    const procIds = ['T3_FLOUR', 'T4_BREAD', 'T4_BUTTER', 'T6_BUTTER', 'T8_BUTTER', 'T1_FISHSAUCE_LEVEL1', 'T1_FISHSAUCE_LEVEL2', 'T1_FISHSAUCE_LEVEL3'];
    itemsToShow = procIds.map(id => ({ id, label: (GD.itemNames && GD.itemNames[id]) || id }));
  }

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin:12px 0">
      <div class="subtabs" style="margin:0">
        ${subtabs.map(([id, label]) => `<button class="${sub === id ? 'active' : ''}" data-foodpricesub="${id}">${label}</button>`).join('')}
      </div>
      <div style="display:flex;gap:8px">
        <button id="fetchFoodPrices" class="btn" style="font-size:12px;padding:6px 12px">🔄 Buscar Cotações de Comida</button>
        <button id="fetchFoodVolumes" class="ghost" style="font-size:12px;padding:6px 12px">📊 Buscar Histórico & VWAP</button>
      </div>
    </div>
    ${priceTable(itemsToShow, getFoodSaleLocs())}
  `;
}

function viewPrices() {
  const tabs = [
    ['ore', '⛏️ Minério'],
    ['bar', '🔩 Barras'],
    ['wood', '🪵 Madeira'],
    ['plank', '🪚 Tábuas'],
    ['art', '★ Artefatos & Emblemas'],
    ['gear', '⚔️ Equipamentos (venda)']
  ];
  let content = '';
  if (priceTab === 'ore') {
    content = `
      <div class="toolbar" style="margin-bottom:8px">
        <button class="ghost" id="fetchOreVolumes">📊 Buscar volumes & VWAP de minérios</button>
      </div>
      ${priceTable(BAR_KEYS.map(k => ({ id: oreId(k), label: `Minério T${k}` })), GD.cities)}`;
  }
  if (priceTab === 'bar') {
    content = `
      <div class="toolbar" style="margin-bottom:8px">
        <button class="ghost" id="fetchBarVolumes">📊 Buscar volumes & VWAP de barras</button>
      </div>
      ${priceTable(BAR_KEYS.map(k => ({ id: barId(k), label: `Barra T${k}` })), GD.cities)}`;
  }
  if (priceTab === 'wood') {
    content = `
      <div class="toolbar" style="margin-bottom:8px">
        <button class="ghost" id="fetchWoodVolumes">📊 Buscar volumes & VWAP de madeiras</button>
      </div>
      ${priceTable(BAR_KEYS.map(k => ({ id: woodId(k), label: `Madeira T${k}` })), GD.cities)}`;
  }
  if (priceTab === 'plank') {
    content = `
      <div class="toolbar" style="margin-bottom:8px">
        <button class="ghost" id="fetchPlankVolumes">📊 Buscar volumes & VWAP de tábuas</button>
      </div>
      ${priceTable(BAR_KEYS.map(k => ({ id: plankId(k), label: `Tábua T${k}` })), GD.cities)}`;
  }
  if (priceTab === 'art') {
    const rows = [];
    if (GD.royal) {
      for (const t of [4, 5, 6, 7, 8]) {
        const s = GD.royal.sigils[t];
        if (s) rows.push({ id: s.id, label: `👑 ${esc(s.name)} <span class="muted">T${t} · Emblema Real</span>` });
      }
    }
    for (const v of GD.variants) if (v.artifact) for (const p of piecesOf(v)) for (let t = 4; t <= 8; t++) {
      const a = artOf(v.code, p.slot, t);
      if (a) rows.push({ id: a.id, label: `${esc(a.name)} <span class="muted">T${t} · ${esc(v.name)} ${p.name}</span>` });
    }
    content = priceTable(rows, GD.cities);
  }
  if (priceTab === 'gear') {
    const g = gearFilter, rows = [];
    for (const v of GD.variants) if (v.code === g.variant) for (const p of piecesOf(v)) if (!g.piece || g.piece === p.slot)
      for (const k of TIERS) if (tv(k)[0] >= Number(g.tmin)) rows.push({ id: itemId(v.code, p.slot, k), label: `${v.name} · ${p.name} T${k}` });
    const curQ = Number(g.quality) || 1;
    const curV = variant(g.variant);
    const vCat = g.cat || (curV && curV.cat) || '';
    content = `<div class="toolbar">
      <label>Categoria<select data-gf="cat"><option value="">Todas</option>${catOpts(g.cat)}</select></label>
      <label>Item / Variante<select data-gf="variant">${variantOpts(g.variant, g.cat)}</select></label>
      <label>Peça / Tipo<select data-gf="piece"><option value="">Todas</option>${pieceOpts(g.piece, vCat)}</select></label>
      <label>Tier mínimo<select data-gf="tmin">${[4, 5, 6, 7, 8].map(t => opt(t, 'T' + t, g.tmin)).join('')}</select></label>
      <label>Qualidade<select data-gf="quality">
        ${QUALITIES.map(qObj => opt(qObj.q, `${qObj.short} · ${qObj.name}`, curQ)).join('')}
      </select></label>
      <button class="ghost" id="fetchGearVolumes" style="margin-top:14px">📊 Buscar volumes (desta seleção)</button>
    </div>
    ${priceTable(rows, GD.saleLocs, '<th>Demanda / dia</th><th>Saúde / Histórico</th>', r => `<td>${volBadge(getBestVol(r.id), '', r.id)}</td><td>${priceHealthBadge(bestSellForQuality(r.id, curQ)?.price, getBestVol(r.id), r.id)}</td>`, curQ)}`;
  }
  const last = ST.lastFetch ? new Date(ST.lastFetch).toLocaleString('pt-BR') : 'nunca';
  const cov = getCoverageStats();
  const freshnessMode = ST.config.fetchFreshness || 'smart_60';
  return `
  <h2>Preços</h2>
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <div><b>Buscar preços e volumes de mercado</b> <span class="muted">· Albion Data Project (coleta inteligente em lotes otimizados com retomada automática)</span></div>
      <div class="muted" style="font-size:12px">
        📊 Cobertura atual — <b>Preços:</b> ${cov.priced}/${cov.total} (${cov.pricePct}%) · <b>Volumes:</b> ${cov.volumed}/${cov.gearTotal} (${cov.volPct}%) · Última busca: ${last}
      </div>
    </div>
    <div class="toolbar" style="margin-top:8px">
      <label>Servidor<select data-cfg="server">${opt('west', 'Américas (West)', ST.config.server)}${opt('east', 'Ásia (East)', ST.config.server)}${opt('europe', 'Europa', ST.config.server)}</select></label>
      <label title="Evita gastar limite da API reconsultando itens que já foram atualizados há poucos minutos">Modo Coleta API<select data-cfg="fetchFreshness">
        ${opt('smart_60', '⚡ Inteligente: Faltantes ou > 1h (Recomendado)', freshnessMode)}
        ${opt('smart_15', '⚡ Rápido: Faltantes ou > 15 min', freshnessMode)}
        ${opt('smart_360', '🛡️ Econômico: Faltantes ou > 6h', freshnessMode)}
        ${opt('missing_only', '🎯 Só Faltantes (Apenas itens sem dados)', freshnessMode)}
        ${opt('force_all', '🔄 Forçar Tudo (Reconsultar do zero)', freshnessMode)}
      </select></label>
      <button class="btn" id="fetchAll" style="margin-top:14px" ${FETCHING ? 'disabled' : ''}>↻ Buscar todos os preços</button>
      <button class="ghost" id="fetchTab" style="margin-top:14px" ${FETCHING ? 'disabled' : ''}>↻ Buscar preços desta aba</button>
      <button class="btn" id="fetchGearVolumesAll" style="margin-top:14px" ${FETCHING ? 'disabled' : ''}>📊 Buscar todos os volumes</button>
      ${FETCHING ? '<button class="btn" id="cancelFetchBtn" style="margin-top:14px;background:#ef6b6b;color:#111">⏹ Parar busca</button>' : ''}
    </div>
    <div class="toolbar" style="margin-top:6px;padding-top:8px;border-top:1px solid #232836;gap:6px">
      <span class="muted" style="font-size:12px;margin-right:4px">⚡ Coleta rápida por categoria (economiza API):</span>
      <button class="ghost" id="fetchBaseMaterialsPrices" style="font-size:12px;padding:4px 10px" ${FETCHING ? 'disabled' : ''}>📦 Só Materiais & Artefatos (${cov.matPriced}/${cov.matTotal})</button>
      <button class="ghost" id="fetchCatPlate" style="font-size:12px;padding:4px 10px" ${FETCHING ? 'disabled' : ''}>🛡️ Só Placas (${cov.platePriced}/${cov.plateTotal})</button>
      <button class="ghost" id="fetchCatBow" style="font-size:12px;padding:4px 10px" ${FETCHING ? 'disabled' : ''}>🏹 Só Arcos (${cov.bowPriced}/${cov.bowTotal})</button>
      <button class="ghost" id="fetchCatCrossbow" style="font-size:12px;padding:4px 10px" ${FETCHING ? 'disabled' : ''}>🎯 Só Bestas (${cov.xbowPriced}/${cov.xbowTotal})</button>
    </div>
    <div class="muted" style="margin-top:6px">💡 <b>Por que a coleta inteligente não trava na API?</b> Materiais, artefatos e comidas são consultados apenas em Q1 (5× mais leve), equipamentos são divididos em lotes menores anti-timeout, e itens já consultados recentemente são pulados automaticamente para que cliques seguidos completem 100% da base sem repetir trabalho.</div>
  </div>
  <div class="subtabs">${tabs.map(([k, l]) => `<button data-ptab="${k}" class="${priceTab === k ? 'active' : ''}">${l}</button>`).join('')}</div>
  ${content}`;
}

/* ----- Config ----- */
function viewConfig() {
  const c = ST.config;
  const row = (key, label, help, isPct) => `<tr><td><b>${label}</b><div class="muted">${help}</div></td>
    <td><input class="num" type="number" step="${isPct ? '0.1' : '1'}" data-cfg="${key}" data-pct="${isPct ? 1 : 0}" data-fk="cfg-${key}" value="${isPct ? +(c[key] * 100).toFixed(2) : c[key]}"> ${isPct ? '%' : 'prata'}</td></tr>`;
  return `
  <h2>Configurações</h2>
  <div class="card"><table class="cfg">
    <tr><td><b>Precificação de Materiais</b><div class="muted">Protege contra ofertas falsas de 1 unidade no mercado (derrapagem/slippage).</div></td>
      <td><select data-cfg="materialPricing">
        ${opt('smart', '🛡️ Inteligente (Usa Preço Médio quando o menor preço for anormal)', c.materialPricing)}
        ${opt('vwap', '📊 Preço Médio Ponderado por Volume (VWAP - Mais seguro para lotes)', c.materialPricing)}
        ${opt('spot', '⚡ Menor Oferta Spot (Menor preço absoluto, mesmo se for 1 un.)', c.materialPricing)}
        ${opt('buffer5', '🛡️ Menor Oferta + 5% de margem', c.materialPricing)}
        ${opt('buffer10', '🛡️ Menor Oferta + 10% de margem', c.materialPricing)}
      </select></td></tr>
    <tr><td><b>Qualidade Padrão de Venda</b><div class="muted">Qualidade considerada para estimativa de receita nos equipamentos.</div></td>
      <td><select data-cfg="targetQuality">
        ${opt('mix', '⚡ Mix Real do Craft (~45% Q1, 42% Q2, 11% Q3, 2% Q4)', c.targetQuality)}
        ${opt('1', 'Q1 · Normal', c.targetQuality)}
        ${opt('2', 'Q2 · Bom', c.targetQuality)}
        ${opt('3', 'Q3 · Notável', c.targetQuality)}
        ${opt('4', 'Q4 · Excelente', c.targetQuality)}
        ${opt('5', 'Q5 · Obra-prima', c.targetQuality)}
        ${opt('best', '★ Maior Preço (Qualquer Qualidade)', c.targetQuality)}
      </select></td></tr>
    ${row('taxBuy', 'Taxa de compra', '0% comprando direto da oferta; 2,5% se criar ordem de compra.', true)}
    ${row('taxSell', 'Taxa total de venda', '6,5% com Premium (4% + 2,5% da ordem); 10,5% sem Premium. Vender direto em ordem de compra (ex.: Mercado Negro) = só 4% / 8%.', true)}
    ${row('retRefine', 'Retorno de recursos no REFINO', 'Ex.: 36,7% em cidade com bônus (Thetford p/ Minério, Fort Sterling p/ Madeira); 15,2% sem bônus; ~53,9% com foco.', true)}
    ${row('retCraft', 'Retorno de recursos no CRAFT', 'Ex.: 24,8% em cidade com bônus (Thetford p/ Placas, Lymhurst p/ Arcos, Bridgewatch p/ Bestas); 15,2% sem bônus; ~47,9% com foco.', true)}
    ${row('feeRefine', 'Taxa da fundição / serraria', 'Prata por 100 de nutrição (mostrada na estação).', false)}
    ${row('feeCraft', 'Taxa da forja / cabana do caçador', 'Prata por 100 de nutrição.', false)}
  </table></div>
  <div class="card muted">
    <b style="color:var(--text)">Como é calculado</b><br>
    • Taxa de estação = valor do item × 0,1125 × taxa ÷ 100 (não é devolvida pelo retorno).<br>
    • Valor do item da peça = (barras × valor da barra) + (tábuas × valor da tábua) + valor do artefato.<br>
    • Artefatos não retornam no craft (confirmado nos dados do jogo).<br>
    • Lucro = melhor preço de venda × (1 − taxa de venda) − custo total.<br>
    • Seus dados ficam salvos em <code>site/data.json</code>.
  </div>
  <div class="toolbar"><button class="ghost" id="exportBtn">⬇ Exportar backup (JSON)</button>
    <label class="ghost" style="flex-direction:row;cursor:pointer;color:var(--text)">⬆ Importar backup<input type="file" id="importFile" accept=".json" hidden></label></div>`;
}

/* ---------------- API de preços e volumes (Inteligente & Anti-Rate-Limit) ---------------- */
function baseMaterialAndArtIds() {
  const ids = new Set();
  BAR_KEYS.forEach(k => { ids.add(oreId(k)); ids.add(barId(k)); ids.add(woodId(k)); ids.add(plankId(k)); });
  Object.values(GD.artifacts).forEach(a => ids.add(a.id));
  if (GD.royal) Object.values(GD.royal.sigils).forEach(s => ids.add(s.id));
  return [...ids];
}
function categoryCraftIds(cat) {
  const ids = new Set();
  const needBars = (cat === 'plate' || cat === 'crossbow');
  const needPlanks = (cat === 'bow' || cat === 'crossbow');
  BAR_KEYS.forEach(k => {
    if (needBars) { ids.add(oreId(k)); ids.add(barId(k)); }
    if (needPlanks) { ids.add(woodId(k)); ids.add(plankId(k)); }
  });
  if (cat === 'plate' && GD.royal) {
    Object.values(GD.royal.sigils).forEach(s => ids.add(s.id));
  }
  for (const v of GD.variants) {
    if ((v.cat || 'plate') !== cat) continue;
    for (const p of piecesOf(v)) {
      for (let t = 4; t <= 8; t++) {
        if (v.artifact) {
          const a = artOf(v.code, p.slot, t);
          if (a) ids.add(a.id);
        }
      }
      for (const k of TIERS) ids.add(itemId(v.code, p.slot, k));
    }
  }
  return [...ids];
}
function allIds() {
  const ids = new Set(baseMaterialAndArtIds());
  for (const v of GD.variants) for (const p of piecesOf(v)) for (const k of TIERS) ids.add(itemId(v.code, p.slot, k));
  return [...ids];
}
function tabIds() {
  if (priceTab === 'ore') return BAR_KEYS.map(oreId);
  if (priceTab === 'bar') return BAR_KEYS.map(barId);
  if (priceTab === 'wood') return BAR_KEYS.map(woodId);
  if (priceTab === 'plank') return BAR_KEYS.map(plankId);
  if (priceTab === 'art') {
    const list = Object.values(GD.artifacts).map(a => a.id);
    if (GD.royal) list.push(...Object.values(GD.royal.sigils).map(s => s.id));
    return list;
  }
  const g = gearFilter, ids = [];
  for (const p of piecesOf(g.variant)) if (!g.piece || g.piece === p.slot) for (const k of TIERS) if (tv(k)[0] >= Number(g.tmin)) ids.push(itemId(g.variant, p.slot, k));
  return ids;
}
function planIds() {
  const ids = new Set();
  for (const r of ST.plan) {
    const v = variant(r.code) || GD.variants[0];
    let p = piece(r.slot);
    if (!p || (p.cat || 'plate') !== (v.cat || 'plate')) p = piecesOf(v)[0];
    const req = matReq(v, p);
    ids.add(itemId(r.code, p.slot, r.k));
    const [t] = tv(r.k);
    if (v && v.royal && GD.royal) {
      const sig = GD.royal.sigils[t];
      if (sig) ids.add(sig.id);
      for (const bCode of GD.royal.baseSets) ids.add(itemId(bCode, p.slot, r.k));
    } else {
      const a = (v && v.artifact) ? artOf(r.code, p.slot, t) : null;
      if (a) ids.add(a.id);
    }
    let k = r.k;
    while (k) {
      if (req.bars > 0 || (v && v.royal)) { ids.add(barId(k)); ids.add(oreId(k)); }
      if (req.planks > 0) { ids.add(plankId(k)); ids.add(woodId(k)); }
      k = lowerBar(k);
    }
  }
  return [...ids];
}
function rankPriceIds() {
  const f = rankFilter;
  const ids = new Set();
  let needBars = false, needPlanks = false, hasRoyal = false;
  for (const v of GD.variants) {
    if (f.cat && (v.cat || 'plate') !== f.cat) continue;
    if (f.variant && v.code !== f.variant) continue;
    for (const p of piecesOf(v)) {
      if (f.piece && p.slot !== f.piece) continue;
      const req = matReq(v, p);
      if (req.bars > 0 || v.royal) needBars = true;
      if (req.planks > 0) needPlanks = true;
      if (v.royal) hasRoyal = true;
      for (const k of TIERS) {
        const [t, e] = tv(k);
        if (f.tier && t !== Number(f.tier)) continue;
        if (f.ench !== '' && e !== Number(f.ench)) continue;
        ids.add(itemId(v.code, p.slot, k));
        if (v.artifact) {
          const a = artOf(v.code, p.slot, t);
          if (a) ids.add(a.id);
        }
        if (v.royal && GD.royal) {
          const sig = GD.royal.sigils[t];
          if (sig) ids.add(sig.id);
          for (const bCode of GD.royal.baseSets) ids.add(itemId(bCode, p.slot, k));
        }
      }
    }
  }
  BAR_KEYS.forEach(k => {
    if (needBars) { ids.add(oreId(k)); ids.add(barId(k)); }
    if (needPlanks) { ids.add(woodId(k)); ids.add(plankId(k)); }
  });
  return [...ids];
}
function foodIds() {
  const ids = new Set();
  if (GD.foods) {
    for (const f of GD.foods) {
      ids.add(f.id);
      for (const e of f.enchantments || []) {
        ids.add(e.id);
        if (e.sauceId) ids.add(e.sauceId);
      }
      for (const ing of f.ingredients || []) ids.add(ing.id);
    }
  }
  if (GD.butchering) {
    for (const b of GD.butchering) {
      ids.add(b.animalId);
      ids.add(b.meatId);
    }
  }
  if (GD.foodProcessing) {
    for (const p of GD.foodProcessing) {
      ids.add(p.id);
      ids.add(p.fromId);
    }
  }
  return [...ids];
}
function foodMealIds() {
  const ids = new Set();
  if (GD.foods) {
    for (const f of GD.foods) {
      ids.add(f.id);
      for (const e of f.enchantments || []) ids.add(e.id);
    }
  }
  return [...ids];
}

function hasAnyPrice(id) {
  const p = ST.prices && ST.prices[id];
  if (p && Object.values(p).some(v => v > 0)) return true;
  const qp = ST.qualityPrices && ST.qualityPrices[id];
  if (qp) {
    for (const qMap of Object.values(qp)) {
      if (qMap && Object.values(qMap).some(v => v > 0)) return true;
    }
  }
  return false;
}

function hasAnyVol(id) {
  const v = ST.volumes && ST.volumes[id];
  return !!(v && Object.keys(v).length > 0);
}

function getCoverageStats() {
  const all = allIds();
  const mats = baseMaterialAndArtIds();
  const gears = gearIds();
  const countPriced = arr => arr.filter(hasAnyPrice).length;
  const plateGears = [];
  const bowGears = [];
  const xbowGears = [];
  for (const v of GD.variants) {
    const cat = v.cat || 'plate';
    for (const p of piecesOf(v)) {
      for (const k of TIERS) {
        const id = itemId(v.code, p.slot, k);
        if (cat === 'plate') plateGears.push(id);
        else if (cat === 'bow') bowGears.push(id);
        else if (cat === 'crossbow') xbowGears.push(id);
      }
    }
  }
  const priced = countPriced(all);
  const volumed = gears.filter(hasAnyVol).length;
  return {
    total: all.length,
    priced,
    pricePct: all.length ? Math.round((priced / all.length) * 100) : 0,
    gearTotal: gears.length,
    volumed,
    volPct: gears.length ? Math.round((volumed / gears.length) * 100) : 0,
    matTotal: mats.length,
    matPriced: countPriced(mats),
    plateTotal: plateGears.length,
    platePriced: countPriced(plateGears),
    bowTotal: bowGears.length,
    bowPriced: countPriced(bowGears),
    xbowTotal: xbowGears.length,
    xbowPriced: countPriced(xbowGears),
  };
}

function getItemLastFetchedTs(id, isVol = false) {
  if (isVol) {
    const t = ST.volFetchedAt && ST.volFetchedAt[id];
    if (t) return t;
    return hasAnyVol(id) ? 1 : 0;
  } else {
    const t = ST.priceFetchedAt && ST.priceFetchedAt[id];
    if (t) return t;
    if (hasAnyPrice(id)) {
      const dates = ST.dates && ST.dates[id] ? Object.values(ST.dates[id]) : [];
      if (dates.length) {
        const maxD = Math.max(...dates.map(d => new Date(d + (String(d).endsWith('Z') ? '' : 'Z')).getTime() || 1));
        return maxD > 0 ? maxD : 1;
      }
      return 1;
    }
    return 0;
  }
}

function filterAndPrioritizeIds(ids, isVol = false, forceAll = false) {
  const unique = [...new Set(ids)];
  const mode = forceAll ? 'force_all' : (ST.config.fetchFreshness || 'smart_60');
  const now = Date.now();

  // Para buscas pequenas e pontuais (<= 35 itens, ex: aba Minério ou Plano curto), sempre consulta todos os itens pedidos
  const isSmallTargetedFetch = unique.length <= 35;

  let filtered = unique;
  if (!isSmallTargetedFetch && mode !== 'force_all') {
    if (mode === 'missing_only') {
      filtered = unique.filter(id => !(isVol ? hasAnyVol(id) : hasAnyPrice(id)));
    } else {
      const maxAgeMin = mode === 'smart_15' ? 15 : mode === 'smart_360' ? 360 : 60;
      const cutoff = now - maxAgeMin * 60 * 1000;
      filtered = unique.filter(id => {
        const hasData = isVol ? hasAnyVol(id) : hasAnyPrice(id);
        const fetchedAt = isVol ? (ST.volFetchedAt && ST.volFetchedAt[id]) : (ST.priceFetchedAt && ST.priceFetchedAt[id]);
        if (!hasData && (!fetchedAt || fetchedAt < cutoff)) return true;
        if (!fetchedAt) return true;
        return fetchedAt < cutoff;
      });
    }
  }

  // Se todos os itens já estavam recentes pelo filtro, avisa e prioriza os mais antigos caso o usuário queira forçar
  const skippedCount = unique.length - filtered.length;

  // Ordena por prioridade:
  // 1º: Itens sem nenhum preço/volume salvo e nunca consultados
  // 2º: Materiais/Artefatos antes de equipamentos (garante que o cálculo de custo funcione imediatamente!)
  // 3º: Itens consultados há mais tempo (menor timestamp)
  const isMatOrArt = id => /^(T\d+_(ORE|METALBAR|WOOD|PLANKS)|.*ARTEFACT.*|.*TOKEN_ROYAL.*)$/.test(id);
  filtered.sort((a, b) => {
    const hasA = isVol ? hasAnyVol(a) : hasAnyPrice(a);
    const hasB = isVol ? hasAnyVol(b) : hasAnyPrice(b);
    if (hasA !== hasB) return hasA ? 1 : -1;
    const matA = isMatOrArt(a);
    const matB = isMatOrArt(b);
    if (matA !== matB) return matA ? -1 : 1;
    const tsA = getItemLastFetchedTs(a, isVol);
    const tsB = getItemLastFetchedTs(b, isVol);
    return tsA - tsB;
  });

  return { list: filtered, skippedCount, totalRequested: unique.length };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
let FETCHING = false;
let CANCEL_FETCH = false;

function cancelActiveFetch() {
  if (!FETCHING) return;
  CANCEL_FETCH = true;
  toast('⏹ Parando busca após concluir o lote atual… Todos os dados já recebidos foram salvos!', 4000);
}

function chunkIds(ids, maxLen = 2000) {
  const out = []; let cur = [], len = 0;
  for (const id of ids) {
    if (cur.length && len + id.length + 3 > maxLen) { out.push(cur); cur = []; len = 0; }
    cur.push(id); len += id.length + 3;
  }
  if (cur.length) out.push(cur);
  return out;
}

function classifyPriceItem(id) {
  if (/^(T\d+_(ORE|METALBAR|WOOD|PLANKS)|.*ARTEFACT.*|.*TOKEN_ROYAL.*)$/.test(id)) return 'material';
  if (id.includes('_MEAL_') || id.includes('_MEAT') || id.includes('_FARM_') || id.includes('FISHSAUCE') || id.includes('FLOUR') || id.includes('BREAD') || id.includes('BUTTER') || /^(T\d+_(CARROT|BEAN|WHEAT|TURNIP|CABBAGE|POTATO|CORN|PUMPKIN|EGG|MILK))/.test(id)) return 'food';
  return 'gear';
}

async function fetchPriceChunkWithSplit(ch, locs, qualities, progressLabel) {
  if (CANCEL_FETCH) return [];
  const url = `/api/prices?server=${ST.config.server}&items=${encodeURIComponent(ch.join(','))}&locations=${encodeURIComponent(locs)}&qualities=${encodeURIComponent(qualities)}`;
  for (let attempt = 1; attempt <= 10; attempt++) {
    if (CANCEL_FETCH) return [];
    let r, data;
    try {
      r = await fetch(url);
      data = await r.json().catch(() => ({ error: 'resposta inválida' }));
    } catch (netErr) {
      r = { ok: false, status: 503 };
      data = { error: netErr.message };
    }
    if (r.ok && Array.isArray(data)) return data;

    // Se o servidor da API retornou erro de tamanho/timeout (414, 502, 503, 504) e o lote tem > 6 itens, divide o lote ao meio!
    if ((r.status === 414 || r.status === 502 || r.status === 503 || r.status === 504) && ch.length > 6 && attempt >= 2) {
      const mid = Math.ceil(ch.length / 2);
      toast(`⚡ Dividindo lote grande (${ch.length} → ${mid}+${ch.length - mid} itens) para evitar timeout… ${progressLabel}`, 4000);
      await sleep(1200);
      const left = await fetchPriceChunkWithSplit(ch.slice(0, mid), locs, qualities, progressLabel + ' [A]');
      if (CANCEL_FETCH) return left;
      await sleep(1400);
      const right = await fetchPriceChunkWithSplit(ch.slice(mid), locs, qualities, progressLabel + ' [B]');
      return [...left, ...right];
    }

    if (r.status === 429 || r.status === 502 || r.status === 503 || r.status === 504) {
      let wait = Number(data && data.retryAfter) || Math.min(12 * attempt, 65);
      for (; wait > 0; wait--) {
        if (CANCEL_FETCH) return [];
        toast(`⏳ Limite/sobrecarga da API (${r.status}) — retomando em ${wait}s (tentativa ${attempt}/10)… ${progressLabel}`, 2000);
        await sleep(1000);
      }
      continue;
    }
    throw new Error((data && data.error) || `HTTP ${r.status}`);
  }
  throw new Error('Limite da API persistiu após várias tentativas; aguarde 1 minuto e clique novamente (o progresso já foi salvo!).');
}

async function fetchPrices(ids, opts = {}) {
  if (!ids || !ids.length) return toast('Nenhum item selecionado para buscar preços.');
  if (FETCHING) return toast('Já existe uma busca em andamento…');

  const { list, skippedCount, totalRequested } = filterAndPrioritizeIds(ids, false, opts.forceAll);
  if (!list.length) {
    return toast(`✓ Todos os ${totalRequested} itens já foram consultados recentemente! (Mude "Modo Coleta API" para "Forçar Tudo" se quiser reconsultar).`, 6000);
  }

  FETCHING = true;
  CANCEL_FETCH = false;
  ST.priceFetchedAt = ST.priceFetchedAt || {};
  render();

  // Separa os itens por perfil de consulta na API:
  // 1. Materiais/Artefatos/Emblemas -> Apenas Q1 e apenas nas 5 Cidades Reais (5x mais leve!)
  // 2. Comidas/Ingredientes -> Apenas Q1 em todas as praças
  // 3. Equipamentos (Placas/Arcos/Bestas) -> Q1 a Q5 em todas as praças, em lotes menores (1400 chars) anti-timeout
  const matIds = [], foodItemIds = [], equipIds = [];
  for (const id of list) {
    const kind = classifyPriceItem(id);
    if (kind === 'material') matIds.push(id);
    else if (kind === 'food') foodItemIds.push(id);
    else equipIds.push(id);
  }

  const jobs = [];
  for (const ch of chunkIds(matIds, 2400)) {
    jobs.push({ ch, locs: GD.cities.join(','), qualities: '1', label: 'Materiais/Artefatos' });
  }
  for (const ch of chunkIds(foodItemIds, 2200)) {
    jobs.push({ ch, locs: getFoodSaleLocs().join(','), qualities: '1', label: 'Culinária' });
  }
  for (const ch of chunkIds(equipIds, 1450)) {
    jobs.push({ ch, locs: GD.saleLocs.join(','), qualities: '1,2,3,4,5', label: 'Equipamentos Q1-Q5' });
  }

  let got = 0, done = 0, rejectedOutliers = 0;
  try {
    for (let i = 0; i < jobs.length; i++) {
      if (CANCEL_FETCH) break;
      const job = jobs[i];
      const progress = `lote ${i + 1}/${jobs.length} · ${job.label}`;
      const skipMsg = skippedCount > 0 ? ` [${skippedCount} recentes pulados]` : '';
      toast(`🔄 Buscando preços… ${Math.round(done / list.length * 100)}% (${progress})${skipMsg}`, 60000);

      const data = await fetchPriceChunkWithSplit(job.ch, job.locs, job.qualities, progress);
      if (CANCEL_FETCH && !data.length) break;

      const nowTs = Date.now();
      for (const id of job.ch) ST.priceFetchedAt[id] = nowTs;

      // Pré-calcula mediana por item no lote para filtrar preços absurdos/contaminados da API (ex: última página ou ordens 9.99M)
      const batchItemStats = {};
      for (const e of data) {
        if (!e || !e.item_id || e.city === 'Black Market') continue;
        const p = e.sell_price_min || 0;
        if (p > 0) {
          (batchItemStats[e.item_id] = batchItemStats[e.item_id] || []).push(p);
        }
      }
      const batchRefMap = {};
      const estMealCost = id => {
        if (!id || !id.includes('_MEAL_') || !GD || !GD.foods) return null;
        const [baseId, enchStr] = id.split('@');
        const ench = enchStr ? Number(enchStr) : 0;
        const f = GD.foods.find(x => x.id === baseId);
        if (!f) return null;
        const ingCnt = (f.ingredients || []).reduce((s, x) => s + (x.count || 0), 0);
        const baseCost = (ingCnt * 410 * (1 - 0.248) + (f.batchIv || 400) * 0.1125 * 4.65) / 10;
        if (!ench) return Math.round(baseCost);
        const ed = (f.enchantments || []).find(x => x.level === ench);
        const sauceUnit = ench === 1 ? 4700 : ench === 2 ? 14800 : 42000;
        return Math.round(baseCost + ((ed ? ed.sauceCount : 10) * sauceUnit) / 10);
      };
      for (const [id, arr] of Object.entries(batchItemStats)) {
        arr.sort((a, b) => a - b);
        const lowMed = arr[Math.floor((arr.length - 1) / 2)];
        const vMap = (ST.volumes && ST.volumes[id]) || {};
        const vwaps = Object.entries(vMap)
          .filter(([c, d]) => c !== 'Black Market' && d && d.vwap > 0 && (d.daily || 0) >= 0.2)
          .map(([, d]) => d.vwap)
          .sort((a, b) => a - b);
        const medVwap = vwaps.length > 0 ? vwaps[Math.floor((vwaps.length - 1) / 2)] : null;
        const estCost = estMealCost(id);
        const rawAnchor = (lowMed && medVwap) ? Math.min(lowMed, medVwap * 1.25) : (medVwap || lowMed);
        const anchor = estCost ? Math.max(rawAnchor || 0, estCost) : rawAnchor;
        batchRefMap[id] = {
          lowMed,
          medVwap,
          estCost,
          anchor,
          count: arr.length
        };
      }

      for (const e of data) {
        const kind = classifyPriceItem(e.item_id);
        const loc = e.city;
        if (!GD.saleLocs.includes(loc)) continue;
        if (kind === 'material' && !GD.cities.includes(loc)) continue;
        if (kind === 'food' && loc === 'Black Market') continue;
        let price = e.sell_price_min, date = e.sell_price_min_date;
        if (loc === 'Black Market') { price = e.buy_price_max; date = e.buy_price_max_date; }
        const q = String(e.quality || 1);

        if (kind === 'food' || kind === 'material') {
          const bStat = batchRefMap[e.item_id];
          const anchor = bStat ? bStat.anchor : null;
          const lowMed = bStat ? bStat.lowMed : null;
          const estCost = bStat ? bStat.estCost : null;
          const isSingleOrderPage = (e.sell_price_min > 0 && e.sell_price_min === e.sell_price_max);
          const isBasicIng = /^(T\d+_(CARROT|BEAN|WHEAT|TURNIP|CABBAGE|POTATO|CORN|PUMPKIN|EGG|MILK|MEAT|FLOUR|BREAD|BUTTER))$/.test(e.item_id);
          const isSauce3 = e.item_id === 'T1_FISHSAUCE_LEVEL3';

          if (price > 0) {
            let isOutlier = false;
            if (isBasicIng) {
              isOutlier = price > 2500;
            } else if (isSauce3) {
              isOutlier = price > 140000;
            } else {
              isOutlier = !!(
                (anchor && bStat.count >= 2 && price > anchor * 1.95 && price > (lowMed || anchor) * 1.85)
                || (anchor && isSingleOrderPage && price > anchor * 1.65)
                || (estCost && price > estCost * 2.5)
              );
            }

            if (isOutlier) {
              rejectedOutliers++;
              // Se havia valor contaminado salvo nessa cidade, remove
              if (ST.prices[e.item_id] && ST.prices[e.item_id][loc] && anchor && ST.prices[e.item_id][loc] > anchor * 1.75) {
                delete ST.prices[e.item_id][loc];
                if (ST.qualityPrices?.[e.item_id]?.[q]) delete ST.qualityPrices[e.item_id][q][loc];
              }
              continue;
            }
          } else if (price === 0 && anchor && ST.prices[e.item_id] && ST.prices[e.item_id][loc] > anchor * 1.75) {
            // Limpa preço fantasma antigo caso a API retorne 0 para a cidade
            delete ST.prices[e.item_id][loc];
            if (ST.qualityPrices?.[e.item_id]?.[q]) delete ST.qualityPrices[e.item_id][q][loc];
            continue;
          }
        }

        if (price > 0) {
          ST.qualityPrices = ST.qualityPrices || {};
          ST.qualityPrices[e.item_id] = ST.qualityPrices[e.item_id] || {};
          ST.qualityPrices[e.item_id][q] = ST.qualityPrices[e.item_id][q] || {};
          ST.qualityPrices[e.item_id][q][loc] = price;

          ST.qualityDates = ST.qualityDates || {};
          ST.qualityDates[e.item_id] = ST.qualityDates[e.item_id] || {};
          ST.qualityDates[e.item_id][q] = ST.qualityDates[e.item_id][q] || {};
          ST.qualityDates[e.item_id][q][loc] = date;

          if (q === '1' || !ST.prices[e.item_id] || !ST.prices[e.item_id][loc]) {
            ST.prices[e.item_id] = ST.prices[e.item_id] || {};
            ST.prices[e.item_id][loc] = price;
            ST.dates[e.item_id] = ST.dates[e.item_id] || {};
            ST.dates[e.item_id][loc] = date;
          }
          got++;
        }
      }
      done += job.ch.length;
      ST.lastFetch = new Date().toISOString();
      save();
      if (i < jobs.length - 1 && !CANCEL_FETCH) await sleep(1650);
    }
    const outlierMsg = rejectedOutliers > 0 ? ` · 🛡️ ${rejectedOutliers} preço(s) inflado(s)/troll descartado(s)` : '';
    if (CANCEL_FETCH) {
      toast(`⏹ Busca pausada pelo usuário: ${got} cotações salvas (${done}/${list.length} itens processados)${outlierMsg}.`, 6000);
    } else {
      toast(`✓ ${got} preços atualizados (${done} itens consultados${skippedCount ? `, ${skippedCount} recentes mantidos` : ''})${outlierMsg}.`, 5500);
    }
  } catch (err) {
    toast(`⚠️ ${err.message} (${got} preços obtidos em ${done}/${list.length} itens foram salvos; clique novamente para continuar de onde parou!).`, 9000);
  } finally {
    FETCHING = false;
    CANCEL_FETCH = false;
    changed();
  }
}

/* ---------------- API de volume e histórico ---------------- */
function gearIds() {
  const ids = [];
  for (const v of GD.variants) for (const p of piecesOf(v)) for (const k of TIERS) ids.push(itemId(v.code, p.slot, k));
  return ids;
}
function oreIds() { return BAR_KEYS.map(oreId); }
function barIds() { return BAR_KEYS.map(barId); }
function woodIds() { return BAR_KEYS.map(woodId); }
function plankIds() { return BAR_KEYS.map(plankId); }
function materialIds() { return [...oreIds(), ...barIds(), ...woodIds(), ...plankIds()]; }
function planAllIds() {
  const ids = new Set();
  for (const r of ST.plan) {
    const v = variant(r.code) || GD.variants[0];
    let p = piece(r.slot);
    if (!p || (p.cat || 'plate') !== (v.cat || 'plate')) p = piecesOf(v)[0];
    const req = matReq(v, p);
    ids.add(itemId(r.code, p.slot, r.k));
    let k = r.k;
    while (k) {
      if (req.bars > 0 || (v && v.royal)) { ids.add(barId(k)); ids.add(oreId(k)); }
      if (req.planks > 0) { ids.add(plankId(k)); ids.add(woodId(k)); }
      k = lowerBar(k);
    }
  }
  return [...ids];
}
function planGearIds() {
  const ids = new Set();
  for (const r of ST.plan) ids.add(itemId(r.code, r.slot, r.k));
  return [...ids];
}
function rankGearIds() {
  const f = rankFilter;
  const ids = [];
  for (const v of GD.variants) {
    if (f.cat && (v.cat || 'plate') !== f.cat) continue;
    if (f.variant && v.code !== f.variant) continue;
    for (const p of piecesOf(v)) {
      if (f.piece && p.slot !== f.piece) continue;
      for (const k of TIERS) {
        if (f.tier && tv(k)[0] !== Number(f.tier)) continue;
        if (f.ench !== '' && tv(k)[1] !== Number(f.ench)) continue;
        ids.push(itemId(v.code, p.slot, k));
      }
    }
  }
  return ids;
}
function currentGearTabIds() {
  const g = gearFilter, ids = [];
  for (const p of piecesOf(g.variant)) if (!g.piece || g.piece === p.slot)
    for (const k of TIERS) if (tv(k)[0] >= Number(g.tmin)) ids.push(itemId(g.variant, p.slot, k));
  return ids;
}

async function fetchHistoryChunkWithSplit(ch, locs, progressLabel) {
  if (CANCEL_FETCH) return [];
  const url = `/api/history?server=${ST.config.server}&items=${encodeURIComponent(ch.join(','))}&locations=${encodeURIComponent(locs)}`;
  for (let attempt = 1; attempt <= 10; attempt++) {
    if (CANCEL_FETCH) return [];
    let r, data;
    try {
      r = await fetch(url);
      data = await r.json().catch(() => ({ error: 'resposta inválida' }));
    } catch (netErr) {
      r = { ok: false, status: 503 };
      data = { error: netErr.message };
    }
    if (r.ok && Array.isArray(data)) return data;

    // Se o lote de histórico deu timeout (502/503/504) ou URL longa (414) e tem > 5 itens, divide ao meio!
    if ((r.status === 414 || r.status === 502 || r.status === 503 || r.status === 504) && ch.length > 5 && attempt >= 2) {
      const mid = Math.ceil(ch.length / 2);
      toast(`⚡ Dividindo lote de histórico (${ch.length} → ${mid}+${ch.length - mid} itens) para evitar timeout… ${progressLabel}`, 4000);
      await sleep(1500);
      const left = await fetchHistoryChunkWithSplit(ch.slice(0, mid), locs, progressLabel + ' [A]');
      if (CANCEL_FETCH) return left;
      await sleep(1800);
      const right = await fetchHistoryChunkWithSplit(ch.slice(mid), locs, progressLabel + ' [B]');
      return [...left, ...right];
    }

    if (r.status === 429 || r.status === 502 || r.status === 503 || r.status === 504) {
      let wait = Number(data && data.retryAfter) || Math.min(15 * attempt, 70);
      for (; wait > 0; wait--) {
        if (CANCEL_FETCH) return [];
        toast(`⏳ Limite da API de Histórico (${r.status}) — aguardando ${wait}s (tentativa ${attempt}/10)… ${progressLabel}`, 2000);
        await sleep(1000);
      }
      continue;
    }
    throw new Error((data && data.error) || `HTTP ${r.status}`);
  }
  throw new Error('Limite da API de histórico persistiu; aguarde 1 minuto e clique novamente para continuar de onde parou.');
}

async function fetchVolumes(ids, opts = {}) {
  if (!ids || !ids.length) return toast('Nenhum item selecionado para buscar volume.');
  if (FETCHING) return toast('Já existe uma busca em andamento…');

  const { list, skippedCount, totalRequested } = filterAndPrioritizeIds(ids, true, opts.forceAll);
  if (!list.length) {
    return toast(`✓ Todos os ${totalRequested} itens já tiveram volume consultado recentemente! (Use "Forçar Tudo" se quiser atualizar novamente).`, 6000);
  }

  FETCHING = true;
  CANCEL_FETCH = false;
  ST.volFetchedAt = ST.volFetchedAt || {};
  render();

  const locs = GD.saleLocs.join(',');
  let got = 0, done = 0;
  // Lotes menores (750 chars ≈ 28-32 itens) evitam 502/504 Gateway Timeout e 429 no endpoint /stats/history/
  const chunks = chunkIds(list, 750);
  try {
    for (let i = 0; i < chunks.length; i++) {
      if (CANCEL_FETCH) break;
      const ch = chunks[i];
      const progress = `lote ${i + 1}/${chunks.length}`;
      const skipMsg = skippedCount > 0 ? ` [${skippedCount} recentes pulados]` : '';
      toast(`📊 Buscando volumes diários & VWAP… ${Math.round(done / list.length * 100)}% (${progress})${skipMsg}`, 60000);

      const data = await fetchHistoryChunkWithSplit(ch, locs, progress);
      if (CANCEL_FETCH && !data.length) break;

      const nowTs = Date.now();
      for (const id of ch) ST.volFetchedAt[id] = nowTs;

      if (Array.isArray(data)) {
        for (const entry of data) {
          const itemId = entry.item_id;
          const loc = entry.location;
          if (classifyPriceItem(itemId) === 'food' && loc === 'Black Market') continue;
          const summary = calcVolumeSummary(entry.data);
          if (summary) {
            ST.volumes[itemId] = ST.volumes[itemId] || {};
            ST.volumes[itemId][loc] = summary;
            got++;
          }
        }
      }
      done += ch.length;
      save();
      if (i < chunks.length - 1 && !CANCEL_FETCH) await sleep(2100);
    }
    if (CANCEL_FETCH) {
      toast(`⏹ Busca de volumes pausada: ${got} séries salvas (${done}/${list.length} itens verificados). Clique novamente quando quiser continuar!`, 6000);
    } else {
      toast(`✓ Volumes e VWAP de ${got} séries atualizados (${done} itens verificados${skippedCount ? `, ${skippedCount} recentes mantidos` : ''}).`, 5000);
    }
  } catch (err) {
    toast(`⚠️ ${err.message} (${got} séries obtidas em ${done}/${list.length} itens foram salvas; clique novamente para continuar de onde parou!).`, 9000);
  } finally {
    FETCHING = false;
    CANCEL_FETCH = false;
    changed();
  }
}

/* ---------------- modal de histórico e análise ---------------- */
function renderHistorySvg(series, spotPrice, vwap) {
  if (!series || !series.length) {
    return `<div class="empty">Nenhum dado diário registrado nos últimos 28 dias.</div>`;
  }

  const svgW = 760, svgH = 185;
  const padL = 60, padR = 40, padT = 20, padB = 30;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const allPrices = series.map(s => s.avg);
  if (spotPrice && spotPrice > 0) allPrices.push(spotPrice);
  if (vwap && vwap > 0) allPrices.push(vwap);

  const minP = Math.min(...allPrices);
  const maxP = Math.max(...allPrices);
  const pDiff = (maxP - minP) || (minP * 0.1) || 100;
  const yMin = Math.max(0, Math.floor(minP - pDiff * 0.12));
  const yMax = Math.ceil(maxP + pDiff * 0.12);

  const maxVol = Math.max(...series.map(s => s.count), 1);

  const getYPrice = p => padT + plotH - ((p - yMin) / (yMax - yMin || 1)) * plotH;
  const getX = idx => series.length === 1 ? padL + plotW / 2 : padL + (idx / (series.length - 1)) * plotW;
  const getBarH = v => (v / maxVol) * (plotH * 0.45);

  let gridLines = '';
  const nGrid = 4;
  for (let i = 0; i <= nGrid; i++) {
    const val = yMin + ((yMax - yMin) / nGrid) * i;
    const y = getYPrice(val);
    gridLines += `<line x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}" stroke="#262d3d" stroke-dasharray="3,3" stroke-width="1"/>`;
    gridLines += `<text x="${padL - 8}" y="${y + 4}" fill="#788299" font-size="10" text-anchor="end">${fmt(Math.round(val))}</text>`;
  }

  let volBars = '';
  const barW = Math.max(4, Math.min(20, (plotW / series.length) * 0.65));
  series.forEach((s, i) => {
    const x = getX(i) - barW / 2;
    const h = Math.max(2, getBarH(s.count));
    const y = padT + plotH - h;
    volBars += `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="#335073" rx="2" opacity="0.75"><title>${s.date}: ${fmt(s.count)} un. vendidas</title></rect>`;
  });

  let linePoints = [];
  let dots = '';
  series.forEach((s, i) => {
    const x = getX(i);
    const y = getYPrice(s.avg);
    linePoints.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="#4cc38a" stroke="#151821" stroke-width="1.5"><title>${s.date}: Preço Médio ${fmt(s.avg)}s (${fmt(s.count)} un)</title></circle>`;
  });

  const polyline = `<polyline points="${linePoints.join(' ')}" fill="none" stroke="#4cc38a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;

  let refLines = '';
  if (vwap && vwap >= yMin && vwap <= yMax) {
    const yV = getYPrice(vwap);
    refLines += `<line x1="${padL}" y1="${yV}" x2="${padL + plotW}" y2="${yV}" stroke="#f0c04b" stroke-dasharray="4,4" stroke-width="1.5"/>`;
    refLines += `<text x="${padL + plotW + 4}" y="${yV + 3}" fill="#f0c04b" font-size="10" font-weight="bold">VWAP ${fmt(vwap)}</text>`;
  }

  if (spotPrice && spotPrice >= yMin && spotPrice <= yMax) {
    const yS = getYPrice(spotPrice);
    refLines += `<line x1="${padL}" y1="${yS}" x2="${padL + plotW}" y2="${yS}" stroke="#ef6b6b" stroke-dasharray="3,3" stroke-width="2"/>`;
    refLines += `<text x="${padL + plotW + 4}" y="${yS + 3}" fill="#ef6b6b" font-size="10" font-weight="bold">Spot ${fmt(spotPrice)}</text>`;
  }

  let dateLabels = '';
  if (series.length > 0) {
    const firstDate = series[0].date.slice(5);
    const lastDate = series[series.length - 1].date.slice(5);
    dateLabels += `<text x="${padL}" y="${padT + plotH + 18}" fill="#788299" font-size="10" text-anchor="start">${firstDate}</text>`;
    if (series.length > 2) {
      const midIdx = Math.floor(series.length / 2);
      const midDate = series[midIdx].date.slice(5);
      dateLabels += `<text x="${getX(midIdx)}" y="${padT + plotH + 18}" fill="#788299" font-size="10" text-anchor="middle">${midDate}</text>`;
    }
    dateLabels += `<text x="${padL + plotW}" y="${padT + plotH + 18}" fill="#788299" font-size="10" text-anchor="end">${lastDate}</text>`;
  }

  return `
    <svg viewBox="0 0 ${svgW} ${svgH}" class="chart-svg" style="width:100%;height:185px;display:block">
      ${gridLines}
      ${volBars}
      ${polyline}
      ${dots}
      ${refLines}
      ${dateLabels}
    </svg>
  `;
}

function openHistoryModal(itemId, preferredLoc) {
  if (!itemId) return;
  histModalState.itemId = itemId;
  histModalState.loc = preferredLoc || histModalState.loc || 'Black Market';
  const modal = $('#histModal');
  if (modal) modal.classList.remove('hidden');
  renderHistoryModal();
}

function closeHistoryModal() {
  const modal = $('#histModal');
  if (modal) modal.classList.add('hidden');
}

function renderHistoryModal() {
  const id = histModalState.itemId;
  if (!id) return closeHistoryModal();

  const info = getItemDisplayInfo(id);
  const isGear = id.startsWith('T') && (id.includes('PLATE') || id.includes('BOW') || id.includes('CROSSBOW'));
  const locs = isGear ? GD.saleLocs : GD.cities;
  if (!locs.includes(histModalState.loc)) histModalState.loc = locs[0];

  const curLoc = histModalState.loc;
  const spotPrice = getQP(id, curLoc, 1) || getP(id, curLoc);
  const vol = getVol(id, curLoc);
  const health = analyzePriceHealth(spotPrice, vol);

  const headerEl = $('#histHeader');
  if (headerEl) {
    headerEl.innerHTML = `
      <img src="${itemIconUrl(id, 1)}" class="hist-icon" onerror="this.style.display='none'">
      <div>
        <div style="display:flex;align-items:center;gap:8px">
          <span>${esc(info.name)}</span>
          <span class="tag">${esc(info.tier)}</span>
        </div>
        <div class="muted" style="font-size:12px;font-weight:normal">${esc(info.sub)} · ID: <code>${esc(id)}</code></div>
      </div>
    `;
  }

  const bodyEl = $('#histBody');
  if (!bodyEl) return;

  const tabsHtml = `
    <div class="hist-tabs">
      ${locs.map(l => `<button class="hist-tab ${l === curLoc ? 'active' : ''}" data-hist-tab="${l}">${locName(l)}</button>`).join('')}
    </div>
  `;

  const bannerHtml = `
    <div class="health-banner ${health.status}">
      <div class="hb-icon">${health.icon}</div>
      <div>
        <div class="hb-title">${esc(health.title)}</div>
        <div class="hb-desc">${esc(health.desc)}</div>
      </div>
    </div>
  `;

  const diffStr = health.diffPct !== null ? `${health.diffPct >= 0 ? '+' : ''}${health.diffPct}% vs VWAP` : '—';
  const spotValCls = health.diffPct && health.diffPct >= 25 ? 'neg' : (health.diffPct && health.diffPct <= -25 ? 'pos' : '');

  const gridHtml = `
    <div class="hist-grid">
      <div class="hist-stat">
        <div class="lbl">Preço de Mercado Atual (Spot)</div>
        <div class="val ${spotValCls}">${spotPrice ? fmt(spotPrice) + 's' : 'Sem oferta'}</div>
        <div class="sub">${diffStr}</div>
      </div>
      <div class="hist-stat">
        <div class="lbl">Preço Médio Ponderado (VWAP 28d)</div>
        <div class="val" style="color:var(--accent)">${vol && (vol.vwap28 || vol.vwap) ? fmt(vol.vwap28 || vol.vwap) + 's' : '—'}</div>
        <div class="sub">Média real ponderada por volume</div>
      </div>
      <div class="hist-stat">
        <div class="lbl">VWAP Recente (Últimos 7 dias)</div>
        <div class="val">${vol && vol.vwap7 ? fmt(vol.vwap7) + 's' : '—'}</div>
        <div class="sub">${vol && vol.total7 ? fmt(vol.total7) + ' un. vendidas em 7d' : 'Pouco movimento recente'}</div>
      </div>
      <div class="hist-stat">
        <div class="lbl">Demanda Diária Média</div>
        <div class="val">${vol && vol.daily !== undefined ? fmt(vol.daily, 1) + ' un/dia' : '—'}</div>
        <div class="sub">${vol && vol.total28 ? 'Total 28d: ' + fmt(vol.total28) + ' un.' : 'Sem compras registradas'}</div>
      </div>
      <div class="hist-stat">
        <div class="lbl">Faixa de Preço (Min - Max)</div>
        <div class="val">${vol && vol.minPrice && vol.maxPrice ? fmt(vol.minPrice) + ' - ' + fmt(vol.maxPrice) + 's' : '—'}</div>
        <div class="sub">${vol && vol.volatility ? 'Oscilação: ±' + vol.volatility + '%' : 'Sem oscilação registrada'}</div>
      </div>
      <div class="hist-stat">
        <div class="lbl">Última Venda Registrada</div>
        <div class="val">${vol && vol.lastDate ? vol.lastDate : '—'}</div>
        <div class="sub">${vol && vol.daysSinceLast !== undefined && vol.daysSinceLast < 900 ? `há ${vol.daysSinceLast} dia(s)` : 'Sem registro'}</div>
      </div>
    </div>
  `;

  let chartHtml = '';
  if (vol && vol.series && vol.series.length > 0) {
    chartHtml = `
      <div class="chart-card">
        <div class="chart-head">
          <h4>📈 Histórico Diário de Volume e Preço Médio (Últimos 28 dias)</h4>
          <div class="chart-legend">
            <span><span class="leg-dot" style="background:#4cc38a"></span> Preço Médio Diário</span>
            <span><span class="leg-dot" style="background:#f0c04b"></span> VWAP Histórico</span>
            ${spotPrice ? '<span><span class="leg-dot" style="background:#ef6b6b"></span> Spot Atual</span>' : ''}
            <span><span class="leg-dot" style="background:#335073"></span> Volume Vendido</span>
          </div>
        </div>
        ${renderHistorySvg(vol.series, spotPrice, vol.vwap)}
      </div>
    `;
  } else {
    chartHtml = `
      <div class="chart-card" style="text-align:center;padding:24px">
        <p class="muted" style="margin-bottom:12px">Os dados detalhados dia a dia para este item ainda não estão carregados na memória local.</p>
        <button class="btn" id="fetchSingleHistBtn" data-item-id="${esc(id)}">⚡ Atualizar Histórico Detalhado Deste Item</button>
      </div>
    `;
  }

  let tableHtml = '';
  if (vol && vol.series && vol.series.length > 0) {
    tableHtml = `
      <div class="card" style="margin:0">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <h4 style="margin:0;font-size:13px;color:var(--text)">📅 Detalhamento das Transações Diárias</h4>
          <button class="ghost" id="fetchSingleHistBtn" data-item-id="${esc(id)}" style="font-size:11px;padding:3px 8px">↻ Atualizar Agora</button>
        </div>
        <div class="tablewrap" style="max-height:220px">
          <table>
            <tr><th class="l">Data</th><th>Unidades Vendidas</th><th>Preço Médio do Dia</th><th>Movimentação (Prata)</th></tr>
            ${[...vol.series].reverse().map(s => `
              <tr>
                <td class="l"><b>${s.date}</b></td>
                <td>${fmt(s.count)} un.</td>
                <td class="best">${fmt(s.avg)}s</td>
                <td class="pos">${fmt(s.count * s.avg)}s</td>
              </tr>
            `).join('')}
          </table>
        </div>
      </div>
    `;
  }

  bodyEl.innerHTML = `
    ${tabsHtml}
    ${bannerHtml}
    ${gridHtml}
    ${chartHtml}
    ${tableHtml}
  `;
}

async function fetchSingleItemHistory(itemId) {
  if (!itemId) return;
  const btn = $('#fetchSingleHistBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Buscando histórico…'; }
  toast(`📊 Buscando histórico diário detalhado de ${itemId}…`, 15000);
  const locs = GD.saleLocs.join(',');
  try {
    const url = `/api/history?server=${ST.config.server}&items=${encodeURIComponent(itemId)}&locations=${encodeURIComponent(locs)}`;
    const r = await fetch(url);
    const data = await r.json().catch(() => ({ error: 'resposta inválida' }));
    if (Array.isArray(data)) {
      let count = 0;
      for (const entry of data) {
        const summary = calcVolumeSummary(entry.data);
        if (summary) {
          ST.volumes[itemId] = ST.volumes[itemId] || {};
          ST.volumes[itemId][entry.location] = summary;
          count++;
        }
      }
      save();
      toast(`✓ Histórico de ${count} praças atualizado com sucesso!`);
      renderHistoryModal();
    } else {
      toast(`Erro ao obter dados: ${data.error || 'resposta não reconhecida'}`);
    }
  } catch (err) {
    toast(`Erro ao consultar histórico: ${err.message}`);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '⚡ Atualizar Histórico Detalhado Deste Item'; }
  }
}

/* ---------------- eventos ---------------- */
function bind() {
  $('#tabs').addEventListener('click', e => {
    const b = e.target.closest('button[data-view]'); if (!b) return;
    VIEW = b.dataset.view;
    document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('active', x === b));
    render();
  });
  const view = $('#view');
  view.addEventListener('change', e => {
    const el = e.target, d = el.dataset;
    if (d.pid) {
      const q = d.q || 1;
      setQP(d.pid, d.loc, q, el.value === '' ? null : Number(el.value));
      return changed();
    }
    if (d.plan !== undefined) {
      const row = ST.plan[d.plan];
      row[d.f] = d.f === 'qty' ? Number(el.value) || 0 : el.value;
      if (d.f === 'code') {
        const valid = piecesOf(row.code);
        if (valid.length && !valid.some(p => p.slot === row.slot)) {
          row.slot = valid[0].slot;
        }
      }
      return changed();
    }
    if (d.origin) { ST.origins[d.origin] = el.value; return changed(); }
    if (d.plankorigin) { ST.plankOrigins = ST.plankOrigins || {}; ST.plankOrigins[d.plankorigin] = el.value; return changed(); }
    if (d.cfg) {
      if (d.cfg === 'server' || d.cfg === 'materialPricing' || d.cfg === 'targetQuality' || d.cfg === 'fetchFreshness') {
        ST.config[d.cfg] = el.value;
      } else {
        ST.config[d.cfg] = (d.pct === '1' ? Number(el.value) / 100 : Number(el.value));
      }
      return changed();
    }
    if (d.rf) {
      rankFilter[d.rf] = el.type === 'checkbox' ? el.checked : el.value;
      if (d.rf === 'cat') {
        rankFilter.variant = '';
        rankFilter.piece = '';
      }
      return render();
    }
    if (d.gf) {
      gearFilter[d.gf] = el.value;
      if (d.gf === 'cat') {
        const vs = GD.variants.filter(v => !gearFilter.cat || (v.cat || 'plate') === gearFilter.cat);
        if (vs.length && !vs.some(v => v.code === gearFilter.variant)) {
          gearFilter.variant = vs[0].code;
        }
        gearFilter.piece = '';
      } else if (d.gf === 'variant') {
        gearFilter.piece = '';
      }
      return render();
    }
    if (d.ff) {
      if (d.ff === 'dailyBonus' || d.ff === 'dailyBonus1') {
        ST.activeDailyBonus = el.value;
        save();
        updateHeaderDailyBonusSelect();
        return render();
      } else if (d.ff === 'dailyBonus2') {
        ST.activeDailyBonus2 = el.value;
        save();
        updateHeaderDailyBonusSelect();
        return render();
      } else if (d.ff === 'city') {
        foodFilter.city = el.value;
        updateFoodReturnRate();
        ST.foodConfig = { ...ST.foodConfig, city: foodFilter.city, retRate: foodFilter.retRate };
        save();
      } else if (d.ff === 'focus') {
        foodFilter.focus = el.checked;
        updateFoodReturnRate();
        ST.foodConfig = { ...ST.foodConfig, focus: foodFilter.focus, retRate: foodFilter.retRate };
        save();
      } else if (d.ff === 'retRate') {
        foodFilter.retRate = Number(el.value) / 100;
        ST.foodConfig = { ...ST.foodConfig, retRate: foodFilter.retRate };
        save();
      } else if (d.ff === 'feeFood') {
        foodFilter.feeFood = Number(el.value) || 0;
        ST.foodConfig = { ...ST.foodConfig, feeFood: foodFilter.feeFood };
        save();
      } else {
        foodFilter[d.ff] = el.type === 'checkbox' ? el.checked : el.value;
        if (d.ff === 'sellPricing' || d.ff === 'autoArbitrage') {
          ST.foodConfig = { ...ST.foodConfig, [d.ff]: foodFilter[d.ff] };
          save();
        }
      }
      return render();
    }
    if (d.foodplan !== undefined) {
      ST.foodPlan = ST.foodPlan || [];
      const row = ST.foodPlan[Number(d.foodplan)];
      if (row) {
        row.batches = Math.max(1, Number(el.value) || 1);
        changed();
      }
      return;
    }
    if (d.foodplanselect !== undefined) {
      ST.foodPlan = ST.foodPlan || [];
      const row = ST.foodPlan[Number(d.foodplanselect)];
      if (row) {
        row.id = el.value;
        changed();
      }
      return;
    }
    if (d.rec) {
      recommendFilter[d.rec] = el.type === 'checkbox' ? el.checked : el.value;
      if (d.rec === 'cat') {
        recommendFilter.variant = '';
      }
      activeRecommendation = generateCraftRecommendation();
      return render();
    }
    if (d.recQty !== undefined) {
      if (activeRecommendation && activeRecommendation.items[Number(d.recQty)]) {
        const val = Math.max(1, Number(el.value) || 1);
        activeRecommendation.items[Number(d.recQty)].recQty = val;
        const items = activeRecommendation.items;
        items.forEach(it => {
          it.totalCost = it.cost !== null ? it.cost * it.recQty : 0;
          it.totalProfit = it.profit !== null ? it.profit * it.recQty : 0;
          it.revenue = it.effectiveSellPrice !== null ? it.effectiveSellPrice * it.recQty : 0;
          it.daysToSell = (it.dailyVol !== null && it.dailyVol > 0) ? (it.recQty / it.dailyVol).toFixed(1) : '—';
        });
        activeRecommendation.totalUnits = items.reduce((a, b) => a + b.recQty, 0);
        activeRecommendation.totalCost = items.reduce((a, b) => a + b.totalCost, 0);
        activeRecommendation.totalProfit = items.reduce((a, b) => a + b.totalProfit, 0);
        activeRecommendation.totalRevenue = items.reduce((a, b) => a + b.revenue, 0);
        activeRecommendation.avgMargin = activeRecommendation.totalCost > 0 ? activeRecommendation.totalProfit / activeRecommendation.totalCost : 0;
        activeRecommendation.estDays = items.length ? Math.max(...items.map(r => Number(r.daysToSell) || 1)).toFixed(1) : '1.0';
        return render();
      }
    }
    if (el.id === 'importFile' && el.files[0]) {
      el.files[0].text().then(t => { ST = JSON.parse(t); changed(); toast('Backup importado.'); }).catch(() => toast('Arquivo inválido.'));
    }
  });
  view.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input.num')) e.target.blur(); });
  view.addEventListener('click', e => {
    const chipEnch = e.target.closest('[data-rec-ench]');
    if (chipEnch) {
      const eNum = chipEnch.dataset.recEnch;
      recommendFilter['ench' + eNum] = !recommendFilter['ench' + eNum];
      activeRecommendation = generateCraftRecommendation();
      return render();
    }
    const chipTarget = e.target.closest('[data-rec-target]');
    if (chipTarget) {
      recommendFilter.targetPieces = Number(chipTarget.dataset.recTarget);
      activeRecommendation = generateCraftRecommendation();
      return render();
    }
    const gotoBtn = e.target.closest('[data-gotoview]');
    if (gotoBtn) {
      VIEW = gotoBtn.dataset.gotoview;
      document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('active', x.dataset.view === VIEW));
      return render();
    }
    const t = e.target.closest('button'); if (!t) return;
    if (t.id === 'generateRecBtn' || t.id === 'regenRecBtn') {
      activeRecommendation = generateCraftRecommendation();
      render();
      return toast('🎲 Mix de craft atualizado!');
    }
    if (t.dataset.recDel !== undefined) {
      if (activeRecommendation) {
        activeRecommendation.items.splice(Number(t.dataset.recDel), 1);
        const items = activeRecommendation.items;
        activeRecommendation.totalUnits = items.reduce((a, b) => a + b.recQty, 0);
        activeRecommendation.totalCost = items.reduce((a, b) => a + b.totalCost, 0);
        activeRecommendation.totalProfit = items.reduce((a, b) => a + b.totalProfit, 0);
        activeRecommendation.totalRevenue = items.reduce((a, b) => a + b.revenue, 0);
        activeRecommendation.avgMargin = activeRecommendation.totalCost > 0 ? activeRecommendation.totalProfit / activeRecommendation.totalCost : 0;
        activeRecommendation.estDays = items.length ? Math.max(...items.map(r => Number(r.daysToSell) || 1)).toFixed(1) : '1.0';
        return render();
      }
    }
    if (t.id === 'applyRecPlanBtn') {
      if (!activeRecommendation || !activeRecommendation.items.length) return toast('Nenhum item recomendado para aplicar.');
      ST.plan = activeRecommendation.items.map(it => ({ code: it.code, slot: it.slot, k: it.k, qty: it.recQty }));
      save();
      VIEW = 'plan';
      document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('active', x.dataset.view === 'plan'));
      render();
      return toast('⚡ Mix de craft aplicado com sucesso ao Planejador!');
    }
    if (t.id === 'addRecPlanBtn') {
      if (!activeRecommendation || !activeRecommendation.items.length) return toast('Nenhum item recomendado para adicionar.');
      ST.plan = ST.plan || [];
      for (const it of activeRecommendation.items) {
        const existing = ST.plan.find(p => p.code === it.code && p.slot === it.slot && p.k === it.k);
        if (existing) {
          existing.qty = (Number(existing.qty) || 0) + it.recQty;
        } else {
          ST.plan.push({ code: it.code, slot: it.slot, k: it.k, qty: it.recQty });
        }
      }
      save();
      VIEW = 'plan';
      document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('active', x.dataset.view === 'plan'));
      render();
      return toast('➕ Mix adicionado ao Planejador existente!');
    }
    if (t.id === 'cancelFetchBtn') return cancelActiveFetch();
    if (t.id === 'addPlan') { const last = ST.plan[ST.plan.length - 1]; ST.plan.push(last ? { ...last } : { code: 'SET1', slot: 'ARMOR', k: '4.0', qty: 10 }); return changed(); }
    if (t.id === 'clearPlan') { if (confirm('Limpar todo o plano?')) { ST.plan = []; changed(); } return; }
    if (t.dataset.del !== undefined) { ST.plan.splice(Number(t.dataset.del), 1); return changed(); }
    if (t.dataset.addrank) { const [code, slot, k] = t.dataset.addrank.split('|'); ST.plan.push({ code, slot, k, qty: 10 }); save(); return toast('Adicionado ao planejador (10 un.).'); }
    if (t.dataset.ptab) { priceTab = t.dataset.ptab; return render(); }
    if (t.dataset.rtab) { refineTab = t.dataset.rtab; return render(); }
    if (t.dataset.foodtab) { foodTab = t.dataset.foodtab; return render(); }
    if (t.dataset.foodpricesub) { foodFilter.priceSubtab = t.dataset.foodpricesub; return render(); }
    if (t.dataset.addfood) {
      ST.foodPlan = ST.foodPlan || [];
      ST.foodPlan.push({ id: t.dataset.addfood, batches: 1 });
      save();
      return toast('Adicionado ao Planejador de Culinária (1 lote = 10 comidas).');
    }
    if (t.dataset.addfoodbulk) {
      const [foodId, countStr] = t.dataset.addfoodbulk.split('|');
      const batches = Number(countStr) || 10;
      ST.foodPlan = ST.foodPlan || [];
      ST.foodPlan.push({ id: foodId, batches });
      save();
      return toast(`Adicionado ${batches} lotes (${batches * 10} un.) ao Planejador.`);
    }
    if (t.id === 'addFoodMealBtn') {
      ST.foodPlan = ST.foodPlan || [];
      const defaultId = (GD.foods && GD.foods[0] ? GD.foods[0].id : 'T3_MEAL_PIE');
      ST.foodPlan.push({ id: defaultId, batches: 1 });
      changed();
      return toast('Comida adicionada ao plano de culinária.');
    }
    if (t.dataset.delfood !== undefined) {
      ST.foodPlan = ST.foodPlan || [];
      ST.foodPlan.splice(Number(t.dataset.delfood), 1);
      return changed();
    }
    if (t.id === 'clearFoodPlan') {
      if (confirm('Limpar todo o plano de culinária?')) {
        ST.foodPlan = [];
        changed();
      }
      return;
    }
    if (t.id === 'fetchFoodPrices') return fetchPrices(foodIds());
    if (t.id === 'fetchFoodVolumes') return fetchVolumes(foodMealIds());
    if (t.id === 'fetchAll') return fetchPrices(allIds());
    if (t.id === 'fetchTab') return fetchPrices(tabIds());
    if (t.id === 'fetchPlan') return fetchPrices(planIds());
    if (t.id === 'fetchPricesRank') return fetchPrices(rankPriceIds());
    if (t.id === 'fetchBaseMaterialsPrices') return fetchPrices(baseMaterialAndArtIds());
    if (t.id === 'fetchCatPlate') return fetchPrices(categoryCraftIds('plate'));
    if (t.id === 'fetchCatBow') return fetchPrices(categoryCraftIds('bow'));
    if (t.id === 'fetchCatCrossbow') return fetchPrices(categoryCraftIds('crossbow'));
    if (t.id === 'fetchVolumesRank') return fetchVolumes(rankGearIds());
    if (t.id === 'fetchPlanVolumes') return fetchVolumes(planAllIds());
    if (t.id === 'fetchGearVolumes') return fetchVolumes(currentGearTabIds());
    if (t.id === 'fetchGearVolumesAll') return fetchVolumes(gearIds());
    if (t.id === 'fetchMaterialsVolume') return fetchVolumes(materialIds());
    if (t.id === 'fetchOreVolumes') return fetchVolumes(oreIds());
    if (t.id === 'fetchBarVolumes') return fetchVolumes(barIds());
    if (t.id === 'fetchWoodVolumes') return fetchVolumes(woodIds());
    if (t.id === 'fetchPlankVolumes') return fetchVolumes(plankIds());
    if (t.id === 'resetFetchTimestampsBtn') {
      ST.priceFetchedAt = {};
      ST.volFetchedAt = {};
      fetch('/api/clear_cache').catch(() => {});
      save();
      toast('? Registro de coleta recente resetado! Agora a busca consultará todos os itens do zero com Brecilien.');
      return render();
    }
    if (t.id === 'exportBtn') {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(ST, null, 1)], { type: 'application/json' }));
      a.download = `albion-craft-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    }
  });

  $('#histClose')?.addEventListener('click', closeHistoryModal);
  $('#histModal')?.addEventListener('click', e => {
    if (e.target.id === 'histModal') closeHistoryModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeHistoryModal();
  });
  document.addEventListener('click', e => {
    const histBtn = e.target.closest('[data-hist-id]');
    if (histBtn) {
      e.preventDefault();
      openHistoryModal(histBtn.dataset.histId, histBtn.dataset.histLoc);
      return;
    }
    const tabBtn = e.target.closest('[data-hist-tab]');
    if (tabBtn) {
      histModalState.loc = tabBtn.dataset.histTab;
      renderHistoryModal();
      return;
    }
    if (e.target.id === 'fetchSingleHistBtn') {
      fetchSingleItemHistory(e.target.dataset.itemId);
      return;
    }
  });

  $('#headerDailyBonusSelect1')?.addEventListener('change', e => {
    ST.activeDailyBonus = e.target.value;
    save();
    render();
  });
  $('#headerDailyBonusSelect2')?.addEventListener('change', e => {
    ST.activeDailyBonus2 = e.target.value;
    save();
    render();
  });
  $('#headerDailyBonusSelect')?.addEventListener('change', e => {
    ST.activeDailyBonus = e.target.value;
    save();
    render();
  });
}

/* ---------------- leitor em tempo real ---------------- */
let lastSeenLiveUpdate = null;
let livePollTimer = null;

async function checkLiveStatus() {
  const badge = $('#liveBadge');
  const text = $('#liveText');
  if (!badge || !text) return;

  try {
    const res = await fetch('/api/live_status');
    if (!res.ok) throw new Error('Status HTTP ' + res.status);
    const data = await res.json();

    badge.classList.remove('waiting', 'connected', 'active');

    if (data.connected) {
      const city = data.last_city ? locName(data.last_city) : '';

      if (data.last_update && data.last_update !== lastSeenLiveUpdate) {
        if (lastSeenLiveUpdate !== null) {
          const fresh = await fetch('/api/state').then(r => r.json());
          ST.prices = fresh.prices || {};
          ST.dates = fresh.dates || {};
          ST.amounts = fresh.amounts || {};
          ST.qualityPrices = fresh.qualityPrices || {};
          ST.qualityDates = fresh.qualityDates || {};
          ST.qualityAmounts = fresh.qualityAmounts || {};
          render();
          toast(`🟢 Mercado lido em tempo real: ${data.items_updated} preço(s) em ${city || 'mercado'}.`);
        }
        lastSeenLiveUpdate = data.last_update;
      }

      let isRecent = false;
      if (data.last_update) {
        const diffMs = Date.now() - new Date(data.last_update).getTime();
        if (diffMs < 20000) isRecent = true;
      }

      if (isRecent && city) {
        badge.classList.add('active');
        text.textContent = `Ao vivo: ${city} (${data.items_updated})`;
        badge.title = `Leitor ativo! Última leitura: ${city} (${data.total_received} ordens recebidas no total).`;
      } else {
        badge.classList.add('connected');
        text.textContent = `Leitor conectado${city ? ' (' + city + ')' : ''}`;
        badge.title = 'Leitor de pacotes conectado. Abra o mercado no Albion para capturar preços.';
      }
    } else {
      badge.classList.add('waiting');
      text.textContent = 'Leitor: Desconectado';
      badge.title = 'Inicie o leitor com Iniciar_Com_Leitor.bat para ler preços do jogo automaticamente.';
    }
  } catch {
    badge.classList.remove('connected', 'active');
    badge.classList.add('waiting');
    text.textContent = 'Leitor: Offline';
    badge.title = 'Não foi possível conectar ao servidor local.';
  }
}

(async function init() {
  [GD, ST] = await Promise.all([fetch('/api/gamedata').then(r => r.json()), fetch('/api/state').then(r => r.json())]);
  ST.prices ??= {}; ST.dates ??= {}; ST.origins ??= {}; ST.plankOrigins ??= {}; ST.plan ??= []; ST.volumes ??= {};
  ST.qualityPrices ??= {}; ST.qualityDates ??= {}; ST.qualityAmounts ??= {}; ST.amounts ??= {};
  ST.priceFetchedAt ??= {}; ST.volFetchedAt ??= {};
  ST.foodPlan ??= [];
  const legacyMap = { forge: 'plate_armor', hunter: 'bow', mage: 'firestaff' };
  if (ST.activeDailyBonus && legacyMap[ST.activeDailyBonus]) ST.activeDailyBonus = legacyMap[ST.activeDailyBonus];
  ST.activeDailyBonus ??= 'none';
  ST.activeDailyBonus2 ??= 'none';
  ST.foodConfig = {
    city: 'Caerleon',
    focus: false,
    retRate: 0.248,
    feeFood: 465,
    autoArbitrage: true,
    sellPricing: 'smart',
    ...ST.foodConfig
  };
  foodFilter.city = ST.foodConfig.city || 'Caerleon';
  foodFilter.focus = !!ST.foodConfig.focus;
  foodFilter.retRate = ST.foodConfig.retRate !== undefined ? ST.foodConfig.retRate : 0.248;
  foodFilter.feeFood = ST.foodConfig.feeFood || 465;
  foodFilter.autoArbitrage = ST.foodConfig.autoArbitrage !== false;
  foodFilter.sellPricing = ST.foodConfig.sellPricing || 'smart';
  ST.config = {
    taxBuy: 0, taxSell: 0.065, retRefine: 0.367, retCraft: 0.248, feeRefine: 465, feeCraft: 465,
    server: 'west', materialPricing: 'smart', targetQuality: 'mix', fetchFreshness: 'smart_60',
    ...ST.config
  };
  rankFilter.quality = rankFilter.quality || ST.config.targetQuality || 'mix';
  rankFilter.sellPricing = rankFilter.sellPricing || 'spot';
  rankFilter.healthFilter = rankFilter.healthFilter || 'all';
  bind();
  render();
  checkLiveStatus();
  livePollTimer = setInterval(checkLiveStatus, 2500);
})();

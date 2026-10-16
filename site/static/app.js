'use strict';
/* Albion Craft · Placas — lógica de refino integrado + craft (mesma matemática da planilha). */

let GD = null;      // dados do jogo (receitas/artefatos)
let ST = null;      // estado do usuário (preços, config, plano)
let VIEW = 'plan';
let priceTab = 'ore';
let rankFilter = { variant: '', piece: '', tier: '', ench: '', minVol: '0', quality: 'mix', onlyPriced: true, sort: 'profitDaily' };
let gearFilter = { variant: 'SET1', piece: '', tmin: 4, quality: '1' };

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
function toast(msg, ms = 3500) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), ms);
}

/* ---------------- IDs do jogo ---------------- */
const suf = e => e ? `_LEVEL${e}@${e}` : '';
const barId = k => { const [t, e] = tv(k); return `T${t}_METALBAR${suf(e)}`; };
const oreId = k => { const [t, e] = tv(k); return `T${t}_ORE${suf(e)}`; };
const itemId = (code, slot, k) => { const [t, e] = tv(k); return `T${t}_${slot}_PLATE_${code}${e ? '@' + e : ''}`; };
const artOf = (code, slot, t) => GD.artifacts[`${code}_${slot}_${t}`] || null;
const variant = code => GD.variants.find(v => v.code === code);
const piece = slot => GD.pieces.find(p => p.slot === slot);
function lowerBar(k) {
  const [t, e] = tv(k);
  if (t === 2) return null;
  if (t === 3) return '2.0';
  if (t === 4) return '3.0';            // T4.x sempre usa a barra T3.0
  return `${t - 1}.${e}`;               // T5+ usa a barra inferior do mesmo encantamento
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

function minBuy(id) {
  let best = null;
  for (const c of GD.cities) { const v = getP(id, c); if (v && (!best || v < best.price)) best = { price: v, loc: c }; }
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
  if (preferredLoc && ST.volumes[id][preferredLoc]) return { ...ST.volumes[id][preferredLoc], loc: preferredLoc };
  let best = null;
  for (const [loc, data] of Object.entries(ST.volumes[id])) {
    if (!best || (data.daily || 0) > (best.daily || 0)) {
      best = { ...data, loc };
    }
  }
  return best;
}
function volBadge(vol, locLabel = '') {
  if (!vol) return `<span class="vol-badge vol-none" title="Demanda ainda não consultada. Clique em 'Buscar volumes'.">— <span class="vol-sub">s/ dados</span></span>`;
  const d = vol.daily !== undefined ? vol.daily : 0;
  const tip = `${locLabel ? locLabel + ': ' : ''}${fmt(d, 1)} peças/dia (Total 28d: ${fmt(vol.total28 || 0)} un)${vol.vwap ? ' · Preço médio (VWAP): ' + fmt(vol.vwap) + 's' : ''}${vol.lastDate ? ' · Última: ' + vol.lastDate : ''}`;
  if (d >= 20) return `<span class="vol-badge vol-high badge-tip" title="${esc(tip)}">🟢 <span class="vol-num">${fmt(d, 1)}</span><span class="vol-sub">/dia</span></span>`;
  if (d >= 5) return `<span class="vol-badge vol-med badge-tip" title="${esc(tip)}">🟡 <span class="vol-num">${fmt(d, 1)}</span><span class="vol-sub">/dia</span></span>`;
  if (d >= 1) return `<span class="vol-badge vol-low badge-tip" title="${esc(tip)}">🟠 <span class="vol-num">${fmt(d, 1)}</span><span class="vol-sub">/dia</span></span>`;
  if (d > 0) return `<span class="vol-badge vol-danger badge-tip" title="${esc(tip)}">🔴 <span class="vol-num">${fmt(d, 1)}</span><span class="vol-sub">/dia (lento)</span></span>`;
  return `<span class="vol-badge vol-danger badge-tip" title="${esc(tip)}">⛔ <span class="vol-num">0</span><span class="vol-sub">/dia (parado)</span></span>`;
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
  for (const pt of pts) {
    const ptTs = new Date(pt.timestamp + (pt.timestamp.endsWith('Z') ? '' : 'Z')).getTime();
    if (isNaN(ptTs)) continue;
    const diffDays = (now - ptTs) / (1000 * 3600 * 24);
    const count = pt.item_count || 0;
    const avg = pt.avg_price || 0;
    if (diffDays <= 28) {
      total28 += count;
      silver28 += count * avg;
    }
    if (diffDays <= 7) {
      total7 += count;
      silver7 += count * avg;
    }
    if (ptTs > latestTs) { latestTs = ptTs; lastDate = pt.timestamp.slice(0, 10); }
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
  return { daily, total28, total7, lastDate, daysSinceLast: Math.round(daysSinceLast), vwap, vwap28, vwap7 };
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
function computeBars() {
  const c = ST.config, bars = {};
  for (const k of BAR_KEYS) {
    const [t, e] = tv(k);
    const iv = 2 ** t * 2 ** e;
    const q = ORE_QTY[t];
    const lw = lowerBar(k);
    const oreBuy = getMaterialBuy(oreId(k), q * 20);
    const barBuy = getMaterialBuy(barId(k), 20);
    const ore = oreBuy ? { price: oreBuy.price, loc: oreBuy.loc, spotPrice: oreBuy.spotPrice, vwap: oreBuy.vwap, slippageRisk: oreBuy.slippageRisk, reason: oreBuy.reason } : null;
    const buy = barBuy ? { price: barBuy.price, loc: barBuy.loc, spotPrice: barBuy.spotPrice, vwap: barBuy.vwap, slippageRisk: barBuy.slippageRisk, reason: barBuy.reason } : null;
    const fee = iv * 0.1125 * c.feeRefine / 100;
    const buyC = buy ? buy.price * (1 + c.taxBuy) : null;
    const oreC = ore ? ore.price * (1 + c.taxBuy) : null;

    // 1. Cascata Completa (refinando cada etapa desde o T2)
    const lwCascade = lw ? (bars[lw] ? bars[lw].cascade : null) : 0;
    const cascade = (oreC !== null && lwCascade !== null)
      ? (q * oreC + lwCascade) * (1 - c.retRefine) + fee
      : null;

    // 2. Refino com Barra Anterior Pronta (comprando a barra T-1 pronta no mercado)
    const lwBuy = lw ? (bars[lw] ? bars[lw].buyC : null) : null;
    const step = !lw
      ? cascade
      : (oreC !== null && lwBuy !== null)
        ? (q * oreC + lwBuy) * (1 - c.retRefine) + fee
        : null;

    const refine = cascade; // compatibilidade com scripts

    // Comparativo entre métodos de refino:
    // Se stepDiff > 0: Cascata é mais barata por X prata.
    // Se stepDiff < 0: Barra anterior pronta é mais barata por X prata.
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

    // Origem / Decisão:
    let origin = ST.origins[k] || 'auto';
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

    bars[k] = {
      k, t, e, iv, q, lw, ore, oreC, buy, buyC, fee,
      cascade, step, stepDiff,
      refine,
      bestRefine, bestRefineMethod,
      eff, dec, origin, saveVsBuy
    };
  }
  return bars;
}

function computeBaseItem(bars, code, slot, k, targetQ = null) {
  const c = ST.config, v = variant(code), p = piece(slot);
  const [t] = tv(k);
  const b = bars[k];
  const art = v.artifact ? artOf(code, slot, t) : null;
  const artBuy = art ? getMaterialBuy(art.id, 1) : null;
  const barsCost = b.eff !== null ? p.bars * b.eff * (1 - c.retCraft) : null;
  const artCost = art ? (artBuy ? artBuy.price * (1 + c.taxBuy) : null) : 0;
  const iv = p.bars * b.iv + (art ? art.iv : 0);
  const fee = iv * 0.1125 * c.feeCraft / 100;
  const cost = (barsCost !== null && artCost !== null) ? barsCost + artCost + fee : null;
  const itId = itemId(code, slot, k);
  const qMode = targetQ || rankFilter.quality || ST.config.targetQuality || 'mix';
  const sell = bestSellQuality(itId, qMode);
  const revenue = sell ? sell.price * (1 - c.taxSell) : null;
  const profit = (cost !== null && revenue !== null) ? revenue - cost : null;
  const vol = sell ? getVol(itId, sell.loc) : getBestVol(itId);
  const dailyVol = vol ? (vol.daily !== undefined ? vol.daily : 0) : null;
  const profitDaily = (dailyVol !== null) ? ((profit !== null && profit > 0) ? profit * dailyVol : (profit !== null && profit < 0 ? profit : 0)) : profit;
  return {
    id: itId, code, slot, k, t, v, p, art, artBuy, barsCost, artCost, iv, fee, cost, sell, revenue, profit,
    vol, dailyVol, profitDaily,
    margin: profit !== null && cost ? profit / cost : null,
    name: `${v.name} · ${p.name} · T${k}`,
  };
}

function computeItem(bars, code, slot, k, targetQ = null) {
  const c = ST.config, v = variant(code), p = piece(slot);
  const [t] = tv(k);
  const qMode = targetQ || rankFilter.quality || ST.config.targetQuality || 'mix';

  if (v && v.royal && GD.royal) {
    const roy = GD.royal;
    const sigilInfo = (roy.sigils && roy.sigils[t]) || null;
    const sigilQty = (roy.sigilQty && roy.sigilQty[slot] && roy.sigilQty[slot][t]) || 0;
    const sigilBuy = sigilInfo ? getMaterialBuy(sigilInfo.id, sigilQty) : null;
    const sigilCost = (sigilBuy && sigilQty > 0) ? sigilQty * sigilBuy.price * (1 + c.taxBuy) : null;

    // Peça base: Soldado (SET1), Cavaleiro (SET2) ou Guardião (SET3).
    // Escolhe a rota mais econômica: craftar a partir de barras ou comprar pronta no mercado.
    let bestBase = null;
    for (const bCode of roy.baseSets) {
      const bV = variant(bCode);
      const bIt = computeBaseItem(bars, bCode, slot, k, targetQ);
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
    const fee = 0; // Taxa de forja para conversão real é 0 prata
    const cost = (baseCost !== null && sigilCost !== null) ? baseCost + sigilCost + fee : null;
    const itId = itemId(code, slot, k);
    const sell = bestSellQuality(itId, qMode);
    const revenue = sell ? sell.price * (1 - c.taxSell) : null;
    const profit = (cost !== null && revenue !== null) ? revenue - cost : null;
    const vol = sell ? getVol(itId, sell.loc) : getBestVol(itId);
    const dailyVol = vol ? (vol.daily !== undefined ? vol.daily : 0) : null;
    const profitDaily = (dailyVol !== null) ? ((profit !== null && profit > 0) ? profit * dailyVol : (profit !== null && profit < 0 ? profit : 0)) : profit;

    return {
      id: itId, code, slot, k, t, v, p,
      isRoyal: true,
      sigilInfo, sigilQty, sigilBuy, sigilCost,
      bestBase, baseCost,
      barsCost: baseCost,
      artCost: sigilCost,
      art: sigilInfo ? { id: sigilInfo.id, name: `${sigilQty}x ${sigilInfo.name}` } : null,
      artBuy: sigilBuy,
      iv: 0, fee, cost, sell, revenue, profit,
      vol, dailyVol, profitDaily,
      margin: profit !== null && cost ? profit / cost : null,
      name: `${v.name} · ${p.name} · T${k}`,
    };
  }

  return computeBaseItem(bars, code, slot, k, targetQ);
}

function computePlan(bars) {
  const c = ST.config;
  const rows = ST.plan.map(r => {
    const it = computeItem(bars, r.code, r.slot, r.k, r.quality || null);
    const qty = Number(r.qty) || 0;
    return { ...r, qty, it, totalCost: it.cost !== null ? it.cost * qty : null, totalProfit: it.profit !== null ? it.profit * qty : null };
  });

  // Demanda direta de barras originada pelo craft de equipamentos
  const direct = Object.fromEntries(BAR_KEYS.map(k => [k, 0]));
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
          // Craftar a peça base: repassa a demanda para as barras (com retorno de recurso no craft da peça base)
          direct[r.k] += r.qty * r.it.p.bars * (1 - c.retCraft);
        }
      } else {
        missing.push(`Peça base para ${r.it.name}`);
      }
    } else {
      direct[r.k] += r.qty * r.it.p.bars * (1 - c.retCraft);
      if (r.it.art) {
        const id = r.it.art.id;
        arts[id] = arts[id] || { art: r.it.art, qty: 0, buy: r.it.artBuy };
        arts[id].qty += r.qty;
      }
    }
  }

  // Decomposição da demanda de barras:
  // - se for 'buy': compra a barra pronta
  // - se for 'step': compra minério atual + compra barra anterior pronta
  // - se for 'cascade': compra minério atual + passa demanda para a barra anterior
  const barDemands = Object.fromEntries(BAR_KEYS.map(k => [k, direct[k] || 0]));
  const buyBarsMap = {};
  const buyOreMap = {};
  const refineStats = {};

  for (const k of [...BAR_KEYS].reverse()) {
    const reqQty = barDemands[k];
    if (!reqQty || reqQty < 1e-9) continue;
    const b = bars[k];
    const dec = b.dec || 'buy';

    if (dec === 'buy') {
      buyBarsMap[k] = (buyBarsMap[k] || 0) + reqQty;
    } else if (dec === 'step') {
      const oq = reqQty * b.q * (1 - c.retRefine);
      buyOreMap[k] = (buyOreMap[k] || 0) + oq;
      refineStats[k] = (refineStats[k] || 0) + reqQty;
      if (b.lw) {
        const prevBarQty = reqQty * (1 - c.retRefine);
        buyBarsMap[b.lw] = (buyBarsMap[b.lw] || 0) + prevBarQty;
      }
    } else { // 'cascade'
      const oq = reqQty * b.q * (1 - c.retRefine);
      buyOreMap[k] = (buyOreMap[k] || 0) + oq;
      refineStats[k] = (refineStats[k] || 0) + reqQty;
      if (b.lw) {
        const prevBarQty = reqQty * (1 - c.retRefine);
        barDemands[b.lw] = (barDemands[b.lw] || 0) + prevBarQty;
      }
    }
  }

  const buyBars = [], buyOre = [];
  let slippageCount = 0;

  for (const k of BAR_KEYS) {
    const q = buyBarsMap[k];
    if (q && q > 1e-9) {
      const b = bars[k];
      const barBuy = getMaterialBuy(barId(k), q);
      const effPrice = barBuy ? barBuy.price * (1 + c.taxBuy) : (b.buyC || null);
      if (effPrice === null) missing.push(`Barra pronta T${k}`);
      if (barBuy && barBuy.slippageRisk) slippageCount++;
      buyBars.push({
        k, qty: q,
        loc: barBuy ? barBuy.loc : (b.buy ? b.buy.loc : '—'),
        price: effPrice,
        total: effPrice ? q * effPrice : null,
        slippageRisk: barBuy ? barBuy.slippageRisk : false,
        spotPrice: barBuy ? barBuy.spotPrice : null,
        vwap: barBuy ? barBuy.vwap : null,
        reason: barBuy ? barBuy.reason : ''
      });
    }
  }
  for (const k of BAR_KEYS) {
    const q = buyOreMap[k];
    if (q && q > 1e-9) {
      const b = bars[k];
      const oreBuy = getMaterialBuy(oreId(k), q);
      const effPrice = oreBuy ? oreBuy.price * (1 + c.taxBuy) : (b.oreC || null);
      if (!b.ore && !oreBuy) missing.push(`Minério T${k}`);
      if (oreBuy && oreBuy.slippageRisk) slippageCount++;
      buyOre.push({
        k, qty: q,
        refineQty: refineStats[k] || 0,
        loc: oreBuy ? oreBuy.loc : (b.ore ? b.ore.loc : '—'),
        price: effPrice,
        total: effPrice ? q * effPrice : null,
        slippageRisk: oreBuy ? oreBuy.slippageRisk : false,
        spotPrice: oreBuy ? oreBuy.spotPrice : null,
        vwap: oreBuy ? oreBuy.vwap : null,
        reason: oreBuy ? oreBuy.reason : ''
      });
    }
  }

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
    + Object.entries(refineStats).reduce((s, [k, q]) => s + (q * bars[k].fee), 0);

  return {
    rows, buyBars, buyOre, artList, sigilsList, baseGearList, missing, total: barDemands,
    slippageCount,
    invest: sum(buyBars) + sum(buyOre) + sum(artList) + sum(sigilsList) + sum(baseGearList), fees,
    cost: rows.reduce((s, r) => s + (r.totalCost || 0), 0),
    revenue: rows.reduce((s, r) => s + (r.it.revenue !== null ? r.it.revenue * r.qty : 0), 0),
    profit: rows.reduce((s, r) => s + (r.totalProfit || 0), 0),
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
function render() {
  const active = document.activeElement;
  const focusKey = active && active.dataset ? active.dataset.fk : null;
  const scrollers = [...document.querySelectorAll('.tablewrap')].map(e => [e.scrollTop, e.scrollLeft]);
  const views = { plan: viewPlan, rank: viewRank, refine: viewRefine, prices: viewPrices, config: viewConfig };
  $('#view').innerHTML = views[VIEW]();
  document.querySelectorAll('.tablewrap').forEach((e, i) => { if (scrollers[i]) [e.scrollTop, e.scrollLeft] = scrollers[i]; });
  if (focusKey) { const el = document.querySelector(`[data-fk="${CSS.escape(focusKey)}"]`); if (el) { el.focus(); if (el.select) el.select(); } }
}

const opt = (val, label, sel) => `<option value="${esc(val)}"${String(val) === String(sel) ? ' selected' : ''}>${esc(label)}</option>`;
const variantOpts = sel => GD.variants.map(v => opt(v.code, v.name + (v.royal ? ' 👑' : v.artifact ? ' ★' : ''), sel)).join('');
const pieceOpts = sel => GD.pieces.map(p => opt(p.slot, p.name, sel)).join('');
const tierOpts = sel => TIERS.map(k => opt(k, 'T' + k, sel)).join('');

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
  const P = computePlan(bars);
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

    return `
    <tr>
      <td class="l"><select data-plan="${i}" data-f="code">${variantOpts(r.code)}</select></td>
      <td class="l"><select data-plan="${i}" data-f="slot">${pieceOpts(r.slot)}</select></td>
      <td class="l"><select data-plan="${i}" data-f="k">${tierOpts(r.k)}</select></td>
      <td><input class="num" type="number" min="0" data-plan="${i}" data-f="qty" data-fk="plan-${i}" value="${r.qty}"></td>
      <td>${r.it.isRoyal ? (r.it.bestBase ? `<span title="Base: ${esc(r.it.bestBase.name)} (${r.it.bestBase.method === 'craft' ? 'craftar com barras' : 'comprar pronta'})">${fmt(r.it.barsCost)}</span>` : '<span class="neg">sem base</span>') : fmt(r.it.barsCost)}</td>
      <td class="l muted">${r.it.isRoyal ? (r.it.sigilInfo ? `<span title="${r.it.sigilQty * r.qty}x ${esc(r.it.sigilInfo.name)}">👑 ${fmt(r.it.artCost)}</span>` : '—') : (r.it.art ? `<span title="${esc(r.it.art.name)}">${fmt(r.it.artCost)}</span>` : '—')}</td>
      <td>${fmt(r.it.fee)}</td>
      <td><b>${fmt(r.it.cost)}</b></td>
      <td class="best">${sellHtml}</td>
      <td class="l">${r.it.sell ? locName(r.it.sell.loc) : ''}</td>
      <td class="${cls(r.it.profit)}">${fmt(r.it.profit)}</td>
      <td class="${cls(r.it.margin)}">${pct(r.it.margin)}</td>
      <td class="${cls(r.totalProfit)}"><b>${fmt(r.totalProfit)}</b></td>
      <td>${volBadge(r.it.vol, r.it.sell ? locName(r.it.sell.loc) : '')}</td>
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
  <h2>Planejador de craft</h2>
  <div class="muted">Escolha o que vai craftar. A lista de compras considera o retorno de recursos (refino e craft), a demanda diária real, preços por qualidade e proteção contra ofertas falsas de 1 unidade.</div>
  <div class="cards">
    <div class="stat"><div class="label">Total a investir (compras)</div><div class="value">${fmt(P.invest)}</div></div>
    <div class="stat"><div class="label">Taxas de barraca (refino + craft)</div><div class="value">${fmt(P.fees)}</div></div>
    <div class="stat"><div class="label">Receita líquida esperada</div><div class="value">${fmt(P.revenue)}</div></div>
    <div class="stat"><div class="label">Lucro esperado</div><div class="value ${cls(P.profit)}">${fmt(P.profit)}</div></div>
    <div class="stat"><div class="label">Giro Estimado do Lote</div><div class="value">${liquiditySummary(P.rows)}</div></div>
  </div>
  ${slippageBanner}
  ${P.missing.length ? `<div class="card" style="border-color:#6b5a2a">⚠️ Faltam preços para: <b>${esc([...new Set(P.missing)].join(', '))}</b> — preencha na aba Preços ou use “Buscar preços”.</div>` : ''}
  <div class="tablewrap"><table>
    <tr><th class="l">Variante</th><th class="l">Peça</th><th class="l">Tier</th><th>Qtd</th><th>Barras / Base</th><th>Artefato / Emblema</th><th>Taxa ferreiro</th>
    <th>Custo / peça</th><th>Melhor venda</th><th class="l">Local</th><th>Lucro / peça</th><th>Margem</th><th>Lucro total</th>
    <th title="Volume de compra diário no mercado de venda (média últimos 28 dias)">Demanda / dia</th>
    <th title="Tempo estimado para escoar o lote com base na demanda diária">Tempo p/ vender</th><th></th></tr>
    ${rows || '<tr><td colspan="16" class="empty">Nenhum item planejado. Clique em “Adicionar item” ou use o Ranking.</td></tr>'}
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
    ${list('Minério (para refinar)', P.buyOre, [
      ['Minério', x => 'T' + x.k, 'l'],
      ['Qtd', x => fmt(Math.ceil(x.qty))],
      ['Cidade', x => x.loc, 'l'],
      ['Preço Unit.', x => fmt(x.price) + (x.slippageRisk ? ` <span class="slippage-pill badge-tip" title="${esc(x.reason)}">⚠️ Spot: ${fmt(x.spotPrice)}s | Média: ${fmt(x.vwap)}s</span>` : '')],
      ['Total', x => fmt(x.total)],
      ['Barras a refinar', x => fmt(Math.ceil(x.refineQty))]
    ])}
    ${list('Barras prontas', P.buyBars, [
      ['Barra', x => 'T' + x.k, 'l'],
      ['Qtd', x => fmt(Math.ceil(x.qty))],
      ['Cidade', x => x.loc || '', 'l'],
      ['Preço Unit.', x => fmt(x.price) + (x.slippageRisk ? ` <span class="slippage-pill badge-tip" title="${esc(x.reason)}">⚠️ Spot: ${fmt(x.spotPrice)}s | Média: ${fmt(x.vwap)}s</span>` : '')],
      ['Total', x => fmt(x.total)]
    ])}
    ${list('Artefatos', P.artList, [
      ['Artefato', x => esc(x.art.name) + ` <span class="muted">T${x.art.id[1]}</span>`, 'l'],
      ['Qtd', x => fmt(x.qty)],
      ['Cidade', x => x.buy ? x.buy.loc : '<span class="neg">sem preço</span>', 'l'],
      ['Preço Unit.', x => fmt(x.price) + (x.slippageRisk ? ` <span class="slippage-pill badge-tip" title="${esc(x.reason)}">⚠️ Spot: ${fmt(x.spotPrice)}s | Média: ${fmt(x.vwap)}s</span>` : '')],
      ['Total', x => fmt(x.total)]
    ])}
    ${P.sigilsList && P.sigilsList.length ? list('Emblemas Reais', P.sigilsList, [
      ['Emblema', x => esc(x.name), 'l'],
      ['Qtd', x => fmt(x.qty)],
      ['Cidade', x => x.buy ? x.buy.loc : '<span class="neg">sem preço</span>', 'l'],
      ['Preço Unit.', x => fmt(x.price)],
      ['Total', x => fmt(x.total)]
    ]) : ''}
    ${P.baseGearList && P.baseGearList.length ? list('Peças Base (comprar prontas)', P.baseGearList, [
      ['Peça', x => esc(x.name), 'l'],
      ['Qtd', x => fmt(x.qty)],
      ['Cidade', x => x.buy ? x.buy.loc : '<span class="neg">sem preço</span>', 'l'],
      ['Preço Unit.', x => fmt(x.price)],
      ['Total', x => fmt(x.total)]
    ]) : ''}
  </div>
  <div class="muted">Quantidades arredondadas para cima. Se a proteção de volume estiver ativa, grandes lotes usam o Preço Médio Real de Volume (VWAP) para proteger seu investimento contra ofertas de 1 unidade no mercado.</div>`;
}

/* ----- Ranking ----- */
function viewRank() {
  const bars = computeBars(), f = rankFilter;
  let items = [];
  for (const v of GD.variants) for (const p of GD.pieces) for (const k of TIERS) {
    if (f.variant && v.code !== f.variant) continue;
    if (f.piece && p.slot !== f.piece) continue;
    if (f.tier && tv(k)[0] !== Number(f.tier)) continue;
    if (f.ench !== '' && tv(k)[1] !== Number(f.ench)) continue;
    const it = computeItem(bars, v.code, p.slot, k);
    if (f.onlyPriced && it.profit === null) continue;
    if (f.minVol && Number(f.minVol) > 0 && (it.dailyVol === null || it.dailyVol < Number(f.minVol))) continue;
    items.push(it);
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
    const sellHtml = it.sell ? `
      <span class="q-badge q-${it.sell.quality || '1'}" title="${esc(it.sell.qualityName || '')}">${it.sell.qualityLabel || 'Q1'}</span>
      <span class="badge-tip" title="${esc(formatQualityTooltip(it.sell.breakdown, it.sell.price, it.sell.qualityLabel))}">${fmt(it.sell.price)}</span>
    ` : '—';
    return `
    <tr><td class="l">${esc(it.v.name)}</td><td class="l">${it.p.name}</td><td class="l">T${it.k}</td>
    <td>${fmt(it.barsCost)}</td><td>${it.art ? fmt(it.artCost) : '—'}</td><td class="l muted">${it.art ? esc(it.art.name) + (it.artBuy ? ' · ' + it.artBuy.loc : '') : ''}</td>
    <td>${fmt(it.fee)}</td><td><b>${fmt(it.cost)}</b></td>
    <td class="best">${sellHtml}</td><td class="l">${it.sell ? locName(it.sell.loc) : ''}</td>
    <td class="${cls(it.profit)}"><b>${fmt(it.profit)}</b></td><td class="${cls(it.margin)}">${pct(it.margin)}</td>
    <td>${volBadge(it.vol, it.sell ? locName(it.sell.loc) : '')}</td>
    <td class="${(it.profitDaily && it.profitDaily > 0) ? 'pos' : ''}"><b>${it.profitDaily !== null ? (it.profitDaily > 0 ? '+' : '') + fmt(it.profitDaily) : '—'}</b></td>
    <td>${riskBadge(it.vol)}</td>
    <td><button class="ghost" data-addrank="${it.code}|${it.slot}|${it.k}">+ planejar</button></td></tr>`;
  }).join('');
  return `
  <h2>Ranking de lucro e demanda diária</h2>
  <div class="muted">Cruzamento de lucratividade real com volume de compra por dia, preço por qualidade e proteção contra ofertas falsas de 1 unidade.</div>
  <div class="toolbar">
    <label>Variante<select data-rf="variant"><option value="">Todas</option>${variantOpts(f.variant)}</select></label>
    <label>Peça<select data-rf="piece"><option value="">Todas</option>${pieceOpts(f.piece)}</select></label>
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
    <button class="btn" id="fetchVolumesRank" style="margin-top:14px">📊 Buscar volumes diários</button>
    <span class="muted" style="margin-top:14px">${items.length} itens</span>
  </div>
  <div class="tablewrap"><table>
    <tr><th class="l">Variante</th><th class="l">Peça</th><th class="l">Tier</th><th>Barras (líq.)</th><th>Artefato</th><th class="l">Artefato / cidade</th>
    <th>Taxa</th><th>Custo</th><th>Melhor venda</th><th class="l">Local</th><th>Lucro / un.</th><th>Margem</th>
    <th title="Volume de compra diário no mercado de venda (média últimos 28 dias)">Demanda / dia</th>
    <th title="Lucro diário estimado = Lucro unitário × Volume diário">Lucro / dia est.</th>
    <th title="Classificação de liquidez e risco de prata parada">Giro / Risco</th><th></th></tr>
    ${body || '<tr><td colspan="16" class="empty">Nenhum item encontrado com os filtros atuais. Busque preços/volumes ou ajuste os filtros.</td></tr>'}
  </table></div>`;
}

/* ----- Refino ----- */
function viewRefine() {
  const bars = computeBars();
  const decLabel = {
    buy: 'Comprar Pronta',
    step: 'Barra Anterior',
    cascade: 'Cascata Total'
  };

  const body = BAR_KEYS.map(k => {
    const b = bars[k];
    const lwBar = b.lw ? bars[b.lw] : null;

    // Comparativo entre os dois métodos de refino:
    let compareHtml = '—';
    if (b.lw && b.step !== null && b.cascade !== null) {
      if (b.stepDiff > 1e-2) {
        compareHtml = `<span class="pill win" title="Cascata economiza ${fmt(b.stepDiff, 1)} de prata por barra">Cascata (-${fmt(b.stepDiff, 0)})</span>`;
      } else if (b.stepDiff < -1e-2) {
        compareHtml = `<span class="pill win" style="background:#3b2a14;color:#f0a04b" title="Comprar a barra T-${b.lw} pronta economiza ${fmt(-b.stepDiff, 1)} de prata por barra">Barra Ant. (-${fmt(-b.stepDiff, 0)})</span>`;
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
      <td class="l">${b.q}× Minério ${b.ore ? `<span class="muted">(${fmt(b.ore.price)} em ${b.ore.loc})</span>${b.ore.slippageRisk ? ` <span class="slippage-pill badge-tip" title="${esc(b.ore.reason)}">⚠️ Média: ${fmt(b.ore.vwap)}s</span>` : ''}` : '<span class="neg">s/ preço</span>'}</td>
      <td class="l">${b.lw ? `T${b.lw} <span class="muted">(Mkt: ${fmt(lwBar?.buyC, 0)} | Cascat: ${fmt(lwBar?.cascade, 0)})</span>` : '—'}</td>
      <td class="${b.step !== null && b.bestRefineMethod === 'step' && b.lw ? 'pos' : ''}">${b.lw ? fmt(b.step, 1) : '—'}</td>
      <td class="${b.cascade !== null && b.bestRefineMethod === 'cascade' ? 'pos' : ''}">${fmt(b.cascade, 1)}</td>
      <td>${compareHtml}</td>
      <td>${b.buyC !== null ? fmt(b.buyC, 1) + (b.buy ? ` <span class="muted">(${b.buy.loc})</span>${b.buy.slippageRisk ? ` <span class="slippage-pill badge-tip" title="${esc(b.buy.reason)}">⚠️ Média: ${fmt(b.buy.vwap)}s</span>` : ''}` : '') : '<span class="muted">—</span>'}</td>
      <td class="l">
        <select data-origin="${k}">
          ${opt('auto', 'Automático (Mais Barato)', b.origin)}
          ${b.lw ? opt('step', 'Refinar: Barra Anterior Pronta', b.origin) : ''}
          ${opt('cascade', 'Refinar: Cascata Completa', b.origin)}
          ${opt('buy', 'Comprar Barra Pronta', b.origin)}
        </select>
      </td>
      <td><b class="pos">${fmt(b.eff, 1)}</b></td>
      <td><span class="tag ${tagClass}">${tagText}</span></td>
      <td class="${cls(b.saveVsBuy)}">${b.saveVsBuy !== null ? (b.saveVsBuy > 0 ? '+' : '') + fmt(b.saveVsBuy, 1) : '—'}</td>
    </tr>`;
  }).join('');

  return `
  <h2>Refino de Barras · Comparativo Estratégico (Cascata vs Barra Anterior)</h2>
  <div class="muted">
    Compare o custo real de refino entre dois métodos:
    <b>[Barra Anterior]</b> (compra a barra T-1 pronta no mercado mais barato + minério do tier) e 
    <b>[Cascata Completa]</b> (refina desde o T2 aproveitando os retornos acumulados).
    O sistema indica qual método gera o menor custo (com a economia em prata por barra) e abastece a Lista de Compras do Planejador de acordo com a sua escolha.
  </div>
  <div class="toolbar" style="margin-top:10px;margin-bottom:14px">
    <label>Modo de Compra de Minério/Barras<select data-cfg="materialPricing">
      ${opt('smart', '🛡️ Inteligente (Anti-Fake/Slippage)', ST.config.materialPricing)}
      ${opt('vwap', '📊 Preço Médio Real (VWAP)', ST.config.materialPricing)}
      ${opt('spot', '⚡ Menor Oferta Spot (Cru)', ST.config.materialPricing)}
      ${opt('buffer5', '🛡️ Spot + 5% Margem', ST.config.materialPricing)}
      ${opt('buffer10', '🛡️ Spot + 10% Margem', ST.config.materialPricing)}
    </select></label>
    <button class="ghost" id="fetchMaterialsVolume" style="margin-top:14px">📊 Buscar volumes & VWAP de minérios e barras</button>
  </div>
  <div class="tablewrap"><table>
    <tr>
      <th class="l">Barra</th>
      <th class="l">Minério Bruto</th>
      <th class="l">Barra Anterior (T-1)</th>
      <th>Custo [Barra Anterior]</th>
      <th>Custo [Cascata]</th>
      <th>Melhor Método</th>
      <th>Barra Pronta (Mercado)</th>
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
function viewPrices() {
  const tabs = [['ore', 'Minério'], ['bar', 'Barras'], ['art', 'Artefatos & Emblemas'], ['gear', 'Equipamentos (venda)']];
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
  if (priceTab === 'art') {
    const rows = [];
    if (GD.royal) {
      for (const t of [4, 5, 6, 7, 8]) {
        const s = GD.royal.sigils[t];
        if (s) rows.push({ id: s.id, label: `👑 ${esc(s.name)} <span class="muted">T${t} · Emblema Real</span>` });
      }
    }
    for (const v of GD.variants) if (v.artifact) for (const p of GD.pieces) for (let t = 4; t <= 8; t++) {
      const a = artOf(v.code, p.slot, t); rows.push({ id: a.id, label: `${esc(a.name)} <span class="muted">T${t} · ${esc(v.name)} ${p.name}</span>` });
    }
    content = priceTable(rows, GD.cities);
  }
  if (priceTab === 'gear') {
    const g = gearFilter, rows = [];
    for (const v of GD.variants) if (v.code === g.variant) for (const p of GD.pieces) if (!g.piece || g.piece === p.slot)
      for (const k of TIERS) if (tv(k)[0] >= Number(g.tmin)) rows.push({ id: itemId(v.code, p.slot, k), label: `${p.name} T${k}` });
    const curQ = Number(g.quality) || 1;
    content = `<div class="toolbar">
      <label>Variante<select data-gf="variant">${variantOpts(g.variant)}</select></label>
      <label>Peça<select data-gf="piece"><option value="">Todas</option>${pieceOpts(g.piece)}</select></label>
      <label>Tier mínimo<select data-gf="tmin">${[4, 5, 6, 7, 8].map(t => opt(t, 'T' + t, g.tmin)).join('')}</select></label>
      <label>Qualidade<select data-gf="quality">
        ${QUALITIES.map(qObj => opt(qObj.q, `${qObj.short} · ${qObj.name}`, curQ)).join('')}
      </select></label>
      <button class="ghost" id="fetchGearVolumes" style="margin-top:14px">📊 Buscar volumes (desta seleção)</button>
    </div>
    ${priceTable(rows, GD.saleLocs, '<th>Demanda / dia</th>', r => `<td>${volBadge(getBestVol(r.id))}</td>`, curQ)}`;
  }
  const last = ST.lastFetch ? new Date(ST.lastFetch).toLocaleString('pt-BR') : 'nunca';
  return `
  <h2>Preços</h2>
  <div class="card">
    <b>Buscar preços e volumes de mercado</b> <span class="muted">· Albion Data Project (dados enviados por jogadores; consulte preços por qualidade e preços médios de volume)</span>
    <div class="toolbar">
      <label>Servidor<select data-cfg="server">${opt('west', 'Américas (West)', ST.config.server)}${opt('east', 'Ásia (East)', ST.config.server)}${opt('europe', 'Europa', ST.config.server)}</select></label>
      <button class="btn" id="fetchAll" style="margin-top:14px">↻ Buscar todos os preços (Q1-Q5)</button>
      <button class="ghost" id="fetchTab" style="margin-top:14px">↻ Buscar preços desta aba</button>
      <button class="btn" id="fetchGearVolumesAll" style="margin-top:14px">📊 Buscar todos os volumes</button>
      <span class="muted" style="margin-top:14px">Última busca: ${last}</span>
    </div>
    <div class="muted">Compra = menor oferta de venda (sell min) nas cidades. Venda = menor oferta de venda nas cidades/Caerleon; no Mercado Negro = maior ordem de compra (buy max). Preços e volumes suportam qualidades Q1 a Q5.</div>
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
    ${row('retRefine', 'Retorno de recursos no REFINO', 'Ex.: 36,7% em cidade com bônus de minério; 15,2% sem bônus; ~53,9% com foco.', true)}
    ${row('retCraft', 'Retorno de recursos no CRAFT', 'Ex.: 24,8% em cidade com bônus de placas; 15,2% sem bônus; ~47,9% com foco.', true)}
    ${row('feeRefine', 'Taxa da fundição', 'Prata por 100 de nutrição (mostrada na estação).', false)}
    ${row('feeCraft', 'Taxa da forja de armaduras', 'Prata por 100 de nutrição.', false)}
  </table></div>
  <div class="card muted">
    <b style="color:var(--text)">Como é calculado</b><br>
    • Taxa de estação = valor do item × 0,1125 × taxa ÷ 100 (não é devolvida pelo retorno).<br>
    • Valor do item da peça = barras × valor da barra + valor do artefato.<br>
    • Artefatos não retornam no craft (confirmado nos dados do jogo).<br>
    • Lucro = melhor preço de venda × (1 − taxa de venda) − custo total.<br>
    • Seus dados ficam salvos em <code>site/data.json</code>.
  </div>
  <div class="toolbar"><button class="ghost" id="exportBtn">⬇ Exportar backup (JSON)</button>
    <label class="ghost" style="flex-direction:row;cursor:pointer;color:var(--text)">⬆ Importar backup<input type="file" id="importFile" accept=".json" hidden></label></div>`;
}

/* ---------------- API de preços ---------------- */
function allIds() {
  const ids = new Set();
  BAR_KEYS.forEach(k => { ids.add(oreId(k)); ids.add(barId(k)); });
  Object.values(GD.artifacts).forEach(a => ids.add(a.id));
  if (GD.royal) Object.values(GD.royal.sigils).forEach(s => ids.add(s.id));
  for (const v of GD.variants) for (const p of GD.pieces) for (const k of TIERS) ids.add(itemId(v.code, p.slot, k));
  return [...ids];
}
function tabIds() {
  if (priceTab === 'ore') return BAR_KEYS.map(oreId);
  if (priceTab === 'bar') return BAR_KEYS.map(barId);
  if (priceTab === 'art') {
    const list = Object.values(GD.artifacts).map(a => a.id);
    if (GD.royal) list.push(...Object.values(GD.royal.sigils).map(s => s.id));
    return list;
  }
  const g = gearFilter, ids = [];
  for (const p of GD.pieces) if (!g.piece || g.piece === p.slot) for (const k of TIERS) if (tv(k)[0] >= Number(g.tmin)) ids.push(itemId(g.variant, p.slot, k));
  return ids;
}
function planIds() {
  const ids = new Set();
  for (const r of ST.plan) {
    ids.add(itemId(r.code, r.slot, r.k));
    const [t] = tv(r.k);
    const v = variant(r.code);
    if (v && v.royal && GD.royal) {
      const sig = GD.royal.sigils[t];
      if (sig) ids.add(sig.id);
      for (const bCode of GD.royal.baseSets) ids.add(itemId(bCode, r.slot, r.k));
    } else {
      const a = (v && v.artifact) ? artOf(r.code, r.slot, t) : null;
      if (a) ids.add(a.id);
    }
    let k = r.k;
    while (k) { ids.add(barId(k)); ids.add(oreId(k)); k = lowerBar(k); }
  }
  return [...ids];
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
let FETCHING = false;
function chunkIds(ids, maxLen = 3500) {          // lotes limitados pelo tamanho da URL => menos requisições
  const out = []; let cur = [], len = 0;
  for (const id of ids) {
    if (cur.length && len + id.length + 3 > maxLen) { out.push(cur); cur = []; len = 0; }
    cur.push(id); len += id.length + 3;          // +3 = vírgula codificada (%2C)
  }
  if (cur.length) out.push(cur);
  return out;
}
async function fetchChunk(ch, locs, progress) {
  const url = `/api/prices?server=${ST.config.server}&items=${encodeURIComponent(ch.join(','))}&locations=${encodeURIComponent(locs)}`;
  for (let attempt = 1; attempt <= 6; attempt++) {
    const r = await fetch(url);
    const data = await r.json().catch(() => ({ error: 'resposta inválida' }));
    if (r.ok && !data.error) return data;
    if (r.status === 429 || r.status === 503) {   // limite da API: espera e tenta de novo
      let wait = Number(data.retryAfter) || Math.min(15 * attempt, 60);
      for (; wait > 0; wait--) { toast(`Limite da API atingido — aguardando ${wait}s (tentativa ${attempt}/6)… ${progress}`, 2000); await sleep(1000); }
      continue;
    }
    throw new Error(data.error || `HTTP ${r.status}`);
  }
  throw new Error('limite da API persistiu após várias tentativas; tente novamente em alguns minutos');
}
async function fetchPrices(ids) {
  if (FETCHING) return toast('Já existe uma busca em andamento…');
  FETCHING = true;
  document.querySelectorAll('#fetchAll,#fetchTab,#fetchPlan').forEach(b => b.disabled = true);
  const locs = GD.saleLocs.join(',');
  let got = 0, done = 0;
  const chunks = chunkIds(ids);
  try {
    for (let i = 0; i < chunks.length; i++) {
      const ch = chunks[i];
      const progress = `lote ${i + 1}/${chunks.length}`;
      toast(`Buscando preços (Q1-Q5)… ${Math.round(done / ids.length * 100)}% (${progress})`, 60000);
      const data = await fetchChunk(ch, locs, progress);
      for (const e of data) {
        const isGear = /_PLATE_/.test(e.item_id) && !/ARTEFACT/.test(e.item_id);
        const loc = e.city;
        if (!GD.saleLocs.includes(loc)) continue;
        if (!isGear && !GD.cities.includes(loc)) continue;
        let price = e.sell_price_min, date = e.sell_price_min_date;
        if (loc === 'Black Market') { price = e.buy_price_max; date = e.buy_price_max_date; }
        const q = String(e.quality || 1);
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
      done += ch.length;
      save();                                     // salva o progresso parcial
      if (i < chunks.length - 1) await sleep(1500); // respeita o limite da API
    }
    ST.lastFetch = new Date().toISOString();
    toast(`✓ ${got} preços atualizados (${ids.length} itens consultados em todas as qualidades).`);
  } catch (err) {
    toast(`Erro ao buscar preços: ${err.message}. ${got} preços obtidos antes do erro foram mantidos.`, 8000);
  } finally {
    FETCHING = false;
    changed();
  }
}

/* ---------------- API de volume e histórico ---------------- */
function gearIds() {
  const ids = [];
  for (const v of GD.variants) for (const p of GD.pieces) for (const k of TIERS) ids.push(itemId(v.code, p.slot, k));
  return ids;
}
function oreIds() { return BAR_KEYS.map(oreId); }
function barIds() { return BAR_KEYS.map(barId); }
function materialIds() { return [...oreIds(), ...barIds()]; }
function planAllIds() {
  const ids = new Set();
  for (const r of ST.plan) {
    ids.add(itemId(r.code, r.slot, r.k));
    let k = r.k;
    while (k) { ids.add(barId(k)); ids.add(oreId(k)); k = lowerBar(k); }
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
    if (f.variant && v.code !== f.variant) continue;
    for (const p of GD.pieces) {
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
  for (const p of GD.pieces) if (!g.piece || g.piece === p.slot)
    for (const k of TIERS) if (tv(k)[0] >= Number(g.tmin)) ids.push(itemId(g.variant, p.slot, k));
  return ids;
}

async function fetchVolumes(ids) {
  if (!ids || !ids.length) return toast('Nenhum item selecionado para buscar volume.');
  if (FETCHING) return toast('Já existe uma busca em andamento…');
  FETCHING = true;
  document.querySelectorAll('#fetchAll,#fetchTab,#fetchPlan,#fetchVolumesRank,#fetchPlanVolumes,#fetchGearVolumes,#fetchGearVolumesAll,#fetchMaterialsVolume,#fetchOreVolumes,#fetchBarVolumes').forEach(b => b.disabled = true);
  const locs = GD.saleLocs.join(',');
  let got = 0, done = 0;
  const chunks = chunkIds(ids, 1200);
  try {
    for (let i = 0; i < chunks.length; i++) {
      const ch = chunks[i];
      const progress = `lote ${i + 1}/${chunks.length}`;
      toast(`📊 Buscando volumes diários & VWAP… ${Math.round(done / ids.length * 100)}% (${progress})`, 60000);
      const url = `/api/history?server=${ST.config.server}&items=${encodeURIComponent(ch.join(','))}&locations=${encodeURIComponent(locs)}`;
      let data = null;
      for (let attempt = 1; attempt <= 6; attempt++) {
        const r = await fetch(url);
        data = await r.json().catch(() => ({ error: 'resposta inválida' }));
        if (r.ok && !data.error) break;
        if (r.status === 429 || r.status === 503) {
          let wait = Number(data.retryAfter) || Math.min(15 * attempt, 60);
          for (; wait > 0; wait--) {
            toast(`Limite da API — aguardando ${wait}s (tentativa ${attempt}/6)… ${progress}`, 2000);
            await sleep(1000);
          }
          continue;
        }
        throw new Error(data.error || `HTTP ${r.status}`);
      }

      if (Array.isArray(data)) {
        for (const entry of data) {
          const itemId = entry.item_id;
          const loc = entry.location;
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
      if (i < chunks.length - 1) await sleep(1200);
    }
    toast(`✓ Volumes e preços médios de ${got} séries atualizados (${ids.length} itens consultados).`);
  } catch (err) {
    toast(`Erro ao buscar volumes: ${err.message}. Dados obtidos foram mantidos.`, 8000);
  } finally {
    FETCHING = false;
    changed();
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
    if (d.plan !== undefined) { ST.plan[d.plan][d.f] = d.f === 'qty' ? Number(el.value) || 0 : el.value; return changed(); }
    if (d.origin) { ST.origins[d.origin] = el.value; return changed(); }
    if (d.cfg) {
      if (d.cfg === 'server' || d.cfg === 'materialPricing' || d.cfg === 'targetQuality') {
        ST.config[d.cfg] = el.value;
      } else {
        ST.config[d.cfg] = (d.pct === '1' ? Number(el.value) / 100 : Number(el.value));
      }
      return changed();
    }
    if (d.rf) { rankFilter[d.rf] = el.type === 'checkbox' ? el.checked : el.value; return render(); }
    if (d.gf) { gearFilter[d.gf] = el.value; return render(); }
    if (el.id === 'importFile' && el.files[0]) {
      el.files[0].text().then(t => { ST = JSON.parse(t); changed(); toast('Backup importado.'); }).catch(() => toast('Arquivo inválido.'));
    }
  });
  view.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input.num')) e.target.blur(); });
  view.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.id === 'addPlan') { const last = ST.plan[ST.plan.length - 1]; ST.plan.push(last ? { ...last } : { code: 'SET1', slot: 'ARMOR', k: '4.0', qty: 10 }); return changed(); }
    if (t.id === 'clearPlan') { if (confirm('Limpar todo o plano?')) { ST.plan = []; changed(); } return; }
    if (t.dataset.del !== undefined) { ST.plan.splice(Number(t.dataset.del), 1); return changed(); }
    if (t.dataset.addrank) { const [code, slot, k] = t.dataset.addrank.split('|'); ST.plan.push({ code, slot, k, qty: 10 }); save(); return toast('Adicionado ao planejador (10 un.).'); }
    if (t.dataset.ptab) { priceTab = t.dataset.ptab; return render(); }
    if (t.id === 'fetchAll') return fetchPrices(allIds());
    if (t.id === 'fetchTab') return fetchPrices(tabIds());
    if (t.id === 'fetchPlan') return fetchPrices(planIds());
    if (t.id === 'fetchVolumesRank') return fetchVolumes(rankGearIds());
    if (t.id === 'fetchPlanVolumes') return fetchVolumes(planAllIds());
    if (t.id === 'fetchGearVolumes') return fetchVolumes(currentGearTabIds());
    if (t.id === 'fetchGearVolumesAll') return fetchVolumes(gearIds());
    if (t.id === 'fetchMaterialsVolume') return fetchVolumes(materialIds());
    if (t.id === 'fetchOreVolumes') return fetchVolumes(oreIds());
    if (t.id === 'fetchBarVolumes') return fetchVolumes(barIds());
    if (t.id === 'exportBtn') {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(ST, null, 1)], { type: 'application/json' }));
      a.download = `albion-craft-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    }
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
  ST.prices ??= {}; ST.dates ??= {}; ST.origins ??= {}; ST.plan ??= []; ST.volumes ??= {};
  ST.qualityPrices ??= {}; ST.qualityDates ??= {}; ST.qualityAmounts ??= {}; ST.amounts ??= {};
  ST.config = {
    taxBuy: 0, taxSell: 0.065, retRefine: 0.367, retCraft: 0.248, feeRefine: 465, feeCraft: 465,
    server: 'west', materialPricing: 'smart', targetQuality: 'mix',
    ...ST.config
  };
  rankFilter.quality = rankFilter.quality || ST.config.targetQuality || 'mix';
  bind();
  render();
  checkLiveStatus();
  livePollTimer = setInterval(checkLiveStatus, 2500);
})();

'use strict';
/* Albion Craft · Placas — lógica de refino integrado + craft (mesma matemática da planilha). */

let GD = null;      // dados do jogo (receitas/artefatos)
let ST = null;      // estado do usuário (preços, config, plano)
let VIEW = 'plan';
let priceTab = 'ore';
let rankFilter = { variant: '', piece: '', tier: '', ench: '', onlyPriced: true, sort: 'profit' };
let gearFilter = { variant: 'SET1', piece: '', tmin: 4 };

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

/* ---------------- preços ---------------- */
function getP(id, loc) { const p = ST.prices[id]; return p && p[loc] > 0 ? p[loc] : null; }
function setP(id, loc, v) {
  ST.prices[id] = ST.prices[id] || {};
  if (v === null || v === '' || isNaN(v) || v <= 0) delete ST.prices[id][loc];
  else ST.prices[id][loc] = Number(v);
  if (ST.dates[id]) delete ST.dates[id][loc];   // preço manual: remove data da API
}
function minBuy(id) {
  let best = null;
  for (const c of GD.cities) { const v = getP(id, c); if (v && (!best || v < best.price)) best = { price: v, loc: c }; }
  return best;
}
function bestSell(id) {
  let best = null;
  for (const c of GD.saleLocs) { const v = getP(id, c); if (v && (!best || v > best.price)) best = { price: v, loc: c }; }
  return best;
}

/* ---------------- cálculos ---------------- */
function computeBars() {
  const c = ST.config, bars = {};
  for (const k of BAR_KEYS) {
    const [t, e] = tv(k);
    const iv = 2 ** t * 2 ** e;
    const q = ORE_QTY[t];
    const lw = lowerBar(k);
    const ore = minBuy(oreId(k));
    const buy = minBuy(barId(k));
    const fee = iv * 0.1125 * c.feeRefine / 100;
    const lwEff = lw ? bars[lw].eff : 0;
    const refine = (ore && lwEff !== null) ? (q * ore.price * (1 + c.taxBuy) + lwEff) * (1 - c.retRefine) + fee : null;
    const buyC = buy ? buy.price * (1 + c.taxBuy) : null;
    const origin = ST.origins[k] || 'auto';
    let eff = null, dec = null;
    if (origin === 'buy') { eff = buyC; dec = 'Comprar'; }
    else if (origin === 'refine') { eff = refine; dec = 'Refinar'; }
    else if (refine !== null && (buyC === null || refine <= buyC)) { eff = refine; dec = 'Refinar'; }
    else if (buyC !== null) { eff = buyC; dec = 'Comprar'; }
    if (eff === null) dec = null;
    bars[k] = { k, t, e, iv, q, lw, ore, buy, fee, refine, buyC, eff, dec, origin };
  }
  return bars;
}

function computeItem(bars, code, slot, k) {
  const c = ST.config, v = variant(code), p = piece(slot);
  const [t] = tv(k);
  const b = bars[k];
  const art = v.artifact ? artOf(code, slot, t) : null;
  const artBuy = art ? minBuy(art.id) : null;
  const barsCost = b.eff !== null ? p.bars * b.eff * (1 - c.retCraft) : null;
  const artCost = art ? (artBuy ? artBuy.price * (1 + c.taxBuy) : null) : 0;
  const iv = p.bars * b.iv + (art ? art.iv : 0);
  const fee = iv * 0.1125 * c.feeCraft / 100;
  const cost = (barsCost !== null && artCost !== null) ? barsCost + artCost + fee : null;
  const sell = bestSell(itemId(code, slot, k));
  const revenue = sell ? sell.price * (1 - c.taxSell) : null;
  const profit = (cost !== null && revenue !== null) ? revenue - cost : null;
  return {
    code, slot, k, t, v, p, art, artBuy, barsCost, artCost, iv, fee, cost, sell, revenue, profit,
    margin: profit !== null && cost ? profit / cost : null,
    name: `${v.name} · ${p.name} · T${k}`,
  };
}

function computePlan(bars) {
  const c = ST.config;
  const rows = ST.plan.map(r => {
    const it = computeItem(bars, r.code, r.slot, r.k);
    const qty = Number(r.qty) || 0;
    return { ...r, qty, it, totalCost: it.cost !== null ? it.cost * qty : null, totalProfit: it.profit !== null ? it.profit * qty : null };
  });
  // demanda de barras (líquida do retorno de craft)
  const direct = Object.fromEntries(BAR_KEYS.map(k => [k, 0]));
  const arts = {};
  for (const r of rows) {
    direct[r.k] += r.qty * r.it.p.bars * (1 - c.retCraft);
    if (r.it.art) {
      const id = r.it.art.id;
      arts[id] = arts[id] || { art: r.it.art, qty: 0, buy: r.it.artBuy };
      arts[id].qty += r.qty;
    }
  }
  const total = {};
  for (const k of [...BAR_KEYS].reverse()) {
    let d = direct[k];
    for (const k2 of BAR_KEYS) if (lowerBar(k2) === k && bars[k2].dec === 'Refinar') d += total[k2] * (1 - c.retRefine);
    total[k] = d;
  }
  const buyBars = [], buyOre = [], missing = [];
  for (const k of BAR_KEYS) {
    const q = total[k]; if (q < 1e-9) continue;
    const b = bars[k];
    if (b.dec === 'Comprar') buyBars.push({ k, qty: q, loc: b.buy && b.buy.loc, price: b.buyC, total: q * b.buyC });
    else if (b.dec === 'Refinar') {
      const oq = q * b.q * (1 - c.retRefine);
      buyOre.push({ k, qty: oq, refineQty: q, loc: b.ore.loc, price: b.ore.price * (1 + c.taxBuy), total: oq * b.ore.price * (1 + c.taxBuy) });
    } else missing.push(`Barra T${k}`);
  }
  const artList = Object.values(arts).map(a => ({ ...a, price: a.buy ? a.buy.price * (1 + c.taxBuy) : null, total: a.buy ? a.qty * a.buy.price * (1 + c.taxBuy) : null }));
  artList.filter(a => a.price === null).forEach(a => missing.push(a.art.name));
  const sum = arr => arr.reduce((s, x) => s + (x.total || 0), 0);
  const fees = rows.reduce((s, r) => s + r.it.fee * r.qty, 0)
    + Object.entries(total).reduce((s, [k, q]) => s + (bars[k].dec === 'Refinar' ? q * bars[k].fee : 0), 0);
  return {
    rows, buyBars, buyOre, artList, missing, total,
    invest: sum(buyBars) + sum(buyOre) + sum(artList), fees,
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
const variantOpts = sel => GD.variants.map(v => opt(v.code, v.name + (v.artifact ? ' ★' : ''), sel)).join('');
const pieceOpts = sel => GD.pieces.map(p => opt(p.slot, p.name, sel)).join('');
const tierOpts = sel => TIERS.map(k => opt(k, 'T' + k, sel)).join('');

/* ----- Planejador ----- */
function viewPlan() {
  const bars = computeBars();
  const P = computePlan(bars);
  const rows = P.rows.map((r, i) => `
    <tr>
      <td class="l"><select data-plan="${i}" data-f="code">${variantOpts(r.code)}</select></td>
      <td class="l"><select data-plan="${i}" data-f="slot">${pieceOpts(r.slot)}</select></td>
      <td class="l"><select data-plan="${i}" data-f="k">${tierOpts(r.k)}</select></td>
      <td><input class="num" type="number" min="0" data-plan="${i}" data-f="qty" data-fk="plan-${i}" value="${r.qty}"></td>
      <td>${fmt(r.it.barsCost)}</td>
      <td>${r.it.art ? fmt(r.it.artCost) : '<span class="muted">—</span>'}</td>
      <td>${fmt(r.it.fee)}</td>
      <td><b>${fmt(r.it.cost)}</b></td>
      <td class="best">${r.it.sell ? fmt(r.it.sell.price) : '<span class="muted">sem preço</span>'}</td>
      <td class="l">${r.it.sell ? locName(r.it.sell.loc) : ''}</td>
      <td class="${cls(r.it.profit)}">${fmt(r.it.profit)}</td>
      <td class="${cls(r.it.margin)}">${pct(r.it.margin)}</td>
      <td class="${cls(r.totalProfit)}"><b>${fmt(r.totalProfit)}</b></td>
      <td><button class="icon" data-del="${i}" title="Remover">✕</button></td>
    </tr>`).join('');
  const list = (title, items, cols) => `
    <div class="card"><h3 style="margin-top:0">${title}</h3>
    ${items.length ? `<table><tr>${cols.map(c => `<th class="${c[2] || ''}">${c[0]}</th>`).join('')}</tr>
      ${items.map(x => `<tr>${cols.map(c => `<td class="${c[2] || ''}">${c[1](x)}</td>`).join('')}</tr>`).join('')}</table>`
      : '<div class="empty">Nada a comprar</div>'}</div>`;
  return `
  <h2>Planejador de craft</h2>
  <div class="muted">Escolha o que vai craftar. A lista de compras considera o retorno de recursos (refino e craft) e a decisão refinar × comprar da aba Refino.</div>
  <div class="cards">
    <div class="stat"><div class="label">Total a investir (compras)</div><div class="value">${fmt(P.invest)}</div></div>
    <div class="stat"><div class="label">Taxas de barraca (refino + craft)</div><div class="value">${fmt(P.fees)}</div></div>
    <div class="stat"><div class="label">Receita líquida esperada</div><div class="value">${fmt(P.revenue)}</div></div>
    <div class="stat"><div class="label">Lucro esperado</div><div class="value ${cls(P.profit)}">${fmt(P.profit)}</div></div>
  </div>
  ${P.missing.length ? `<div class="card" style="border-color:#6b5a2a">⚠️ Faltam preços para: <b>${esc([...new Set(P.missing)].join(', '))}</b> — preencha na aba Preços ou use “Buscar preços”.</div>` : ''}
  <div class="tablewrap"><table>
    <tr><th class="l">Variante</th><th class="l">Peça</th><th class="l">Tier</th><th>Qtd</th><th>Barras (líq.)</th><th>Artefato</th><th>Taxa ferreiro</th>
    <th>Custo / peça</th><th>Melhor venda</th><th class="l">Local</th><th>Lucro / peça</th><th>Margem</th><th>Lucro total</th><th></th></tr>
    ${rows || '<tr><td colspan="14" class="empty">Nenhum item planejado. Clique em “Adicionar item” ou use o Ranking.</td></tr>'}
  </table></div>
  <div class="toolbar"><button class="btn" id="addPlan">+ Adicionar item</button>
    ${ST.plan.length ? '<button class="ghost" id="clearPlan">Limpar plano</button><button class="ghost" id="fetchPlan">↻ Buscar preços só do plano</button>' : ''}</div>
  <h3>Lista de compras</h3>
  <div class="grid3">
    ${list('Minério (para refinar)', P.buyOre, [['Minério', x => 'T' + x.k, 'l'], ['Qtd', x => fmt(Math.ceil(x.qty))], ['Cidade', x => x.loc, 'l'], ['Preço', x => fmt(x.price)], ['Total', x => fmt(x.total)], ['Barras a refinar', x => fmt(Math.ceil(x.refineQty))]])}
    ${list('Barras prontas', P.buyBars, [['Barra', x => 'T' + x.k, 'l'], ['Qtd', x => fmt(Math.ceil(x.qty))], ['Cidade', x => x.loc || '', 'l'], ['Preço', x => fmt(x.price)], ['Total', x => fmt(x.total)]])}
    ${list('Artefatos', P.artList, [['Artefato', x => esc(x.art.name) + ` <span class="muted">T${x.art.id[1]}</span>`, 'l'], ['Qtd', x => fmt(x.qty)], ['Cidade', x => x.buy ? x.buy.loc : '<span class="neg">sem preço</span>', 'l'], ['Preço', x => fmt(x.price)], ['Total', x => fmt(x.total)]])}
  </div>
  <div class="muted">Quantidades arredondadas para cima. As barras T2/T3 usadas como base do refino entram automaticamente na cadeia.</div>`;
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
    items.push(it);
  }
  const key = { profit: 'profit', margin: 'margin', cost: 'cost' }[f.sort];
  items.sort((a, b) => (b[key] ?? -Infinity) - (a[key] ?? -Infinity));
  const body = items.slice(0, 600).map(it => `
    <tr><td class="l">${esc(it.v.name)}</td><td class="l">${it.p.name}</td><td class="l">T${it.k}</td>
    <td>${fmt(it.barsCost)}</td><td>${it.art ? fmt(it.artCost) : '—'}</td><td class="l muted">${it.art ? esc(it.art.name) + (it.artBuy ? ' · ' + it.artBuy.loc : '') : ''}</td>
    <td>${fmt(it.fee)}</td><td><b>${fmt(it.cost)}</b></td>
    <td class="best">${it.sell ? fmt(it.sell.price) : '—'}</td><td class="l">${it.sell ? locName(it.sell.loc) : ''}</td>
    <td class="${cls(it.profit)}"><b>${fmt(it.profit)}</b></td><td class="${cls(it.margin)}">${pct(it.margin)}</td>
    <td><button class="ghost" data-addrank="${it.code}|${it.slot}|${it.k}">+ planejar</button></td></tr>`).join('');
  return `
  <h2>Ranking de lucro</h2>
  <div class="muted">Todas as combinações de variante × peça × tier, calculadas com seus preços atuais.</div>
  <div class="toolbar">
    <label>Variante<select data-rf="variant"><option value="">Todas</option>${variantOpts(f.variant)}</select></label>
    <label>Peça<select data-rf="piece"><option value="">Todas</option>${pieceOpts(f.piece)}</select></label>
    <label>Tier<select data-rf="tier"><option value="">Todos</option>${[4, 5, 6, 7, 8].map(t => opt(t, 'T' + t, f.tier)).join('')}</select></label>
    <label>Encantamento<select data-rf="ench"><option value="">Todos</option>${[0, 1, 2, 3, 4].map(e => opt(e, '.' + e, f.ench)).join('')}</select></label>
    <label>Ordenar por<select data-rf="sort">${opt('profit', 'Lucro', f.sort)}${opt('margin', 'Margem', f.sort)}${opt('cost', 'Custo', f.sort)}</select></label>
    <label style="flex-direction:row;align-items:center;gap:6px;margin-top:14px"><input type="checkbox" data-rf="onlyPriced" ${f.onlyPriced ? 'checked' : ''}> só com preço completo</label>
    <span class="muted" style="margin-top:14px">${items.length} itens</span>
  </div>
  <div class="tablewrap"><table>
    <tr><th class="l">Variante</th><th class="l">Peça</th><th class="l">Tier</th><th>Barras (líq.)</th><th>Artefato</th><th class="l">Artefato / cidade</th>
    <th>Taxa</th><th>Custo</th><th>Melhor venda</th><th class="l">Local</th><th>Lucro</th><th>Margem</th><th></th></tr>
    ${body || '<tr><td colspan="13" class="empty">Nenhum item com preços completos. Busque/preencha preços na aba Preços ou desmarque o filtro.</td></tr>'}
  </table></div>`;
}

/* ----- Refino ----- */
function viewRefine() {
  const bars = computeBars();
  const body = BAR_KEYS.map(k => {
    const b = bars[k];
    return `<tr><td class="l"><b>T${k}</b></td><td>${b.iv}</td><td class="l">${b.q}× minério + ${b.lw ? '1× barra T' + b.lw : '—'}</td>
      <td>${b.ore ? fmt(b.ore.price) : '—'}</td><td class="l">${b.ore ? b.ore.loc : ''}</td>
      <td>${fmt(b.fee, 1)}</td><td>${fmt(b.refine, 1)}</td>
      <td>${fmt(b.buyC, 1)}</td><td class="l">${b.buy ? b.buy.loc : ''}</td>
      <td class="l"><select data-origin="${k}">${opt('auto', 'Automático', b.origin)}${opt('refine', 'Refinar', b.origin)}${opt('buy', 'Comprar', b.origin)}</select></td>
      <td><b class="pos">${fmt(b.eff, 1)}</b></td>
      <td>${b.dec ? `<span class="tag ${b.dec.toLowerCase()}">${b.dec}</span>` : '<span class="muted">sem preço</span>'}</td>
      <td class="${b.refine !== null && b.buyC !== null ? cls(b.buyC - b.refine) : ''}">${b.refine !== null && b.buyC !== null ? fmt(b.buyC - b.refine, 1) : '—'}</td></tr>`;
  }).join('');
  return `
  <h2>Refino de barras · custo unitário real</h2>
  <div class="muted">Custo ao refinar = (minério + barra inferior) × (1 − retorno) + taxa da fundição. A barra inferior usa o custo efetivo dela (cadeia integrada). T4.x usa a T3.0; T5+ usa a barra inferior do mesmo encantamento.</div>
  <div class="tablewrap" style="margin-top:12px"><table>
    <tr><th class="l">Barra</th><th>Valor item</th><th class="l">Receita</th><th>Minério (menor)</th><th class="l">Cidade</th><th>Taxa fundição</th>
    <th>Custo ao REFINAR</th><th>Barra pronta</th><th class="l">Cidade</th><th class="l">Origem</th><th>Custo efetivo</th><th>Decisão</th><th>Economia ao refinar</th></tr>
    ${body}</table></div>`;
}

/* ----- Preços ----- */
function priceInput(id, loc) {
  const v = getP(id, loc);
  const d = ST.dates[id] && ST.dates[id][loc];
  const stale = d && (Date.now() - new Date(d + 'Z').getTime()) > 48 * 3600e3;
  const title = d ? `Albion Data: ${new Date(d + 'Z').toLocaleString('pt-BR')}` : 'manual';
  return `<input class="num${stale ? ' stale' : ''}" type="number" min="0" data-pid="${id}" data-loc="${loc}" data-fk="${id}|${loc}" value="${v ?? ''}" title="${esc(title)}">`;
}
function priceTable(rows, locs, extraHead = '', extra = () => '') {
  return `<div class="tablewrap"><table><tr><th class="l">Item</th>${extraHead}${locs.map(l => `<th>${locName(l)}</th>`).join('')}<th>Menor</th><th>Maior</th></tr>
    ${rows.map(r => {
      const vals = locs.map(l => getP(r.id, l)).filter(Boolean);
      return `<tr><td class="l">${r.label}</td>${extra(r)}${locs.map(l => `<td>${priceInput(r.id, l)}</td>`).join('')}
        <td class="pos">${vals.length ? fmt(Math.min(...vals)) : '—'}</td><td class="best">${vals.length ? fmt(Math.max(...vals)) : '—'}</td></tr>`;
    }).join('')}</table></div>`;
}
function viewPrices() {
  const tabs = [['ore', 'Minério'], ['bar', 'Barras'], ['art', 'Artefatos'], ['gear', 'Equipamentos (venda)']];
  let content = '';
  if (priceTab === 'ore') content = priceTable(BAR_KEYS.map(k => ({ id: oreId(k), label: `Minério T${k}` })), GD.cities);
  if (priceTab === 'bar') content = priceTable(BAR_KEYS.map(k => ({ id: barId(k), label: `Barra T${k}` })), GD.cities);
  if (priceTab === 'art') {
    const rows = [];
    for (const v of GD.variants) if (v.artifact) for (const p of GD.pieces) for (let t = 4; t <= 8; t++) {
      const a = artOf(v.code, p.slot, t); rows.push({ id: a.id, label: `${esc(a.name)} <span class="muted">T${t} · ${esc(v.name)} ${p.name}</span>` });
    }
    content = priceTable(rows, GD.cities);
  }
  if (priceTab === 'gear') {
    const g = gearFilter, rows = [];
    for (const v of GD.variants) if (v.code === g.variant) for (const p of GD.pieces) if (!g.piece || g.piece === p.slot)
      for (const k of TIERS) if (tv(k)[0] >= Number(g.tmin)) rows.push({ id: itemId(v.code, p.slot, k), label: `${p.name} T${k}` });
    content = `<div class="toolbar">
      <label>Variante<select data-gf="variant">${variantOpts(g.variant)}</select></label>
      <label>Peça<select data-gf="piece"><option value="">Todas</option>${pieceOpts(g.piece)}</select></label>
      <label>Tier mínimo<select data-gf="tmin">${[4, 5, 6, 7, 8].map(t => opt(t, 'T' + t, g.tmin)).join('')}</select></label></div>
      ${priceTable(rows, GD.saleLocs)}`;
  }
  const last = ST.lastFetch ? new Date(ST.lastFetch).toLocaleString('pt-BR') : 'nunca';
  return `
  <h2>Preços</h2>
  <div class="card">
    <b>Buscar preços automaticamente</b> <span class="muted">· Albion Data Project (dados enviados por jogadores; podem estar desatualizados — passe o mouse sobre um preço para ver a data, bordas amareladas = mais de 48h)</span>
    <div class="toolbar">
      <label>Servidor<select data-cfg="server">${opt('west', 'Américas (West)', ST.config.server)}${opt('east', 'Ásia (East)', ST.config.server)}${opt('europe', 'Europa', ST.config.server)}</select></label>
      <button class="btn" id="fetchAll" style="margin-top:14px">↻ Buscar todos os preços</button>
      <button class="ghost" id="fetchTab" style="margin-top:14px">↻ Buscar só desta aba</button>
      <span class="muted" style="margin-top:14px">Última busca: ${last}</span>
    </div>
    <div class="muted">Compra = menor oferta de venda (sell min) nas cidades. Venda = menor oferta de venda nas cidades/Caerleon; no Mercado Negro = maior ordem de compra (buy max). Qualidade Normal. Você pode editar qualquer valor manualmente.</div>
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
  for (const v of GD.variants) for (const p of GD.pieces) for (const k of TIERS) ids.add(itemId(v.code, p.slot, k));
  return [...ids];
}
function tabIds() {
  if (priceTab === 'ore') return BAR_KEYS.map(oreId);
  if (priceTab === 'bar') return BAR_KEYS.map(barId);
  if (priceTab === 'art') return Object.values(GD.artifacts).map(a => a.id);
  const g = gearFilter, ids = [];
  for (const p of GD.pieces) if (!g.piece || g.piece === p.slot) for (const k of TIERS) if (tv(k)[0] >= Number(g.tmin)) ids.push(itemId(g.variant, p.slot, k));
  return ids;
}
function planIds() {
  const ids = new Set();
  for (const r of ST.plan) {
    ids.add(itemId(r.code, r.slot, r.k));
    const [t] = tv(r.k);
    const a = variant(r.code).artifact ? artOf(r.code, r.slot, t) : null;
    if (a) ids.add(a.id);
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
      toast(`Buscando preços… ${Math.round(done / ids.length * 100)}% (${progress})`, 60000);
      const data = await fetchChunk(ch, locs, progress);
      for (const e of data) {
        const isGear = /_PLATE_/.test(e.item_id) && !/ARTEFACT/.test(e.item_id);
        const loc = e.city;
        if (!GD.saleLocs.includes(loc)) continue;
        if (!isGear && !GD.cities.includes(loc)) continue;
        let price = e.sell_price_min, date = e.sell_price_min_date;
        if (loc === 'Black Market') { price = e.buy_price_max; date = e.buy_price_max_date; }
        if (price > 0) {
          ST.prices[e.item_id] = ST.prices[e.item_id] || {};
          ST.prices[e.item_id][loc] = price;
          ST.dates[e.item_id] = ST.dates[e.item_id] || {};
          ST.dates[e.item_id][loc] = date;
          got++;
        }
      }
      done += ch.length;
      save();                                     // salva o progresso parcial
      if (i < chunks.length - 1) await sleep(1500); // respeita o limite da API
    }
    ST.lastFetch = new Date().toISOString();
    toast(`✓ ${got} preços atualizados (${ids.length} itens consultados).`);
  } catch (err) {
    toast(`Erro ao buscar preços: ${err.message}. ${got} preços obtidos antes do erro foram mantidos.`, 8000);
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
    if (d.pid) { setP(d.pid, d.loc, el.value === '' ? null : Number(el.value)); return changed(); }
    if (d.plan !== undefined) { ST.plan[d.plan][d.f] = d.f === 'qty' ? Number(el.value) || 0 : el.value; return changed(); }
    if (d.origin) { ST.origins[d.origin] = el.value; return changed(); }
    if (d.cfg) { ST.config[d.cfg] = d.cfg === 'server' ? el.value : (d.pct === '1' ? Number(el.value) / 100 : Number(el.value)); return changed(); }
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
    if (t.id === 'exportBtn') {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(ST, null, 1)], { type: 'application/json' }));
      a.download = `albion-craft-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    }
  });
}

(async function init() {
  [GD, ST] = await Promise.all([fetch('/api/gamedata').then(r => r.json()), fetch('/api/state').then(r => r.json())]);
  ST.prices ??= {}; ST.dates ??= {}; ST.origins ??= {}; ST.plan ??= [];
  ST.config = { taxBuy: 0, taxSell: 0.065, retRefine: 0.367, retCraft: 0.248, feeRefine: 465, feeCraft: 465, server: 'west', ...ST.config };
  bind();
  render();
})();

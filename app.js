const DATA_URL = 'data/bedrock_verdicts.json';

let allListings = [];
let filtered = [];

// ── Formatters ───────────────────────────────────────────────────────────────

function fmtPrice(val) {
  if (val == null) return '—';
  return '£' + Number(val).toLocaleString('en-GB');
}

function fmtYield(val) {
  if (val == null) return '—';
  return Number(val).toFixed(2) + '%';
}

function fmtYears(val) {
  if (val == null) return '—';
  return Number(val).toFixed(1) + ' yrs';
}

function fmtVal(val) {
  return (val != null && val !== '') ? String(val) : '—';
}

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Sorting ──────────────────────────────────────────────────────────────────

function sortListings(list) {
  return [...list].sort((a, b) => {
    const sa = a.score ?? -1;
    const sb = b.score ?? -1;
    if (sb !== sa) return sb - sa;
    const ya = a.financials?.gross_yield_pct ?? -1;
    const yb = b.financials?.gross_yield_pct ?? -1;
    return yb - ya;
  });
}

// ── Card rendering ───────────────────────────────────────────────────────────

function verdictBadge(verdict, score) {
  const scoreHtml = score != null
    ? `<span class="badge-score">${escHtml(score)}</span>`
    : '';
  return `<span class="verdict-badge ${escHtml(verdict)}">${escHtml(verdict)}${scoreHtml}</span>`;
}

function infoIcon(complete, brochureUrl) {
  if (complete) {
    return `<span class="info-icon info-icon--complete" title="Information complete">
      <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="8" r="7" fill="currentColor" opacity=".15"/>
        <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/>
        <path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </span>`;
  }
  return `<a class="info-icon info-icon--incomplete" href="${escHtml(brochureUrl)}" target="_blank" rel="noopener noreferrer" title="Information incomplete — view brochure">
    <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="7" fill="currentColor" opacity=".12"/>
      <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/>
      <path d="M8 5v3.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
      <circle cx="8" cy="11" r=".75" fill="currentColor"/>
    </svg>
  </a>`;
}

function dataItem(key, val) {
  return `<div class="di"><span class="k">${key}</span><span class="v">${escHtml(fmtVal(val))}</span></div>`;
}

function renderActiveCard(l) {
  const imgEl = l.image_url
    ? `<img class="card-image" src="${escHtml(l.image_url)}" alt="" loading="lazy">`
    : `<div class="card-image-placeholder">No image</div>`;

  const a = l.asset || {};
  const f = l.financials || {};
  const le = l.lease || {};
  const t = l.tenant || {};

  const dataRows = [
    dataItem('Asset type', a.type),
    dataItem('Tenure', a.tenure),
    dataItem('Asking price', fmtPrice(f.asking_price)),
    dataItem('Gross yield', fmtYield(f.gross_yield_pct)),
    dataItem('Residual lease', fmtYears(le.residual_years)),
    dataItem('Lease type', le.type),
    le.tenant_break ? dataItem('Break clause', le.tenant_break) : '',
    dataItem('Tenant', t.name),
    dataItem('Covenant', t.covenant_strength),
  ].join('');

  const flagItems = (l.flags || []).map(f => `<li>${escHtml(f)}</li>`).join('');
  const flagsBlock = flagItems
    ? `<div class="card-divider"></div><ul class="flags-list">${flagItems}</ul>`
    : '';

  const nextStep = l.next_step
    ? `<div class="next-step"><div class="block-label">Next step</div><p>${escHtml(l.next_step)}</p></div>`
    : '';

  const auctionDateLine = l.auction_date
    ? `<div style="font-size:11px;color:#9333ea;margin-top:3px">Auction: ${escHtml(l.auction_date)}</div>`
    : '';
  const auctionBid = (l.auction && l.auction_max_bid != null)
    ? `<div class="auction-bid"><div class="block-label">Auction max bid</div><p>${fmtPrice(l.auction_max_bid)}</p>${auctionDateLine}</div>`
    : '';

  return `
<article class="card">
  ${imgEl}
  <div class="card-body">
    <div class="card-top">
      <div class="card-address">
        <a href="${escHtml(l.url)}" target="_blank" rel="noopener noreferrer">${escHtml(l.address)}</a>
      </div>
      <div class="card-top-right">
        ${infoIcon(l.information_complete, l.brochure_url)}
        ${verdictBadge(l.verdict, l.score)}
      </div>
    </div>
    <div class="data-grid">${dataRows}</div>
    ${flagsBlock}
    ${nextStep}
    ${auctionBid}
  </div>
</article>`.trim();
}

function renderRejectRow(l) {
  return `
<div class="reject-row">
  <div class="reject-info">
    <div class="reject-address">
      <a href="${escHtml(l.url)}" target="_blank" rel="noopener noreferrer">${escHtml(l.address)}</a>
    </div>
    <div class="reject-reason">${escHtml(l.reject_reason || '—')}</div>
  </div>
  ${infoIcon(l.information_complete, l.brochure_url)}
</div>`.trim();
}

// ── Stats bar ────────────────────────────────────────────────────────────────

function renderStats() {
  const total = allListings.length;
  const proceed  = allListings.filter(l => l.verdict === 'PROCEED').length;
  const marginal = allListings.filter(l => l.verdict === 'MARGINAL').length;
  const reject   = allListings.filter(l => l.verdict === 'REJECT').length;
  const lastScrape = allListings.reduce((best, l) =>
    l.date_scraped > (best || '') ? l.date_scraped : best, null);
  document.getElementById('last-scrape').textContent =
    lastScrape ? `Last scraped ${lastScrape}` : '';
  document.getElementById('stats-bar').innerHTML = `
    <div class="stat-chip">
      <span class="s-label">Screened</span>
      <span class="s-value">${total}</span>
    </div>
    <div class="stat-chip proceed">
      <span class="s-label">Proceed</span>
      <span class="s-value">${proceed}</span>
    </div>
    <div class="stat-chip marginal">
      <span class="s-label">Marginal</span>
      <span class="s-value">${marginal}</span>
    </div>
    <div class="stat-chip reject">
      <span class="s-label">Reject</span>
      <span class="s-value">${reject}</span>
    </div>
  `;
}

// ── Filters ──────────────────────────────────────────────────────────────────

function getFilters() {
  return {
    verdict: document.getElementById('filter-verdict').value,
    asset:   document.getElementById('filter-asset').value,
  };
}

function applyFilters() {
  const f = getFilters();
  filtered = allListings.filter(l => {
    if (f.verdict && l.verdict !== f.verdict) return false;
    if (f.asset   && (l.asset?.type || '') !== f.asset) return false;
    return true;
  });
  render();
}

function populateFilterOptions() {
  const assetTypes = [...new Set(
    allListings.map(l => l.asset?.type).filter(Boolean)
  )].sort();
  const assetEl = document.getElementById('filter-asset');
  assetTypes.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    assetEl.appendChild(opt);
  });

}

// ── Render ───────────────────────────────────────────────────────────────────

function render() {
  const active  = filtered.filter(l => l.verdict === 'PROCEED' || l.verdict === 'MARGINAL');
  const rejects = filtered.filter(l => l.verdict === 'REJECT');

  // Section headings
  document.getElementById('active-heading').textContent =
    `PROCEED / MARGINAL (${active.length})`;
  document.getElementById('reject-heading').textContent =
    `REJECT (${rejects.length})`;

  // Active cards
  const cardsEl = document.getElementById('cards-active');
  if (active.length === 0) {
    cardsEl.innerHTML = '<div class="empty-state">No listings match the current filters.</div>';
  } else {
    cardsEl.innerHTML = active.map(renderActiveCard).join('');
  }

  // Reject rows
  document.getElementById('cards-reject').innerHTML = rejects.map(renderRejectRow).join('');

  // Auto-open reject section when filtering by REJECT
  const details = document.getElementById('reject-details');
  if (getFilters().verdict === 'REJECT') {
    details.open = true;
  }
}

// ── Boot ─────────────────────────────────────────────────────────────────────

async function init() {
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status} — could not load ${DATA_URL}`);
    const data = await res.json();
    allListings = sortListings(data);
    filtered = allListings;
    renderStats();
    populateFilterOptions();
    render();
  } catch (err) {
    document.getElementById('main').innerHTML =
      `<div class="error-state">Failed to load data.<br><small>${escHtml(err.message)}</small></div>`;
  }
}

document.getElementById('filter-verdict').addEventListener('change', applyFilters);
document.getElementById('filter-asset').addEventListener('change', applyFilters);

init();

/* ============ views ============ */
function sushiPlate(cx, cy, colour, kind){
  const maki = (x, filling) => `<g transform="translate(${x},${cy + 6})">
      <ellipse cx="0" cy="0" rx="13" ry="5" fill="#16211e"/>
      <rect x="-13" y="-16" width="26" height="16" fill="#16211e"/>
      <ellipse cx="0" cy="-16" rx="13" ry="5" fill="#16211e"/>
      <ellipse cx="0" cy="-16" rx="10" ry="3.8" fill="#f6f1e4"/>
      <ellipse cx="0" cy="-16" rx="4.5" ry="1.9" fill="${filling}"/>
    </g>`;
  const prawn = `<g transform="translate(${cx - 2},${cy + 8})">
      <rect x="-16" y="-12" width="32" height="13" rx="6" fill="#f6f1e4"/>
      <path d="M-21,-9 Q-20,-23 0,-23 Q20,-23 21,-9 Q21,-3 14,-6 Q0,-3 -14,-6 Q-21,-3 -21,-9Z" fill="#f4a38a"/>
      <path d="M-11,-21 Q-8,-14 -11,-8 M-3,-22 Q0,-14 -3,-7 M5,-22 Q8,-14 5,-7 M13,-20 Q15,-14 13,-9" stroke="#e5714e" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <path d="M19,-11 Q29,-16 32,-7 Q27,-9 25,-4 Q22,-7 19,-6Z" fill="#e8643f"/>
    </g>`;
  const inari = `<g transform="translate(${cx},${cy + 8})">
      <path d="M-17,0 Q-20,-14 -11,-19 L11,-19 Q20,-14 17,0 Q0,4 -17,0Z" fill="#c98a2b" stroke="#a86d1c" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M-13,-12 Q-15,-6 -13,-3" stroke="rgba(255,255,255,.3)" stroke-width="2" fill="none" stroke-linecap="round"/>
      <ellipse cx="0" cy="-19" rx="11" ry="4" fill="#f6f1e4"/>
      <circle cx="-4" cy="-19.5" r="1.1" fill="#9a8a5f"/><circle cx="1" cy="-18.5" r="1.1" fill="#9a8a5f"/><circle cx="5" cy="-20" r="1.1" fill="#9a8a5f"/>
    </g>`;
  const fills = ['#f0866a', '#8fce6b'];
  const items = {
    maki: maki(cx, fills[0]),
    maki2: maki(cx - 20, fills[0]) + maki(cx + 20, fills[1]),
    prawn, inari
  };
  return `<ellipse cx="${cx}" cy="${cy + 6}" rx="70" ry="23" fill="rgba(0,0,0,.35)"/>
    <ellipse cx="${cx}" cy="${cy}" rx="70" ry="23" fill="${colour}"/>
    <ellipse cx="${cx}" cy="${cy}" rx="47" ry="13.5" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="2.5"/>
    ${items[kind]}`;
}
function soyFish(x, y, rot, flip){
  const k = 0.72;   // overall size
  return `<g transform="translate(${x},${y}) rotate(${rot}) scale(${(flip ? -1 : 1) * k},${k})">
    <path d="M-20,-3 L-13,-5 L-13,5 L-20,3Z" fill="rgba(238,234,244,.7)"/>
    <path d="M-19,0 L-33,-9 Q-28,0 -33,9Z" fill="rgba(238,234,244,.75)" stroke="rgba(255,255,255,.35)" stroke-width="1"/>
    <path d="M-3,9 Q4,16 13,9Z" fill="#c9761f"/>
    <path d="M-3,-9 Q3,-15 9,-9Z" fill="#c9761f"/>
    <path d="M-16,0 Q-12,-11 4,-11 Q20,-10 24,-3 L24,3 Q20,10 4,11 Q-12,11 -16,0Z" fill="#150b08" stroke="rgba(255,255,255,.28)" stroke-width="1.2"/>
    <path d="M-8,-6 Q4,-9.5 16,-5.5" stroke="rgba(255,255,255,.25)" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M-6,-1 q3,3 6,0 M0,-1 q3,3 6,0 M6,-1 q3,3 6,0 M-3,4 q3,3 6,0 M3,4 q3,3 6,0" stroke="rgba(255,255,255,.14)" stroke-width="1" fill="none"/>
    <rect x="23.5" y="-4" width="8" height="8" rx="2.2" fill="#d62f36"/>
    <path d="M26.2,-4 v8 M28.8,-4 v8" stroke="rgba(0,0,0,.22)" stroke-width="1"/>
  </g>`;
}
const HERO_PLATES = `<svg class="hero-plates" viewBox="0 0 340 206" role="img" aria-label="Plates of sushi and soy sauce fish on a conveyor belt">
  ${sushiPlate(90, 62, '#3e8ef7', 'maki')}${sushiPlate(250, 62, '#f5a524', 'maki2')}
  ${sushiPlate(90, 148, '#e7d24f', 'prawn')}${sushiPlate(250, 148, '#b9bec2', 'inari')}
  ${soyFish(132, 110, -7, false)}${soyFish(208, 110, 7, true)}
</svg>`;

function viewPick(){
  const hero = `<div class="hero">
      <h1 class="hero-title">Sushi Train <span>Track</span></h1>
      <div class="belt" aria-hidden="true"></div>
      ${HERO_PLATES}
    </div>`;
  let picker;
  if (!S.restaurants.length) {
    picker = `<div class="picker">
      <p class="intro">Add the sushi train you're at, set the colour and price of each plate, then tap as you grab them.</p>
      <button class="btn primary big" data-act="new">Get started</button>
    </div>`;
  } else if (isPremium()) {
    const opts = S.restaurants.map(r => {
      const t = totalOf(r);
      return `<option value="${r.id}">${esc(r.name)}${t ? ` · ${money(t, r)} so far` : ''}</option>`;
    }).join('');
    picker = `<div class="picker">
      <label class="pick-label" for="rest-select">Pick your restaurant</label>
      <div class="select-wrap">
        <select id="rest-select">
          <option value="" disabled selected>Choose…</option>
          ${opts}
          <option value="__new">+ Add new restaurant</option>
        </select>
      </div>
    </div>`;
  } else {
    // free: one restaurant, no picker
    const first = S.restaurants[0], more = S.restaurants.length - FREE_RESTAURANTS;
    picker = `<div class="picker">
      <div class="pick-label">Your restaurant</div>
      <button class="btn primary big" data-act="open" data-id="${first.id}">${esc(first.name)}</button>
      <button class="btn ghost" data-act="upsell" data-why="restaurants">${more > 0
        ? `${more} more saved. Unlock Premium to use ${more === 1 ? 'it' : 'them'}`
        : 'Want more than one restaurant? Unlock Premium'}</button>
    </div>`;
  }
  return `<div class="screen narrow"><div class="scroll"><div class="landing">${hero}<div>${picker}<div class="ver">Build ${BUILD}${BUILD_ID !== 'dev' ? ' · ' + BUILD_ID : ''} · ${editionLabel()}</div></div></div></div></div>`;
}

function viewBill(){
  const r = rest(), b = billOf(r.id);
  const plates = r.plates.map((p, idx) => {
    const n = b.counts[p.id] || 0;
    const lbl = money(p.price, r), pf = lbl.length <= 6 ? 10.5 : lbl.length === 7 ? 9.5 : lbl.length <= 9 ? 8 : 6.8;   // longer labels get smaller type
    if (!isPremium() && idx >= FREE_PLATES) {   // free: only the first plates work, the rest are locked (never deleted)
      return `<button class="plate-btn locked" data-act="upsell" data-why="plates" aria-label="${esc(p.colour)} plate, ${lbl}. Premium feature">
      <div class="plate" style="--c:${p.colour};--ink:${inkFor(p.colour)};--pf:${pf}"><span class="n lock">${ICON.lock}</span><span class="price">${lbl}</span></div>
    </button>`;
    }
    return `<button class="plate-btn ${n ? 'has' : ''}" data-act="plate" data-id="${p.id}" aria-label="${esc(p.colour)} plate, ${lbl}, ${n} taken">
      <div class="plate" data-plate="${p.id}" style="--c:${p.colour};--ink:${inkFor(p.colour)};--pf:${pf}"><span class="n ${n ? '' : 'zero'}">${n}</span><span class="price">${lbl}</span></div>
    </button>`;
  }).join('');
  return `<div class="screen ${ui.removing ? 'removing' : ''}">
    <div class="bill-head">
      <div class="total"><span class="lbl">Total:</span><b id="total">${money(totalOf(r))}</b></div>
      <button class="icon-btn" data-act="menu" aria-label="Menu">${ICON.menu}</button>
    </div>
    ${ui.removing ? `<div class="banner"><span>Tap a plate to remove one</span><button data-act="cancel-remove">Done</button></div>` : ''}
    <div class="scroll fit"><div class="plates" style="--rows:${Math.min(3, Math.max(1, Math.ceil((r.plates.length + 1) / 2)))}">${r.plates.length ? '' : '<p class="muted" style="grid-column:1/-1;text-align:center">No plates yet. Tap the + to add one.</p>'}${plates}<button class="plate-btn add-plate" data-act="add-plate-modal" aria-label="Add a plate"><div class="plate"><span class="plus">+</span></div></button></div></div>
    <div class="dock-space"></div>
    <div class="dock-scrim ${ui.dock ? 'on' : ''}" id="dock-scrim" data-act="dock-close"></div>
    <div class="dock ${ui.dock ? 'open' : ''}" id="dock">
      <button class="dock-tab" data-act="dock-toggle" aria-expanded="${ui.dock}" aria-controls="dock-body"><span class="lbl">${ui.dock ? 'Close' : dockTitle(b)}</span><i></i></button>
      <div class="venue" data-act="dock-toggle">${esc(r.name)}</div>
      <div class="extras" id="dock-body" ${ui.dock ? '' : 'inert'}>
        <div class="dock-items" id="dock-items">${dockItemsHtml(b, r)}</div>
        <div class="formwrap">
          <div class="suggest" id="suggest" hidden></div>
          <form id="extra-form" autocomplete="off">
            <input id="xdesc" type="text" enterkeyhint="next" placeholder="Add menu item" aria-label="Add menu item" autocomplete="off">
            <div class="amt"><span>${esc(symOf(curOf(r)))}</span><input id="xprice" type="text" inputmode="decimal" enterkeyhint="go" placeholder="${plain(0, curOf(r))}" style="padding-left:${symPad(curOf(r))}px" aria-label="Price"></div>
            <button class="add" type="submit">Add</button>
          </form>
        </div>
      </div>
    </div>
    ${ui.menu ? `<div class="scrim" data-act="menu-close"></div>
      <div class="menu">
        <button data-act="itemised">See itemised bill</button>
        <button data-act="start-remove">Remove a plate</button>
        <hr>
        <button data-act="edit" data-id="${r.id}">Edit this restaurant</button>
        <button data-act="new">Add a new restaurant${isPremium() ? '' : '<span class="pro">Premium</span>'}</button>
        ${isPremium() ? '<button data-act="pick">Switch restaurant</button>' : '<hr><button class="up-entry" data-act="upsell" data-why="generic">Unlock Premium</button>'}
        <hr>
        <button class="danger" data-act="reset">Start a new bill</button>
      </div>` : ''}
  </div>`;
}

function viewItemised(){
  const r = rest(), b = billOf(r.id);
  const plateLines = r.plates.filter(p => (b.counts[p.id] || 0) > 0).map(p => {
    const n = b.counts[p.id];
    return `<div class="line"><span class="chip" style="background:${p.colour}"></span>
      <div class="desc">${n} × plate<small>${money(p.price)} each</small></div>
      <span class="amt">${money(n * p.price)}</span></div>`;
  }).join('');
  const extraLines = b.extras.map(e => `<div class="line"><span class="chip extra" aria-hidden="true">${ICON.cup}</span>
      <div class="desc">${e.desc ? esc(e.desc) : 'Other item'}</div>
      <span class="amt">${money(e.price)}</span>
      <button class="x" data-act="del-extra" data-id="${e.id}" aria-label="Remove item">×</button></div>`).join('');
  return `<div class="screen narrow">
    <div class="topbar"><button class="icon-btn" data-act="bill" aria-label="Back">${ICON.back}</button><h1>${esc(r.name)}</h1></div>
    <div class="scroll pad">
      ${plateLines || extraLines ? plateLines + extraLines : '<p class="muted">Nothing on the bill yet.</p>'}
      <div class="grand"><span>Total</span><b>${money(totalOf(r))}</b></div>
    </div>
  </div>`;
}

function viewEdit(){
  const d = ui.draft;
  const cur = d.currency, sym = symOf(cur), pad = symPad(cur), ph = plain(0, cur);
  const rows = d.plates.map((p, i) => `<div class="prow">
      <button type="button" class="cdot" data-act="edit-colour" data-i="${i}" style="--c:${p.colour}" aria-label="Plate colour, tap to change"></button>
      <div class="money"><span>${esc(sym)}</span><input type="text" inputmode="decimal" enterkeyhint="next" value="${esc(p.price)}" placeholder="${ph}" style="padding-left:${pad}px" data-field="price" data-i="${i}" aria-label="Price per plate"></div>
      <button class="x" data-act="del-plate" data-i="${i}" aria-label="Remove plate">×</button>
    </div>`).join('');
  const irows = d.items.map((it, i) => `<div class="prow">
      <div class="dwrap"><input type="text" enterkeyhint="next" value="${esc(it.desc)}" placeholder="e.g. Green tea" data-field="idesc" data-i="${i}" aria-label="Item description" autocomplete="off"><div class="suggest edit-suggest" hidden></div></div>
      <div class="money" style="flex:none;width:112px"><span>${esc(sym)}</span><input type="text" inputmode="decimal" enterkeyhint="next" value="${esc(it.price)}" placeholder="${ph}" style="padding-left:${pad}px" data-field="iprice" data-i="${i}" aria-label="Item price"></div>
      <button class="x" data-act="del-item" data-i="${i}" aria-label="Remove menu item">×</button>
    </div>`).join('');
  return `<div class="screen narrow">
    <div class="topbar"><button class="icon-btn" data-act="edit-back" aria-label="Back">${ICON.back}</button>
      <h1>${d.isNew ? 'New restaurant' : 'Edit restaurant'}</h1></div>
    <div class="scroll pad">
      <div class="field-label" style="margin-top:0">Restaurant name</div>
      <input type="text" enterkeyhint="next" value="${esc(d.name)}" placeholder="e.g. Sushi Hub" data-field="name" id="rname">
      <div class="field-label">Currency</div>
      ${isPremium()
        ? `<div class="select-wrap"><select id="cur-select" aria-label="Currency">${currencyOptions(cur)}</select></div>
      ${d.isNew ? '' : '<p class="muted" style="margin:8px 2px 0;font-size:14px">Changing the currency does not convert the prices.</p>'}`
        : `<button class="select-like" data-act="upsell" data-why="currency"><span>${esc(currencyLabel(cur))}</span><span class="pro">Premium</span></button>`}
      <div class="field-label">Plates</div>
      <p class="muted" style="margin:-4px 0 12px;font-size:14px">Tap a circle to change the plate colour, then enter its price.${isPremium() ? '' : ` The free version has up to ${FREE_PLATES} plates.`}</p>
      ${rows}
      <button class="btn" style="width:100%" data-act="add-plate">Add a plate${!isPremium() && d.plates.length >= FREE_PLATES ? '<span class="pro">Premium</span>' : ''}</button>
      <div class="field-label">Menu items${isPremium() ? '' : '<span class="pro">Premium</span>'}</div>
      ${isPremium() ? `<p class="muted" style="margin:-4px 0 12px;font-size:14px">Drinks and other extras with set prices. You can pick these when adding an item to a bill.</p>
      ${irows}
      <button class="btn" style="width:100%" data-act="add-item">Add a menu item</button>`
      : `<p class="muted" style="margin:-4px 0 12px;font-size:14px">Save drinks and other extras with set prices, then pick them in one tap.${d.items.length ? ` Your ${d.items.length} saved item${d.items.length === 1 ? ' is' : 's are'} kept safe and will be back when you unlock Premium.` : ''}</p>
      <button class="btn" style="width:100%" data-act="upsell" data-why="items">Unlock Premium</button>`}
      ${d.isNew ? '' : '<button class="btn danger" style="width:100%;margin-top:28px" data-act="del-rest">Delete this restaurant</button>'}
    </div>
    <div class="footer-actions">
      <button class="btn" data-act="edit-back">Cancel</button>
      <button class="btn primary" data-act="save-rest">Save</button>
    </div>
  </div>`;
}


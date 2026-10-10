/* Amapola Pastelería — catálogo editable (productos.json), calendario y pedido por WhatsApp */
(() => {
  document.documentElement.classList.add('js');
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => (Number(n) > 0 ? '$' + Number(n).toLocaleString('es-AR') : 'Consultar');
  const ICONS = { torta: '🎂', cupcake: '🧁', galleta: '🍪', mini: '🍰', bandeja: '🥮', caja: '🎁', desayuno: '☕', pan: '🥖', evento: '🎉' };
  const icon = (cat) => ICONS[Object.keys(ICONS).find((k) => String(cat).toLowerCase().includes(k))] || '🍰';
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  let data = { whatsapp: '', anticipacionDias: 3, diasCerrados: [], fechasBloqueadas: [], productos: [] };
  let cat = 'Todo', sub = 'Todo', q = '', cart = {}, fecha = null;
  try { cart = JSON.parse(localStorage.getItem('amapola-cart') || '{}'); } catch (_) {}
  const save = () => { try { localStorage.setItem('amapola-cart', JSON.stringify(cart)); } catch (_) {} };
  const find = (n) => data.productos.find((p) => p.nombre === n);

  // ---------- Catálogo ----------
  const chip = (label, on, attr) => `<button class="chip${on ? ' on' : ''}" type="button" ${attr}="${esc(label)}">${esc(label)}</button>`;
  const renderChips = () => {
    const cats = ['Todo', ...new Set(data.productos.map((p) => p.categoria).filter(Boolean))];
    $('#chips').innerHTML = cats.map((c) => chip(c, c === cat, 'data-cat')).join('');
    const subs = cat === 'Todo' ? [] : [...new Set(data.productos.filter((p) => p.categoria === cat).map((p) => p.subcategoria).filter(Boolean))];
    $('#subchips').innerHTML = subs.length > 1 ? ['Todo', ...subs].map((s) => chip(s, s === sub, 'data-sub')).join('') : '';
  };
  const renderGrid = () => {
    const list = data.productos.filter((p) => q ? `${p.nombre} ${p.descripcion} ${p.categoria} ${p.subcategoria || ''}`.toLowerCase().includes(q) : (cat === 'Todo' || p.categoria === cat) && (sub === 'Todo' || p.subcategoria === sub));
    $('#grid').innerHTML = list.map((p, i) => {
      const media = p.imagen ? `<img src="${esc(p.imagen)}" alt="${esc(p.nombre)}" loading="lazy">` : `<span class="ico">${icon(p.categoria)}</span>`;
      const badge = p.destacado ? '<span class="badge">Favorita</span>' : '';
      const price = p.precio > 0 ? `<small>Desde</small> ${money(p.precio)}` : 'A medida';
      const btn = p.disponible === false ? '<button class="add" disabled>Agotado</button>' : `<button class="add" type="button" data-add="${esc(p.nombre)}">${p.precio > 0 ? 'Agregar' : 'Consultar'}</button>`;
      return `<article class="card" style="--i:${i}"><div class="thumb">${media}${badge}</div><div class="card-body"><h3>${esc(p.nombre)}</h3><p>${esc(p.descripcion)}</p><span class="price">${price}</span>${btn}</div></article>`;
    }).join('') || '<p class="loading">No hay productos en esta categoría.</p>';
  };

  // ---------- Pedido ----------
  const senia = (t) => (data.senaPorcentaje && t ? Math.round(t * data.senaPorcentaje / 10000) * 100 : 0);
  const items = () => Object.entries(cart).filter(([n]) => find(n));
  const totals = () => {
    const it = items();
    return { it, count: it.reduce((a, [, q]) => a + q, 0), total: it.reduce((a, [n, q]) => a + (find(n).precio || 0) * q, 0) };
  };
  const renderCart = () => {
    const { it, count, total } = totals();
    const cc = $('#cart-count');
    if (cc.textContent !== String(count)) { cc.classList.remove('bump'); void cc.offsetWidth; cc.classList.add('bump'); }
    cc.textContent = count;
    const bar = $('#cart-bar');
    bar.hidden = count === 0;
    bar.textContent = `Ver mi pedido (${count})` + (total ? ` · ${money(total)}` : '');
    $('#cart-list').innerHTML = it.length
      ? it.map(([n, q]) => `<li><span>${esc(n)}</span><span class="qty"><button type="button" data-dec="${esc(n)}" aria-label="Quitar uno">−</button>${q}<button type="button" data-add="${esc(n)}" aria-label="Agregar uno">+</button></span></li>`).join('')
      : '<li>Tu pedido está vacío.</li>';
    const sn = senia(total);
    const t = total ? `Total estimado: ${money(total)}` + (sn ? ` · Seña sugerida (${data.senaPorcentaje}%): ${money(sn)}` : '') : '';
    $('#cart-total').textContent = t; $('#form-total').textContent = t;
    $('#to-form').style.display = it.length ? '' : 'none';
    $('#cart-clear').style.display = it.length ? '' : 'none';
    save();
  };

  const step = (s) => {
    $('#step-cart').hidden = s !== 'cart'; $('#step-form').hidden = s !== 'form';
    $('#drawer-title').textContent = s === 'cart' ? 'Mi pedido' : 'Tus datos';
    $('#drawer').scrollTop = 0;
  };
  const setDrawer = (open) => {
    $('#drawer').hidden = !open; $('#overlay').hidden = !open;
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) step('cart');
  };

  // ---------- Calendario ----------
  const minDate = () => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + (Number(data.anticipacionDias) || 0)); return d; };
  const cal = { y: 0, m: 0 };
  const renderCal = () => {
    const min = minDate(), first = new Date(cal.y, cal.m, 1);
    const days = new Date(cal.y, cal.m + 1, 0).getDate(), off = (first.getDay() + 6) % 7;
    const atMin = cal.y === min.getFullYear() && cal.m <= min.getMonth();
    let g = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d) => `<span>${d}</span>`).join('') + '<i></i>'.repeat(off);
    for (let d = 1; d <= days; d++) {
      const dt = new Date(cal.y, cal.m, d), k = iso(dt);
      const off2 = dt < min || (data.diasCerrados || []).includes(dt.getDay()) || (data.fechasBloqueadas || []).includes(k);
      g += `<button type="button" data-day="${k}"${off2 ? ' disabled' : ''}${k === fecha ? ' class="sel"' : ''}>${d}</button>`;
    }
    $('#cal').innerHTML = `<div class="cal-head"><button type="button" data-month="-1" aria-label="Mes anterior"${atMin ? ' disabled' : ''}>‹</button><span>${first.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</span><button type="button" data-month="1" aria-label="Mes siguiente">›</button></div><div class="cal-grid">${g}</div>`;
  };
  const fechaTxt = () => fecha ? new Date(fecha + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const initCal = () => { const m = minDate(); cal.y = m.getFullYear(); cal.m = m.getMonth(); renderCal(); };

  // ---------- Envío ----------
  const val = (id) => $(id).value.trim();
  const build = () => {
    const { it, total } = totals();
    const modo = document.querySelector('input[name="modo"]:checked').value;
    const L = ['Hola! Quiero hacer un pedido:', ...it.map(([n, q]) => `• ${q} x ${n}${find(n).precio ? ' — ' + money(find(n).precio * q) : ' (a consultar)'}`)];
    if (total) L.push(`Total estimado: ${money(total)}`);
    if (senia(total)) L.push(`Seña sugerida (${data.senaPorcentaje}%): ${money(senia(total))}`);
    L.push('', `Nombre: ${val('#f-nombre')}`, `Fecha: ${fechaTxt()} (${$('#f-hora').value})`, `Modalidad: ${modo}${modo === 'Envío' ? ' — ' + val('#f-dir') : ''}`);
    [['Ocasión', $('#f-ocasion').value], ['Personas', val('#f-pers')], ['Dedicatoria', val('#f-ded')], ['Alergias/preferencias', val('#f-alerg')], ['Pago', $('#f-pago').value], ['Comentarios', val('#f-nota')]]
      .forEach(([k, v]) => v && L.push(`${k}: ${v}`));
    L.push('', '¿Me confirmás disponibilidad y seña?');
    return L.join('\n');
  };
  const validate = () => {
    if (!val('#f-nombre')) return 'Escribí tu nombre.';
    if (!fecha) return 'Elegí una fecha en el calendario.';
    if (document.querySelector('input[name="modo"]:checked').value === 'Envío' && !val('#f-dir')) return 'Indicá la dirección para el envío.';
    return '';
  };

  document.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    const d = t.dataset;
    if (d.cat !== undefined) { cat = d.cat; sub = 'Todo'; renderChips(); renderGrid(); }
    else if (d.sub !== undefined) { sub = d.sub; renderChips(); renderGrid(); }
    else if (d.add) {
      cart[d.add] = (cart[d.add] || 0) + 1; renderCart();
      if (t.classList.contains('add')) { const o = t.textContent; t.textContent = 'Agregado ✓'; setTimeout(() => (t.textContent = o), 1200); }
    } else if (d.dec) { cart[d.dec] = (cart[d.dec] || 1) - 1; if (cart[d.dec] <= 0) delete cart[d.dec]; renderCart(); }
    else if (d.month) { cal.m += Number(d.month); if (cal.m > 11) { cal.m = 0; cal.y++; } if (cal.m < 0) { cal.m = 11; cal.y--; } renderCal(); }
    else if (d.day) { fecha = d.day; $('#cal-sel').textContent = fechaTxt(); renderCal(); }
  });
  ['#cart-open', '#cart-bar'].forEach((s) => $(s).addEventListener('click', () => setDrawer(true)));
  $('#cart-close').addEventListener('click', () => setDrawer(false));
  $('#overlay').addEventListener('click', () => setDrawer(false));
  $('#to-form').addEventListener('click', () => step('form'));
  $('#to-cart').addEventListener('click', () => step('cart'));
  $('#cart-clear').addEventListener('click', () => { cart = {}; renderCart(); });
  document.querySelectorAll('input[name="modo"]').forEach((r) => r.addEventListener('change', () => { $('#f-dir-wrap').hidden = document.querySelector('input[name="modo"]:checked').value !== 'Envío'; }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setDrawer(false); });
  $('#cart-send').addEventListener('click', (e) => {
    const err = validate();
    $('#form-err').textContent = err;
    if (err) { e.preventDefault(); return; }
    e.currentTarget.href = `https://wa.me/${data.whatsapp}?text=${encodeURIComponent(build())}`;
  });

  // ---------- Scroll suave con animación (botones del inicio, menú y volver arriba) ----------
  const smooth = (y, ms) => {
    const s = window.scrollY, dist = y - s;
    if (Math.abs(dist) < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { window.scrollTo(0, y); return; }
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    let t0 = null;
    const frame = (now) => {
      t0 = t0 ?? now;
      const p = Math.min((now - t0) / ms, 1);
      window.scrollTo(0, s + dist * ease(p));
      if (p < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  };
  const goTo = (y) => smooth(Math.max(0, y), Math.min(1400, 700 + Math.abs(y - window.scrollY) / 5));
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute('href').length < 2) return;
    const el = document.querySelector(a.getAttribute('href'));
    if (!el) return;
    e.preventDefault();
    goTo(el.getBoundingClientRect().top + window.scrollY - $('.header').offsetHeight + 1);
  });
  $('#to-top').addEventListener('click', () => goTo(0));
  $('#search').addEventListener('input', (e) => { q = e.target.value.trim().toLowerCase(); renderGrid(); });

  // ---------- Animaciones de scroll y encabezado ----------
  const hd = $('.header');
  const pr = $('#progress'), tt = $('#to-top');
  const onScroll = () => {
    hd.classList.toggle('scrolled', window.scrollY > 12);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    pr.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
    tt.hidden = window.scrollY < 600;
  };
  onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.15 });
    document.querySelectorAll('.wrap > .tag, .wrap > h2, .pasos li, .nos-grid > *, .faq details, .nota, .footer > *').forEach((el, i) => {
      el.classList.add('rv'); el.style.transitionDelay = (i % 4) * 90 + 'ms'; io.observe(el);
    });
  }

  fetch('productos.json', { cache: 'no-cache' })
    .then((r) => r.json())
    .then((d) => {
      data = d;
      if (d.anticipacion) $('#anticipacion').textContent = d.anticipacion;
      renderChips(); renderGrid(); renderCart(); initCal();
      if (d.aviso) { $('#aviso').textContent = d.aviso; $('#aviso').hidden = false; }
      if (d.instagram) { $('#f-ig').href = 'https://instagram.com/' + String(d.instagram).replace('@', ''); $('#f-ig').hidden = false; }
      if (Array.isArray(d.testimonios) && d.testimonios.length) {
        $('#res-grid').innerHTML = d.testimonios.map((t, i) => `<figure class="res" style="--i:${i}"><div class="stars" aria-label="5 estrellas">★★★★★</div><blockquote>${esc(t.texto)}</blockquote><figcaption><b>${esc(t.nombre)}</b> · ${esc(t.detalle)}</figcaption></figure>`).join('');
        $('#resenas').hidden = false;
      }
    })
    .catch(() => { $('#grid').innerHTML = '<p class="loading">No pudimos cargar el catálogo. Escribinos por WhatsApp.</p>'; });
})();

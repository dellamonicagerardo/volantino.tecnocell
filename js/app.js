(() => {
  const PAGE_W = 480;
  const PAGE_H = 680;
  const book = document.getElementById('book');
  const sizer = document.getElementById('sizer');
  const status = document.getElementById('status');
  const prev = document.getElementById('prev');
  const next = document.getElementById('next');
  const pager = document.getElementById('pager-label');
  const title = document.getElementById('flyer-title');
  const shopLink = document.getElementById('shop-link');
  const shopButton = document.getElementById('shop-button');
  const waCta = document.getElementById('wa-cta');

  let flip = null;

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  const parseMoney = (value) => {
    if (value == null || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const raw = String(value).trim().replace(/€/g, '').replace(/\s/g, '');
    if (!raw) return null;
    let number;
    if (raw.includes(',') && raw.includes('.')) number = Number(raw.replace(/\./g, '').replace(',', '.'));
    else if (raw.includes(',')) number = Number(raw.replace(',', '.'));
    else number = Number(raw);
    return Number.isFinite(number) ? number : null;
  };

  const formatEuro = (value) => {
    const number = parseMoney(value);
    if (number == null) return '';
    const [whole, fraction] = number.toFixed(2).split('.');
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `€ ${grouped},${fraction}`;
  };

  const formatDay = (iso, withYear) => {
    if (!iso) return '';
    const date = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('it-IT', {
      day: 'numeric',
      month: withYear ? 'long' : 'short',
      year: withYear ? 'numeric' : undefined
    }).format(date);
  };

  const validity = (data, style) => {
    const from = data.validFrom;
    const to = data.validTo;
    if (style === 'short') {
      const a = formatDay(from, false);
      const b = formatDay(to, false);
      if (a && b) return `${a} – ${b}`;
      return b ? `fino al ${b}` : a;
    }
    const a = formatDay(from, true);
    const b = formatDay(to, true);
    if (a && b) return `Dal ${a} al ${b}`;
    if (b) return `Fino al ${b}`;
    if (a) return `Dal ${a}`;
    return '';
  };

  const safeUrl = (value) => {
    if (!value) return '';
    const raw = String(value).trim();
    if (!raw) return '';
    if (raw.startsWith('assets/') || raw.startsWith('./') || raw.startsWith('../') || raw.startsWith('/')) return raw;
    try {
      const url = new URL(raw, window.location.href);
      if (url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'tel:') {
        return url.href;
      }
    } catch (error) {
      return '';
    }
    return '';
  };

  const logo = () => {
    const image = document.createElement('img');
    image.src = 'assets/tecnocell-logo.png';
    image.alt = 'Tecnocell';
    return image;
  };

  const normalize = (product) => ({
    name: String(product.name || product.title || '').trim(),
    brand: String(product.brand || '').trim(),
    category: String(product.category || '').trim(),
    description: String(product.description || '').trim(),
    price: parseMoney(product.price),
    compareAt: parseMoney(product.compareAt),
    image: safeUrl(product.image),
    badge: String(product.badge || '').trim(),
    featured: Boolean(product.featured)
  });

  const discount = (product) => {
    if (product.compareAt == null || product.price == null || product.compareAt <= product.price) return 0;
    return Math.round((1 - product.price / product.compareAt) * 100);
  };

  const LAYOUTS = { solo: 1, duo: 2, hero: 3, rows: 3, quad: 4, stack: 4, mosaic: 5, tiles: 6 };
  const DEFAULT_SEQUENCE = ['hero', 'quad', 'mosaic', 'rows', 'stack', 'tiles', 'duo'];
  const DARK_LAYOUTS = new Set(['hero', 'rows', 'solo']);

  const variantFor = (layout, index) => {
    if (layout === 'solo' || layout === 'duo') return ['tall'];
    if (layout === 'hero') return index === 0 ? ['wide'] : ['card'];
    if (layout === 'rows') return index % 2 ? ['row', 'flip'] : ['row'];
    if (layout === 'mosaic' || layout === 'stack') return index === 0 ? ['tall'] : ['mini'];
    if (layout === 'tiles') return ['mini'];
    return ['card'];
  };

  const money = (value) => {
    const node = el('span', 'money');
    const number = parseMoney(value);
    if (number == null) return node;
    const [whole, fraction] = number.toFixed(2).split('.');
    node.append(
      el('b', '', whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')),
      el('small', '', fraction === '00' ? '€' : `,${fraction}€`)
    );
    return node;
  };

  const priceTag = (product) => {
    const tag = el('div', 'tag');
    if (product.price == null) {
      tag.append(el('span', 'tag__ask', 'Chiedi in negozio'));
      return tag;
    }
    const percent = discount(product);
    if (percent) tag.append(el('s', 'tag__was', formatEuro(product.compareAt)));
    const box = el('div', 'tag__box');
    box.append(money(product.price));
    tag.append(box);
    if (percent) tag.append(el('span', 'tag__off', `Sconto ${percent}%`));
    return tag;
  };

  const specs = (description) => {
    const parts = description.split(/\s*[·•|]\s*/).filter(Boolean);
    if (parts.length < 2) return null;
    const list = el('ul', 'deal__specs');
    parts.forEach((part) => list.append(el('li', '', part)));
    return list;
  };

  const burstShape = (points) => {
    const coords = [];
    for (let index = 0; index < points * 2; index += 1) {
      const radius = index % 2 ? 41 : 50;
      const angle = (Math.PI * index) / points - Math.PI / 2;
      coords.push(`${(50 + radius * Math.cos(angle)).toFixed(1)}% ${(50 + radius * Math.sin(angle)).toFixed(1)}%`);
    }
    return `polygon(${coords.join(',')})`;
  };

  const sectionTitle = (items) => {
    const categories = [...new Set(items.map((product) => product.category).filter(Boolean))];
    if (categories.length === 1) return categories[0];
    if (categories.length === 2) return categories.join(' & ');
    return 'Da non perdere';
  };

  const pageShell = (density) => {
    const page = el('div', 'page');
    if (density) page.dataset.density = density;
    return page;
  };

  const renderDeal = (product, variants) => {
    const card = el('div', ['deal', ...variants.map((variant) => `deal--${variant}`)].join(' '));

    const media = el('div', 'deal__media');
    if (product.image) {
      const image = document.createElement('img');
      image.src = product.image;
      image.alt = '';
      image.addEventListener('error', () => {
        image.replaceWith(el('span', 'deal__fallback', (product.brand || product.name || '?').slice(0, 1)));
      });
      media.append(image);
    } else {
      media.append(el('span', 'deal__fallback', (product.brand || product.name || '?').slice(0, 1)));
    }
    const percent = discount(product);
    const badge = product.badge || (percent ? `−${percent}%` : '') || (product.featured ? 'Top' : '');
    if (badge) {
      const plain = !product.badge && !percent;
      media.append(el('span', `deal__badge${plain ? ' deal__badge--top' : ''}`, badge));
    }

    const body = el('div', 'deal__body');
    if (product.brand || product.category) body.append(el('p', 'deal__brand', product.brand || product.category));
    body.append(el('h2', 'deal__name', product.name));
    const chips = product.description ? specs(product.description) : null;
    if (chips) body.append(chips);
    else if (product.description) body.append(el('p', 'deal__desc', product.description));
    body.append(priceTag(product));
    card.append(media, body);
    return card;
  };

  const renderCover = (data, showcase, products) => {
    const page = pageShell('hard');
    const sheet = el('article', 'sheet sheet--cover');

    const top = el('header', 'cover__top');
    const mark = logo();
    mark.className = 'cover__logo';
    top.append(mark);
    const when = validity(data, 'short');
    if (when) top.append(el('p', 'cover__dates', when));

    const hero = el('div', 'cover__hero');
    hero.append(el('p', 'cover__kicker', data.kicker || 'Sfoglia le promozioni'));
    const heading = el('h1', 'cover__title');
    const words = String(data.headline || 'Volantino offerte').trim().split(/\s+/);
    if (words.length > 1) heading.append(el('span', '', words[0]), el('span', '', words.slice(1).join(' ')));
    else heading.append(el('span', '', words[0] || 'Offerte'));
    hero.append(heading);

    const best = Math.max(0, ...products.map(discount));
    const burst = el('p', 'cover__burst');
    burst.style.clipPath = burstShape(14);
    if (best) burst.append(el('small', '', 'fino a'), el('b', '', `−${best}%`));
    else burst.append(el('small', '', 'ben'), el('b', '', String(products.length)), el('small', '', 'offerte'));
    hero.append(burst);
    sheet.append(top, hero);

    if (showcase) {
      const show = el('div', 'cover__show');
      show.append(renderDeal(showcase, ['cover']));
      sheet.append(show);
    }

    const notice = el('div', 'cover__notice');
    notice.append(
      el('strong', '', data.storeOnly || 'Offerte valide solo in negozio'),
      el('span', '', data.storeOnlyNote || 'Non disponibili sul negozio online')
    );
    sheet.append(notice);

    const perks = el('ul', 'cover__perks');
    (data.highlights || []).slice(0, 3).forEach((item) => {
      if (item) perks.append(el('li', '', String(item)));
    });
    if (perks.childElementCount) sheet.append(perks);

    const foot = el('footer', 'cover__foot');
    foot.append(
      el('span', '', data.store?.address || ''),
      el('strong', '', 'Sfoglia →')
    );
    sheet.append(foot);
    page.append(sheet);
    return page;
  };

  const renderBand = (items) => {
    const band = el('header', 'band');
    const mark = logo();
    mark.className = 'band__logo';
    mark.alt = '';
    const title = el('h2', 'band__title');
    title.append(el('small', '', 'Offerte'), document.createTextNode(sectionTitle(items)));
    band.append(mark, title);
    return band;
  };

  const renderFoot = (data) => {
    const foot = el('footer', 'sheet__foot');
    const when = validity(data, 'short');
    foot.append(
      el('span', '', when ? `Valide ${when}` : ''),
      el('span', 'sheet__store', 'Solo in negozio'),
      el('span', 'sheet__num', '')
    );
    foot.lastElementChild.dataset.pageNum = '1';
    return foot;
  };

  const renderProducts = (data, layout, products) => {
    const page = pageShell('soft');
    const tone = DARK_LAYOUTS.has(layout) ? ' sheet--dark' : '';
    const sheet = el('article', `sheet sheet--products${tone}`);
    const grid = el('div', `layout layout--${layout}`);
    products.forEach((product, index) => grid.append(renderDeal(product, variantFor(layout, index))));
    sheet.append(renderBand(products), grid, renderFoot(data));
    page.append(sheet);
    return page;
  };

  const planPages = (products, sequence) => {
    const plan = [];
    let index = 0;
    let step = 0;
    let last = '';
    while (index < products.length) {
      const remaining = products.length - index;
      let layout = sequence[step % sequence.length];
      step += 1;
      if (LAYOUTS[layout] > remaining) {
        const fits = Object.keys(LAYOUTS).filter((name) => LAYOUTS[name] === remaining);
        layout = fits.find((name) => name !== last) || fits[0];
      }
      plan.push({ layout, items: products.slice(index, index + LAYOUTS[layout]) });
      index += LAYOUTS[layout];
      last = layout;
    }
    return plan;
  };

  const renderEmpty = (data) => {
    const page = pageShell('soft');
    const sheet = el('article', 'sheet sheet--empty');
    sheet.append(
      el('h2', '', 'Nessun prodotto'),
      el('p', '', 'Aggiungi i prodotti in data/volantino.json')
    );
    page.append(sheet);
    return page;
  };

  const whatsappLink = (store) => {
    const message = encodeURIComponent('Ciao Tecnocell, ho visto il volantino e vorrei informazioni.');
    return `https://wa.me/${String(store.whatsapp).replace(/\D/g, '')}?text=${message}`;
  };

  const contactItem = (label, text, href, className) => {
    const item = el('li');
    const body = href ? document.createElement('a') : el('span');
    if (className) body.className = className;
    if (href) {
      body.href = href;
      if (/^https?:/i.test(href)) {
        body.target = '_blank';
        body.rel = 'noopener';
      }
    }
    body.append(el('small', '', label), document.createTextNode(text));
    item.append(body);
    return item;
  };

  const renderBack = (data) => {
    const store = data.store || {};
    const page = pageShell('soft');
    const sheet = el('article', 'sheet sheet--back');
    const hero = el('div', 'back__hero');
    const mark = logo();
    hero.append(
      mark,
      el('h2', '', 'Vieni a trovarci'),
      el('p', '', store.hours || ''),
      el('p', 'back__notice', data.storeOnly || 'Offerte valide solo in negozio')
    );

    const list = el('ul', 'back__list');
    if (store.address) list.append(contactItem('Negozio', store.address, safeUrl(store.mapUrl)));
    if (store.phone) list.append(contactItem('Telefono', store.phone, safeUrl(store.phoneHref || `tel:${store.phone}`)));
    if (store.whatsapp) list.append(contactItem('WhatsApp', 'Scrivici su WhatsApp', whatsappLink(store), 'back__wa'));

    sheet.append(hero, list);
    if (data.disclaimer) sheet.append(el('p', 'back__note', data.disclaimer));
    const vat = store.vat ? `P.IVA ${store.vat}` : store.name || '';
    if (vat) sheet.append(el('p', 'back__vat', vat));
    page.append(sheet);
    return page;
  };

  const buildPages = (data) => {
    const products = (Array.isArray(data.products) ? data.products : []).map(normalize).filter((product) => product.name);
    const showcase = products.find((product) => product.featured) || products[0];
    const rest = products.filter((product) => product !== showcase);
    const custom = (Array.isArray(data.layouts) ? data.layouts : []).filter((name) => LAYOUTS[name]);
    const pages = [renderCover(data, showcase, products)];
    if (!products.length) pages.push(renderEmpty(data));
    else {
      planPages(rest, custom.length ? custom : DEFAULT_SEQUENCE).forEach(({ layout, items }) => {
        pages.push(renderProducts(data, layout, items));
      });
    }
    pages.push(renderBack(data));
    pages.forEach((page, index) => {
      page.querySelectorAll('[data-page-num]').forEach((node) => {
        node.textContent = `${index + 1} / ${pages.length}`;
      });
    });
    return pages;
  };

  const fitBook = () => {
    const docked = !waCta.hidden && getComputedStyle(waCta).position !== 'fixed' ? waCta.offsetHeight : 0;
    const chrome = document.querySelector('.topbar').offsetHeight + document.querySelector('.pager').offsetHeight + docked + 28;
    const availH = Math.max(280, window.innerHeight - chrome);
    const availW = window.innerWidth - (window.innerWidth <= 720 ? 6 : 24);
    let landW = Math.min(availW - 88, 1000);
    let landH = landW * (PAGE_H / (PAGE_W * 2));
    if (landH > availH) landW = availH * ((PAGE_W * 2) / PAGE_H);
    const portrait = landW < 700 || window.innerWidth < 780;
    if (portrait) {
      let width = Math.min(availW - 8, 520);
      const height = width * (PAGE_H / PAGE_W);
      if (height > availH) width = availH * (PAGE_W / PAGE_H);
      sizer.style.width = `${Math.max(300, width)}px`;
    } else {
      sizer.style.width = `${Math.max(700, landW)}px`;
    }
  };

  const atEnd = () => {
    const index = flip.getCurrentPageIndex();
    const total = flip.getPageCount();
    const portrait = flip.getOrientation() === 'portrait';
    return portrait || index === 0 ? index >= total - 1 : index >= total - 2;
  };

  const updateChrome = () => {
    const index = flip.getCurrentPageIndex();
    const total = flip.getPageCount();
    const portrait = flip.getOrientation() === 'portrait';
    if (portrait) pager.textContent = `Pagina ${index + 1} di ${total}`;
    else if (index === 0) pager.textContent = `Copertina · 1 di ${total}`;
    else pager.textContent = `Pagine ${index + 1}–${Math.min(index + 2, total)} di ${total}`;
    prev.disabled = index <= 0;
    next.disabled = atEnd();
    const closed = index === 0 && flip.getOrientation() !== 'portrait';
    sizer.classList.toggle('is-closed', closed);
  };

  // The page-flip swipe only counts a flick under 250ms and ignores touches
  // that start on a link, so most of a product page never turns. A short
  // horizontal move anywhere on the sheet turns the page instead.
  const bindLightSwipe = () => {
    const stage = book.closest('.stage');
    const minDistance = 20;
    let origin = null;
    let blockClick = false;
    let swallowMouseUntil = 0;

    const armMouseSwallow = () => {
      swallowMouseUntil = Date.now() + 700;
    };

    stage.addEventListener('touchstart', (event) => {
      if (!flip || event.touches.length !== 1) {
        origin = null;
        return;
      }
      const touch = event.changedTouches[0];
      origin = { x: touch.clientX, y: touch.clientY, t: Date.now() };
      event.stopPropagation();
    }, { capture: true });

    stage.addEventListener('touchmove', (event) => {
      if (!origin || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const dx = touch.clientX - origin.x;
      const dy = touch.clientY - origin.y;
      if (Math.abs(dx) < 8 || Math.abs(dx) <= Math.abs(dy)) return;
      event.preventDefault();
      event.stopPropagation();
    }, { capture: true, passive: false });

    stage.addEventListener('touchend', (event) => {
      const start = origin;
      origin = null;
      armMouseSwallow();
      if (!start || !flip || event.changedTouches.length === 0) return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      const turned = Math.abs(dx) >= minDistance
        && Math.abs(dx) > Math.abs(dy) * 0.75
        && Date.now() - start.t < 1400
        && flip.getState() === 'read';
      if (!turned) return;
      blockClick = true;
      window.setTimeout(() => { blockClick = false; }, 500);
      event.preventDefault();
      event.stopPropagation();
      if (dx < 0) flip.flipNext('bottom');
      else flip.flipPrev('bottom');
    }, { capture: true, passive: false });

    stage.addEventListener('touchcancel', () => {
      origin = null;
      armMouseSwallow();
    }, { capture: true });

    const swallowSyntheticMouse = (event) => {
      if (Date.now() > swallowMouseUntil) return;
      event.stopPropagation();
    };
    stage.addEventListener('mousedown', swallowSyntheticMouse, true);
    stage.addEventListener('mouseup', swallowSyntheticMouse, true);
    stage.addEventListener('click', (event) => {
      if (!blockClick) return;
      blockClick = false;
      event.preventDefault();
      event.stopPropagation();
    }, true);
  };

  const showError = (message) => {
    status.hidden = false;
    status.textContent = message;
  };

  const start = (data) => {
    document.title = data.title || 'Volantino Tecnocell';
    title.textContent = data.headline || data.title || 'Volantino';
    const website = safeUrl(data.store?.website) || 'https://tecnocell.shop';
    shopLink.href = website;
    shopButton.href = website;
    if (data.store?.whatsapp) {
      waCta.href = whatsappLink(data.store);
      waCta.hidden = false;
    }

    book.replaceChildren(...buildPages(data));
    fitBook();
    window.addEventListener('resize', fitBook);

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    flip = new St.PageFlip(book, {
      width: PAGE_W,
      height: PAGE_H,
      size: 'stretch',
      minWidth: 280,
      maxWidth: 520,
      minHeight: 400,
      maxHeight: 760,
      drawShadow: true,
      flippingTime: reduce ? 200 : 750,
      usePortrait: true,
      startZIndex: 4,
      autoSize: true,
      maxShadowOpacity: 0.45,
      showCover: true,
      mobileScrollSupport: false,
      swipeDistance: 18,
      clickEventForward: true,
      useMouseEvents: true,
      showPageCorners: !reduce,
      disableFlipByClick: false
    });

    flip.loadFromHTML(book.querySelectorAll('.page'));
    flip.on('flip', updateChrome);
    flip.on('changeOrientation', updateChrome);
    flip.on('changeState', (event) => {
      const state = event.data;
      if ((state === 'flipping' || state === 'user_fold') && flip.getCurrentPageIndex() === 0) {
        sizer.classList.remove('is-closed');
      }
      if (state === 'read') updateChrome();
    });
    status.hidden = true;
    updateChrome();

    const hash = Number((location.hash.match(/(\d+)/) || [])[1]);
    if (hash > 1) flip.turnToPage(Math.min(flip.getPageCount() - 1, hash - 1));

    prev.addEventListener('click', () => flip.flipPrev('bottom'));
    next.addEventListener('click', () => flip.flipNext('bottom'));
    bindLightSwipe();
    window.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight' || event.key === 'PageDown') {
        event.preventDefault();
        flip.flipNext('bottom');
      } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        flip.flipPrev('bottom');
      } else if (event.key === 'Home') {
        flip.turnToPage(0);
      } else if (event.key === 'End') {
        flip.turnToPage(flip.getPageCount() - 1);
      }
    });
  };

  fetch('data/volantino.json', { cache: 'no-cache' })
    .then((response) => {
      if (!response.ok) throw new Error('missing');
      return response.json();
    })
    .then(start)
    .catch(() => {
      showError('Non riesco a leggere data/volantino.json. Apri il sito da un server locale o da GitHub Pages.');
    });
})();

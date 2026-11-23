function track(event, fields = {}) {
  (window.dataLayer ||= []).push({ event, page_path: window.location.pathname, ...fields });
}

track('page_view');

document.addEventListener('click', event => {
  const item = event.target.closest('[data-track]:not(details), .menu nav a, #directions .more-link, #about .more-link, .back-top');
  if (!item) return;
  if (item.dataset.track === 'format_select') {
    track('format_select', { format: item.dataset.formatChoice });
  } else if (item.dataset.track === 'service_select') {
    track('service_select', { service: item.dataset.serviceChoice });
  } else if (item.dataset.track) {
    track(item.dataset.track, { placement: item.dataset.placement || 'page' });
  } else {
    track('navigation_click', { target: item.getAttribute('href') });
  }
});


const menu = document.querySelector('.menu');
const backTop = document.querySelector('.back-top');
function refreshBackTop() { backTop.hidden = window.scrollY < 280; }
window.addEventListener('scroll', refreshBackTop, {passive:true});
refreshBackTop();

document.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener('click', event => {
  const target = document.getElementById(link.getAttribute('href').slice(1));
  if (!target) return;
  event.preventDefault();
  if (menu.contains(link)) menu.open = false;
  target.setAttribute('tabindex', '-1');
  target.focus({preventScroll:true});
  target.scrollIntoView();
}));
document.addEventListener('click', event => {
  if (menu.open && !menu.contains(event.target)) menu.open = false;
});
menu.addEventListener('toggle', () => { if (menu.open) track('menu_open'); });
document.querySelectorAll('.question-list details').forEach((question, index) => {
  question.addEventListener('toggle', () => {
    if (question.open) track('faq_open', { question_index: index + 1 });
  });
});

menu.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu.open) {
    menu.open = false;
    menu.querySelector('summary').focus();
  }
});

function connectGallery(gallery) {
  const rail = gallery.querySelector('.evidence-list');
  const controls = gallery.querySelector('.gallery-controls');
  const [previous, next] = controls.querySelectorAll('button');
  function sync() {
    const max = rail.scrollWidth - rail.clientWidth;
    controls.hidden = max < 2;
    previous.disabled = rail.scrollLeft < 2;
    next.disabled = rail.scrollLeft >= max - 2;
  }
  function move(direction) {
    track('gallery_navigate', { gallery: rail.id, direction });
    const card = rail.querySelector(':scope > :not([hidden])');
    if (!card) return;
    const gap = parseFloat(getComputedStyle(card).marginRight) || 0;
    const stride = card.getBoundingClientRect().width + gap;
    const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    rail.scrollBy({left: direction * stride, behavior});
  }
  previous.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  rail.addEventListener('keydown', event => {
    if (event.target !== rail || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    move(event.key === 'ArrowLeft' ? -1 : 1);
  });
  rail.addEventListener('scroll', sync, {passive:true});
  new MutationObserver(sync).observe(rail, {childList:true});
  if ('ResizeObserver' in window) new ResizeObserver(sync).observe(rail);
  else window.addEventListener('resize', sync);
  const filters = gallery.parentElement.querySelector('.qualification-filters');
  if (filters) {
    const buttons = Array.from(filters.querySelectorAll('[data-qualification-filter]'));
    function selectFilter(button) {
      const category = button.dataset.qualificationFilter;
      buttons.forEach(option => option.setAttribute('aria-pressed', String(option === button)));
      for (const card of rail.children) {
        card.hidden = category !== 'all' && card.dataset.qualificationCategory !== category;
      }
      rail.scrollLeft = 0;
      sync();
    }
    selectFilter(buttons.find(button => button.getAttribute('aria-pressed') === 'true') || buttons[0]);
    filters.hidden = false;
    buttons.forEach(button => button.addEventListener('click', () => {
      selectFilter(button);
      track('qualification_filter', { category: button.dataset.qualificationFilter });
    }));
  }
  sync();
}
document.querySelectorAll('.gallery').forEach(connectGallery);

const certificateDialog = document.getElementById('certificate-dialog');
if (certificateDialog) {
  let opener;
  let current = 0;
  let touchStart;
  let photos = [];
  const enlarged = certificateDialog.querySelector('img');
  const position = certificateDialog.querySelector('.document-position');
  const show = index => {
    current = (index + photos.length) % photos.length;
    const photo = photos[current];
    enlarged.src = photo.src;
    enlarged.alt = photo.alt;
    position.textContent = `${current + 1} / ${photos.length}`;
  };
  document.querySelectorAll('.document-trigger').forEach(trigger => trigger.addEventListener('click', () => {
    const rail = trigger.closest('.evidence-list');
    track('certificate_open', { gallery: rail.id });
    photos = Array.from(rail.querySelectorAll('figure:not([hidden]) img'));
    opener = trigger;
    show(photos.indexOf(trigger.closest('figure').querySelector('img')));
    certificateDialog.showModal();
  }));
  certificateDialog.querySelectorAll('[data-document-step]').forEach(button => {
    button.addEventListener('click', () => show(current + Number(button.dataset.documentStep)));
  });
  certificateDialog.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    show(current + (event.key === 'ArrowRight' ? 1 : -1));
  });
  enlarged.addEventListener('touchstart', event => {
    touchStart = event.touches.length === 1 ? event.touches[0] : null;
  }, { passive: true });
  enlarged.addEventListener('touchend', event => {
    if (!touchStart) return;
    const end = event.changedTouches[0];
    const dx = end.clientX - touchStart.clientX;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(end.clientY - touchStart.clientY)) show(current + (dx < 0 ? 1 : -1));
    touchStart = null;
  }, { passive: true });
  certificateDialog.querySelector('.close-document').addEventListener('click', () => certificateDialog.close());
  certificateDialog.addEventListener('click', event => {
    if (event.target === certificateDialog) certificateDialog.close();
  });
  certificateDialog.addEventListener('close', () => opener?.focus());
}

const contactKind = document.getElementById('contact-kind');
if (contactKind) {
  function updateChannel() {
    const channel = contactKind.value;
    const fields = {
      email: channel === 'email',
      phone: Boolean(channel) && channel !== 'email',
      nickname: ['telegram','signal'].includes(channel),
    };
    for (const [kind, visible] of Object.entries(fields)) {
      const label = document.getElementById(kind + '-field');
      label.hidden = !visible;
      label.querySelector('input').disabled = !visible;
    }
  }
  contactKind.addEventListener('change', updateChannel);
  updateChannel();
  const form = document.querySelector('.request-form');
  const status = document.getElementById('form-state');
  const interests = document.getElementById('request-interests');
  const checked = name => Array.from(form.querySelectorAll(`input[name="${name}"]:checked`), input => input.value);

  if (interests) {
    const back = form.querySelector('.return-to-choice');
    const returnBar = back.parentElement;
    const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
    let previousChoice;
    back.addEventListener('click', () => {
      if (!previousChoice) return;
      const { link, offset } = previousChoice;
      const visibleOffset = Math.min(Math.max(offset, 0), Math.max(window.innerHeight - link.offsetHeight, 0));
      const top = window.scrollY + link.getBoundingClientRect().top - visibleOffset;
      link.focus({preventScroll: true});
      returnBar.hidden = true;
      previousChoice = undefined;
      window.scrollTo({top, behavior: reducedMotion() ? 'instant' : 'smooth'});
    });
    const inputs = Array.from(interests.querySelectorAll('input[type="checkbox"]'));
    const choose = (name, value) => {
      const input = inputs.find(item => item.name === name && item.value === value);
      if (input) input.checked = true;
      return input;
    };
    const fromLink = new URLSearchParams(location.search);
    for (const name of ['format', 'service']) {
      for (const value of fromLink.getAll(name)) choose(name, value);
    }

    document.querySelectorAll('[data-format-choice], [data-service-choice]').forEach(link => {
      link.addEventListener('click', event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const { formatChoice, serviceChoice } = link.dataset;
        const input = formatChoice ? choose('format', formatChoice) : choose('service', serviceChoice);
        if (!input) return;
        event.preventDefault();
        status.hidden = true;
        previousChoice = { link, offset: link.getBoundingClientRect().top };
        const selection = input.closest('label');
        input.closest('fieldset').before(returnBar);
        returnBar.hidden = false;
        back.focus({preventScroll: true});
        const animate = !reducedMotion();
        selection.scrollIntoView({block: 'start', behavior: animate ? 'smooth' : 'instant'});
        if (animate) selection.animate(
          [{backgroundColor: '#31536b'}, {backgroundColor: 'transparent'}],
          {duration: 1250, delay: 230},
        );
      });
    });

    interests.addEventListener('change', event => {
      const {name, value, checked} = event.target;
      if (name === 'format') track('form_format_change', { format: value, selected: checked });
      if (name === 'service') track('form_service_change', { service: value, selected: checked });
    });
  }
  document.querySelectorAll('.service-details').forEach(details => {
    details.addEventListener('toggle', () => {
      if (details.open) track('service_details_open', { service: details.dataset.serviceId });
    });
  });

  form.addEventListener('focusin', () => track('booking_start'), { once: true });
  contactKind.addEventListener('change', () => track('booking_channel_change', { channel: contactKind.value }));

  form.addEventListener('input', () => { status.hidden = true; });
  form.addEventListener('invalid', () => track('booking_validation_error'), true);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    if (button.disabled) return;
    const formats = checked('format');
    const intent = {
      format: formats[0] || 'undecided', formats, services: checked('service'), channel: contactKind.value,
    };
    track('booking_submit', intent);
    button.disabled = true;
    status.hidden = false;
    status.textContent = 'Надсилаємо заявку…';
    try {
      const response = await fetch(form.action, {
        method:'POST',
        headers:{ Accept:'application/json' },
        body:new URLSearchParams(new FormData(form)),
      });
      const result = await response.json();
      if (!response.ok || !result.reference) {
        track('booking_error', intent);
        status.textContent = result.error || 'Заявка не надійшла. Спробуйте ще раз.';
        return;
      }
      track('booking_success', intent);
      form.reset();
      updateChannel();
      status.textContent = 'Заявку прийнято. Номер: ' + result.reference;
    } catch {
      track('booking_error', intent);
      status.textContent = 'Не вдалося підтвердити надсилання. Спробуйте ще раз.';
    } finally {
      button.disabled = false;
    }
  });
}

const footerContacts = document.querySelector('.footer-contacts');
footerContacts?.addEventListener('submit', async event => {
  event.preventDefault();
  const channel = event.submitter?.value;
  if (!channel) return;
  track('contact_click', { channel, placement: 'footer' });
  const status = document.querySelector('.footer-message');
  status.hidden = true;
  try {
    const response = await fetch(footerContacts.action, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: new URLSearchParams({ channel }),
    });
    const result = await response.json();
    if (response.ok && result.destination) {
      location.assign(result.destination);
      return;
    }
    status.textContent = result.error;
  } catch {
    status.textContent = 'Не вдалося відкрити контакт.';
  }
  status.hidden = false;
});

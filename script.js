'use strict';

/* =========================================================
   Shared across index.html and about.html. Every page-specific
   block is guarded on the element it needs, so a missing section
   is a no-op rather than a thrown error that kills the rest.
   ========================================================= */

/* ---------- nav (all pages) ---------- */
(function(){
  const header = document.getElementById('siteHeader');
  if(!header) return;
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 30);
  });
  function setNav(open){
    navLinks.classList.toggle('open', open);
    navToggle.classList.toggle('open', open);
    document.body.classList.toggle('nav-open', open);
    navToggle.textContent = open ? '✕' : '☰';
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  navToggle.addEventListener('click', () => setNav(!navLinks.classList.contains('open')));
  navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setNav(false)));
  document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape' && navLinks.classList.contains('open')){ setNav(false); navToggle.focus(); }
  });
  // Reset the mobile menu if the viewport grows past the breakpoint.
  window.matchMedia('(min-width:861px)').addEventListener('change', (e) => { if(e.matches) setNav(false); });

})();

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- footer year (all pages) ---------- */
(function(){
  const y = document.getElementById('year');
  if(y) y.textContent = new Date().getFullYear();
})();

  /* ---------- headline: wrap each word so it can animate on its own ----------
     Walks the h1 so the <em> around "on call." is preserved. Spaces stay
     outside the spans, which keeps normal line-wrapping intact. */
  (function splitHeadline(){
    const h1 = document.querySelector('.hero-left h1');
    if(!h1) return;
    let i = 0;
    const wrapWords = (node) => {
      const frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach(chunk => {
        if(!chunk) return;
        if(/^\s+$/.test(chunk)){ frag.appendChild(document.createTextNode(chunk)); return; }
        const span = document.createElement('span');
        span.className = 'w';
        span.style.setProperty('--d', (0.13 + i * 0.045).toFixed(3) + 's');
        span.textContent = chunk;
        frag.appendChild(span);
        i++;
      });
      node.parentNode.replaceChild(frag, node);
    };
    [...h1.childNodes].forEach(node => {
      if(node.nodeType === 3) wrapWords(node);
      else [...node.childNodes].forEach(child => { if(child.nodeType === 3) wrapWords(child); });
    });
  })();

  /* ---------- stat rules: stagger them after the headline ---------- */
  document.querySelectorAll('.stat-row > div').forEach((el, i) => {
    el.style.setProperty('--d', (0.55 + i * 0.09).toFixed(2) + 's');
  });

/* ---------- generic scroll reveal (all pages) ---------- */
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => { if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
}, {threshold:0.15});
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

/* ---------- staggered card reveals (all pages) ---------- */
document.querySelectorAll('[data-stagger]').forEach(group => {
  [...group.children].forEach((card, i) => {
    card.style.setProperty('--d', (i * 55) + 'ms');
    card.classList.add('stagger-item');
    io.observe(card);
  });
});

/* ---------- carousel: case studies + testimonials ----------
   One slide visible at a time, moved with translateX. The viewport height
   follows the active slide so a short quote doesn't leave a tall empty box.
   Off-screen slides are pulled out of the tab order and hidden from screen
   readers, otherwise keyboard users tab into content they cannot see. */
document.querySelectorAll('[data-carousel]').forEach(root => {
  const viewport = root.querySelector('.carousel-viewport');
  const track    = root.querySelector('.carousel-track');
  const slides   = [...track.children];
  const label    = root.getAttribute('data-carousel') || 'item';

  if(slides.length < 2){
    const c = root.querySelector('.carousel-controls');
    if(c) c.remove();
    return;
  }

  root.setAttribute('role', 'group');
  root.setAttribute('aria-roledescription', 'carousel');
  root.setAttribute('aria-label', label + 's');

  const fade = root.getAttribute('data-mode') === 'fade';
  const autoMs = parseInt(root.getAttribute('data-auto'), 10) || 0;
  const dotsWrap = root.querySelector('.carousel-dots');
  const counter  = root.querySelector('.carousel-count');
  const prevBtn  = root.querySelector('[data-carousel-prev]');
  const nextBtn  = root.querySelector('[data-carousel-next]');
  let index = 0;

  /* ---- autoplay ----
     A restartable countdown, not an on/off switch. Every advance (automatic or
     manual) re-arms it, so a dot click just delays the next change rather than
     killing the rotation. While hovered, focused, or in a hidden tab the tick
     is skipped, and the countdown re-arms; nothing ever stops it permanently.
     Runs under reduced motion too (the change is requested behaviour, not
     decoration); the CSS makes the swap instant there instead of a fade. */
  let autoTimer = null;
  /* Blocked-state is computed live at tick time, never cached in booleans.
     A cached `focused` flag rots: clicking a dot leaves focus on that button
     indefinitely, so the flag never clears and rotation halts forever (found
     in testing). :hover is live by definition, and :focus-visible is true for
     keyboard focus but not mouse clicks, which is exactly the split we want —
     a keyboard user reading a slide holds it, a mouse click doesn't. */
  function autoBlocked(){
    return document.hidden
        || root.matches(':hover')
        || root.querySelector(':focus-visible') !== null;
  }
  function armAuto(){
    if(!autoMs) return;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => {
      if(!autoBlocked()) go(index + 1);
      else armAuto();
    }, autoMs);
  }

  slides.forEach((s, i) => {
    s.setAttribute('role', 'group');
    s.setAttribute('aria-roledescription', 'slide');
    s.setAttribute('aria-label', (i + 1) + ' of ' + slides.length);
  });

  const dots = slides.map((_, i) => {
    const d = document.createElement('button');
    d.type = 'button';
    d.className = 'carousel-dot';
    d.setAttribute('aria-label', 'Show ' + label + ' ' + (i + 1) + ' of ' + slides.length);
    d.addEventListener('click', () => go(i));
    dotsWrap.appendChild(d);
    return d;
  });

  function syncHeight(){
    viewport.style.height = slides[index].offsetHeight + 'px';
  }

  function go(i){
    index = (i + slides.length) % slides.length;
    if(fade) slides.forEach((s, si) => s.classList.toggle('active', si === index));
    else track.style.transform = 'translateX(' + (-index * 100) + '%)';

    dots.forEach((d, di) => {
      d.classList.toggle('on', di === index);
      d.setAttribute('aria-current', di === index ? 'true' : 'false');
    });
    slides.forEach((s, si) => {
      const on = si === index;
      s.setAttribute('aria-hidden', on ? 'false' : 'true');
      s.querySelectorAll('a, button, input, select, textarea').forEach(el => { el.tabIndex = on ? 0 : -1; });
    });
    if(counter) counter.textContent = (index + 1) + ' / ' + slides.length;
    syncHeight();
    armAuto();
  }

  if(prevBtn) prevBtn.addEventListener('click', () => go(index - 1));
  if(nextBtn) nextBtn.addEventListener('click', () => go(index + 1));



  // Arrow keys, but only while focus is inside the carousel.
  root.addEventListener('keydown', (e) => {
    if(e.key === 'ArrowLeft'){ e.preventDefault(); go(index - 1); }
    else if(e.key === 'ArrowRight'){ e.preventDefault(); go(index + 1); }
  });

  // Horizontal swipe. Vertical intent is left alone so the page still scrolls.
  let startX = 0, startY = 0, tracking = false;
  root.addEventListener('pointerdown', (e) => {
    if(e.pointerType === 'mouse') return;
    startX = e.clientX; startY = e.clientY; tracking = true;
  }, {passive:true});
  root.addEventListener('pointerup', (e) => {
    if(!tracking) return;
    tracking = false;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if(Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) go(index + (dx < 0 ? 1 : -1));
  }, {passive:true});
  root.addEventListener('pointercancel', () => { tracking = false; }, {passive:true});

  // Slide heights change with viewport width, and with late-loading webfonts.
  window.addEventListener('resize', syncHeight);
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(syncHeight);
  if('ResizeObserver' in window) new ResizeObserver(syncHeight).observe(slides[0]);

  go(0);
});

/* ---------- services, values, hero ascent (index only) ---------- */
(function(){
  const tabsEl = document.getElementById('serviceTabs');
  if(!tabsEl) return;

  const services = [
    {
      title: "Executive Operations", tag: "Founders & leadership",
      desc: "The infrastructure behind a founder's time: calendar discipline, decision cadence, board and investor prep.",
      items: ["Executive calendar & time architecture", "Meeting cadence and decision logs", "Board, investor, and stakeholder prep"]
    },
    {
      title: "Business Operations", tag: "Cross-functional",
      desc: "The connective tissue between teams: process design, reporting, and the rhythm that keeps everyone aligned.",
      items: ["Process mapping & documentation", "Cross-team reporting & KPIs", "Handoffs, escalation paths & operating cadence"]
    },
    {
      title: "Marketing Operations", tag: "Growth infrastructure",
      desc: "The tooling and workflow layer behind campaigns, so marketing spends time on ideas, not admin.",
      items: ["Martech stack setup & integration", "Campaign and funnel workflows", "Attribution & performance reporting"]
    },
    {
      title: "Systems & Automation", tag: "Tooling & code",
      desc: "We audit what's manual, then remove it: with configuration where that's enough, and with custom code where it isn't.",
      items: ["Workflow audits & automation builds", "Tool integration & data flow design", "Custom internal tools, dashboards & sites"]
    },
    {
      title: "Procurement & Vendor Operations", tag: "Supply & spend",
      desc: "Where the money quietly leaves the business: supplier selection, contract terms, and the inventory discipline that stops you paying for urgency.",
      items: ["Supplier sourcing & negotiation", "Contract and renewal tracking", "Inventory and reorder discipline"]
    },
    {
      title: "Talent & Recruitment Operations", tag: "Hiring",
      desc: "Your hiring pipeline run as a process, so roles close on a timeline instead of whenever somebody finds the time.",
      items: ["Role scoping & candidate filtering", "Full-cycle recruitment coordination", "Onboarding & ramp documentation"]
    }
  ];
  const shortLabels = ["EXEC","BIZ OPS","MKTG OPS","SYSTEMS","VENDORS","TALENT"];

  const detailEl = document.getElementById('serviceDetail');

  function renderDetail(i){
    const s = services[i];
    detailEl.setAttribute('aria-labelledby', 'service-tab-' + i);
    detailEl.innerHTML = `
      <div class="detail-inner">
        <span class="detail-tag">${s.tag}</span>
        <div class="detail-title">${s.title}</div>
        <p class="detail-desc">${s.desc}</p>
        <ul class="detail-list">${s.items.map(it => `<li>${it}</li>`).join('')}</ul>
      </div>
    `;
  }
  function setActive(i, moveFocus){
    [...tabsEl.children].forEach((t, idx) => {
      const on = idx === i;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    renderDetail(i);
    if(moveFocus) tabsEl.children[i].focus();
    if(waypoints[i]) setActiveWaypoint(i);
  }
  services.forEach((s, i) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'service-tab' + (i === 0 ? ' active' : '');
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(i === 0));
    tab.setAttribute('aria-controls', 'serviceDetail');
    tab.id = 'service-tab-' + i;
    tab.tabIndex = i === 0 ? 0 : -1;
    tab.innerHTML = `<span class="idx" aria-hidden="true">0${i+1}</span><span class="name">${s.title}</span>`;
    tab.addEventListener('click', () => setActive(i));
    tab.addEventListener('keydown', (e) => {
      const keys = {ArrowDown:1, ArrowRight:1, ArrowUp:-1, ArrowLeft:-1};
      if(keys[e.key]){
        e.preventDefault();
        setActive((i + keys[e.key] + services.length) % services.length, true);
      } else if(e.key === 'Home'){ e.preventDefault(); setActive(0, true); }
      else if(e.key === 'End'){ e.preventDefault(); setActive(services.length - 1, true); }
    });
    tabsEl.appendChild(tab);
  });
  renderDetail(0);

  /* ---------- values ---------- */
  /* Four, not seven. "Own the Outcome" and "Accountability" were the same value
     stated twice, and "Client First" / "Team Wins" are claims every competitor
     makes. A shorter list that says something specific is worth more. */
  const values = [
    { title: "Own the outcome", desc: "We're accountable for the result, not the hours logged getting there. If something's off, you hear it from us first." },
    { title: "Communicate early", desc: "Blockers get flagged the moment we see them, not after they've already cost you a week." },
    { title: "Build systems", desc: "Anything done twice becomes a documented, repeatable process, one you keep whether or not you keep us." },
    { title: "Leave it sharper", desc: "We revisit what we've built and tighten it. Every month, something gets faster." }
  ];
  const valuesGrid = document.getElementById('valuesGrid');
  values.forEach((v, i) => {
    const card = document.createElement('div');
    card.className = 'value-card';
    card.style.transitionDelay = (i * 60) + 'ms';
    card.innerHTML = `<span class="value-num">0${i+1}</span><h3>${v.title}</h3><p>${v.desc}</p>`;
    valuesGrid.appendChild(card);
    io.observe(card);
  });

  /* ---------- hero ascent path (signature element) ---------- */
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.getElementById('ascent-svg');
  const heroVisual = document.getElementById('heroVisual');
  const caption = document.getElementById('pathCaption');
  const captionLive = document.getElementById('pathCaptionLive');
  const CAPTION_DEFAULT = 'Hover or focus a marker on the path.';

  /* One span per message, all in the same grid cell. The tallest one sets the
     height of the box once, at load, and it never changes again. */
  const captionSpans = [CAPTION_DEFAULT].concat(services.map(s => s.desc)).map((text, i) => {
    const span = document.createElement('span');
    span.textContent = text;
    if(i === 0) span.className = 'on';
    caption.appendChild(span);
    return span;
  });

  // i = -1 shows the default prompt; 0..4 show that discipline.
  function setCaption(i){
    const target = i < 0 ? 0 : i + 1;
    captionSpans.forEach((span, idx) => span.classList.toggle('on', idx === target));
    captionLive.textContent = i < 0 ? '' : services[i].desc;
  }

  // faint contour background lines
  const contours = [
    "M0,120 Q130,95 260,120 T520,120",
    "M0,220 Q130,195 260,220 T520,220",
    "M0,320 Q130,295 260,320 T520,320",
    "M0,400 Q130,378 260,400 T520,400"
  ];
  contours.forEach(d => {
    const p = document.createElementNS(svgNS, "path");
    p.setAttribute("d", d);
    p.setAttribute("class", "contour");
    svg.appendChild(p);
  });

  /* Six local peaks then the summit, one peak per discipline. Evenly spaced so
     the labels never collide, and each rises 50px on the previous so a label
     sitting slightly wide of its marker still clears its neighbours. */
  const points = [
    [20,424],
    [78,372],[110,398],
    [145,322],[177,348],
    [212,272],[244,298],
    [279,222],[311,248],
    [346,172],[378,198],
    [413,122],[445,148],
    [500,55]
  ];
  /* One marker per discipline. The final unmarked climb to the summit is the
     point of the metaphor: the disciplines are the route, not the peak. */
  const waypointIdx = [1,3,5,7,9,11];

  /* ---- summit geometry ----
     The arrowhead is a swallowtail dart, not a flat-based triangle. A flat base
     meets the line at 90° and flares to 12px against a 3.5px stroke, which
     reads as a barb hanging off the end. The dart's notch lets the line run
     into it instead, so the two read as one shape.
     The path is trimmed to stop inside the dart, where the dart is already
     wider than the stroke, so the round linecap is hidden and there's no seam. */
  const TIP   = points[points.length - 1];
  const PREV  = points[points.length - 2];
  const ARROW_LEN = 19, ARROW_HALF = 7, ARROW_NOTCH = 5.5, PATH_INSET = 7.5;

  const _dx = TIP[0] - PREV[0], _dy = TIP[1] - PREV[1];
  const _mag = Math.hypot(_dx, _dy);
  const ux = _dx / _mag, uy = _dy / _mag;                  // unit vector at the summit
  const arrowBase = [TIP[0] - ux * ARROW_LEN, TIP[1] - uy * ARROW_LEN];
  const pathEnd   = [arrowBase[0] + ux * PATH_INSET, arrowBase[1] + uy * PATH_INSET];

  // Everything except the final point, then stop early so the dart finishes the climb.
  const pathPoints = points.slice(0, -1).concat([pathEnd]);
  const pathD = "M" + pathPoints.map(p => p.join(",")).join(" L ");
  const pathEl = document.createElementNS(svgNS, "path");
  pathEl.setAttribute("d", pathD);
  pathEl.setAttribute("class", "ascent-path");
  svg.appendChild(pathEl);

  // Swallowtail dart: tip forward, two swept-back barbs, notch where the line enters.
  const angle = Math.atan2(uy, ux) * 180 / Math.PI;
  const arrow = document.createElementNS(svgNS, "g");           // placement only
  arrow.setAttribute("transform", `translate(${arrowBase[0]},${arrowBase[1]}) rotate(${angle})`);
  arrow.setAttribute("class", "ascent-arrow");
  const arrowShape = document.createElementNS(svgNS, "polygon"); // scaling only
  arrowShape.setAttribute("points", [
    `${ARROW_LEN},0`,        // tip
    `0,${-ARROW_HALF}`,      // upper barb
    `${ARROW_NOTCH},0`,      // notch — the line runs into this
    `0,${ARROW_HALF}`        // lower barb
  ].join(" "));
  arrowShape.setAttribute("class", "ascent-arrow-shape");
  arrow.appendChild(arrowShape);
  svg.appendChild(arrow);

  // The climber — a pulsing marker that rides the path and draws it.
  const climber = document.createElementNS(svgNS, "g");
  climber.setAttribute("class", "climber");
  const halo = document.createElementNS(svgNS, "circle");
  halo.setAttribute("r", 13); halo.setAttribute("class", "climber-halo");
  const dot = document.createElementNS(svgNS, "circle");
  dot.setAttribute("r", 5.5); dot.setAttribute("class", "climber-dot");
  climber.appendChild(halo); climber.appendChild(dot);
  svg.appendChild(climber);

  const waypoints = [];
  waypointIdx.forEach((pi, wi) => {
    const [wx,wy] = points[pi];
    const g = document.createElementNS(svgNS, "g");
    g.setAttribute("class", "waypoint");
    g.setAttribute("role", "button");
    g.setAttribute("tabindex", "0");
    g.setAttribute("aria-label", services[wi].title);
    const c = document.createElementNS(svgNS, "circle");
    c.setAttribute("cx", wx); c.setAttribute("cy", wy); c.setAttribute("r", 7);
    g.appendChild(c);
    const t = document.createElementNS(svgNS, "text");
    t.setAttribute("x", wx);
    t.setAttribute("y", wy - 15);
    t.textContent = shortLabels[wi];
    g.appendChild(t);
    const preview = () => { setCaption(wi); setActiveWaypoint(wi); };
    const clear = () => { setCaption(-1); setActiveWaypoint(-1); };
    g.addEventListener('mouseenter', preview);
    g.addEventListener('mouseleave', clear);
    g.addEventListener('focus', preview);
    g.addEventListener('blur', clear);
    g.addEventListener('click', () => setActive(wi));
    g.addEventListener('keydown', (e) => {
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); setActive(wi); }
    });
    svg.appendChild(g);
    waypoints.push(g);
  });
  function setActiveWaypoint(i){
    waypoints.forEach((w, idx) => w.classList.toggle('active', idx === i));
  }

  /* ---------- the ascent ----------
     One rAF loop drives everything: the climber's position, how much of the
     line is drawn, and when each waypoint ignites. Keeping them on a single
     clock means a waypoint lights up exactly as the climber reaches it —
     independent CSS keyframes and timers would drift apart. */
  const pathLength = pathEl.getTotalLength();
  pathEl.style.strokeDasharray = pathLength;
  pathEl.style.strokeDashoffset = pathLength;

  // Distance along the path at which each waypoint sits.
  const waypointAt = waypointIdx.map((pi) => {
    let d = 0;
    for(let i = 1; i <= pi; i++){
      d += Math.hypot(points[i][0] - points[i-1][0], points[i][1] - points[i-1][1]);
    }
    return d;
  });

  const CLIMB_MS = 2400;
  // Slow at the start, quick through the middle, easing off at the summit.
  const easeInOutCubic = (t) => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;

  function settle(){
    heroVisual.classList.add('drawn');       // arrowhead in
    climber.classList.remove('on');          // climber hands off to the arrow
    caption.classList.add('ready');          // now there is something to hover
  }

  function climb(){
    let start = null;
    const lit = new Set();
    climber.classList.add('on');

    function frame(now){
      if(start === null) start = now;
      const t = Math.min(1, (now - start) / CLIMB_MS);
      const travelled = pathLength * easeInOutCubic(t);

      pathEl.style.strokeDashoffset = pathLength - travelled;

      const pt = pathEl.getPointAtLength(travelled);
      climber.setAttribute('transform', `translate(${pt.x},${pt.y})`);

      waypointAt.forEach((d, i) => {
        if(travelled >= d && !lit.has(i)){
          lit.add(i);
          waypoints[i].classList.add('shown', 'ping');
          setTimeout(() => waypoints[i].classList.remove('ping'), 420);
        }
      });

      if(t < 1) requestAnimationFrame(frame);
      else setTimeout(settle, 120);
    }
    requestAnimationFrame(frame);
  }

  function playHero(){
    document.getElementById('heroSection').classList.add('loaded');

    if(prefersReducedMotion){
      pathEl.style.strokeDashoffset = 0;
      waypoints.forEach(w => w.classList.add('shown'));
      settle();
      return;
    }
    climb();
  }
  if(document.readyState === 'complete'){ setTimeout(playHero, 100); }
  else{ window.addEventListener('load', () => setTimeout(playHero, 100)); }

})();

/* ---------- process trail (index only) ---------- */
(function(){
  const stepTrack = document.getElementById('stepTrack');
  if(!stepTrack) return;
  const steps = [...stepTrack.querySelectorAll('.step')];
  const trailIO = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if(e.isIntersecting){
        stepTrack.classList.add('filled');
        steps.forEach((s, i) => {
          if(prefersReducedMotion) s.classList.add('filled');
          else setTimeout(() => s.classList.add('filled'), i * 160);
        });
        trailIO.unobserve(e.target);
      }
    });
  }, {threshold:0.3});
  trailIO.observe(stepTrack);

})();

/* ---------- contact form -> /api/inquiry (index only) ---------- */
(function(){
  const form = document.getElementById('inquiryForm');
  if(!form) return;
  const success = document.getElementById('formSuccess');
  const errorBox = document.getElementById('formError');
  const errorText = document.getElementById('formErrorText');
  const submitBtn = form.querySelector('.submit-btn');
  const submitBtnDefaultLabel = submitBtn.textContent;
  const FALLBACK_EMAIL = 'peakoperationspartner@gmail.com';

  const formFields = {
    name: document.getElementById('name'),
    company: document.getElementById('company'),
    email: document.getElementById('email'),
    service: document.getElementById('service'),
    message: document.getElementById('message'),
    botcheck: document.getElementById('botcheck')
  };
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function setSubmitting(isSubmitting){
    submitBtn.disabled = isSubmitting;
    submitBtn.textContent = isSubmitting ? 'Sending…' : submitBtnDefaultLabel;
  }

  function hideMessages(){
    success.classList.remove('show');
    errorBox.classList.remove('show');
  }

  function showError(message){
    errorText.textContent = message;
    errorBox.classList.add('show');
    errorBox.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'nearest' });
  }

  // Name, Company, Email and Message are required; also enforce a real email format.
  function validateForm(){
    if (!form.checkValidity()) {
      form.reportValidity();
      return false;
    }
    const emailValue = formFields.email.value.trim();
    if (!emailPattern.test(emailValue)) {
      formFields.email.setCustomValidity('Please enter a valid email address, like name@company.com.');
      form.reportValidity();
      formFields.email.setCustomValidity('');
      return false;
    }
    return true;
  }

  function playSuccessCheck(){
    if(prefersReducedMotion) return;
    const circle = success.querySelector('.check-circle');
    const mark = success.querySelector('.check-mark');
    [circle, mark].forEach(el => {
      const len = el.getTotalLength();
      el.style.strokeDasharray = len;
      el.style.strokeDashoffset = len;
      el.style.transition = 'stroke-dashoffset 0.6s ease';
    });
    requestAnimationFrame(() => {
      circle.style.strokeDashoffset = 0;
      setTimeout(() => { mark.style.strokeDashoffset = 0; }, 300);
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessages();

    if (!validateForm()) return;

    setSubmitting(true);

    try {
      const response = await fetch(form.getAttribute('data-endpoint'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:     formFields.name.value.trim(),
          company:  formFields.company.value.trim(),
          email:    formFields.email.value.trim(),
          service:  formFields.service.value,
          message:  formFields.message.value.trim(),
          botcheck: formFields.botcheck.value
        })
      });

      let result = null;
      try { result = await response.json(); } catch (parseErr) { result = null; }

      if (response.ok && result && result.ok) {
        form.reset();
        form.style.display = 'none';
        success.classList.add('show');
        success.setAttribute('tabindex', '-1');
        success.focus();
        playSuccessCheck();
      } else if (response.status === 404) {
        // The function isn't deployed — api/inquiry.js is missing or misplaced.
        showError('The form endpoint is missing. Please email us at ' + FALLBACK_EMAIL + '.');
      } else {
        showError((result && result.error) ||
          'We could not send your inquiry. Please try again, or email us at ' + FALLBACK_EMAIL + '.');
      }
    } catch (networkErr) {
      console.error('Inquiry submit failed:', networkErr);
      showError("We could not reach the server. Please check your connection and try again, or email us at " + FALLBACK_EMAIL + '.');
    } finally {
      setSubmitting(false);
    }
  });
})();

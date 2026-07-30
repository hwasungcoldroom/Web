/* =========================================================
   HWASUNG REFRIGERATION — SCRIPT.JS
   Shared by every page. Handles the mobile nav, scroll
   reveals, snow canvas, the cold gauge, the modals, and
   the booking form.
   ========================================================= */
/* =========================================================
   HWASUNG REFRIGERATION — SCRIPT.JS
   Handles: mobile nav, scroll reveal, snow animation,
   and the consultation booking form submission.
   ========================================================= */

(function () {
  'use strict';

  /* -------------------------------------------------------
     Footer year
  ------------------------------------------------------- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* -------------------------------------------------------
     Modal system (Special Promo / Booking form)
     Triggers: any element with [data-open-modal="<id>"]
     Closes: [data-close-modal] buttons, overlay click, Esc key
  ------------------------------------------------------- */
  var lastFocusedEl = null;

  var welcomeOverlay = document.getElementById('welcome-modal');
  var welcomeStack = document.getElementById('welcome-stack');
  var promoOverlay = document.getElementById('promo-modal');
  var bookingOverlay = document.getElementById('booking-modal');
  var promoPanel = promoOverlay && promoOverlay.querySelector('.modal-panel');
  var bookingPanel = bookingOverlay && bookingOverlay.querySelector('.modal-panel');

  /* Move both panels into the shared overlay and show them together */
  function openWelcomeModals() {
    if (!welcomeOverlay || !welcomeStack || !promoPanel || !bookingPanel) return;
    welcomeStack.appendChild(promoPanel);
    welcomeStack.appendChild(bookingPanel);
    welcomeOverlay.scrollTop = 0;
    openModal(welcomeOverlay);
  }

  /* Put each panel back in its own overlay so single triggers still work */
  function restorePanels() {
    if (promoPanel && promoOverlay && promoPanel.parentNode !== promoOverlay) {
      promoOverlay.appendChild(promoPanel);
    }
    if (bookingPanel && bookingOverlay && bookingPanel.parentNode !== bookingOverlay) {
      bookingOverlay.appendChild(bookingPanel);
    }
  }

  function openModal(modal) {
    if (!modal) return;
    lastFocusedEl = document.activeElement;
    modal.hidden = false;
    // Force a reflow so the transition plays
    void modal.offsetWidth;
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    var closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) closeBtn.focus();
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
    window.setTimeout(function () {
      modal.hidden = true;
      // Hand the panels back to their own overlays
      if (modal === welcomeOverlay) restorePanels();
    }, 220);
    if (lastFocusedEl && lastFocusedEl.focus) lastFocusedEl.focus();
  }

  document.querySelectorAll('[data-open-modal]').forEach(function (trigger) {
    trigger.addEventListener('click', function (event) {
      event.preventDefault();
      // A single trigger always opens just that one modal
      if (welcomeOverlay && welcomeOverlay.classList.contains('is-open')) {
        closeModal(welcomeOverlay);
        restorePanels();
      }
      var modal = document.getElementById(trigger.getAttribute('data-open-modal'));
      openModal(modal);
    });
  });

  /* Delegated close handling — keeps working after the panels are
     relocated between overlays. */
  document.addEventListener('click', function (event) {
    if (!event.target.closest) return;
    var btn = event.target.closest('[data-close-modal]');
    if (!btn) return;
    var overlay = btn.closest('.modal-overlay');
    if (overlay) closeModal(overlay);
  });

  document.querySelectorAll('.modal-overlay').forEach(function (modal) {
    modal.addEventListener('click', function (event) {
      // Clicking the backdrop (or the gap between stacked panels) closes it
      var onBackdrop = event.target === modal ||
        (event.target.classList && event.target.classList.contains('modal-stack'));
      if (onBackdrop) closeModal(modal);
    });
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    document.querySelectorAll('.modal-overlay.is-open').forEach(function (modal) {
      closeModal(modal);
    });
  });

  /* -------------------------------------------------------
     Mobile navigation toggle
  ------------------------------------------------------- */
  var navToggle = document.getElementById('nav-toggle');
  var header = document.querySelector('.site-header');

  if (navToggle && header) {
    navToggle.addEventListener('click', function () {
      var isOpen = header.classList.toggle('nav-open');
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    // Close mobile menu when a nav link is clicked
    document.querySelectorAll('.main-nav a').forEach(function (link) {
      link.addEventListener('click', function () {
        header.classList.remove('nav-open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* -------------------------------------------------------
     Home page: promo + booking form shown together on load.
     #welcome-modal only exists on index.html, so this is a
     no-op on every other page.
  ------------------------------------------------------- */
  if (welcomeOverlay) {
    window.setTimeout(openWelcomeModals, 400);
  }

  /* -------------------------------------------------------
     Scroll reveal animation (IntersectionObserver)
  ------------------------------------------------------- */
  var revealEls = document.querySelectorAll('.reveal');
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if ('IntersectionObserver' in window && !prefersReducedMotion) {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    revealEls.forEach(function (el) { revealObserver.observe(el); });
    // Short pages may never fire a scroll event, so reveal whatever is
    // already within the viewport straight away.
    revealEls.forEach(function (el) {
      if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('is-visible');
    });
  } else {
    // No IntersectionObserver support or reduced motion preferred: show everything
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* -------------------------------------------------------
     Lightweight snow animation (canvas)
     Kept intentionally simple: a small, fixed particle count
     redrawn with requestAnimationFrame. Pauses when the tab
     is hidden and respects prefers-reduced-motion.
  ------------------------------------------------------- */
  var canvas = document.getElementById('snow-canvas');

  if (canvas && !prefersReducedMotion) {
    var ctx = canvas.getContext('2d');
    var flakes = [];
    // Fewer flakes on mobile. Roughly one in six is a soft, oversized
    // "bokeh" orb (like out-of-focus snow close to a camera lens) — that
    // mix of large soft blurs and small crisp dots is what gives the
    // snowfall the same dreamy, layered depth as the reference photo.
    var FLAKE_COUNT = window.innerWidth < 720 ? 130 : 230;
    var BOKEH_TINTS = ['255,255,255', '255,255,255', '159,216,232']; // mostly white, occasional frost-cyan
    var animationId = null;
    var isTabVisible = true;

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    function createFlake() {
      // Depth layers give the snowfall a sense of distance: far flakes are
      // small, slow, and faint; near flakes are bigger, faster, and brighter.
      var isBokeh = Math.random() < 0.16;

      if (isBokeh) {
        var bRadius = 10 + Math.random() * 22;
        return {
          bokeh: true,
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          radius: bRadius,
          speedY: 0.15 + Math.random() * 0.25,
          speedX: Math.random() * 0.2 - 0.1,
          drift: Math.random() * Math.PI * 2,
          opacity: 0.10 + Math.random() * 0.22,
          tint: BOKEH_TINTS[Math.floor(Math.random() * BOKEH_TINTS.length)]
        };
      }

      var depth = Math.random();
      var radius = depth * 3 + 1.5;
      return {
        bokeh: false,
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: radius,
        speedY: depth * 0.9 + 0.45,
        speedX: Math.random() * 0.5 - 0.25,
        drift: Math.random() * Math.PI * 2,
        opacity: depth * 0.4 + 0.6,
        glow: radius * 2.8
      };
    }

    function initFlakes() {
      flakes = [];
      for (var i = 0; i < FLAKE_COUNT; i++) flakes.push(createFlake());
    }

    function drawFlakes() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      flakes.forEach(function (flake) {
        ctx.save();
        if (flake.bokeh) {
          // Large, soft, out-of-focus orb: a radial gradient reads as a true
          // photographic blur, unlike a hard circle with a shadow around it.
          var gradient = ctx.createRadialGradient(flake.x, flake.y, 0, flake.x, flake.y, flake.radius);
          gradient.addColorStop(0, 'rgba(' + flake.tint + ',' + flake.opacity + ')');
          gradient.addColorStop(1, 'rgba(' + flake.tint + ',0)');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.globalAlpha = flake.opacity;
          // Soft glow behind each flake so it stays visible over both the
          // pale sections and the dark navy bands of the page.
          ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
          ctx.shadowBlur = flake.glow;
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        flake.y += flake.speedY;
        flake.drift += 0.01;
        flake.x += flake.speedX + Math.sin(flake.drift) * (flake.bokeh ? 0.15 : 0.3);

        // Recycle flakes that drift off screen
        var edge = flake.radius + 5;
        if (flake.y > canvas.height + edge) {
          flake.y = -edge;
          flake.x = Math.random() * canvas.width;
        }
        if (flake.x > canvas.width + edge) flake.x = -edge;
        if (flake.x < -edge) flake.x = canvas.width + edge;
      });

      ctx.globalAlpha = 1;
    }

    function loop() {
      if (isTabVisible) drawFlakes();
      animationId = requestAnimationFrame(loop);
    }

    document.addEventListener('visibilitychange', function () {
      isTabVisible = document.visibilityState === 'visible';
    });

    var resizeTimeout;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(function () {
        resizeCanvas();
        FLAKE_COUNT = window.innerWidth < 720 ? 130 : 230;
        initFlakes();
      }, 200);
    });

    resizeCanvas();
    initFlakes();
    loop();
  }

  /* -------------------------------------------------------
     Consultation booking form
     Currently client-side only: on submit, it validates the
     fields and shows the success message directly. There is
     no backend in this project yet — see the comment marked
     BACKEND INTEGRATION POINT below for where to add one
     later (e.g. a POST to your own /api/booking endpoint).
  ------------------------------------------------------- */
  var form = document.getElementById('booking-form');

  if (form) {
    var nameInput = document.getElementById('fullName');
    var phoneInput = document.getElementById('phone');
    var nameError = document.getElementById('fullName-error');
    var phoneError = document.getElementById('phone-error');
    var submitBtn = document.getElementById('booking-submit');
    var successBox = document.getElementById('booking-success');
    var errorBox = document.getElementById('booking-error');

    // Simple phone format check (accepts common US formats; adjust for your locale)
    var PHONE_PATTERN = /^[\d\s()+.-]{7,20}$/;

    function validateName() {
      var value = nameInput.value.trim();
      if (!value) {
        nameError.textContent = 'Please enter your full name.';
        return false;
      }
      nameError.textContent = '';
      return true;
    }

    function validatePhone() {
      var value = phoneInput.value.trim();
      if (!value || !PHONE_PATTERN.test(value)) {
        phoneError.textContent = 'Please enter a valid phone number.';
        return false;
      }
      phoneError.textContent = '';
      return true;
    }

    nameInput.addEventListener('blur', validateName);
    phoneInput.addEventListener('blur', validatePhone);

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var isNameValid = validateName();
      var isPhoneValid = validatePhone();

      if (!isNameValid || !isPhoneValid) return;

      successBox.hidden = true;
      errorBox.hidden = true;
      submitBtn.setAttribute('data-loading', 'true');
      submitBtn.disabled = true;

      var requestTypes = Array.prototype.slice
        .call(document.querySelectorAll('input[name="requestType"]:checked'))
        .map(function (el) { return el.value; });

      var payload = {
  fullName: nameInput.value.trim(),
  phone: phoneInput.value.trim(),
  requestType: requestTypes
};

      // ---------------------------------------------------
      // BACKEND INTEGRATION POINT
      // This project is currently plain HTML/CSS/JS with no
      // server. To actually receive these submissions (store
      // them, notify staff, or trigger an outbound call via
      // Twilio/Vonage/Plivo), add your own backend endpoint
      // and call it here, for example:
      //
      //   fetch('https://your-backend.example.com/api/booking', {
      //     method: 'POST',
      //     headers: { 'Content-Type': 'application/json' },
      //     body: JSON.stringify(payload)
      //   })
      //     .then(function (response) {
      //       if (!response.ok) throw new Error('Request failed');
      //       showSuccess();
      //     })
      //     .catch(showError);
      //
      // Until then, this simulates a short delay and shows the
      // success message directly so the form is fully demo-able.
      // ---------------------------------------------------
      window.setTimeout(function () {
        console.log('[Booking submitted — no backend connected]', payload);
        form.reset();
        successBox.hidden = false;
        successBox.focus && successBox.focus();
        submitBtn.removeAttribute('data-loading');
        submitBtn.disabled = false;
      }, 600);
    });
  }
})();


/* ---------------------------------------------------
   Cold gauge: 0 -> -20 -> -50 -> back to 0
   One script moves the mercury AND swaps the caption, so the two can
   never drift apart. (Previously the column used SVG <animate> and the
   captions used separate CSS keyframes; those two clocks start and
   pause independently — e.g. when the tab is backgrounded — which is
   why the label sometimes showed the wrong temperature.)
   --------------------------------------------------- */
(function () {
  var svg = document.querySelector('.cold-gauge svg');
  if (!svg) return;

  var column = svg.querySelector('[data-gauge-column]');
  var marker = svg.querySelector('[data-gauge-marker]');
  var labels = document.querySelectorAll('.cold-gauge-label');
  if (!column || !marker || !labels.length) return;

  var BASE = 238;          // y of the bottom of the mercury column
  var HOLD = 2600;         // ms paused at each temperature
  var MOVE = 1100;         // ms travelling between temperatures
  // y positions matching the tick marks: 0, -20, -50
  var STOPS = [30, 106, 220];

  function setLevel(y) {
    column.setAttribute('y', y);
    column.setAttribute('height', Math.max(BASE - y, 6));
    marker.setAttribute('cy', y);
  }

  function showLabel(i) {
    for (var n = 0; n < labels.length; n++) {
      labels[n].classList.toggle('is-current', n === i);
    }
  }

  // Reduced-motion: hold the headline figure, no movement at all
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    setLevel(STOPS[1]);
    showLabel(1);
    return;
  }

  function ease(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

  var index = 0;
  setLevel(STOPS[0]);
  showLabel(0);

  function travel() {
    var from = STOPS[index];
    var next = (index + 1) % STOPS.length;
    var to = STOPS[next];
    var start = null;

    function frame(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / MOVE, 1);
      setLevel(from + (to - from) * ease(p));
      if (p < 1) {
        window.requestAnimationFrame(frame);
      } else {
        index = next;
        showLabel(index);          // caption swaps exactly on arrival
        window.setTimeout(travel, HOLD);
      }
    }
    window.requestAnimationFrame(frame);
  }

  window.setTimeout(travel, HOLD);
})();

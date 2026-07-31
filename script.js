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

  /* Exposed so the Employment page can open its application modal after it
     has configured the form for the chosen role — configuring first avoids
     a flash of the previously selected position. */
  window.HwasungModal = { open: openModal, close: closeModal };

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


/* ---------------------------------------------------
   Employment page
   One application form that reshapes itself for the
   chosen role. Runs only on employment.html; every
   element lookup is guarded so other pages skip it.
   --------------------------------------------------- */
(function () {
  var panel = document.getElementById('apply-modal');
  var form = document.getElementById('apply-form');
  if (!panel || !form) return;

  var grid        = document.getElementById('job-grid');
  var roleName    = document.getElementById('apply-role-name');
  var positionIn  = document.getElementById('apply-position');
  var changeBtn   = document.getElementById('apply-change');
  var expBlock    = document.getElementById('experience-block');
  var trainNote   = document.getElementById('training-note');
  var submitBtn   = document.getElementById('apply-submit');
  var successBox  = document.getElementById('apply-success');

  var details     = document.getElementById('details');
  var wordCount   = document.getElementById('details-count');

  var fileInput   = document.getElementById('cv');
  var uploadArea  = document.getElementById('upload-area');
  var uploadText  = document.getElementById('upload-text');
  var uploadSub   = uploadText.querySelector('.upload-sub');
  var uploadTitle = uploadText.querySelector('strong');

  var MAX_CHARS = 300;
  var MAX_BYTES = 10 * 1024 * 1024;               // 10 MB
  var ALLOWED = /\.(pdf|docx)$/i;
  var DEFAULT_TITLE = uploadTitle.textContent;
  var DEFAULT_SUB = uploadSub.textContent;

  /* Which extra fields each role shows.
     office: neither block — personal details, CV, submit only. */
  var VARIANTS = {
    experienced: { experience: true,  training: false },
    trainee:     { experience: false, training: true  },
    office:      { experience: false, training: false }
  };

  /* ---------- role selection ---------- */

  function selectRole(role, variant) {
    var cfg = VARIANTS[variant] || VARIANTS.office;

    roleName.textContent = role;
    positionIn.value = role;

    expBlock.hidden = !cfg.experience;
    trainNote.hidden = !cfg.training;

    // Unchecking on switch stops a hidden box from being submitted for a
    // role that never displayed it.
    if (!cfg.experience) {
      var boxes = expBlock.querySelectorAll('input[type="checkbox"]');
      for (var i = 0; i < boxes.length; i++) boxes[i].checked = false;
    }

    successBox.hidden = true;

    // Highlight the card being applied for
    var cards = grid.querySelectorAll('.job-card');
    for (var c = 0; c < cards.length; c++) {
      cards[c].classList.toggle('is-selected', cards[c].getAttribute('data-role') === role);
    }

    // Open only after the form is configured, so the popup never shows the
    // previously chosen role for a frame.
    if (window.HwasungModal) {
      window.HwasungModal.open(panel);
      panel.scrollTop = 0;
    } else {
      panel.hidden = false;                       // fallback if the shared script is older
    }
  }

  function clearRole() {
    if (window.HwasungModal) window.HwasungModal.close(panel);
    else panel.hidden = true;
    positionIn.value = '';
    roleName.textContent = '\u00a0';

    var cards = grid.querySelectorAll('.job-card');
    for (var i = 0; i < cards.length; i++) cards[i].classList.remove('is-selected');

    grid.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(function () {
      var firstBtn = grid.querySelector('.js-apply');
      if (firstBtn) firstBtn.focus({ preventScroll: true });
    }, 420);
  }

  // Only .js-apply buttons are wired up, so the disabled "Position Full"
  // button can never open the form.
  var applyBtns = document.querySelectorAll('.js-apply');
  for (var b = 0; b < applyBtns.length; b++) {
    applyBtns[b].addEventListener('click', function () {
      selectRole(this.getAttribute('data-role'), this.getAttribute('data-variant'));
    });
  }
  changeBtn.addEventListener('click', clearRole);

  /* ---------- CV upload ---------- */

  function describeFile(file) {
    var kb = file.size / 1024;
    var size = kb > 1024 ? (kb / 1024).toFixed(1) + ' MB' : Math.round(kb) + ' KB';
    return file.name + ' \u2014 ' + size;
  }

  function resetUpload() {
    uploadArea.classList.remove('has-file');
    uploadTitle.textContent = DEFAULT_TITLE;
    uploadSub.textContent = DEFAULT_SUB;
  }

  fileInput.addEventListener('change', function () {
    var file = fileInput.files && fileInput.files[0];
    if (!file) { resetUpload(); return; }
    if (validateFile()) {
      uploadArea.classList.add('has-file');
      uploadTitle.textContent = 'CV attached';
      uploadSub.textContent = describeFile(file);
    } else {
      resetUpload();
    }
  });

  // Drag and drop onto the upload area
  ['dragenter', 'dragover'].forEach(function (evt) {
    uploadArea.addEventListener(evt, function (e) {
      e.preventDefault();
      uploadArea.classList.add('is-dragover');
    });
  });
  ['dragleave', 'drop'].forEach(function (evt) {
    uploadArea.addEventListener(evt, function (e) {
      e.preventDefault();
      uploadArea.classList.remove('is-dragover');
    });
  });
  uploadArea.addEventListener('drop', function (e) {
    if (e.dataTransfer && e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      fileInput.dispatchEvent(new Event('change'));
    }
  });

  /* ---------- validation ---------- */

  function setError(id, message) {
    var el = document.getElementById(id + '-error');
    if (el) el.textContent = message || '';
    var input = document.getElementById(id);
    if (input) {
      input.setAttribute('data-touched', 'true');
      input.setAttribute('aria-invalid', message ? 'true' : 'false');
    }
    return !message;
  }

  function validateText(id, label) {
    var v = document.getElementById(id).value.trim();
    return setError(id, v ? '' : 'Please enter your ' + label + '.');
  }

  function validateMobile() {
    var v = document.getElementById('mobile').value.trim();
    if (!v) return setError('mobile', 'Please enter your mobile number.');
    if (!/^[\d\s()+.-]{7,20}$/.test(v)) return setError('mobile', 'Please enter a valid mobile number.');
    return setError('mobile', '');
  }

  function validateEmail() {
    var v = document.getElementById('email').value.trim();
    if (!v) return setError('email', 'Please enter your email address.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return setError('email', 'Please enter a valid email address.');
    return setError('email', '');
  }

  function countChars(text) {
    return text.length;
  }

  function updateWordCount() {
    var n = countChars(details.value);
    wordCount.textContent = n + ' / ' + MAX_CHARS + ' characters';
    wordCount.classList.toggle('is-near', n > MAX_CHARS * 0.9 && n <= MAX_CHARS);
    wordCount.classList.toggle('is-over', n > MAX_CHARS);
    details.classList.toggle('is-over', n > MAX_CHARS);
    if (n <= MAX_CHARS) setError('details', '');
    return n;
  }

  function validateDetails() {
    // Optional field — only the length is enforced
    var n = countChars(details.value);
    if (n > MAX_CHARS) {
      return setError('details', 'Please shorten this to ' + MAX_CHARS +
        ' characters or fewer. You are ' + (n - MAX_CHARS) + ' over.');
    }
    return setError('details', '');
  }

  details.addEventListener('input', updateWordCount);
  details.addEventListener('blur', validateDetails);
  updateWordCount();

  function validateFile() {
    var file = fileInput.files && fileInput.files[0];
    if (!file) return setError('cv', 'Please attach your CV.');
    if (!ALLOWED.test(file.name)) return setError('cv', 'Your CV must be a PDF or DOCX file.');
    if (file.size > MAX_BYTES) return setError('cv', 'That file is larger than 10 MB. Please upload a smaller one.');
    return setError('cv', '');
  }

  document.getElementById('firstName').addEventListener('blur', function () { validateText('firstName', 'first name'); });
  document.getElementById('lastName').addEventListener('blur', function () { validateText('lastName', 'last name'); });
  document.getElementById('mobile').addEventListener('blur', validateMobile);
  document.getElementById('email').addEventListener('blur', validateEmail);

  /* ---------- submit ---------- */

  form.addEventListener('submit', function (event) {
    // Note: default is NOT prevented up here. It is prevented only when the
    // form is invalid, or when no endpoint is configured — otherwise the
    // browser must be allowed to POST, since that is what carries the CV.

    // Evaluate every field so all messages appear at once
    var checks = [
      validateText('firstName', 'first name'),
      validateText('lastName', 'last name'),
      validateMobile(),
      validateEmail(),
      validateFile(),
      validateDetails()
    ];
    var ok = checks.indexOf(false) === -1;

    if (!ok) {
      event.preventDefault();
      var firstBad = form.querySelector('input[aria-invalid="true"], textarea[aria-invalid="true"]');
      if (firstBad) firstBad.focus();
      return;
    }

    // Everything valid. If a real endpoint is configured, let the browser do a
    // normal POST — that is what carries the CV file. The applicant lands on
    // the `_next` URL afterwards, which shows the confirmation banner.
    if (form.getAttribute('action')) {
      successBox.hidden = true;
      submitBtn.setAttribute('data-loading', 'true');
      submitBtn.disabled = true;
      return;                       // no preventDefault: the form submits
    }

    // No endpoint configured — fall back to a local confirmation so the flow
    // can still be demonstrated. Nothing is sent in this branch.
    event.preventDefault();

    var experience = [];
    if (!expBlock.hidden) {
      var picked = expBlock.querySelectorAll('input[type="checkbox"]:checked');
      for (var i = 0; i < picked.length; i++) experience.push(picked[i].value);
    }

    console.log('[Application not sent — no action set on the form]', {
      position:   positionIn.value,
      firstName:  document.getElementById('firstName').value.trim(),
      lastName:   document.getElementById('lastName').value.trim(),
      mobile:     document.getElementById('mobile').value.trim(),
      email:      document.getElementById('email').value.trim(),
      experience: experience,
      details:    details.value.trim(),
      cv:         fileInput.files[0] ? fileInput.files[0].name : null
    });

    submitBtn.setAttribute('data-loading', 'true');
    submitBtn.disabled = true;
    window.setTimeout(function () {
      form.reset();
      resetUpload();
      updateWordCount();
      successBox.hidden = false;
      successBox.focus && successBox.focus();
      submitBtn.removeAttribute('data-loading');
      submitBtn.disabled = false;
    }, 700);
  });

  /* Applicant returning from the mail service: confirm, then tidy the URL so a
     refresh does not show the message again. */
  (function () {
    if (window.location.search.indexOf('sent=1') === -1) return;
    var sent = document.getElementById('apply-sent');
    if (!sent) return;
    sent.hidden = false;
    sent.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  })();
})();

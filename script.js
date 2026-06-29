/* ============================================================
   ALIGNED AESTHETICS — script.js
   Handles: Custom Cursor · Nav Scroll · Marquee ·
            Mandala BG Tiles · Scroll Reveal
   ============================================================ */

/* ── 1. CUSTOM CURSOR ── */
(function initCursor() {
  const cursor = document.getElementById('cursor');
  const ring   = document.getElementById('cursorRing');

  let mouseX = 0, mouseY = 0;   // actual mouse position
  let ringX  = 0, ringY  = 0;   // lagging ring position

  // Track real mouse position
  document.addEventListener('mousemove', function (e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  // Animate cursor dot (instant) and ring (lagging)
  function animateCursor() {
    // Dot follows instantly
    cursor.style.left = mouseX + 'px';
    cursor.style.top  = mouseY + 'px';

    // Ring lerps toward mouse
    ringX += (mouseX - ringX) * 0.12;
    ringY += (mouseY - ringY) * 0.12;
    ring.style.left = ringX + 'px';
    ring.style.top  = ringY + 'px';

    requestAnimationFrame(animateCursor);
  }
  animateCursor();

  // Scale ring on interactive elements
  document.querySelectorAll('a, button').forEach(function (el) {
    el.addEventListener('mouseenter', function () {
      ring.style.transform   = 'translate(-50%, -50%) scale(1.6)';
      ring.style.borderColor = '#C8A84B';
      ring.style.opacity     = '0.8';
    });
    el.addEventListener('mouseleave', function () {
      ring.style.transform   = 'translate(-50%, -50%) scale(1)';
      ring.style.borderColor = 'rgba(232,212,154,0.5)';
      ring.style.opacity     = '0.5';
    });
  });
})();


/* ── 2. NAVBAR — SOLID ON SCROLL ── */
(function initNavScroll() {
  var navbar = document.getElementById('navbar');

  window.addEventListener('scroll', function () {
    if (window.scrollY > 60) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });
})();


/* ── 3. MARQUEE — DYNAMIC ITEMS ── */
(function initMarquee() {
  var services = [
    'Video Editing',
    'Graphic Design',
    'Web Development',
    'Motion Graphics',
    'App Development',
    'Brand Identity',
    'Reels & Content',
    'UI / UX Design'
  ];

  var track = document.getElementById('marqueeTrack');
  if (!track) return;

  // Duplicate for seamless infinite scroll
  var allItems = services.concat(services);

  allItems.forEach(function (text) {
    var div = document.createElement('div');
    div.className = 'marquee-item';
    div.innerHTML = text + '<span class="marquee-dot">✦</span>';
    track.appendChild(div);
  });
})();


/* ── 4. MANDALA BACKGROUND TILES ── */
(function initMandalaBg() {
  var bgGrid = document.getElementById('mandala-bg');
  if (!bgGrid) return;

  // Speeds cycle through 5 values (25s → 45s)
  for (var i = 0; i < 20; i++) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');

    var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', 'translate(50,50)');

    // Alternate clockwise / counter-clockwise for visual variety
    var direction = i % 2 === 0 ? '' : ' reverse';
    var duration  = (25 + (i % 5) * 5) + 's';
    g.style.animation      = 'rotateSlow ' + duration + ' linear infinite' + direction;
    g.style.transformOrigin = 'center';

    g.innerHTML = [
      '<g stroke="#C8A84B" stroke-width="1.5" fill="none" stroke-linecap="round">',
        '<path d="M0,-8 C-6,-16 -6,-26 0,-32"/>',
        '<path d="M0,-8 C6,-16 6,-26 0,-32"/>',
        '<path d="M8,0 C16,-6 26,-6 32,0"/>',
        '<path d="M8,0 C16,6 26,6 32,0"/>',
        '<path d="M0,8 C-6,16 -6,26 0,32"/>',
        '<path d="M0,8 C6,16 6,26 0,32"/>',
        '<path d="M-8,0 C-16,-6 -26,-6 -32,0"/>',
        '<path d="M-8,0 C-16,6 -26,6 -32,0"/>',
      '</g>',
      '<circle cx="0" cy="0" r="4" stroke="#C8A84B" stroke-width="1" fill="none"/>'
    ].join('');

    svg.appendChild(g);
    bgGrid.appendChild(svg);
  }
})();


/* ── 5. SCROLL REVEAL (IntersectionObserver) ── */
(function initScrollReveal() {
  var options = { threshold: 0.15 };

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);   // fire once only
      }
    });
  }, options);

  // Reveal generic elements
  document.querySelectorAll('.reveal').forEach(function (el) {
    observer.observe(el);
  });

  // Process steps slide in from left
  document.querySelectorAll('.process-step').forEach(function (el) {
    observer.observe(el);
  });
})();


/* ── 6. CONTACT FORM SUBMISSION ── */
(function initContactForm() {
  var form = document.getElementById('clientRequestForm');
  var status = document.getElementById('requestFormStatus');
  var localMessagesKey = 'aa_local_client_messages';

  if (!form || !status) return;

  function readLocalMessages() {
    try {
      return JSON.parse(localStorage.getItem(localMessagesKey) || '[]');
    } catch (error) {
      return [];
    }
  }

  function saveLocalMessage(message) {
    var messages = readLocalMessages();
    messages.unshift(message);
    localStorage.setItem(localMessagesKey, JSON.stringify(messages.slice(0, 200)));
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();

    status.textContent = 'Sending your message...';
    status.dataset.state = 'pending';

    var submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = true;
    }

    try {
      var payload = {};

      new FormData(form).forEach(function (value, key) {
        payload[key] = value;
      });

      try {
        var response = await fetch(form.action, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        var responsePayload = await response.json();

        if (!response.ok || !responsePayload.ok) {
          throw new Error(responsePayload.error || 'Unable to send your message right now.');
        }
      } catch (apiError) {
        saveLocalMessage({
          id: 'local-' + Date.now(),
          clientName: payload.client_name,
          clientEmail: payload.client_email,
          clientMobile: payload.client_mobile,
          selectedService: payload.selected_service,
          clientMessage: payload.client_message,
          createdAt: new Date().toISOString(),
          status: 'new'
        });
      }

      form.reset();
      status.textContent = "We\'ll reach you soon.";
      status.dataset.state = 'success';
    } catch (error) {
      status.textContent = error.message || 'Something went wrong. Please try again.';
      status.dataset.state = 'error';
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });
})();

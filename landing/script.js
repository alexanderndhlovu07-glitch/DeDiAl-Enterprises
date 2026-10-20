(() => {
  'use strict';

  const init = () => {
    const root = document.documentElement;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const compactViewport = window.matchMedia('(max-width: 760px)');
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const supportsIntersection = typeof window.IntersectionObserver === 'function';
    let syncHeroScene = () => {};
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const number = (value, fallback = 0) => value == null || String(value).trim() === ''
      ? fallback : Number.isFinite(Number(value)) ? Number(value) : fallback;
    const listenForChange = (query, callback) => {
      if (query.addEventListener) query.addEventListener('change', callback);
      else query.addListener(callback);
    };

    // The landing page has no dependency on the platform's scripts or state.
    const platformRoutes = new Set(['signup', 'login', 'assistant', 'home']);
    const platformBase = window.DEDIAL_CONFIG?.platformUrl || 'http://127.0.0.1:4173/';
    try {
      const target = new URL(platformBase, window.location.href);
      if (target.protocol === 'http:' || target.protocol === 'https:') {
        document.querySelectorAll('[data-platform-link]').forEach(link => {
          const route = link.dataset.platformRoute || 'signup';
          if (!platformRoutes.has(route)) return;
          const destination = new URL(target.href);
          destination.hash = route;
          link.href = destination.href;
        });
      }
    } catch (_) {
      // Explicit links in the HTML remain usable if deployment config is invalid.
    }

    document.querySelectorAll('[data-current-year]').forEach(item => {
      item.textContent = String(new Date().getFullYear());
    });

    const menuToggle = document.querySelector('#menu-toggle');
    const mobileMenu = document.querySelector('#mobile-menu');
    if (menuToggle && mobileMenu) {
      const surroundings = [...document.querySelectorAll('main, .site-footer, .site-header > .brand, .desktop-nav, .header-actions > a')]
        .map(element => ({ element, wasInert: element.inert }));
      const setMenu = (open, restoreFocus = false) => {
        menuToggle.setAttribute('aria-expanded', String(open));
        menuToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
        mobileMenu.hidden = !open;
        root.classList.toggle('menu-open', open);
        syncHeroScene();
        surroundings.forEach(({ element, wasInert }) => { element.inert = open || wasInert; });
        if (open) mobileMenu.querySelector('a')?.focus({ preventScroll: true });
        else if (restoreFocus) menuToggle.focus({ preventScroll: true });
      };
      setMenu(false);
      menuToggle.addEventListener('click', () => {
        setMenu(menuToggle.getAttribute('aria-expanded') !== 'true');
      });
      mobileMenu.addEventListener('click', event => {
        if (event.target.closest('a')) setMenu(false);
      });
      document.addEventListener('keydown', event => {
        if (mobileMenu.hidden) return;
        if (event.key === 'Escape') setMenu(false, true);
        if (event.key === 'Tab') {
          const controls = [menuToggle, ...mobileMenu.querySelectorAll('a[href]')];
          const first = controls[0], last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault(); last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault(); first.focus();
          }
        }
      });
      document.addEventListener('click', event => {
        if (!mobileMenu.hidden && !mobileMenu.contains(event.target) && !menuToggle.contains(event.target)) {
          setMenu(false, true);
        }
      });
      listenForChange(window.matchMedia('(min-width: 901px)'), event => {
        if (event.matches) {
          const wasInMenu = mobileMenu.contains(document.activeElement) || document.activeElement === menuToggle;
          setMenu(false);
          if (wasInMenu) document.querySelector('.desktop-nav a')?.focus({ preventScroll: true });
        }
      });
    }

    const exampleCopy = {
      stay: 'A place, a date, a little context. In this concept, Lex helps turn your preferences into a stay to review.',
      commerce: 'Start with your space, style and budget. Lex could connect those details with relevant products and sellers.',
      book: 'Tell Lex what you need and when. Explore nearby services in DeDiAl, then review the details before booking.',
      source: 'Describe the product and quantity. Lex can help you start a sourcing request and find your next step in DeDiAl.',
      activity: 'Ask about your bookings or sourcing requests. Lex can point you toward your activity in DeDiAl.'
    };
    const examples = [...document.querySelectorAll('[data-lex-example]')];
    const response = document.querySelector('#lex-response');
    let responseTimer = 0;
    let responseEndTimer = 0;
    if (response && examples.length) {
      examples.forEach(button => {
        button.addEventListener('click', () => {
          const copy = exampleCopy[button.dataset.lexExample];
          if (!copy) return;
          clearTimeout(responseTimer);
          clearTimeout(responseEndTimer);
          examples.forEach(item => {
            const active = item === button;
            item.setAttribute('aria-pressed', String(active));
            item.classList.toggle('is-active', active);
          });
          const update = () => {
            response.textContent = copy;
            response.classList.remove('is-changing');
            response.classList.add('is-updated');
            responseEndTimer = window.setTimeout(() => response.classList.remove('is-updated'), 680);
          };
          response.classList.remove('is-updated');
          if (reducedMotion.matches) update();
          else {
            response.classList.add('is-changing');
            responseTimer = window.setTimeout(update, 120);
          }
        });
      });
    }

    const reveals = [...document.querySelectorAll('[data-reveal]')];
    reveals.forEach(item => {
      item.style.setProperty('--reveal-delay', `${clamp(number(item.dataset.revealDelay), 0, 600)}ms`);
    });
    let revealObserver;
    if (supportsIntersection && !reducedMotion.matches) {
      // A masked line starts outside its clipped box. Observe the stable mask,
      // so its translated child can enter instead of waiting on its own visibility.
      const revealTargets = new Map();
      reveals.forEach(item => {
        const target = item.closest('.type-mask') || item;
        if (!revealTargets.has(target)) revealTargets.set(target, []);
        revealTargets.get(target).push(item);
      });
      revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          revealTargets.get(entry.target)?.forEach(item => item.classList.add('is-visible'));
          revealObserver.unobserve(entry.target);
        });
      }, { rootMargin: '0px 0px -32px 0px', threshold: 0.08 });
      revealTargets.forEach((_, target) => revealObserver.observe(target));
    } else {
      reveals.forEach(item => item.classList.add('is-visible'));
    }

    const parallaxItems = [...document.querySelectorAll('[data-parallax]')].map(element => ({
      element,
      distance: clamp(number(element.dataset.parallax, 30), -90, 90),
      top: 0,
      height: 0,
      current: 0,
      target: 0,
      rendered: NaN
    }));
    const lexScene = document.querySelector('#lex-scene');
    const lexSteps = lexScene ? [...lexScene.querySelectorAll('.lex-step[data-step]')] : [];
    const lex = { top: 0, height: 0, current: 0, target: 0, rendered: NaN, step: -1 };
    const heroElement = document.querySelector('#top.hero--objects');
    const heroStage = heroElement?.querySelector('.hero-stage');
    const heroObjectStage = heroElement?.querySelector('.hero-object-stage');
    const hero = {
      top: 0, height: 0, stage: null, sceneWidth: 0, sceneHeight: 0,
      current: 0, target: 0, pointerX: 0, pointerY: 0, targetX: 0, targetY: 0,
      rendered: '', inView: false, compact: false, lightweight: false, motionBudget: 1
    };
    let viewportHeight = window.innerHeight;
    let scrollPosition = window.scrollY;
    let frame = 0;
    let needsMeasure = true;
    let previousFrame = 0;

    // Ship, aircraft and harbour are independent image planes. Their positions
    // derive from one reversible scroll progress value, never an idle timeline.
    const updateHeroPolicy = () => {
      if (!heroElement) return;
      const slowConnection = !!connection?.saveData || /^(slow-)?2g$/.test(connection?.effectiveType || '');
      const limitedDevice = (navigator.deviceMemory && navigator.deviceMemory <= 2)
        || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
      hero.compact = compactViewport.matches || !finePointer.matches || window.innerHeight < 540;
      hero.lightweight = Boolean(slowConnection || limitedDevice);
      const highDensity = window.devicePixelRatio > 2.5 ? 0.85 : 1;
      hero.motionBudget = hero.compact
        ? clamp(window.innerHeight / 760 * 0.28, 0.16, 0.28) * highDensity : 1;
      heroElement.classList.toggle('is-hero-compact', hero.compact);
      heroElement.classList.toggle('is-hero-lightweight', hero.lightweight);
      hero.rendered = '';
      if (reducedMotion.matches || !finePointer.matches || hero.compact || hero.lightweight) {
        hero.targetX = hero.targetY = 0;
      }
    };
    const writeHero = () => {
      if (!heroElement) return;
      const p = number(hero.current.toFixed(4));
      const x = number(hero.pointerX.toFixed(4));
      const y = number(hero.pointerY.toFixed(4));
      const disabled = reducedMotion.matches || hero.lightweight;
      const motion = disabled ? 0 : hero.motionBudget;
      const pointer = disabled || hero.compact ? 0 : 1;
      const sceneWidth = hero.sceneWidth || window.innerWidth * (hero.compact ? 0.92 : 0.7);
      const sceneHeight = hero.sceneHeight || viewportHeight * 0.65;
      const key = [p, x, y, motion, pointer, sceneWidth, sceneHeight].join(':');
      if (hero.rendered === key) return;
      hero.rendered = key;
      const set = (name, value, unit = '') => {
        heroElement.style.setProperty(name, value.toFixed(4) + unit);
      };
      const phase = (start, end) => {
        const value = clamp((p - start) / (end - start), 0, 1);
        return value * value * (3 - 2 * value);
      };
      const approachBudget = disabled ? 0 : hero.compact ? 0.6 : 1;
      const planeProgress = phase(0.05, 0.4);
      const planeExit = phase(0.28, 0.44);
      const shipProgress = phase(0.36, 0.83);
      const shipExit = phase(0.67, 0.88);
      const airReveal = disabled ? 1 : phase(0.42, 0.5);
      const seaReveal = disabled ? 1 : phase(0.84, 0.94);
      const planeOpacity = disabled || p < 0.44 ? 1 : 0;
      const shipOpacity = disabled || p < 0.88 ? 1 : 0;
      const exitBudget = disabled ? 0 : 1;

      // The aircraft approaches the camera before departing through the top
      // clipping boundary. Its own Z/scale/translation remain independently
      // reversible rather than moving a wrapper containing the whole scene.
      const planeScale = 1 + (-0.24 + planeProgress * 1.09) * approachBudget;
      const planeX = planeProgress * sceneWidth * 0.012 * approachBudget + x * 26 * pointer;
      const planeY = -sceneHeight * (planeProgress * 0.1 + planeExit * (hero.compact ? 1.3 : 1.52))
        * exitBudget + y * 14 * pointer;
      const planeZ = (-80 + planeProgress * 360) * approachBudget;
      set('--hero-plane-scale', planeScale);
      set('--hero-plane-x', planeX, 'px');
      set('--hero-plane-y', planeY, 'px');
      set('--hero-plane-z', planeZ, 'px');
      set('--hero-plane-rotate', -planeProgress * 2.3 * approachBudget + x * 2 * pointer, 'deg');
      set('--hero-plane-opacity', planeOpacity);

      // The heavier ship approaches later, with its path continuing through
      // the lower boundary as the second cargo chapter is revealed behind it.
      const shipScale = 1 + (-0.18 + shipProgress * 0.86) * approachBudget;
      const shipX = -shipProgress * sceneWidth * 0.006 * approachBudget + x * 10 * pointer;
      const shipY = sceneHeight * (shipProgress * 0.12 + shipExit * (hero.compact ? 1.35 : 1.65))
        * exitBudget + y * 6 * pointer;
      const shipZ = (-55 + shipProgress * 280) * approachBudget;
      const shipRotate = shipProgress * 0.75 * approachBudget + x * 0.5 * pointer;
      set('--hero-ship-scale', shipScale);
      set('--hero-ship-x', shipX, 'px');
      set('--hero-ship-y', shipY, 'px');
      set('--hero-ship-z', shipZ, 'px');
      set('--hero-ship-rotate', shipRotate, 'deg');
      set('--hero-ship-opacity', shipOpacity);
      set('--hero-air-opacity', airReveal);
      set('--hero-air-y', (1 - airReveal) * 28 * exitBudget, 'px');
      set('--hero-sea-opacity', seaReveal);
      set('--hero-sea-y', (1 - seaReveal) * 28 * exitBudget, 'px');

      const wakePhase = disabled ? 0 : shipProgress;
      const wakeStrength = disabled ? 0 : phase(0.34, 0.51) * (1 - phase(0.86, 0.98));
      set('--hero-wake-phase', wakePhase);
      set('--hero-wake-strength', wakeStrength);
      set('--hero-progress', p);
      set('--hero-pointer-x', x * pointer);
      set('--hero-pointer-y', y * pointer);
      set('--hero-harbour-scale', 1 + (0.01 - p * 0.025) * motion);
      set('--hero-harbour-y', p * 18 * motion + y * 2 * pointer, 'px');
      set('--hero-atmosphere-x', x * 5 * pointer, 'px');
      set('--hero-atmosphere-y', p * 18 * motion + y * 3 * pointer, 'px');
      set('--hero-content-y', -p * 28 * motion + y * 2 * pointer, 'px');
      set('--hero-content-scale', 1 - p * 0.018 * motion);
      set('--hero-content-opacity', 1 - phase(0.58, 1) * 0.3 * motion);
      set('--hero-card-a-x', -p * 20 * motion + x * 12 * pointer, 'px');
      set('--hero-card-a-y', -p * 72 * motion + y * 8 * pointer, 'px');
      set('--hero-card-b-x', p * 28 * motion + x * 16 * pointer, 'px');
      set('--hero-card-b-y', -p * 94 * motion + y * 10 * pointer, 'px');
      set('--hero-cards-opacity', disabled ? 1 : 1 - phase(0.4, 0.77));

      // The canvas shares this exact progress and draws only when these poses
      // change. It owns no animation loop and cannot drift from the ship.
      window.DEDIAL_WATER?.render?.({
        progress: p, shipProgress, shipXpx: shipX, shipYpx: shipY,
        shipScale, shipZ, shipRotate, shipOpacity, disabled, compact: hero.compact,
        sceneWidth, sceneHeight, pointerX: x * pointer, pointerY: y * pointer,
        wakePhase, wakeStrength
      });
    };
    syncHeroScene = () => {
      if (!heroElement) return;
      if (document.hidden || root.classList.contains('menu-open') || !hero.inView) {
        hero.targetX = hero.targetY = 0;
        hero.pointerX = hero.pointerY = 0;
        hero.stage = null;
        hero.rendered = '';
        writeHero();
      }
      schedule();
    };
    if (heroElement) {
      updateHeroPolicy();
      if (supportsIntersection) {
        const sceneObserver = new IntersectionObserver(entries => {
          hero.inView = entries[0].isIntersecting;
          syncHeroScene();
        }, { threshold: 0.01 });
        sceneObserver.observe(heroStage || heroElement);
      }
      connection?.addEventListener?.('change', () => {
        updateHeroPolicy();
        scheduleMeasure();
      });
    }

    const writeLex = progress => {
      if (!lexScene) return;
      const p = Number(progress.toFixed(4));
      if (p !== lex.rendered) {
        lexScene.style.setProperty('--lex-progress', String(p));
        const motion = reducedMotion.matches ? 0 : 1;
        lexScene.style.setProperty('--orb-x', `${((p - 0.5) * 72 * motion).toFixed(2)}px`);
        lexScene.style.setProperty('--orb-y', `${(-Math.sin(p * Math.PI) * 20 * motion).toFixed(2)}px`);
        lexScene.style.setProperty('--orb-scale', (1 + Math.sin(p * Math.PI) * 0.12 * motion).toFixed(4));
        lexScene.style.setProperty('--orb-rotate', `${((p - 0.5) * 16 * motion).toFixed(2)}deg`);
        lex.rendered = p;
      }
      const step = p < 0.34 ? 0 : p < 0.67 ? 1 : 2;
      if (step !== lex.step) {
        lexScene.dataset.step = String(step);
        lexSteps.forEach(item => {
          const active = Number(item.dataset.step) === step;
          item.classList.toggle('is-active', active);
          if (active) item.setAttribute('aria-current', 'step');
          else item.removeAttribute('aria-current');
        });
        lex.step = step;
      }
    };

    const measure = () => {
      viewportHeight = window.innerHeight;
      scrollPosition = window.scrollY;
      // Clear previous offsets before measuring so resize never accumulates drift.
      parallaxItems.forEach(item => item.element.style.setProperty('--parallax-y', '0px'));
      parallaxItems.forEach(item => {
        const bounds = item.element.getBoundingClientRect();
        item.top = bounds.top + scrollPosition;
        item.height = bounds.height;
        item.element.style.setProperty('--parallax-y', `${item.current.toFixed(2)}px`);
      });
      if (lexScene) {
        const bounds = lexScene.getBoundingClientRect();
        lex.top = bounds.top + scrollPosition;
        lex.height = bounds.height;
      }
      if (heroElement) {
        const bounds = heroElement.getBoundingClientRect();
        hero.top = bounds.top + scrollPosition;
        hero.height = bounds.height;
        hero.stage = null;
        // client dimensions stay stable as the object images transform.
        hero.sceneWidth = heroObjectStage?.clientWidth || heroStage?.clientWidth || window.innerWidth;
        hero.sceneHeight = heroObjectStage?.clientHeight || heroStage?.clientHeight || viewportHeight;
        if (heroStage) {
          heroStage.style.setProperty('--hero-sticky-top',
            Math.min(0, viewportHeight - heroStage.offsetHeight - 16) + 'px');
        }
        updateHeroPolicy();
        window.DEDIAL_WATER?.resize?.();
        if (!supportsIntersection) {
          hero.inView = bounds.top < viewportHeight && bounds.bottom > 0;
        }
      }
      needsMeasure = false;
    };

    const renderMotion = timestamp => {
      frame = 0;
      if (document.hidden) return;
      if (needsMeasure) measure();
      const elapsed = previousFrame ? clamp(timestamp - previousFrame, 1, 64) : 16.7;
      previousFrame = timestamp;
      const blend = reducedMotion.matches ? 1 : 1 - Math.exp(-elapsed / 100);
      let unsettled = false;
      parallaxItems.forEach(item => {
        const inView = item.top < scrollPosition + viewportHeight + 100 && item.top + item.height > scrollPosition - 100;
        if (reducedMotion.matches) item.target = 0;
        else if (!inView) return;
        else {
          const center = item.top + item.height / 2;
          const fraction = clamp((scrollPosition + viewportHeight / 2 - center) / ((viewportHeight + item.height) / 2), -1, 1);
          item.target = fraction * item.distance;
        }
        item.current += (item.target - item.current) * blend;
        if (Math.abs(item.target - item.current) < 0.05) item.current = item.target;
        else unsettled = true;
        const value = Number(item.current.toFixed(2));
        if (value !== item.rendered) {
          item.element.style.setProperty('--parallax-y', `${value}px`);
          item.rendered = value;
        }
      });
      if (lexScene) {
        lex.target = clamp((scrollPosition - lex.top) / Math.max(1, lex.height - viewportHeight), 0, 1);
        lex.current += (lex.target - lex.current) * blend;
        if (Math.abs(lex.target - lex.current) < 0.0005) lex.current = lex.target;
        else unsettled = true;
        writeLex(lex.current);
      }
      if (heroElement) {
        const menuOpen = root.classList.contains('menu-open');
        // A compact hero can be shorter than the viewport. Give that layout
        // a meaningful scroll range instead of completing depth in one pixel.
        const scrollRange = Math.max(1, viewportHeight * 0.6, hero.height - viewportHeight);
        hero.target = menuOpen ? hero.current
          : clamp((scrollPosition - hero.top) / scrollRange, 0, 1);
        if (!hero.inView || menuOpen || reducedMotion.matches || hero.lightweight) {
          hero.current = hero.target;
          hero.pointerX = hero.pointerY = 0;
          hero.targetX = hero.targetY = 0;
        } else {
          hero.current += (hero.target - hero.current) * blend;
          hero.pointerX += (hero.targetX - hero.pointerX) * blend;
          hero.pointerY += (hero.targetY - hero.pointerY) * blend;
          if (Math.abs(hero.target - hero.current) < 0.0005) hero.current = hero.target;
          else unsettled = true;
          if (Math.abs(hero.targetX - hero.pointerX) < 0.0005) hero.pointerX = hero.targetX;
          else unsettled = true;
          if (Math.abs(hero.targetY - hero.pointerY) < 0.0005) hero.pointerY = hero.targetY;
          else unsettled = true;
        }
        writeHero();
      }
      if (unsettled) frame = window.requestAnimationFrame(renderMotion);
      else previousFrame = 0;
    };

    const schedule = () => {
      if (!frame && !document.hidden) frame = window.requestAnimationFrame(renderMotion);
    };
    const scheduleMeasure = () => {
      needsMeasure = true;
      schedule();
    };
    window.addEventListener('scroll', () => {
      scrollPosition = window.scrollY;
      hero.stage = null;
      if (heroElement && !supportsIntersection) {
        hero.inView = hero.top < scrollPosition + viewportHeight && hero.top + hero.height > scrollPosition;
        syncHeroScene();
      }
      schedule();
    }, { passive: true });
    window.addEventListener('resize', scheduleMeasure, { passive: true });
    window.addEventListener('pageshow', scheduleMeasure);
    document.addEventListener('visibilitychange', () => {
      syncHeroScene();
      if (document.hidden) {
        if (frame) window.cancelAnimationFrame(frame);
        frame = 0;
        previousFrame = 0;
      } else scheduleMeasure();
    });

    if ('ResizeObserver' in window) {
      const resizeObserver = new ResizeObserver(scheduleMeasure);
      resizeObserver.observe(document.body);
    }
    document.querySelectorAll('img').forEach(image => {
      if (!image.complete) image.addEventListener('load', scheduleMeasure, { once: true });
    });
    if (document.fonts?.ready) document.fonts.ready.then(scheduleMeasure).catch(() => {});

    if (heroStage && heroElement) {
      const resetHeroPointer = () => {
        hero.targetX = hero.targetY = 0;
        hero.stage = null;
        schedule();
      };
      heroStage.addEventListener('pointermove', event => {
        if (!finePointer.matches || reducedMotion.matches || hero.compact || hero.lightweight
          || !hero.inView || document.hidden || event.pointerType === 'touch'
          || root.classList.contains('menu-open')) return;
        if (!hero.stage) hero.stage = heroStage.getBoundingClientRect();
        hero.targetX = clamp((event.clientX - hero.stage.left) / Math.max(1, hero.stage.width) * 2 - 1, -1, 1);
        hero.targetY = clamp((event.clientY - hero.stage.top) / Math.max(1, hero.stage.height) * 2 - 1, -1, 1);
        schedule();
      }, { passive: true });
      heroStage.addEventListener('pointerleave', resetHeroPointer);
      heroStage.addEventListener('pointercancel', resetHeroPointer);
    }

    const pointerItems = [...document.querySelectorAll('[data-tilt], [data-magnetic]')];
    const resetPointer = element => {
      element.style.setProperty('--tilt-x', '0deg');
      element.style.setProperty('--tilt-y', '0deg');
      element.style.setProperty('--magnet-x', '0px');
      element.style.setProperty('--magnet-y', '0px');
      element.classList.remove('is-pointer-active');
    };
    pointerItems.forEach(element => {
      let bounds;
      element.addEventListener('pointerenter', () => {
        if (!finePointer.matches || reducedMotion.matches) return;
        bounds = element.getBoundingClientRect();
        element.classList.add('is-pointer-active');
      });
      element.addEventListener('pointermove', event => {
        if (!finePointer.matches || reducedMotion.matches || event.pointerType === 'touch' || !bounds) return;
        const x = clamp((event.clientX - bounds.left) / bounds.width - 0.5, -0.5, 0.5);
        const y = clamp((event.clientY - bounds.top) / bounds.height - 0.5, -0.5, 0.5);
        if (element.hasAttribute('data-tilt')) {
          const strength = clamp(number(element.dataset.tilt, 5), 0, 9);
          element.style.setProperty('--tilt-x', `${(-y * strength).toFixed(2)}deg`);
          element.style.setProperty('--tilt-y', `${(x * strength).toFixed(2)}deg`);
        }
        if (element.hasAttribute('data-magnetic')) {
          const strength = clamp(number(element.dataset.magnetic, 8), 0, 12);
          element.style.setProperty('--magnet-x', `${(x * strength).toFixed(2)}px`);
          element.style.setProperty('--magnet-y', `${(y * strength).toFixed(2)}px`);
        }
      });
      element.addEventListener('pointerleave', () => {
        bounds = undefined;
        resetPointer(element);
      });
      element.addEventListener('pointercancel', () => {
        bounds = undefined;
        resetPointer(element);
      });
      element.addEventListener('blur', () => resetPointer(element));
    });

    listenForChange(finePointer, () => {
      pointerItems.forEach(resetPointer);
      updateHeroPolicy();
      scheduleMeasure();
    });
    listenForChange(compactViewport, () => {
      updateHeroPolicy();
      scheduleMeasure();
    });
    listenForChange(reducedMotion, () => {
      lex.rendered = NaN;
      hero.rendered = '';
      if (reducedMotion.matches) {
        hero.targetX = hero.targetY = 0;
      }
      updateHeroPolicy();
      if (reducedMotion.matches) {
        reveals.forEach(item => item.classList.add('is-visible'));
        revealObserver?.disconnect();
        pointerItems.forEach(resetPointer);
        clearTimeout(responseTimer);
        if (response?.classList.contains('is-changing')) {
          const active = examples.find(button => button.getAttribute('aria-pressed') === 'true');
          if (active && exampleCopy[active.dataset.lexExample]) response.textContent = exampleCopy[active.dataset.lexExample];
          response.classList.remove('is-changing');
        }
      }
      scheduleMeasure();
    });

    root.classList.add('js');
    scheduleMeasure();
  };

  const start = () => {
    try { init(); }
    catch (error) {
      document.documentElement.classList.remove('js');
      document.querySelectorAll('[data-reveal]').forEach(item => item.classList.add('is-visible'));
      console.error('DeDiAl landing page enhancement could not start.', error);
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

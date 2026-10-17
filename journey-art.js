/* Original Deshpath expedition instruments. All artwork is authored for this site. */
(function () {
  'use strict';

  var instances = new WeakMap();
  var sequence = 0;

  function mount(target) {
    var root = typeof target === 'string' ? document.querySelector(target) : target;
    if (!root || instances.has(root)) return root && instances.get(root);

    var key = 'dp-art-' + (++sequence);
    root.classList.add('dp-art-mounted');
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML = `
      <svg class="dp-art-canvas" viewBox="0 0 720 620" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">
        <defs>
          <linearGradient id="${key}-ink" x1="65" y1="500" x2="620" y2="255" gradientUnits="userSpaceOnUse">
            <stop stop-color="var(--art-paper)" stop-opacity=".94"/>
            <stop offset="1" stop-color="var(--art-accent)" stop-opacity=".9"/>
          </linearGradient>
          <linearGradient id="${key}-paper" x1="63" y1="382" x2="312" y2="558" gradientUnits="userSpaceOnUse">
            <stop stop-color="var(--art-ink)" stop-opacity=".76"/>
            <stop offset="1" stop-color="var(--art-ink)" stop-opacity=".94"/>
          </linearGradient>
          <radialGradient id="${key}-halo">
            <stop stop-color="var(--art-paper)" stop-opacity=".14"/>
            <stop offset="1" stop-color="var(--art-paper)" stop-opacity="0"/>
          </radialGradient>
        </defs>

        <g class="dp-art-contours" stroke="var(--art-paper)" stroke-width="1">
          <path d="M364 529C381 485 343 461 375 417C411 366 490 405 514 344C534 294 492 278 515 235C541 186 622 203 674 156"/>
          <path d="M389 539C410 485 369 461 400 426C438 384 513 417 539 351C561 295 517 280 540 247C568 205 631 224 690 174"/>
          <path d="M414 549C441 486 397 465 426 438C468 398 535 431 565 362C590 304 545 286 564 260C593 222 648 245 705 197"/>
          <path d="M441 559C474 488 425 473 453 451C493 420 558 444 590 374C620 310 574 296 590 274C618 241 664 265 716 222"/>
          <path d="M469 567C509 493 457 484 481 465C522 436 584 462 618 389C651 321 606 306 617 289C644 261 677 288 728 249"/>
        </g>

        <g class="dp-art-compass" transform="translate(570 137)">
          <circle r="94" fill="url(#${key}-halo)"/>
          <circle r="62" fill="var(--art-ink)" fill-opacity=".26" stroke="var(--art-paper)" stroke-opacity=".5"/>
          <circle r="53" stroke="var(--art-paper)" stroke-opacity=".28" stroke-dasharray="1 10.9" stroke-linecap="round"/>
          <path d="M0-73V-65M73 0H65M0 73V65M-73 0H-65" stroke="var(--art-paper)" stroke-width="1.3"/>
          <g class="dp-art-compass-orbit">
            <circle r="69" stroke="var(--art-accent)" stroke-width="1.5" stroke-dasharray="32 402" stroke-linecap="round"/>
            <circle cx="0" cy="-69" r="3" fill="var(--art-accent)"/>
          </g>
          <g class="dp-art-needle">
            <path d="M0-39L9 0L0 39L-9 0Z" fill="var(--art-paper)" fill-opacity=".88"/>
            <path d="M0-39L9 0H-9Z" fill="var(--art-accent)"/>
            <circle r="4.5" fill="var(--art-ink)" stroke="var(--art-paper)" stroke-width="1.3"/>
          </g>
        </g>

        <g class="dp-art-route" stroke-linecap="round" stroke-linejoin="round">
          <path class="dp-art-route-shadow" d="M107 389C160 360 184 401 230 371C274 342 251 295 300 277C352 258 384 321 432 294C474 270 456 229 498 214" stroke="var(--art-ink)" stroke-opacity=".3" stroke-width="5"/>
          <path class="dp-art-route-line" d="M107 389C160 360 184 401 230 371C274 342 251 295 300 277C352 258 384 321 432 294C474 270 456 229 498 214" pathLength="1" stroke="url(#${key}-ink)" stroke-width="2"/>
          <g class="dp-art-waypoint dp-art-waypoint-one" transform="translate(107 389)">
            <circle class="dp-art-waypoint-ring" r="11" stroke="var(--art-paper)" stroke-opacity=".5"/>
            <circle r="4" fill="var(--art-paper)"/>
          </g>
          <g class="dp-art-waypoint dp-art-waypoint-two" transform="translate(300 277)">
            <circle r="8" fill="var(--art-ink)" fill-opacity=".7" stroke="var(--art-accent)"/>
            <circle r="2.5" fill="var(--art-accent)"/>
          </g>
          <g class="dp-art-waypoint dp-art-waypoint-three" transform="translate(498 214)">
            <circle class="dp-art-waypoint-ring" r="13" stroke="var(--art-accent)" stroke-opacity=".55"/>
            <circle r="5" fill="var(--art-accent)" stroke="var(--art-ink)" stroke-width="2"/>
          </g>
        </g>

        <g class="dp-art-field-card">
          <rect x="57" y="422" width="242" height="134" rx="17" fill="url(#${key}-paper)" stroke="var(--art-paper)" stroke-opacity=".18"/>
          <path d="M79 447H105" stroke="var(--art-accent)" stroke-width="3" stroke-linecap="round"/>
          <path d="M113 447H145M79 459H167" stroke="var(--art-paper)" stroke-opacity=".5" stroke-width="2" stroke-linecap="round"/>
          <path d="M79 481H275M79 499H275M79 517H275" stroke="var(--art-paper)" stroke-opacity=".09"/>
          <path d="M80 522L106 503L126 509L155 483L183 495L214 467L245 482L274 455" stroke="var(--art-paper)" stroke-opacity=".84" stroke-width="1.5" stroke-linejoin="round"/>
          <path d="M80 522L106 503L126 509L155 483L183 495L214 467L245 482L274 455V530H80Z" fill="var(--art-paper)" fill-opacity=".035"/>
          <circle class="dp-art-profile-point" cx="214" cy="467" r="4" fill="var(--art-accent)"/>
          <path d="M79 538H104M112 538H129M137 538H146" stroke="var(--art-accent)" stroke-opacity=".6" stroke-linecap="round"/>
          <path d="M262 538H274" stroke="var(--art-paper)" stroke-opacity=".55" stroke-linecap="round"/>
        </g>

        <g class="dp-art-frame" stroke="var(--art-paper)" stroke-opacity=".45" stroke-width="1">
          <path d="M47 86V67H66M654 535H673V516"/>
          <path d="M47 119V148M47 160V169M615 553H586M574 553H565" stroke-opacity=".32"/>
        </g>
        <g class="dp-art-coordinate-mark" stroke="var(--art-accent)" stroke-width="1.2">
          <path d="M368 155V169M361 162H375"/>
          <circle cx="368" cy="162" r="16" stroke-opacity=".35"/>
        </g>
      </svg>`;

    var inView = true;
    var observer;
    function updatePlayback() {
      root.classList.toggle('dp-art-is-paused', !inView || document.hidden);
    }
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        updatePlayback();
      }, { rootMargin: '60px', threshold: 0 });
      observer.observe(root);
    }
    document.addEventListener('visibilitychange', updatePlayback);
    updatePlayback();

    var instance = {
      destroy: function () {
        if (observer) observer.disconnect();
        document.removeEventListener('visibilitychange', updatePlayback);
        root.innerHTML = '';
        root.classList.remove('dp-art-mounted', 'dp-art-is-paused');
        instances.delete(root);
      }
    };
    instances.set(root, instance);
    return instance;
  }

  window.DESH_JOURNEY_ART = { mount: mount };
  function autoMount() { mount(document.getElementById('journeyArt')); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoMount, { once: true });
  else autoMount();
})();

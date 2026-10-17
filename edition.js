/* Light, optional motion for the original journal edition. */
'use strict';
(() => {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const targets = document.querySelectorAll('.journey-chapter, .section-heading, .story-banner');
  if (!media.matches && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('edition-visible');
        observer.unobserve(entry.target);
      }
    }, {threshold: 0.08});
    targets.forEach((element, index) => {
      element.classList.add('edition-reveal');
      element.style.setProperty('--reveal-delay', `${index < 3 ? index * 70 : 0}ms`);
      observer.observe(element);
    });
    media.addEventListener('change', event => {
      if (!event.matches) return;
      observer.disconnect();
      targets.forEach(element => element.classList.add('edition-visible'));
    });
  }
})();

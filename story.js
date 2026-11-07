(function () {
  const home = document.getElementById('home');
  const scrollArea = document.getElementById('storyScroll');
  const canvas = document.getElementById('storyCanvas');
  const chapters = Array.from(document.querySelectorAll('.story-chapter'));
  const steps = Array.from(document.querySelectorAll('[data-story-step]'));
  const checkpoints = [0, .20, .55, .80, .99];
  const thresholds = [.10, .30, .62, .90];
  const scrollLabels = ['Scroll to explore', 'Keep going. Make it yours.', 'Take the collection further', 'Almost there', 'Find your next canvas'];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let scene;
  let frame;
  let progress = 0;
  let currentChapter = -1;
  let dirty = true;
  let active = false;
  let failed = false;

  function measureProgress() {
    const distance = Math.max(1, scrollArea.offsetHeight - document.querySelector('.story-pin').offsetHeight);
    return Math.max(0, Math.min(1, -scrollArea.getBoundingClientRect().top / distance));
  }

  function updateChapter(index) {
    if (currentChapter === index) return;
    currentChapter = index;
    chapters.forEach((chapter, number) => {
      const visible = number === index;
      chapter.classList.toggle('is-current', visible);
      chapter.setAttribute('aria-hidden', String(!visible));
      chapter.inert = !visible;
    });
    steps.forEach((step, number) => {
      if (number === index) step.setAttribute('aria-current', 'step');
      else step.removeAttribute('aria-current');
    });
    document.getElementById('storyScrollLabel').textContent = scrollLabels[index];
    canvas.setAttribute('aria-label', [
      'A blank white dieline is the first canvas for a brand’s printing journey.',
      'A blank sheet folds into a three-dimensional mailer box.',
      'One yellow and green design appears across a box, hoodie, half-sleeved shirt, full-sleeved shirt and paper bag.',
      'The five-piece branded collection travels together on a yellow delivery truck.',
      'The whole collection arrives at the storefront with the message delivered at your doorstep, with love.'
    ][index]);
  }

  function render(now) {
    frame = null;
    if (!active) return;
    const target = measureProgress();
    const next = reduceMotion.matches ? target : progress + (target - progress) * .16;
    const moving = Math.abs(next - progress) > .00008;
    progress = Math.abs(target - next) < .0001 ? target : next;
    if (dirty || moving) {
      const index = thresholds.filter(threshold => progress >= threshold).length;
      updateChapter(index);
      document.getElementById('storyProgressLine').style.width = progress * 100 + '%';
      home.style.setProperty('--liquid-drift', -progress * 120 + 'px');
      home.style.setProperty('--bubble-drift', progress * 90 + 'px');
      if (scene) {
        // Reduced motion displays a representative pose for each chapter.
        scene.setProgress(reduceMotion.matches ? checkpoints[index] : progress);
        scene.render(now);
      }
      dirty = false;
    }
    if (Math.abs(target - progress) > .0001) requestRender();
  }

  function requestRender() {
    if (active && !frame) frame = requestAnimationFrame(render);
  }

  function initializeScene() {
    if (scene || failed) return;
    try {
      scene = new window.FolioStoryScene(canvas);
    } catch (error) {
      failed = true;
      canvas.hidden = true;
      document.getElementById('storyFallback').hidden = false;
      console.error('The homepage 3D scene could not start.', error);
    }
  }

  function resizeStory() {
    if (!active) return;
    if (scene) scene.resize();
    dirty = true;
    requestRender();
  }

  function syncView() {
    active = document.body.dataset.view === 'home' && !document.hidden;
    if (active) {
      initializeScene();
      progress = measureProgress();
      resizeStory();
    } else if (frame) {
      cancelAnimationFrame(frame);
      frame = null;
    }
  }

  function goToProgress(value) {
    const distance = scrollArea.offsetHeight - document.querySelector('.story-pin').offsetHeight;
    const top = scrollArea.getBoundingClientRect().top + window.scrollY + value * distance;
    window.scrollTo({top, behavior: reduceMotion.matches ? 'instant' : 'smooth'});
  }

  steps.forEach((button, index) => button.addEventListener('click', () => goToProgress(checkpoints[index])));
  document.getElementById('storyNext').addEventListener('click', () => {
    if (currentChapter === 4) view('library');
    else goToProgress(checkpoints[currentChapter + 1]);
  });
  document.getElementById('storyReplay').addEventListener('click', () => goToProgress(0));
  window.addEventListener('scroll', requestRender, {passive: true});
  window.addEventListener('resize', resizeStory);
  document.addEventListener('visibilitychange', syncView);
  reduceMotion.addEventListener('change', () => { dirty = true; requestRender(); });
  window.addEventListener('hashchange', syncView);
  new ResizeObserver(resizeStory).observe(document.getElementById('storyScene'));
  syncView();
})();

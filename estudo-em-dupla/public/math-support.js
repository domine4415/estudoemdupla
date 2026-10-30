/* Estudo em Dupla — fórmulas matemáticas. Usa KaTeX, não interpreta HTML dos usuários. */
(() => {
  'use strict';
  const version = '0.16.11';
  const base = `https://cdn.jsdelivr.net/npm/katex@${version}/dist/`;
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = base + 'katex.min.css';
  document.head.append(style);

  const selectors = '.statement, .answer-label, .rich-comment, #bankStatement, #questionStatement, #feedback, #bankFeedback';
  let ready = false;
  let scheduled = false;
  function containsMath(el) {
    const t = el.textContent || '';
    return /\\\(|\\\[|\$\$/.test(t);
  }
  function render() {
    scheduled = false;
    if (!ready || typeof window.renderMathInElement !== 'function') return;
    for (const el of document.querySelectorAll(selectors)) {
      if (el.dataset.mathRendered === '1' || !containsMath(el)) continue;
      el.dataset.mathRendered = '1';
      try {
        window.renderMathInElement(el, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '\\[', right: '\\]', display: true },
            { left: '\\(', right: '\\)', display: false }
          ],
          throwOnError: false,
          trust: false,
          strict: 'warn'
        });
      } catch (err) {
        el.dataset.mathRendered = '';
        console.warn('Falha ao renderizar fórmula:', err);
      }
    }
  }
  function schedule() {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(render);
    }
  }
  function addScript(src, done) {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = done;
    script.onerror = () => console.warn('Não foi possível carregar a biblioteca matemática:', src);
    document.head.append(script);
  }
  addScript(base + 'katex.min.js', () => {
    addScript(base + 'contrib/auto-render.min.js', () => {
      ready = true;
      schedule();
    });
  });
  const observer = new MutationObserver(records => {
    if (!ready) return;
    if (records.some(r => Array.from(r.addedNodes).some(n => n.nodeType === 1 &&
       (n.matches?.(selectors) || n.querySelector?.(selectors))))) schedule();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.estudoRenderMath = schedule;
})();

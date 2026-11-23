/** Mensajes del material del curso embebido (srcDoc) hacia ContacNeed. */
export const CN_CURSO_MSG = 'cn-curso' as const

export type CnCursoAction = 'lecciones' | 'diapositivas'

export type CnCursoMessage = {
  type: typeof CN_CURSO_MSG
  action: CnCursoAction
}

export function isCnCursoMessage(data: unknown): data is CnCursoMessage {
  if (!data || typeof data !== 'object') return false
  const msg = data as { type?: string; action?: string }
  return (
    msg.type === CN_CURSO_MSG &&
    (msg.action === 'lecciones' || msg.action === 'diapositivas')
  )
}

/**
 * Script inyectado en lecciones/diapositivas.
 * En iframe srcDoc, los href="#…" y "diapositivas.html" se resuelven contra la URL
 * de ContacNeed y cargan la pizarra dentro del marco. Este script lo evita.
 */
export const CURSO_IFRAME_NAV_SCRIPT = `<script>
(function () {
  function embedded() {
    try { return window.top !== window.self; } catch (e) { return true; }
  }
  function goHash(href) {
    var id = href.slice(1);
    if (!id) return;
    var el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function post(action) {
    try { window.parent.postMessage({ type: 'cn-curso', action: action }, '*'); } catch (e) {}
  }
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href) return;

    if (href.charAt(0) === '#') {
      e.preventDefault();
      e.stopPropagation();
      goHash(href);
      return;
    }

    if (href === '/' || href === './' || href === 'index.html' || href.indexOf('guia-docente') !== -1) {
      if (embedded()) {
        e.preventDefault();
        e.stopPropagation();
        if (href.indexOf('index.html') !== -1) post('lecciones');
      }
      return;
    }

    if (/diapositivas\\.html/i.test(href)) {
      if (embedded()) {
        e.preventDefault();
        e.stopPropagation();
        post('diapositivas');
      }
    }
  }, true);
})();
</script>`

/** Evita que history.replaceState con hash rompa el srcDoc del iframe. */
export const CURSO_SLIDES_HISTORY_PATCH = `try {
      if (location.protocol !== 'about:' && String(location.href).indexOf('srcdoc') === -1) {
        history.replaceState(null, "", "#s" + (i + 1));
      }
    } catch (_e) {}`

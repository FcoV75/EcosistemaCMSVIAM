/** Reloj y hilo de plática continua de Sincronía Nexus. */
(function () {
  function formatMs(ms) {
    if (ms == null || ms < 0) return '';
    const total = Math.ceil(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function pintarHilo(container, role, text) {
    if (!container || !text) return;
    container.style.display = 'block';
    const el = document.createElement('div');
    el.className = role === 'user' ? 'nexus-hilo-user' : 'nexus-hilo-ia';
    el.textContent = text;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  const relojes = new WeakMap();

  function iniciarReloj(el, restanteMs, onEnd) {
    if (!el) return;
    if (restanteMs == null) {
      el.textContent = 'Plática abierta. La música del día nace solo en el primer consejo.';
      return;
    }
    const prev = relojes.get(el);
    if (prev) clearInterval(prev);
    const ends = Date.now() + Number(restanteMs);
    function tick() {
      const left = Math.max(0, ends - Date.now());
      el.textContent = left > 0
        ? `Plática continua: quedan ${formatMs(left)}`
        : 'La ventana de plática de hoy se cerró. La música puede seguir sonando.';
      if (left <= 0) {
        clearInterval(relojes.get(el));
        relojes.delete(el);
        if (typeof onEnd === 'function') onEnd();
      }
    }
    tick();
    const id = setInterval(tick, 1000);
    relojes.set(el, id);
  }

  window.NexusPlatica = { formatMs, pintarHilo, iniciarReloj };
})();

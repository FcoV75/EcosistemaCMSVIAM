/** Reloj discreto y salón de plática continua de Sincronía Nexus. */
(function () {
  function formatMs(ms) {
    if (ms == null || ms < 0) return '';
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function ventanaDePlan(plan) {
    if (plan === 'miembro') return 30 * 60 * 1000;
    return 10 * 60 * 1000;
  }

  function textoReloj(restanteMs, { plan, permanente } = {}) {
    if (permanente || restanteMs == null) {
      return 'Te acompaño sin prisa. La música del día nace solo en el primer consejo.';
    }
    const left = Math.max(0, Number(restanteMs) || 0);
    const ventana = ventanaDePlan(plan);
    if (left <= 0) {
      return plan === 'miembro'
        ? 'Hoy te escuché completo. Mañana el Santuario abre de nuevo. La música puede seguir.'
        : 'Hoy te escuché en tu muestra. Mañana o en el Santuario seguimos. La música puede seguir.';
    }
    if (left <= 120000) {
      return `Sigo aquí, te escucho · ${formatMs(left)}`;
    }
    const cupo = plan === 'miembro' ? '30 min' : '10 min';
    return `Te escucho y te comprendo · ${formatMs(left)} de ${cupo}`;
  }

  function pintarHilo(container, role, text) {
    if (!container || !text) return;
    quitarEscribiendo(container);
    container.style.display = 'block';
    const el = document.createElement('div');
    el.className = role === 'user' ? 'nexus-hilo-user' : 'nexus-hilo-ia';
    if (role !== 'user') {
      const firma = document.createElement('span');
      firma.className = 'nexus-hilo-firma';
      firma.textContent = 'Sincronía Nexus te escucha';
      el.appendChild(firma);
    }
    const cuerpo = document.createElement('div');
    cuerpo.textContent = text;
    el.appendChild(cuerpo);
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  function pintarEscribiendo(container) {
    if (!container) return;
    quitarEscribiendo(container);
    container.style.display = 'block';
    const el = document.createElement('div');
    el.className = 'nexus-hilo-ia nexus-hilo-escribiendo';
    el.setAttribute('data-escribiendo', '1');
    el.textContent = 'Sincronía Nexus te escucha…';
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  function quitarEscribiendo(container) {
    if (!container) return;
    container.querySelectorAll('[data-escribiendo]').forEach((n) => n.remove());
  }

  const relojes = new WeakMap();

  function pintarBarra(el, left, ventana) {
    const wrap = el?.closest?.('.nexus-reloj-wrap');
    const bar = wrap?.querySelector('.nexus-reloj-barra > span');
    if (!bar || left == null || !ventana) return;
    const pct = Math.max(0, Math.min(100, (left / ventana) * 100));
    bar.style.width = `${pct}%`;
    wrap.querySelector('.nexus-reloj-barra')?.removeAttribute('hidden');
  }

  function iniciarReloj(el, restanteMs, opts = {}) {
    if (!el) return;
    const plan = opts.plan || 'publico';
    const permanente = Boolean(opts.permanente) || restanteMs == null;
    const ventana = opts.ventanaMs || ventanaDePlan(plan);
    el.setAttribute('aria-live', 'off');

    if (permanente) {
      el.textContent = textoReloj(null, { permanente: true, plan });
      return;
    }

    const prev = relojes.get(el);
    if (prev) clearInterval(prev);
    const ends = Date.now() + Number(restanteMs);
    let avisoCierre = false;

    function tick() {
      const left = Math.max(0, ends - Date.now());
      el.textContent = textoReloj(left, { plan });
      pintarBarra(el, left, ventana);
      if (left <= 0) {
        clearInterval(relojes.get(el));
        relojes.delete(el);
        el.setAttribute('aria-live', 'polite');
        if (!avisoCierre && typeof opts.onEnd === 'function') {
          avisoCierre = true;
          opts.onEnd();
        }
      }
    }
    tick();
    const id = setInterval(tick, 1000);
    relojes.set(el, id);
  }

  function configurarEnvio(textarea, onSend) {
    if (!textarea || typeof onSend !== 'function') return;
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSend();
      }
    });
  }

  function cerrarComposer({ input, button, nota }) {
    if (input) {
      input.disabled = true;
      input.placeholder = 'Hoy la plática llegó a su tiempo. Mañana te vuelvo a escuchar.';
    }
    if (button) {
      button.disabled = true;
      button.textContent = 'Plática de hoy concluida';
    }
    if (nota) nota.textContent = 'Gracias por confiarme tu historia. Integra con calma; aquí estaré.';
  }

  window.NexusPlatica = {
    formatMs,
    textoReloj,
    pintarHilo,
    pintarEscribiendo,
    quitarEscribiendo,
    iniciarReloj,
    configurarEnvio,
    cerrarComposer,
  };
})();

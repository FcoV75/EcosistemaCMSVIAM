/** Reproductor de frecuencias Sincronía Nexus — catálogo Cloudinary + síntesis generada */
(function () {
  let ctx = null;
  let nodes = [];

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  function detenerSintesis() {
    nodes.forEach((n) => {
      try {
        if (n.stop) n.stop();
        n.disconnect?.();
      } catch {
        /* ignore */
      }
    });
    nodes = [];
  }

  function tonoSuave(ac, freq, gainVal, type = 'sine') {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = gainVal;
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start();
    nodes.push(osc, gain);
    return { osc, gain };
  }

  /**
   * Pista generada: melodía ambiental + frecuencia Solfeggio + opcional binaural.
   */
  function reproducirGenerada(frecuenciaHz, ondaCerebral) {
    detenerSintesis();
    const ac = getCtx();
    if (ac.state === 'suspended') ac.resume();

    const master = ac.createGain();
    master.gain.value = 0.35;
    master.connect(ac.destination);
    nodes.push(master);

    const solfeggio = ac.createOscillator();
    const solGain = ac.createGain();
    solfeggio.type = 'sine';
    solfeggio.frequency.value = frecuenciaHz;
    solGain.gain.value = 0.06;
    solfeggio.connect(solGain);
    solGain.connect(master);
    solfeggio.start();
    nodes.push(solfeggio, solGain);

    const padNotes = [1, 1.25, 1.5, 2];
    padNotes.forEach((ratio, i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'triangle';
      o.frequency.value = (frecuenciaHz / 4) * ratio;
      g.gain.value = 0.03 / (i + 1);
      o.connect(g);
      g.connect(master);
      o.start();
      nodes.push(o, g);
    });

    if (ondaCerebral === 'delta' || ondaCerebral === 'theta' || ondaCerebral === 'alpha') {
      const beat = ondaCerebral === 'delta' ? 2 : ondaCerebral === 'theta' ? 6 : 10;
      const carrier = 180;
      const left = ac.createOscillator();
      const right = ac.createOscillator();
      const merger = ac.createChannelMerger(2);
      const binGain = ac.createGain();
      left.frequency.value = carrier;
      right.frequency.value = carrier + beat;
      binGain.gain.value = 0.04;
      left.connect(merger, 0, 0);
      right.connect(merger, 0, 1);
      merger.connect(binGain);
      binGain.connect(master);
      left.start();
      right.start();
      nodes.push(left, right, merger, binGain);
    }
  }

  /** Capa sutil de frecuencia sobre pista del catálogo */
  function superponerFrecuencia(frecuenciaHz, ondaCerebral) {
    detenerSintesis();
    const ac = getCtx();
    if (ac.state === 'suspended') ac.resume();
    tonoSuave(ac, frecuenciaHz, 0.045, 'sine');
    if (ondaCerebral === 'theta' || ondaCerebral === 'alpha' || ondaCerebral === 'delta') {
      const beat = ondaCerebral === 'delta' ? 2 : ondaCerebral === 'theta' ? 6 : 10;
      const left = ac.createOscillator();
      const right = ac.createOscillator();
      const merger = ac.createChannelMerger(2);
      const g = ac.createGain();
      left.frequency.value = 160;
      right.frequency.value = 160 + beat;
      g.gain.value = 0.025;
      left.connect(merger, 0, 0);
      right.connect(merger, 0, 1);
      merger.connect(g);
      g.connect(ac.destination);
      left.start();
      right.start();
      nodes.push(left, right, merger, g);
    }
  }

  window.NexusSantuario = {
    detenerSintesis,
    reproducirExperiencia(data) {
      const audio = document.getElementById('member-audio');
      const synthWrap = document.getElementById('synth-player-wrap');
      detenerSintesis();

      if (data.fuenteAudio === 'generada') {
        if (audio) {
          audio.pause();
          audio.removeAttribute('src');
        }
        if (synthWrap) synthWrap.style.display = 'block';
        reproducirGenerada(data.frecuenciaHz || 528, data.ondaCerebral);
        return;
      }

      if (synthWrap) synthWrap.style.display = 'none';
      if (audio && data.audioUrl) {
        audio.src = data.audioUrl;
        audio.load();
        audio.play().catch(() => {});
        audio.onplay = () => superponerFrecuencia(data.frecuenciaHz || 528, data.ondaCerebral);
      }
    },
  };
})();

/** Mensajes diarios rotativos — bienvenida e invitación a platicar */
window.NexusMensajesDiarios = (function () {
  const dias = [
    {
      bienvenida: 'Qué alegría tenerte aquí hoy. Este santuario es tuyo: respira, suelta el prisa, y confía en que cada palabra que compartas será recibida con amor.',
      invitacion: '¿Qué sientes en el corazón en este momento? Cuéntame con libertad; aquí no hay juicio, solo presencia.',
    },
    {
      bienvenida: 'Bienvenido/a de nuevo al espacio donde tu alma puede hablar sin máscaras. Hoy el universo te escucha con ternura.',
      invitacion: 'Si pudieras nombrar lo que más pesa hoy, ¿qué sería? Estoy aquí para acompañarte.',
    },
    {
      bienvenida: 'Entra despacio… Sincronía Nexus te recibe como quien recibe a un ser querido después de un día largo.',
      invitacion: '¿Qué emoción visita tu cuerpo ahora mismo? Descríbela y empecemos juntos.',
    },
    {
      bienvenida: 'Hoy es un buen día para soltar un poco el control y permitirte ser sostenido/a. Tu sanación importa.',
      invitacion: '¿Qué situación te gustaría transformar con calma y sabiduría? Compártela conmigo.',
    },
    {
      bienvenida: 'El silencio también sana, pero hablar con confianza abre caminos. Me honra que elijas este refugio.',
      invitacion: '¿Qué necesitas escuchar de ti mismo/a hoy? Escríbelo y lo exploramos con cariño.',
    },
    {
      bienvenida: 'Aquí las frecuencias y las palabras caminan juntas. Respira hondo: estás en casa.',
      invitacion: 'Cuéntame qué te inquieta o qué anhelas cultivar. Tu voz es el primer paso hacia la paz.',
    },
    {
      bienvenida: 'Cada amanecer trae una oportunidad de recomenzar. Gracias por confiar en este santuario.',
      invitacion: '¿Cómo se siente tu mundo interior hoy? Platica conmigo; Sincronía Nexus te acompaña.',
    },
  ];

  function indiceHoy() {
    const start = new Date(new Date().getFullYear(), 0, 0);
    const day = Math.floor((Date.now() - start) / 86400000);
    return day % dias.length;
  }

  return {
    hoy() {
      return dias[indiceHoy()];
    },
    aplicar() {
      const d = dias[indiceHoy()];
      const bien = document.getElementById('santuario-bienvenida');
      const input = document.getElementById('user-input');
      if (bien) bien.textContent = d.bienvenida;
      if (input) input.placeholder = d.invitacion;
    },
  };
})();

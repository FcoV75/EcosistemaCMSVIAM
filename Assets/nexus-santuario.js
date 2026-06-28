/** Reproductor Sincronía Nexus — instrumental principal + frecuencia subconsciente en segundo plano */
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

  /** Frecuencia Solfeggio + onda binaural en bajo volumen (subconsciente) */
  function superponerFrecuencia(frecuenciaHz, ondaCerebral) {
    detenerSintesis();
    const ac = getCtx();
    if (ac.state === 'suspended') ac.resume();

    const master = ac.createGain();
    master.gain.value = 1;
    master.connect(ac.destination);
    nodes.push(master);

    const sol = ac.createOscillator();
    const solGain = ac.createGain();
    sol.type = 'sine';
    sol.frequency.value = frecuenciaHz || 528;
    solGain.gain.value = 0.022;
    sol.connect(solGain);
    solGain.connect(master);
    sol.start();
    nodes.push(sol, solGain);

    const armonico = ac.createOscillator();
    const arGain = ac.createGain();
    armonico.type = 'triangle';
    armonico.frequency.value = (frecuenciaHz || 528) * 0.5;
    arGain.gain.value = 0.012;
    armonico.connect(arGain);
    arGain.connect(master);
    armonico.start();
    nodes.push(armonico, arGain);

    if (ondaCerebral === 'theta' || ondaCerebral === 'alpha' || ondaCerebral === 'delta') {
      const beat = ondaCerebral === 'delta' ? 2 : ondaCerebral === 'theta' ? 6 : 10;
      const left = ac.createOscillator();
      const right = ac.createOscillator();
      const merger = ac.createChannelMerger(2);
      const g = ac.createGain();
      left.frequency.value = 136;
      right.frequency.value = 136 + beat;
      g.gain.value = 0.014;
      left.connect(merger, 0, 0);
      right.connect(merger, 0, 1);
      merger.connect(g);
      g.connect(master);
      left.start();
      right.start();
      nodes.push(left, right, merger, g);
    }
  }

  function textoFrecuenciaFondo(data) {
    const hz = data.frecuenciaHz || 528;
    const etiq = data.frecuenciaEtiqueta || 'sanación';
    return `La frecuencia de <strong>${hz} Hz</strong> (${etiq}) viaja en <strong>segundo plano</strong>, en bajo volumen, mientras disfrutas esta pieza instrumental elegida para ti. Tu mente consciente se deleita con la melodía; tu subconsciente recibe plenamente la vibración que Sincronía Nexus creó para tu bienestar.`;
  }

  window.NexusSantuario = {
    detenerSintesis,
    textoFrecuenciaFondo,
    reproducirExperiencia(data, audioId = 'member-audio', notaId = 'freq-nota-subconsciente') {
      const audio = document.getElementById(audioId);
      const nota = document.getElementById(notaId);
      const synthWrap = document.getElementById('synth-player-wrap');
      detenerSintesis();
      if (synthWrap) synthWrap.style.display = 'none';

      if (nota) {
        nota.innerHTML = textoFrecuenciaFondo(data);
        nota.style.display = 'block';
      }

      if (!audio || !data.audioUrl) return;

      audio.onplay = () => superponerFrecuencia(data.frecuenciaHz, data.ondaCerebral);
      audio.onpause = () => detenerSintesis();
      audio.onended = () => detenerSintesis();
      audio.src = data.audioUrl;
      audio.load();
      audio.play().catch(() => {});
    },
  };
})();

/** Mensajes diarios rotativos */
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

/** Galería viva — rotación cada 2–3 minutos con transición suave */
window.NexusGaleriaViva = (function () {
  const imagenes = [
    { src: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1200&q=80', alt: 'Universo y galaxia infinita' },
    { src: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=80', alt: 'Bosque verde y sereno' },
    { src: 'https://images.unsplash.com/photo-1433088538087-44472279e054?auto=format&fit=crop&w=1200&q=80', alt: 'Río entre montañas' },
    { src: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1200&q=80', alt: 'Montañas al amanecer' },
    { src: 'https://images.unsplash.com/photo-1501785888041-74d7f7266580?auto=format&fit=crop&w=1200&q=80', alt: 'Campo y lago en calma' },
    { src: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=80', alt: 'Cielo estrellado sobre montañas' },
    { src: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80', alt: 'Mar turquesa e isla tropical' },
    { src: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1200&q=80', alt: 'Niebla en valle de montaña' },
    { src: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=1200&q=80', alt: 'Cachorros jugando en naturaleza' },
    { src: 'https://images.unsplash.com/photo-1444464666168-49d633b86797?auto=format&fit=crop&w=1200&q=80', alt: 'Colibrí en su entorno' },
    { src: 'https://images.unsplash.com/photo-1523712999610-f77fbcfc3844?auto=format&fit=crop&w=1200&q=80', alt: 'Árboles frutales en huerto' },
    { src: 'https://images.unsplash.com/photo-1534088568595-a066f410bcda?auto=format&fit=crop&w=1200&q=80', alt: 'Cielo dramático al atardecer' },
    { src: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80', alt: 'Persona meditando en paz' },
    { src: 'https://images.unsplash.com/photo-1545389336-cf090694435e?auto=format&fit=crop&w=1200&q=80', alt: 'Respiración consciente y yoga' },
    { src: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=1200&q=80', alt: 'Mandala y luz suave' },
    { src: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?auto=format&fit=crop&w=1200&q=80', alt: 'Aurora sobre bosque' },
    { src: 'https://images.unsplash.com/photo-1470252649378-9c297eb3da1f?auto=format&fit=crop&w=1200&q=80', alt: 'Amanecer en campo dorado' },
    { src: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=1200&q=80', alt: 'Rayos de sol entre nubes' },
    { src: 'https://images.unsplash.com/photo-1439066615861-d1af74d74000?auto=format&fit=crop&w=1200&q=80', alt: 'Lago de montaña cristalino' },
    { src: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&w=1200&q=80', alt: 'Pradera con flores silvestres' },
    { src: 'https://images.unsplash.com/photo-1518837695005-2083093fe35a?auto=format&fit=crop&w=1200&q=80', alt: 'Olas suaves del océano' },
    { src: 'https://images.unsplash.com/photo-1505144808419-195fd814ca7e?auto=format&fit=crop&w=1200&q=80', alt: 'Cascada en selva tropical' },
    { src: 'https://images.unsplash.com/photo-1494500764479-73c48a8d0f19?auto=format&fit=crop&w=1200&q=80', alt: 'Estrellas sobre el desierto' },
    { src: 'https://images.unsplash.com/photo-1552728080-b9126787e285?auto=format&fit=crop&w=1200&q=80', alt: 'Pájaros en ramas al amanecer' },
  ];

  let timer = null;
  let idx = 0;

  function mezclar(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  return {
    init(containerId) {
      const container = document.getElementById(containerId);
      if (!container) return;

      const orden = mezclar(imagenes);
      container.innerHTML = `
        <div class="galeria-viva-frame">
          <img id="galeria-viva-img" src="${orden[0].src}" alt="${orden[0].alt}" loading="lazy" />
          <p id="galeria-viva-caption" class="galeria-viva-caption">${orden[0].alt}</p>
        </div>`;

      const img = document.getElementById('galeria-viva-img');
      const cap = document.getElementById('galeria-viva-caption');
      idx = 0;

      function siguiente() {
        idx = (idx + 1) % orden.length;
        img.style.opacity = '0';
        setTimeout(() => {
          img.src = orden[idx].src;
          img.alt = orden[idx].alt;
          if (cap) cap.textContent = orden[idx].alt;
          img.style.opacity = '1';
        }, 700);
      }

      function programar() {
        const ms = 120000 + Math.floor(Math.random() * 60000);
        timer = setTimeout(() => {
          siguiente();
          programar();
        }, ms);
      }

      programar();
    },
    detener() {
      if (timer) clearTimeout(timer);
    },
  };
})();

/** Bienvenida cordial al Santuario (primera visita por código) */
window.NexusBienvenidaMiembro = function (codigo, esPropietario) {
  const key = `nexus_santuario_acogida_${String(codigo).trim().toUpperCase()}`;
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, '1');

  const msg = esPropietario
    ? 'Querido propietario del ecosistema: tu Santuario te esperaba. Aquí encontrarás consejo amoroso, frecuencias en segundo plano e instrumentales que acarician el alma. Bienvenido/a a casa.'
    : 'Es un honor recibirte en tu Santuario Sincronía Nexus. Gracias por confiar en nosotros. Este espacio fue creado para acompañarte con ternura, sabiduría y sanación sonora. Respira hondo: ya estás en buenas manos.';

  setTimeout(() => {
    alert(msg);
  }, 600);
};

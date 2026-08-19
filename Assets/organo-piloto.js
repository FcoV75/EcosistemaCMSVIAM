/**
 * Cliente del órgano piloto Sincronía Nexus Presencia.
 * Voz (mic), oído (síntesis), ojo (cámara local, nunca sube el fotograma).
 */
(function () {
  const STORAGE = 'nexus_organo_piloto_v1';

  const MODOS = [
    { id: 'terapia', etiqueta: 'Terapia' },
    { id: 'calle', etiqueta: 'Calle' },
    { id: 'empresa', etiqueta: 'Empresa' },
    { id: 'ocio', etiqueta: 'Ocio' },
  ];

  function leerPrefs() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE) || '{}');
    } catch {
      return {};
    }
  }

  function guardarPrefs(prefs) {
    localStorage.setItem(STORAGE, JSON.stringify(prefs));
  }

  function SpeechRecognitionCtor() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  function NexusOrgano(opciones) {
    this.root = typeof opciones.root === 'string' ? document.getElementById(opciones.root) : opciones.root;
    this.ambito = opciones.ambito === 'publico' ? 'publico' : 'santuario';
    this.getAuthHeaders = opciones.getAuthHeaders || (async (extra) => extra);
    this.getCode = opciones.getCode || (() => '');
    this.onRespuesta = opciones.onRespuesta || function () {};
    this.getMensaje = opciones.getMensaje || null;
    this.setMensaje = opciones.setMensaje || null;
    this.prefs = Object.assign(
      { modo: 'terapia', voz: false, ojo: false, memoria: true, oido: true, clinica: false },
      leerPrefs(),
    );
    this.stream = null;
    this.rec = null;
    this.mediaRec = null;
    this.chunks = [];
    this.escuchando = false;
    this.vozEnEsteTurno = false;
  }

  NexusOrgano.prototype.montar = function () {
    if (!this.root) return;
    this.root.innerHTML = `
      <div class="organo-faro" data-estado="apagado" role="status" aria-live="polite">
        <span class="organo-faro-luz" aria-hidden="true"></span>
        <span class="organo-faro-texto">Faro apagado — nadie te oye ni te ve</span>
        <button type="button" data-organo="apagar">Apagar percepción</button>
      </div>
      <div class="organo-panel">
        <p style="margin:0.6rem 0 0;color:#dbe9ff;font-size:0.92rem;line-height:1.55;">
          Este es el órgano piloto: una presencia que ya usa <strong>voz, oído y ojo</strong> con contrato.
          El hardware de lentes llegará; la ética empieza hoy. Lo irreversible (diagnosticar, presentar, pagar, grabar) exige tu veto.
        </p>
        <div class="organo-modos" role="group" aria-label="Modo de presencia">
          ${MODOS.map(
            (m) =>
              `<button type="button" data-modo="${m.id}" aria-pressed="${this.prefs.modo === m.id}">${m.etiqueta}</button>`,
          ).join('')}
        </div>
        <div class="organo-consent">
          <label><input type="checkbox" data-cons="voz" ${this.prefs.voz ? 'checked' : ''}/> Consentimiento de voz (micrófono). El faro se enciende al hablar.</label>
          <label><input type="checkbox" data-cons="oido" ${this.prefs.oido !== false ? 'checked' : ''}/> Oído: que Nexus te lea la respuesta en voz alta.</label>
          <label><input type="checkbox" data-cons="ojo" ${this.prefs.ojo ? 'checked' : ''}/> Consentimiento de ojo (cámara). Nunca se sube el fotograma; solo puedes dictar “lo que veo”.</label>
          ${
            this.ambito === 'santuario'
              ? `<label><input type="checkbox" data-cons="memoria" ${this.prefs.memoria !== false ? 'checked' : ''}/> Memoria episódica (solo resúmenes de texto, 30 días). Sin audio ni video.</label>`
              : ''
          }
        </div>
        <div class="organo-preview" data-organo="preview">
          <video data-organo="video" autoplay playsinline muted></video>
        </div>
        <textarea class="organo-lo-que-veo" data-organo="lo-que-veo" placeholder="Si el ojo está encendido: describe lo que miras. El píxel no sale de tu dispositivo."></textarea>
        <div class="organo-acciones">
          <button type="button" class="btn-organo" data-organo="hablar">Hablar</button>
          <button type="button" class="btn-organo secundario" data-organo="turno">Enviar presencia</button>
          ${this.ambito === 'santuario' ? '<button type="button" class="btn-organo secundario" data-organo="olvidar">Olvidar memoria</button>' : ''}
        </div>
        <div class="organo-filtro" data-organo="filtro"></div>
        <div class="organo-veto" data-organo="veto"></div>
        <p class="organo-meta" data-organo="meta"></p>
      </div>
    `;
    this.bind();
    this.pintarFaro();
  };

  NexusOrgano.prototype.bind = function () {
    const root = this.root;
    root.querySelectorAll('[data-modo]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.prefs.modo = btn.getAttribute('data-modo');
        if (this.prefs.modo !== 'calle' && this.escuchandoOjo()) this.apagarOjo();
        guardarPrefs(this.prefs);
        root.querySelectorAll('[data-modo]').forEach((b) => b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'));
        this.pintarFaro();
      });
    });
    root.querySelectorAll('[data-cons]').forEach((box) => {
      box.addEventListener('change', () => {
        const key = box.getAttribute('data-cons');
        this.prefs[key] = box.checked;
        if (key === 'ojo' && !box.checked) this.apagarOjo();
        if (key === 'voz' && !box.checked) this.apagarVoz();
        guardarPrefs(this.prefs);
        this.pintarFaro();
      });
    });
    root.querySelector('[data-organo="apagar"]').addEventListener('click', () => this.apagarTodo());
    root.querySelector('[data-organo="hablar"]').addEventListener('click', () => this.toggleVoz());
    root.querySelector('[data-organo="turno"]').addEventListener('click', () => this.enviarTurno());
    const olvidar = root.querySelector('[data-organo="olvidar"]');
    if (olvidar) olvidar.addEventListener('click', () => this.olvidar());
  };

  NexusOrgano.prototype.escuchandoOjo = function () {
    return Boolean(this.stream);
  };

  NexusOrgano.prototype.pintarFaro = function () {
    const el = this.root.querySelector('.organo-faro');
    const texto = this.root.querySelector('.organo-faro-texto');
    const preview = this.root.querySelector('[data-organo="preview"]');
    const loQueVeo = this.root.querySelector('[data-organo="lo-que-veo"]');
    let estado = 'apagado';
    let msg = 'Faro apagado — nadie te oye ni te ve';
    if (this.escuchandoOjo()) {
      estado = 'ojo';
      msg = 'OJO ENCENDIDO — la cámara está activa en tu dispositivo. El fotograma no se sube.';
    } else if (this.escuchando) {
      estado = 'voz';
      msg = 'VOZ ENCENDIDA — te estoy oyendo. Un toque en Apagar corta el micrófono.';
    } else if (this.prefs.oido !== false) {
      estado = 'oido';
      msg = 'Oído listo — puedo leerte la respuesta. Mic y cámara apagados.';
    }
    el.setAttribute('data-estado', estado);
    texto.textContent = msg;
    preview.style.display = this.escuchandoOjo() ? 'block' : 'none';
    loQueVeo.style.display = this.prefs.ojo && this.prefs.modo === 'calle' ? 'block' : 'none';
  };

  NexusOrgano.prototype.apagarVoz = function () {
    this.escuchando = false;
    try {
      this.rec?.stop();
    } catch {
      /* ignore */
    }
    this.rec = null;
    if (this.mediaRec && this.mediaRec.state !== 'inactive') {
      try {
        this.mediaRec.stop();
      } catch {
        /* ignore */
      }
    }
    this.mediaRec = null;
    this.pintarFaro();
  };

  NexusOrgano.prototype.apagarOjo = function () {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    const video = this.root.querySelector('[data-organo="video"]');
    if (video) video.srcObject = null;
    this.pintarFaro();
  };

  NexusOrgano.prototype.apagarTodo = function () {
    this.apagarVoz();
    this.apagarOjo();
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
    this.pintarFaro();
  };

  NexusOrgano.prototype.toggleVoz = async function () {
    if (this.escuchando) {
      this.apagarVoz();
      return;
    }
    if (!this.prefs.voz) {
      alert('Activa primero el consentimiento de voz. El faro tiene que poder encenderse.');
      return;
    }
    if (this.prefs.ojo && this.prefs.modo === 'calle' && !this.stream) {
      await this.encenderOjo();
    }
    const Ctor = SpeechRecognitionCtor();
    if (Ctor) {
      const rec = new Ctor();
      rec.lang = 'es-MX';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (ev) => {
        const texto = ev.results[0][0].transcript;
        this.vozEnEsteTurno = true;
        this.escribirMensaje(texto);
        this.apagarVoz();
      };
      rec.onerror = () => {
        this.apagarVoz();
        this.grabarYTranscribir();
      };
      rec.onend = () => {
        this.escuchando = false;
        this.pintarFaro();
      };
      this.rec = rec;
      this.escuchando = true;
      this.pintarFaro();
      rec.start();
      return;
    }
    await this.grabarYTranscribir();
  };

  NexusOrgano.prototype.escribirMensaje = function (texto) {
    if (this.setMensaje) this.setMensaje(texto);
    else {
      const area = document.getElementById('user-input') || document.querySelector('#nexus-form textarea[name="situacion"]');
      if (area) area.value = texto;
    }
  };

  NexusOrgano.prototype.leerMensaje = function () {
    if (this.getMensaje) return this.getMensaje();
    const area = document.getElementById('user-input');
    if (area) return area.value.trim();
    return '';
  };

  NexusOrgano.prototype.encenderOjo = async function () {
    if (!this.prefs.ojo) return;
    if (this.prefs.modo !== 'calle') {
      alert('El ojo solo se abre en modo Calle. En Terapia, Empresa y Ocio permanece apagado.');
      return;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      const video = this.root.querySelector('[data-organo="video"]');
      video.srcObject = this.stream;
      this.pintarFaro();
    } catch {
      alert('No pude abrir la cámara. El órgano sigue oyendo y leyendo; el ojo queda en off.');
      this.prefs.ojo = false;
      const box = this.root.querySelector('[data-cons="ojo"]');
      if (box) box.checked = false;
      guardarPrefs(this.prefs);
    }
  };

  NexusOrgano.prototype.grabarYTranscribir = async function () {
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.chunks = [];
      const rec = new MediaRecorder(mic);
      this.mediaRec = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size) this.chunks.push(e.data);
      };
      rec.onstop = async () => {
        mic.getTracks().forEach((t) => t.stop());
        const blob = new Blob(this.chunks, { type: rec.mimeType || 'audio/webm' });
        await this.enviarAudio(blob);
      };
      this.escuchando = true;
      this.pintarFaro();
      rec.start();
      setTimeout(() => {
        if (rec.state !== 'inactive') rec.stop();
      }, 12000);
    } catch {
      alert('El navegador no permitió el micrófono.');
      this.apagarVoz();
    }
  };

  NexusOrgano.prototype.enviarAudio = async function (blob) {
    const headers = await this.getAuthHeaders();
    delete headers['Content-Type'];
    const form = new FormData();
    form.append('audio', blob, 'organo.webm');
    const code = this.getCode();
    if (code) form.append('code', code);
    if (this.ambito === 'publico') form.append('publico', '1');
    try {
      const res = await fetch('/.netlify/functions/organo-transcribe', { method: 'POST', headers, body: form });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'No pude transcribir.');
      this.vozEnEsteTurno = true;
      this.escribirMensaje(data.texto);
    } catch (err) {
      alert(err.message);
    } finally {
      this.apagarVoz();
    }
  };

  NexusOrgano.prototype.enviarTurno = async function () {
    const mensaje = this.leerMensaje();
    if (!mensaje) {
      alert('Habla o escribe primero. El órgano no inventa lo que no oye.');
      return;
    }
    if (this.prefs.ojo && this.prefs.modo === 'calle' && !this.stream) {
      await this.encenderOjo();
    }
    const loQueVeo = (this.root.querySelector('[data-organo="lo-que-veo"]')?.value || '').trim();
    const btn = this.root.querySelector('[data-organo="turno"]');
    btn.disabled = true;
    try {
      const headers = await this.getAuthHeaders({ 'Content-Type': 'application/json' });
      const body = {
        accion: 'turno',
        publico: this.ambito === 'publico',
        modo: this.prefs.modo,
        mensaje,
        percepcion: {
          voz: Boolean(this.vozEnEsteTurno),
          oido: this.prefs.oido !== false,
          ojo: Boolean(this.stream),
          transcripcion: mensaje,
          loQueVeo: this.stream ? loQueVeo : '',
        },
        consentimientos: {
          voz: Boolean(this.prefs.voz),
          ojo: Boolean(this.prefs.ojo),
          memoria: this.prefs.memoria !== false,
          clinica: false,
        },
      };
      const code = this.getCode();
      if (code) body.code = code;
      const res = await fetch('/.netlify/functions/organo-piloto', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        const extra = data.detalle ? `\n${data.detalle.map((d) => d.detalle).join('\n')}` : '';
        throw new Error((data.error || 'El órgano no respondió.') + extra);
      }
      this.pintarFiltro(data);
      this.pintarVeto(data);
      this.root.querySelector('[data-organo="meta"]').textContent = [
        `Modo ${data.modo}`,
        `skills: ${(data.skillsInvocados || []).join(', ') || 'ninguna'}`,
        data.memoriaGuardada ? 'memoria resumida guardada' : 'sin memoria cruda',
        data.consultasRestantes != null ? `${data.consultasRestantes} consultas restantes` : '',
      ]
        .filter(Boolean)
        .join(' · ');
      if (this.prefs.oido !== false && data.reply && !data.silencio) this.hablar(data.reply);
      this.onRespuesta(data);
      this.vozEnEsteTurno = false;
    } catch (err) {
      alert(err.message);
    } finally {
      btn.disabled = false;
    }
  };

  NexusOrgano.prototype.pintarFiltro = function (data) {
    const el = this.root.querySelector('[data-organo="filtro"]');
    const f = data.filtro;
    if (!f) {
      el.style.display = 'none';
      return;
    }
    el.style.display = 'block';
    el.innerHTML = `<strong>Triple Filtro Nexus — veredicto: ${f.veredicto}</strong><br>
      Verdad: ${f.verdad?.nota || ''}<br>
      Bondad: ${f.bondad?.nota || ''}<br>
      Utilidad: ${f.utilidad?.nota || ''}<br>
      <em>${data.loQueNoHare || ''}</em>`;
  };

  NexusOrgano.prototype.pintarVeto = function (data) {
    const el = this.root.querySelector('[data-organo="veto"]');
    const pendientes = data.vetosPendientes || [];
    if (!pendientes.length) {
      el.style.display = 'none';
      el.innerHTML = '';
      return;
    }
    el.style.display = 'block';
    el.innerHTML = pendientes
      .map(
        (v) =>
          `<p style="margin:0 0 .5rem;"><strong>Veto: ${v.tipo.replace(/_/g, ' ')}</strong> — ${v.resumen}</p>
           <button type="button" class="btn-organo secundario" data-veto-id="${v.id}" data-veto-d="rechazar">Rechazar (recomendado)</button>
           <button type="button" class="btn-organo" data-veto-id="${v.id}" data-veto-d="aprobar">Registrar mi sí (aún no se ejecuta)</button>`,
      )
      .join('');
    el.querySelectorAll('[data-veto-id]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const headers = await this.getAuthHeaders({ 'Content-Type': 'application/json' });
        const res = await fetch('/.netlify/functions/organo-piloto', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            accion: 'veto',
            vetoId: btn.getAttribute('data-veto-id'),
            vetoDecision: btn.getAttribute('data-veto-d'),
          }),
        });
        const d = await res.json();
        alert(d.mensaje || 'Veto registrado.');
      });
    });
  };

  NexusOrgano.prototype.hablar = function (texto) {
    try {
      window.speechSynthesis?.cancel();
      const u = new SpeechSynthesisUtterance(String(texto).slice(0, 900));
      u.lang = 'es-MX';
      u.rate = 0.94;
      window.speechSynthesis.speak(u);
    } catch {
      /* ignore */
    }
  };

  NexusOrgano.prototype.olvidar = async function () {
    if (!confirm('¿Borrar los resúmenes de memoria de este Santuario? El audio y el video nunca se guardaron.')) return;
    const headers = await this.getAuthHeaders({ 'Content-Type': 'application/json' });
    const body = { accion: 'memoria', borrar: true };
    const code = this.getCode();
    if (code) body.code = code;
    const res = await fetch('/.netlify/functions/organo-piloto', { method: 'POST', headers, body: JSON.stringify(body) });
    const data = await res.json();
    alert(data.borrada ? 'Memoria episódica olvidada.' : data.error || 'No se pudo olvidar.');
  };

  window.NexusOrgano = {
    montar(opts) {
      const inst = new NexusOrgano(opts);
      inst.montar();
      window.addEventListener('pagehide', () => inst.apagarTodo());
      return inst;
    },
  };
})();

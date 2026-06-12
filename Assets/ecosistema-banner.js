(function () {
  if (document.getElementById('ecosistema-gracias-banner')) return;

  const banner = document.createElement('figure');
  banner.id = 'ecosistema-gracias-banner';
  banner.className = 'ecosistema-gracias-banner';
  banner.innerHTML =
    '<img src="/Assets/Images/Gracias_Pago_CMS.png" alt="Muchas gracias — CMS, VIAM Music, Sincronía Nexus y ContacNeed" loading="lazy" />' +
    '<figcaption>Ecosistema CMS VIAM — Centro Multidisciplinario · VIAM Music &amp; Publicity · Sincronía Nexus · ContacNeed</figcaption>';

  const container =
    document.querySelector('.wrap') ||
    document.querySelector('.contenedor-principal') ||
    document.querySelector('main') ||
    document.body;

  container.appendChild(banner);

  window.mostrarGraciasEcosistema = function () {
    banner.classList.add('exito');
    const cap = banner.querySelector('figcaption');
    if (cap) {
      cap.textContent = '¡Gracias por tu confianza! Esperamos verte pronto de nuevo.';
    }
    banner.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };
})();

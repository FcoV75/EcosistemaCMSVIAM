(function () {
  if (document.getElementById('ecosistema-gracias-banner')) return;

  const banner = document.createElement('figure');
  banner.id = 'ecosistema-gracias-banner';
  banner.className = 'ecosistema-gracias-banner';
  banner.innerHTML =
    '<img src="/Assets/Images/Gracias_Pago_CMS.png" alt="Muchas gracias — CMS, VIAM Music, Sincronía Nexus y ContacNeed" loading="lazy" />' +
    '<figcaption>Ecosistema CMS VIAM — Centro Multidisciplinario · VIAM Music &amp; Publicity · Sincronía Nexus · ContacNeed</figcaption>';

  const anchor =
    document.querySelector('header') ||
    document.querySelector('.cabecera-diamante') ||
    document.querySelector('nav.topnav') ||
    document.querySelector('.header-logos') ||
    document.querySelector('.wrap') ||
    document.querySelector('.contenedor-principal');

  if (!anchor) return;

  if (anchor.matches('header, .cabecera-diamante, nav.topnav, .header-logos')) {
    anchor.insertAdjacentElement('afterend', banner);
  } else {
    anchor.prepend(banner);
  }

  window.mostrarGraciasEcosistema = function () {
    banner.classList.add('exito');
    const cap = banner.querySelector('figcaption');
    if (cap) {
      cap.textContent = '¡Gracias por tu confianza! Esperamos verte pronto de nuevo.';
    }
    banner.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
})();

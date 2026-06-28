function envCodes(varName) {
  let raw = '';
  try {
    if (typeof Netlify !== 'undefined' && Netlify.env?.get) {
      raw = Netlify.env.get(varName) || '';
    }
  } catch {
    /* ignore */
  }
  if (!raw) raw = process.env[varName] || '';
  return new Set(
    String(raw)
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean),
  );
}

function allOwnerCodes() {
  const merged = new Set();
  for (const code of envCodes('ECOSISTEMA_OWNER_CODES')) merged.add(code);
  for (const code of envCodes('VIDEO_DIAMANTE_OWNER_CODES')) merged.add(code);
  for (const code of envCodes('SINCRONIA_NEXUS_OWNER_CODES')) merged.add(code);
  return merged;
}

function nexusOwnerCodes() {
  const merged = new Set(allOwnerCodes());
  for (const code of envCodes('SINCRONIA_NEXUS_OWNER_CODES')) merged.add(code);
  return merged;
}

function videoOwnerCodes() {
  const merged = new Set(allOwnerCodes());
  for (const code of envCodes('VIDEO_DIAMANTE_OWNER_CODES')) merged.add(code);
  return merged;
}

export function esCodigoPropietario(code) {
  if (!code) return false;
  return allOwnerCodes().has(String(code).trim().toUpperCase());
}

export function esCodigoPropietarioNexus(code) {
  if (!code) return false;
  return nexusOwnerCodes().has(String(code).trim().toUpperCase());
}

export function esCodigoPropietarioVideoDiamante(code) {
  if (!code) return false;
  return videoOwnerCodes().has(String(code).trim().toUpperCase());
}

export function esMembresiaPermanente(code, memberData) {
  if (esCodigoPropietario(code)) return true;
  return memberData?.permanent === true;
}

export function estadoMembresia(code, memberData) {
  const producto = memberData?.producto || 'video_diamante_premium';
  const plan = memberData?.plan || null;

  if (esMembresiaPermanente(code, memberData)) {
    return {
      producto,
      plan: plan || 'propietario',
      daysLeft: 99999,
      status: 'active',
      permanent: true,
    };
  }

  const now = Date.now();
  const msInDay = 1000 * 60 * 60 * 24;
  const elapsedDays = Math.floor((now - memberData.startDate) / msInDay);
  const daysLeft = memberData.durationDays - elapsedDays;
  const base = { producto, plan, daysLeft, permanent: false };

  if (daysLeft < 0) return { ...base, status: 'expired', daysLeft: 0 };
  if (daysLeft === 0) return { ...base, status: 'last_day', daysLeft: 0 };
  if (daysLeft <= 5) return { ...base, status: 'warning', daysLeft };
  return { ...base, status: 'active', daysLeft };
}

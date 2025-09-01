// src/lib/net/findCandidateLink.js
// Encuentra un enlace candidato en el HTML del home que apunte a /privacy, /terms o /faq (etc.)
// Usa cheerio para parsear <a href=...> y resuelve URLs relativas contra el origin.
//
// Heurística intencionalmente simple (alineada con tu API):
//  - Normaliza a minúsculas.
//  - Considera candidato si la URL resultante incluye "/<tail>" o termina con "/<tail>".
//  - Devuelve el PRIMERO que coincida (orden del DOM).
//
// Nota: No filtra por dominio distinto; si necesitas restringir al mismo host, pasa { sameHostOnly: true }.

import cheerio from 'cheerio';

/**
 * @typedef {Object} FindOpts
 * @property {boolean} [sameHostOnly=false]  Si true, sólo acepta enlaces cuyo host sea igual al del origin.
 */

/**
 * Devuelve la primera URL candidata que matchee alguno de los tails.
 * @param {string} homeHtml  HTML del home.
 * @param {string} origin    Origin absoluto (p.ej. "https://acme.com").
 * @param {string[]} tails   Lista de tails (sin slash inicial requerido), p.ej. ["privacy","privacy-policy"].
 * @param {FindOpts} [opts]
 * @returns {string|null}
 */
export function findCandidateLink(homeHtml, origin, tails, opts = {}) {
  if (!homeHtml || !origin || !Array.isArray(tails) || tails.length === 0) return null;

  let base;
  try {
    base = new URL(origin);
  } catch {
    return null;
  }

  const $ = cheerio.load(homeHtml, { decodeEntities: true, lowerCaseAttributeNames: true });

  /** Normaliza href y lo resuelve contra origin; devuelve string o null */
  const resolveHref = (href) => {
    if (!href || typeof href !== 'string') return null;
    const h = href.trim();
    // descartar anchors/mailto/javascript/etc
    if (!h || h === '#' || h.startsWith('javascript:') || h.startsWith('mailto:') || h.startsWith('tel:')) {
      return null;
    }
    try {
      const abs = new URL(h, base).toString();
      return abs;
    } catch {
      return null;
    }
  };

  /** Checa si la URL (lowercased) coincide con alguno de los tails. */
  const matchesTails = (urlLower) => {
    for (const t of tails) {
      const tail = `/${String(t).toLowerCase()}`;
      if (urlLower.includes(tail) || urlLower.endsWith(tail)) return true;
    }
    return false;
  };

  const wantSameHost = !!opts.sameHostOnly;

  // Recorremos <a href> en orden de aparición
  const anchors = $('a[href]');
  for (let i = 0; i < anchors.length; i++) {
    const el = anchors[i];
    const hrefAttr = $(el).attr('href');
    const abs = resolveHref(hrefAttr);
    if (!abs) continue;

    // Filtro same-host opcional
    if (wantSameHost) {
      try {
        const u = new URL(abs);
        if (u.hostname !== base.hostname) continue;
      } catch {
        continue;
      }
    }

    const low = abs.toLowerCase();
    if (matchesTails(low)) return abs;
  }

  return null;
}

export default findCandidateLink;
// src/lib/sections/htmlToPlain.js
// Normaliza HTML -> texto plano para scoring y checks de secciones.
// - Elimina <script>, <style>, <noscript>, <template>, <svg>, <canvas>, <iframe>, etc.
// - Intenta conservar <title> y el texto del <body>.
// - Colapsa espacios, newlines y entidades comunes.
// - Devuelve string UTF-8 sin caracteres de control innecesarios.

import cheerio from 'cheerio';

/**
 * Convierte HTML a texto plano "audit-friendly".
 * @param {string} html
 * @param {{ keepTitle?: boolean, maxChars?: number }} [opts]
 * @returns {string}
 */
export function htmlToPlain(html, opts = {}) {
  if (!html || typeof html !== 'string') return '';

  const keepTitle = opts.keepTitle ?? true;
  const maxChars = Math.max(0, opts.maxChars ?? 500_000); // hard cap para no desbordar memoria

  // Parse robusto
  const $ = cheerio.load(html, { decodeEntities: true, lowerCaseTags: true });

  // Remover nodos ruidosos
  $('script, style, noscript, template, svg, canvas, iframe, picture, source, video, audio').remove();

  // Extraer título si aplica
  const title = keepTitle ? String($('title').first().text() || '').trim() : '';

  // Texto del body; si no hay <body>, tomamos root()
  let bodyText = $('body').length ? $('body').text() : $.root().text();
  bodyText = String(bodyText || '');

  // Normalización: unificar espacios, quitar NBSP, tabs excesivos, CR, etc.
  let text = (title ? `${title}\n\n` : '') + bodyText;

  text = text
    .replace(/\u00A0/g, ' ')        // NBSP -> espacio normal
    .replace(/\r/g, '\n')           // CR -> LF
    .replace(/[ \t]+/g, ' ')        // colapsar tabs y múltiples espacios
    .replace(/\n{3,}/g, '\n\n')     // como máximo doble salto
    .replace(/[ \t]+\n/g, '\n')     // espacios al final de línea
    .replace(/\n[ \t]+/g, '\n');    // espacios al inicio de línea

  text = text.trim();

  if (text.length > maxChars) {
    text = text.slice(0, maxChars);
  }

  return text;
}

/**
 * Extrae texto plano rápido sin cheerio (fallback si hiciera falta).
 * Útil para testing o entornos sin dependencias.
 * @param {string} html
 * @returns {string}
 */
export function naiveStripHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default htmlToPlain;
// src/lib/match/templateMatcher.js
// Carga templates PDF, extrae texto, cachea por mtime/size y calcula similitud 0–100.
//
// Expuestos:
//  - readPdfToText(absPath)
//  - loadTemplatePack(names?) -> { names, texts, entries: [{name,path,size,text}] }
//  - matchTextToTemplates(text, pack) -> { best, byTemplate, labeled: [{name, score}] }
//  - getTemplatesInfo(names?) -> [{ name, path, size }]
//
// Requisitos: assets/templates/{PP.pdf,TOS.pdf,CS.pdf}

import fs from 'node:fs/promises';
import path from 'node:path';
import pdfParse from 'pdf-parse';
import { similarityAgainstTemplates } from './similarity.js';
import {
  resolveTemplatePdf,
  fileSize,
} from '../util/ensurePaths.js';

/** Normaliza texto para scoring: colapsa espacios, quita NBSP, trim. */
function normalizeText(s) {
  return String(s || '')
    .replace(/\u00A0/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .trim();
}

/** Cache simple por ruta con invalidación por mtime y size. */
const pdfCache = new Map(); // path -> { mtimeMs, size, text }

/**
 * Lee un PDF y devuelve su texto normalizado.
 * Cachea por (mtime,size) para evitar reparsear.
 * @param {string} absPath ruta absoluta al PDF
 * @returns {Promise<string>}
 */
export async function readPdfToText(absPath) {
  const st = await fs.stat(absPath);
  if (!st.isFile()) throw new Error(`Not a file: ${absPath}`);

  const prev = pdfCache.get(absPath);
  if (prev && prev.mtimeMs === st.mtimeMs && prev.size === st.size && typeof prev.text === 'string') {
    return prev.text;
  }

  const buf = await fs.readFile(absPath);
  const out = await pdfParse(buf);
  const text = normalizeText(out.text || '');

  pdfCache.set(absPath, { mtimeMs: st.mtimeMs, size: st.size, text });
  return text;
}

/**
 * Carga un pack de templates PDF desde assets/templates.
 * @param {string[]} [names=['PP.pdf','TOS.pdf','CS.pdf']]
 * @returns {Promise<{ names:string[], texts:string[], entries: {name:string, path:string, size:number, text:string}[] }>}
 */
export async function loadTemplatePack(names = ['PP.pdf', 'TOS.pdf', 'CS.pdf']) {
  /** @type {{name:string, path:string, size:number, text:string}[]} */
  const entries = [];

  for (const name of names) {
    const abs = await resolveTemplatePdf(name);
    const size = await fileSize(abs);
    const text = await readPdfToText(abs);
    entries.push({ name, path: abs, size, text });
  }

  return {
    names: entries.map(e => e.name),
    texts: entries.map(e => e.text),
    entries,
  };
}

/**
 * Calcula similitud (0–100) contra todas las plantillas del pack.
 * @param {string} text
 * @param {{ names:string[], texts:string[] }} pack
 * @returns {{ best:number, byTemplate:number[], labeled:{name:string, score:number}[] }}
 */
export function matchTextToTemplates(text, pack) {
  const { best, byTemplate } = similarityAgainstTemplates(text || '', pack.texts || []);
  const labeled = (pack.names || []).map((name, i) => ({ name, score: byTemplate[i] ?? 0 }));
  return { best, byTemplate, labeled };
}

/**
 * Devuelve metadatos de los templates incluidos (ruta y tamaño).
 * @param {string[]} [names=['PP.pdf','TOS.pdf','CS.pdf']]
 * @returns {Promise<{name:string, path:string, size:number}[]>}
 */
export async function getTemplatesInfo(names = ['PP.pdf', 'TOS.pdf', 'CS.pdf']) {
  const infos = [];
  for (const name of names) {
    const abs = await resolveTemplatePdf(name);
    const size = await fileSize(abs);
    infos.push({ name, path: abs, size });
  }
  return infos;
}

export default {
  readPdfToText,
  loadTemplatePack,
  matchTextToTemplates,
  getTemplatesInfo,
};
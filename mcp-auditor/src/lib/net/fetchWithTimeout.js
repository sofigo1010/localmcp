// src/lib/net/fetchWithTimeout.js
// Descarga HTML con timeout, UA y límite de tamaño (streaming seguro).
// Requiere Node 18+ (global fetch / AbortController).

/**
 * @typedef {Object} FetchOpts
 * @property {number} [timeoutMs=12000]   Tiempo máximo por request.
 * @property {string} [userAgent]         User-Agent a enviar.
 * @property {number} [maxBytes=2_000_000]Límite duro de bytes a leer.
 * @property {AbortSignal} [signal]       Señal externa para cancelar.
 * @property {Object.<string,string>} [headers] Headers extra.
 */

/**
 * Hace fetch y devuelve el cuerpo como texto UTF-8 (hasta maxBytes).
 * Lanza si: timeout, abort, status >= 400, o cuerpo excede maxBytes.
 * @param {string} url
 * @param {FetchOpts} [opts]
 * @returns {Promise<{ url:string, status:number, headers:Record<string,string>, text:string }>}
 */
export async function fetchWithTimeout(url, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 12_000;
  const maxBytes  = opts.maxBytes  ?? 2_000_000;
  const userAgent = opts.userAgent || undefined;

  const ac = new AbortController();
  const onTimeout = setTimeout(() => ac.abort(new Error('Fetch timeout')), timeoutMs);

  // Propaga abort externo
  const { signal: outer } = opts;
  if (outer) {
    if (outer.aborted) ac.abort(outer.reason || new Error('Aborted'));
    outer.addEventListener('abort', () => ac.abort(outer.reason || new Error('Aborted')), { once: true });
  }

  const headers = new Headers(opts.headers || {});
  if (userAgent) headers.set('user-agent', userAgent);
  headers.set('accept', headers.get('accept') || 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8');

  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: ac.signal,
      headers,
    });

    const status = res.status;
    if (status >= 400) {
      const err = new Error(`Upstream responded ${status}`);
      // Adjuntamos info útil
      /** @type {any} */(err).status = status;
      throw err;
    }

    // Leemos streaming y cortamos en maxBytes
    const reader = res.body?.getReader ? res.body.getReader() : null;
    const chunks = [];
    let total = 0;

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          total += value.byteLength;
          if (total > maxBytes) {
            // Cancelamos el stream
            try { await reader.cancel(); } catch {}
            const err = new Error(`Response too large (> ${maxBytes} bytes)`);
            /** @type {any} */(err).code = 'E2BIG';
            throw err;
          }
          chunks.push(value);
        }
      }
    } else {
      // Fallback (entornos sin stream): aún respetamos maxBytes
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.byteLength > maxBytes) {
        const err = new Error(`Response too large (> ${maxBytes} bytes)`);
        /** @type {any} */(err).code = 'E2BIG';
        throw err;
      }
      chunks.push(buf);
      total = buf.byteLength;
    }

    const body = concatUint8(chunks, total);
    const text = decodeUtf8(body);

    const outHeaders = {};
    for (const [k, v] of res.headers.entries()) outHeaders[k.toLowerCase()] = v;

    return {
      url: res.url || url, // URL final tras redirects
      status,
      headers: outHeaders,
      text,
    };
  } catch (e) {
    // Normalizamos errores comunes
    if (e?.name === 'AbortError') {
      const err = new Error('Request aborted or timed out');
      /** @type {any} */(err).code = 'ETIMEDOUT';
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(onTimeout);
  }
}

/** Concatena Uint8Array[] sin copiar de más. */
function concatUint8(chunks, total) {
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.byteLength;
  }
  return out;
}

/** Decodifica UTF-8 con TextDecoder (sin BOM). */
function decodeUtf8(bytes) {
  const dec = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true });
  return dec.decode(bytes);
}

/**
 * Atajo semántico para HTML.
 * @param {string} url
 * @param {FetchOpts} [opts]
 */
export async function fetchHtml(url, opts = {}) {
  return fetchWithTimeout(url, opts);
}

export default fetchWithTimeout;
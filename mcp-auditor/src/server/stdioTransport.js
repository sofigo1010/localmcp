// src/server/stdioTransport.js
// JSON-RPC 2.0 sobre stdio con framing dual:
//  - NDJSON (una línea por mensaje JSON)
//  - LSP-style: "Content-Length: <n>\r\n\r\n<json>"
// Se auto-detecta el framing por el primer mensaje entrante y se mantiene para las respuestas.

import { Buffer } from 'node:buffer';

const FRAMING = {
  UNKNOWN: 'unknown',
  NDJSON: 'ndjson',
  LSP: 'lsp',
};

/**
 * Adjunta el servidor MCP a STDIN/STDOUT y procesa JSON-RPC.
 * @param {{handleRequest: (payload:any)=>Promise<any>, shutdown:()=>Promise<void>}} server
 * @param {{onClose?: ()=>void, log?: (level:string, ...args:any[])=>void}} opts
 * @returns {()=>void} detach
 */
export function attachToStdio(server, opts = {}) {
  const log = opts.log || ((..._args) => {});
  let framing = FRAMING.UNKNOWN;

  // --- Escritura (usa el framing detectado) ---
  function writeMessage(obj) {
    const json = JSON.stringify(obj);
    if (framing === FRAMING.LSP) {
      const body = Buffer.from(json, 'utf8');
      const header = Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, 'utf8');
      const out = Buffer.concat([header, body]);
      process.stdout.write(out);
    } else {
      // NDJSON por defecto
      process.stdout.write(json + '\n');
    }
  }

  // --- Parser NDJSON ---
  let ndjsonBuffer = '';
  function tryDrainNdjson() {
    let newlineIdx;
    while ((newlineIdx = ndjsonBuffer.indexOf('\n')) >= 0) {
      const line = ndjsonBuffer.slice(0, newlineIdx).trim();
      ndjsonBuffer = ndjsonBuffer.slice(newlineIdx + 1);
      if (line.length === 0) continue;
      handleOneLine(line);
    }
  }
  function handleOneLine(line) {
    try {
      const payload = JSON.parse(line);
      dispatch(payload);
    } catch (e) {
      log('warn', 'Invalid NDJSON line (ignored):', e?.message);
    }
  }

  // --- Parser LSP (Content-Length) ---
  let lspBuffer = Buffer.alloc(0);
  function tryDrainLsp() {
    // Buscamos doble CRLF que separa headers del cuerpo
    while (true) {
      const headerEnd = lspBuffer.indexOf('\r\n\r\n');
      if (headerEnd < 0) return; // headers incompletos
      const headerPart = lspBuffer.slice(0, headerEnd).toString('utf8');
      const match = /Content-Length:\s*(\d+)/i.exec(headerPart);
      if (!match) {
        // Encabezado inválido; descartamos hasta próximo CRLF
        log('warn', 'LSP header without Content-Length; dropping chunk');
        // Avanzar más allá del CRLF doble para no quedar pegados
        lspBuffer = lspBuffer.slice(headerEnd + 4);
        continue;
      }
      const length = parseInt(match[1], 10);
      const totalNeeded = headerEnd + 4 + length;
      if (lspBuffer.length < totalNeeded) return; // cuerpo incompleto
      const body = lspBuffer.slice(headerEnd + 4, totalNeeded).toString('utf8');
      lspBuffer = lspBuffer.slice(totalNeeded);

      try {
        const payload = JSON.parse(body);
        dispatch(payload);
      } catch (e) {
        log('warn', 'Invalid LSP JSON (ignored):', e?.message);
      }
      // loop para ver si hay más mensajes completos
    }
  }

  // --- Despacho hacia el server JSON-RPC ---
  async function dispatch(payload) {
    try {
      const res = await server.handleRequest(payload);
      if (res) writeMessage(res);
    } catch (err) {
      // Si el server lanzó una excepción no convertida en JSON-RPC, devolvemos error genérico
      const id = payload && typeof payload === 'object' ? payload.id ?? null : null;
      writeMessage({
        jsonrpc: '2.0',
        id,
        error: { code: -32000, message: 'Internal error' },
      });
      log('error', 'dispatch error:', err?.stack || err);
    }
  }

  // --- Auto-detector de framing y handler de datos ---
  function onData(chunk) {
    if (framing === FRAMING.UNKNOWN) {
      // Chequeo simple: si el chunk comienza con "Content-Length", asumimos LSP
      const s = chunk.toString('utf8');
      if (/^\s*Content-Length:/i.test(s) || s.includes('\r\n\r\n')) {
        framing = FRAMING.LSP;
      } else {
        framing = FRAMING.NDJSON;
      }
      log('debug', 'Framing detected:', framing);
    }

    if (framing === FRAMING.LSP) {
      lspBuffer = Buffer.concat([lspBuffer, chunk]);
      tryDrainLsp();
    } else {
      ndjsonBuffer += chunk.toString('utf8');
      tryDrainNdjson();
    }
  }

  // --- Wire up STDIN events ---
  process.stdin.setEncoding('utf8'); // para NDJSON; LSP igualmente reinterpreta con Buffer
  process.stdin.on('data', onData);

  process.stdin.on('end', async () => {
    try {
      await server.shutdown?.();
    } finally {
      opts.onClose?.();
    }
  });

  process.stdin.on('error', async (e) => {
    log('error', 'STDIN error:', e?.stack || e);
    try {
      await server.shutdown?.();
    } finally {
      opts.onClose?.();
    }
  });

  // Devolvemos detach para permitir cierre ordenado
  return function detach() {
    try {
      process.stdin.off('data', onData);
    } catch (_) {}
    // No cerramos stdout (lo maneja el host); sólo hacemos shutdown del server
    server.shutdown?.().catch(() => {});
  };
}

export default attachToStdio;
// src/server/manifest.js
// Carga y valida el manifest MCP, aplica defaults y sanity checks.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Defaults razonables si no vienen en el manifest
const DEFAULT_LIMITS = Object.freeze({
  timeout_ms_default: 12_000,
  max_concurrency: 5,
  max_html_size_bytes: 2_000_000,
});

// Esquema mínimo para validar estructura del manifest
const manifestSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    version: { type: 'string', minLength: 1 },
    description: { type: 'string' },
    vendor: { type: 'string' },
    transport: { type: 'string', enum: ['stdio', 'http'] },
    limits: {
      type: 'object',
      properties: {
        timeout_ms_default: { type: 'integer', minimum: 1 },
        max_concurrency: { type: 'integer', minimum: 1 },
        max_html_size_bytes: { type: 'integer', minimum: 1 },
      },
      additionalProperties: true,
    },
    env: {
      type: 'object',
      additionalProperties: { type: 'string' },
    },
    tools: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          description: { type: 'string' },
          input_schema: { type: 'string' },
          output_schema: { type: 'string' },
          input_schema_inline: { type: 'object' },
          output_schema_inline: { type: 'object' },
          timeout_ms: { type: 'integer', minimum: 1 },
          optional: { type: 'boolean' },
        },
        required: ['name'],
        additionalProperties: true,
      },
      minItems: 1,
    },
  },
  required: ['name', 'version', 'tools'],
  additionalProperties: true,
};

/**
 * Carga mcp.manifest.json desde la raíz del proyecto, valida y normaliza.
 * @param {{ root?: string }} opts
 * @returns {Promise<Readonly<any>>}
 */
export async function loadManifest(opts = {}) {
  const projectRoot =
    opts.root || path.resolve(__dirname, '../../..');

  const manifestPath = path.join(projectRoot, 'mcp.manifest.json');

  let raw;
  try {
    raw = await fs.readFile(manifestPath, 'utf8');
  } catch (e) {
    const err = new Error(
      `Manifest not found at ${manifestPath}. Asegúrate de tener mcp.manifest.json.`
    );
    err.cause = e;
    throw err;
  }

  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch (e) {
    const err = new Error(`Invalid JSON in manifest: ${e.message}`);
    err.cause = e;
    throw err;
  }

  // Defaults
  manifest.transport ||= 'stdio';
  manifest.limits = { ...DEFAULT_LIMITS, ...(manifest.limits || {}) };

  // Validación base
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(manifestSchema);
  const ok = validate(manifest);
  if (!ok) {
    const err = new Error('Invalid manifest structure');
    err.data = { errors: validate.errors || [] };
    throw err;
  }

  // Sanity checks de tools
  const seen = new Set();
  for (const tool of manifest.tools) {
    if (seen.has(tool.name)) {
      throw new Error(`Duplicate tool name in manifest: ${tool.name}`);
    }
    seen.add(tool.name);

    // Si no hay input_schema declarado, asumimos objeto vacío (sin params)
    if (!tool.input_schema && !tool.input_schema_inline) {
      tool.input_schema_inline = { type: 'object', additionalProperties: false };
    }
    // output_schema puede omitirse; lo validamos opcionalmente en runtime si existe
  }

  return Object.freeze(manifest);
}

export default loadManifest;
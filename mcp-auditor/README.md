# mcp-auditor

**mcp-auditor** is an **MCP (stdio) server** that exposes the `audit_site` tool to audit a website’s **Privacy Policy**, **Terms of Service**, and **FAQ**. It uses **TF‑IDF + cosine similarity** against bundled **PDF templates**, checks for **required sections**, and runs a **spellcheck**. It’s designed so that **any custom chatbot** can talk to it over MCP—no Claude Desktop required.

> Behavior mirrors the original API: discover candidate URLs via _tails_ (`/privacy`, `/terms`, `/faq`) and home-page `<a href>` links, normalize HTML → text, score 0–100 against the PDFs, and decide pass/fail using per‑type thresholds.

---

## Requirements

- **Node.js ≥ 18.17** (uses `globalThis.fetch`, `AbortController`)
- Read access to the PDFs in `assets/templates/` (bundled with the package)

---

## Install

### Local (from the repo)

```bash
npm i
```

### Global (if publishing to npm)

```bash
npm i -g mcp-auditor
```

---

## Run the MCP server (stdio)

```bash
npm start
```

The binary speaks **JSON‑RPC 2.0** over **STDIN/STDOUT**. It supports **NDJSON** or **LSP‑style** framing; framing is auto‑detected from the first incoming message and mirrored in responses.

---

## Example client (Node)

A minimal client lives in `examples/node-client/`. It spawns the server and calls `audit_site`.

```bash
cd examples/node-client
npm start -- https://example.com
```

Example output:

```json
{
  "overallPass": true,
  "overallScore": 0.86,
  "pages": [
    {
      "type": "privacy",
      "foundAt": "https://example.com/privacy",
      "pass": true,
      "similarity": 91,
      "sectionsFound": ["personal information", "cookies", "..."],
      "sectionsMissing": [],
      "typos": [],
      "typoRate": 0.01,
      "headings": ["Privacy Policy", "Data Security", "..."],
      "rawTextLength": 25432,
      "notes": []
    },
    { "type": "terms", "...": "..." },
    { "type": "faq", "...": "..." }
  ]
}
```

---

## Available tools

### `audit_site` (primary)

**Input**

```json
{ "url": "https://your-site.com" }
```

**Output**

```json
{
  "overallPass": true,
  "overallScore": 0.87,
  "pages": [
    {
      "type": "privacy|terms|faq",
      "foundAt": "https://...",
      "pass": true,
      "similarity": 0,
      "sectionsFound": [],
      "sectionsMissing": [],
      "typos": [],
      "typoRate": 0,
      "headings": [],
      "qaCount": 0,
      "rawTextLength": 0,
      "notes": [],
      "error": "optional"
    }
  ]
}
```

### `get_required_sections` (optional)

- **Input**: `{ "type": "privacy"|"terms"|"faq" }`
- **Output**: `{ "sections": ["..."] }`

### `get_templates_info` (optional)

- **Output**: `{ "templates": [{ "name": "PP.pdf", "path": "...", "size": 12345 }, ...] }`

### `dry_run` (optional, debug)

- **Input**: `{ "url": "https://..." }`
- **Output**: `{ "candidates": ["..."], "headings": ["..."] }`

---

## Environment variables (overrides)

| Var                                       | Description                           | Default                                      |
| ----------------------------------------- | ------------------------------------- | -------------------------------------------- |
| `BEVSTACK_AUDITOR_TIMEOUT_MS`             | Per‑request timeout (ms)              | `12000`                                      |
| `BEVSTACK_AUDITOR_UA`                     | Fetch User‑Agent                      | `BevstackAuditor/1.0 (+https://bevstack.io)` |
| `BEVSTACK_AUDITOR_PASS_THRESHOLD`         | PP/TOS threshold (0–100)              | `80`                                         |
| `BEVSTACK_AUDITOR_FAQ_SOFT_PASS`          | FAQ threshold (0–100)                 | `60`                                         |
| `BEVSTACK_AUDITOR_MAX_HTML_BYTES`         | Max HTML bytes per fetch              | `2000000`                                    |
| `BEVSTACK_AUDITOR_ENABLE_SPELLCHECK`      | Enable spellcheck                     | `true`                                       |
| `BEVSTACK_AUDITOR_SPELL_WHITELIST_APPEND` | Comma‑separated extra whitelist terms | `""`                                         |
| `BEVSTACK_AUDITOR_TAILS_JSON`             | JSON to customize tails per type      | see `config/defaults.js`                     |
| `BEVSTACK_AUDITOR_REQUIRED_SECTIONS_JSON` | JSON to customize required sections   | see `config/defaults.js`                     |

---

## How to integrate with your chatbot

1. **Spawn** the `mcp-auditor` binary (or `node ./bin/mcp-auditor.js`) with stdio open.
2. Send JSON‑RPC messages (NDJSON or LSP‑style), e.g.
   - `{"jsonrpc":"2.0","id":1,"method":"tools/list"}`
   - `{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"audit_site","arguments":{"url":"https://..."}}}`
3. Read the `result` and present the report to your user.

> If your bot already has a “tool router,” just register `audit_site` with the same name and forward the input.

---

## Assets

The PDF templates live under `assets/templates/`:

- `PP.pdf` (Privacy)
- `TOS.pdf` (Terms)
- `CS.pdf` (FAQ / Customer Support)

> Replace these PDFs if you need different markets/languages; the similarity engine adapts automatically.

---

## Troubleshooting

- **No typos are reported**: ensure `assets/dictionaries/en_US.aff` and `en_US.dic` exist. If missing, the spellchecker disables itself safely.
- **“Response too large”**: raise `BEVSTACK_AUDITOR_MAX_HTML_BYTES`.
- **“fetch home failed”**: verify the domain/SSL; consider running `dry_run` to inspect candidates.
- **Framing**: if your client sends messages with `Content-Length` headers, the server replies using **LSP‑style**; otherwise it uses **NDJSON**.

---

## License

MIT — see `LICENSE`.

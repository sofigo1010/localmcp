# localmcp

mcp-auditor/
├─ package.json # "type": "module", bin CLI, exports del server
├─ README.md # Guía de instalación/uso para integradores MCP
├─ LICENSE
├─ .gitignore
├─ .npmignore # Excluir tests/fixtures si publicas a npm
├─ .editorconfig
├─ mcp.manifest.json # Manifest MCP: tools, schemas, vendor, version
│
├─ bin/
│ └─ mcp-auditor.js # CLI que habla MCP por stdio (shebang, sin deps externas)
│
├─ src/
│ ├─ server/
│ │ ├─ createServer.js # Arranque del MCP server: lifecycle + registro de tools
│ │ ├─ stdioTransport.js # Loop stdio (read/write JSON-RPC); robusto a errores
│ │ └─ manifest.js # Carga/valida mcp.manifest.json en runtime
│ │
│ ├─ tools/
│ │ ├─ audit_site.js # Tool principal (1:1 con tu API actual) [oai_citation:0‡route.js](file-service://file-Pb3sifPec1fGb7dSkHZSXi)
│ │ ├─ get_required_sections.js # (opcional) expone checklist por tipo [oai_citation:1‡route.js](file-service://file-Pb3sifPec1fGb7dSkHZSXi)
│ │ ├─ get_templates_info.js # (opcional) paths y tamaños de templates [oai_citation:2‡templateMatcher.js](file-service://file-NkaGUqbvynTtwoaDk1HcUF)
│ │ └─ dry_run.js # (opcional) candidates + headings (debug)
│ │
│ ├─ lib/
│ │ ├─ sections/
│ │ │ ├─ htmlToPlain.js # Normaliza HTML→texto (sin <script/style>) [oai_citation:3‡sections.js](file-service://file-4JPXwFcFLkPa7R5PVNN8K6)
│ │ │ └─ extractHeadings.js # H1/H2/H3 limpios [oai_citation:4‡sections.js](file-service://file-4JPXwFcFLkPa7R5PVNN8K6)
│ │ ├─ match/
│ │ │ ├─ templateMatcher.js # TF-IDF + coseno + carga de PDFs [oai_citation:5‡templateMatcher.js](file-service://file-NkaGUqbvynTtwoaDk1HcUF)
│ │ │ ├─ tokenize.js # Tokenización, TF, vocabulario
│ │ │ └─ similarity.js # Cosine helpers si los separas [oai_citation:6‡templateMatcher.js](file-service://file-NkaGUqbvynTtwoaDk1HcUF)
│ │ ├─ spell/
│ │ │ ├─ spellcheck.js # Nspell + typoRate + whitelist (porta tu lógica)
│ │ │ └─ whitelist.js # Lista de términos permitidos por defecto [oai_citation:7‡route.js](file-service://file-Pb3sifPec1fGb7dSkHZSXi)
│ │ ├─ net/
│ │ │ ├─ fetchWithTimeout.js # Fetch con AbortController + UA [oai_citation:8‡route.js](file-service://file-Pb3sifPec1fGb7dSkHZSXi)
│ │ │ ├─ findCandidateLink.js# Parser de <a href=...> + resolución [oai_citation:9‡route.js](file-service://file-Pb3sifPec1fGb7dSkHZSXi)
│ │ │ └─ resolveCandidates.js# Guess de tails (/privacy, /terms, /faq) [oai_citation:10‡route.js](file-service://file-Pb3sifPec1fGb7dSkHZSXi)
│ │ ├─ audit/
│ │ │ ├─ requiredSections.js # Matriz de secciones por tipo [oai_citation:11‡route.js](file-service://file-Pb3sifPec1fGb7dSkHZSXi)
│ │ │ ├─ thresholds.js # PASS_THRESHOLD, FAQ_SOFT_PASS [oai_citation:12‡route.js](file-service://file-Pb3sifPec1fGb7dSkHZSXi)
│ │ │ └─ scorer.js # Orquesta similarity + pass por página [oai_citation:13‡route.js](file-service://file-Pb3sifPec1fGb7dSkHZSXi)
│ │ └─ util/
│ │ ├─ logger.js # Logs discretos (info/warn/error)
│ │ └─ ensurePaths.js # Helpers de rutas relativas/absolutas
│ │
│ ├─ config/
│ │ ├─ defaults.js # TIMEOUT_MS, UA, thresholds por defecto [oai_citation:14‡route.js](file-service://file-Pb3sifPec1fGb7dSkHZSXi)
│ │ └─ env.js # Lectura de env (permite override)
│ │
│ └─ schemas/
│ ├─ audit_site.input.schema.json # { url: string }
│ └─ audit_site.output.schema.json # Igual al JSON de tu API (pages, score, pass) [oai_citation:15‡route.js](file-service://file-Pb3sifPec1fGb7dSkHZSXi)
│
├─ assets/
│ ├─ templates/
│ │ ├─ PP.pdf # Privacy template (PDF) [oai_citation:16‡PP.pdf](file-service://file-ENqSX5AZ54FwuVyDBB3sxK)
│ │ ├─ TOS.pdf # Terms template (PDF) [oai_citation:17‡TOS.pdf](file-service://file-1iTWjJYQznmARj4HuH7tv4)
│ │ └─ CS.pdf # FAQ/Customer Support template (PDF)
│ └─ dictionaries/ # (opcional) si bundlas diccionario local
│ ├─ en_US.dic
│ └─ en_US.aff
│
├─ examples/
│ └─ node-client/
│ ├─ README.md # Cómo conectar un chatbot propio por stdio
│ ├─ package.json
│ └─ index.js # Cliente MCP mínimo (descubre + llama audit_site)
│
└─ tests/
├─ unit/
│ ├─ htmlToPlain.spec.js
│ ├─ templateMatcher.spec.js
│ └─ spellcheck.spec.js
├─ integration/
│ └─ audit_site.e2e.spec.js # Llama al tool y valida shape de salida
└─ fixtures/
├─ sites/
│ ├─ good-privacy.html
│ ├─ bad-privacy.html
│ ├─ terms.html
│ └─ faq.html
└─ outputs/
└─ golden-audit.json # Golden master igual que tu API [oai_citation:18‡route.js](file-service://file-Pb3sifPec1fGb7dSkHZSXi)

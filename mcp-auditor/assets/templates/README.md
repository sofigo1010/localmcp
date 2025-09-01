**`assets/templates/README.md`**

```md
# PDF Templates

This folder contains the PDF templates used to score content via TF-IDF + cosine similarity.

## Default templates

- `PP.pdf` — Privacy Policy template
- `TOS.pdf` — Terms of Service template
- `CS.pdf` — FAQ / Customer Support template

> These are bundled in the package by default. Replace them if you want to adapt the audit to different markets or languages—the matcher recalculates similarity automatically.

## Notes

- Files are loaded at runtime and cached by `(mtime, size)`.
- If a template is missing or corrupt, the server will throw when attempting to read it. Use the `get_templates_info` tool to verify availability and sizes.
```

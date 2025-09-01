# Dictionaries

This folder holds Hunspell dictionaries used by `nspell` for spellchecking.

## Expected files

- `en_US.aff`
- `en_US.dic`

If these files are **missing**, the spellchecker **disables itself safely** and the audit continues without reporting typos.

## Where to get them

- npm: `dictionary-en` (Hunspell English)
- Alternatively, any compatible Hunspell `en_US` pair (`.aff` + `.dic`) works.

## Custom terms

You can extend the whitelist via env:

```bash
export BEVSTACK_AUDITOR_SPELL_WHITELIST_APPEND="bevstack,shopify,sku,añejo"
```

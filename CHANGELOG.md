# Changelog

All notable changes to Interlinear are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0/).

The pre-Interlinear history of the fork lives in the Git history and is not
reproduced here.

## [0.5.1] - 2026-11-10

First release as **Interlinear**, an independent project based on
quillamio/bilingual-reader (see [NOTICE.md](NOTICE.md)).

### Added

- Five built-in translation backends: Google Translate (default, no API key),
  OpenAI-compatible endpoints, Anthropic Claude, Google Gemini, and Ollama.
- Four display layouts — translation below, side-by-side, translation only,
  source only — with a toolbar button that cycles them.
- Single-paragraph translation: configurable hover delay, a customizable
  keyboard shortcut, Alt-click, and a selection popup; all work before any
  full-document run and reuse its in-flight requests.
- Full-document progress, cancellation, viewport-first queue ordering that
  re-sorts on page turns, short-paragraph batching, concurrency and throttle
  controls, timeouts, and automatic pause after consecutive failures.
- Click-to-retry for failed or paused paragraphs; non-blocking in-reader error
  notices.
- Glossary import/export (CSV/TSV), injected into LLM prompts and enforced as
  post-translation replacement on every backend, including Google.
- Translation cache keyed by backend, language pair, and glossary hash, with a
  cleanup UI.
- Reading-assistant chat sidebar with selected-paragraph, current-page, and
  full-document context scopes.
- Export of the current bilingual view as a searchable PDF attached to the
  Zotero item.
- Translation appearance settings: font size, font presets, picker/swatch
  colors with a follow-theme option, line height, paragraph spacing, theme,
  underline, and a left ribbon.
- Redesigned settings page: section jump navigation, explicit save with
  unsaved-change indicator, and per-backend connection tests that report
  running/success/warning/failure in place.
- Complete English and Simplified Chinese UI via Fluent.
- This repository's own documentation set, NOTICE.md attribution, and CI
  release flow pointing at the new repository.

### Changed

- Project renamed to Interlinear with a new Z/A translation-card icon; the
  reader toolbar icon renders at 16px and its right-click menu exposes every
  action.
- The left ribbon defaults to blue (`#2f6fdf`).
- API keys are documented as plaintext in Zotero preferences and are never
  written to logs or cache keys.
- Settings and translation cache from the original plugin's namespace are
  migrated on first start; the original data is not deleted.

### Removed

- The runtime dependency on Translate for Zotero; a stored `pdftranslate`
  engine value falls back to Google.
- Template example code, sample locale entries, and other upstream scaffolding
  leftovers.

### Fixed

- Side-by-side layout no longer renders the translation one line higher than
  the source; first lines are aligned.
- Hover and shortcut translation work as soon as reading mode is ready, without
  toggling full-document translation first; false triggers from annotation
  overlays, intra-paragraph pointer movement, and window switches are reduced.

[0.5.1]: https://github.com/Muanyan-mjq/zotero-interlinear/releases/tag/v0.5.1
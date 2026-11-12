# Changelog

All notable changes to Interlinear are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0/).

The pre-Interlinear history of the fork lives in the Git history and is not
reproduced here.

## [0.8.0] - 2026-11-12

### Added

- Free translation is now a configurable service chain. Google's free endpoint
  has independent per-`client` quota pools (`it`, `at`, `gtx`,
  `dict-chrome-ex`, `firefox-a`); the default uses the batched
  `translate_a/t` endpoint with one request per batch of paragraphs. When a
  pool is throttled, the router switches to a healthy pool within the same
  batch instead of failing every paragraph.
- Two more free backends: MyMemory (no key, configurable endpoint, optional
  contact address for a higher daily quota) and LibreTranslate (custom server
  URL with an optional API key stored in the OS key store).
- Settings for free services: pin one service or keep auto rotation, choose the
  preferred Google pool, toggle automatic fallback, set custom endpoints, and
  see the active service plus any pools that are cooling down. "Test
  connection" now uses the current form values without saving first.
- Extra Google gateway hosts can be listed (one per line) to add more
  independent quota pools without rebuilding. Each host is treated as its own
  pool and rotates into the chain ahead of MyMemory/LibreTranslate; up to four
  are honored to keep an all-throttled batch from stalling.
- A fully user-defined free endpoint: a GET URL template with `{text}`,
  `{from}`, `{to}` placeholders plus a dotted JSON result path (or empty for a
  plain-text answer). This is the escape hatch when every public free service is
  blocked — a self-hosted LibreTranslate/DeepLX, a corporate gateway, or a
  Google mirror can be wired in without shipping another hard-coded URL.
- End-to-end coverage now pushes concurrency to dozens of articles at once:
  stress tests keep 36 concurrent articles aligned on the healthy free chain and
  keep dozens of articles aligned when only the custom endpoint survives,
  exercising the same alignment and cooldown logic the UI uses.
- Zotero 11 compatibility is now declared: the manifest `strict_max_version` is
  widened to `11.*` so both Zotero 10.x and 11.x can install. Regression guards
  cover the inline-handler removal and the OS key store API changes, and the
  build passes on the Zotero 11 development build.
- Cross-platform source fixes so the plugin behaves outside Windows:
  - File-picker filters use the GTK (Linux) / Cocoa (macOS) compatible glob form
    (`*.csv *.tsv *.txt` and `*`) instead of the Windows-only `;` separator and
    the `*.*` "any file" pattern.
  - macOS Option (Alt) dead-key rewriting of `event.key` is avoided by matching
    shortcuts on the physical `event.code`, so Alt+Letter shortcuts record and
    fire correctly; labels use `⌘`/`⌥` on macOS and stay parseable elsewhere.
  - POSIX file paths containing spaces and CJK characters pass through untouched.

### Known limitations (0.8.0)

- Automated end-to-end and GUI tests run on Windows only; Linux/macOS GUI/e2e
  automation is not configured in CI, so those platforms are validated by
  source review and unit-level simulation rather than full runs.
- On Linux without a Secret Service (libsecret), the OS key store reports
  `available = false`; the plugin's detection of this state is a known risk
  (see `test/platformCompat.node.test.mjs`). Prefer a working Secret Service on
  Linux.

### Fixed

- A whole run no longer leaves every paragraph stuck on a "retry in N seconds"
  message: concurrent workers share one run-wide cooldown, the wait is capped,
  and a run that exhausts every free service shows an actionable paused state.
- Google's `client=gtx` pool being blocked for an IP no longer makes free
  translation unusable; the router rotates pools and falls back to other free
  services automatically.

### Fixed

- Full-document Google translation no longer collapses into per-paragraph
  "translation failed" after a couple of articles. Three interacting causes
  were fixed:
  - Google segments now travel in one multi-`q` request per batch (about 6×
    fewer requests per document), and a batch that the endpoint answers with
    an unexpected shape falls back to per-paragraph requests instead of
    failing.
  - Zotero's HTTP layer retries 429/5xx responses internally for up to an
    hour; the plugin now opts out with `noRetryOnThrottle`/`errorDelayMax: 0`
    and applies its own pacing, backoff and cooldown instead. Throttled
    requests used to sit in that invisible loop until the request timeout
    killed them, which is what surfaced as endless "timeout" errors.
  - A 429 or captcha (`/sorry/`) now pauses the whole run once — with a
    visible cooldown message — retries automatically, and only stops (with a
    clear rate-limit explanation) if throttling persists.
- Model backends (OpenAI-compatible, Claude, Gemini, Ollama) now retry
  429/5xx responses themselves with 1s/2s/4s backoff instead of failing the
    paragraph on the first response.

## [0.7.0] - 2026-11-12

### Security

- API keys are now encrypted with Zotero's OS key store (macOS Keychain,
  Windows DPAPI, Linux libsecret) and stored as `oskv1:` ciphertext instead of
  plaintext. Existing plaintext keys are encrypted in place on first start.
  When the key store is unavailable the key is kept for the session only; saving
  it unencrypted requires an explicit inline confirmation and stays marked as
  unencrypted in the settings page.
- Requests that carry a key no longer follow redirects; a 3xx response is
  reported instead of silently sending the key to another host.
- Plain-HTTP endpoints are limited to loopback and private networks; anything
  else needs a second confirmation that lists the host.
- Errors, debug output and connection-test results are scrubbed of credentials
  before they are shown or logged.

### Changed

- The settings pane boots from a registered script instead of an inline
  `onload` handler, ahead of Zotero's baseline chrome CSP.
- API key fields show a masked value (`••••••••` plus the last four characters),
  hide themselves again eight seconds after being revealed, trim pasted values,
  and have a "Clear key" button with an encrypted/session-only/unencrypted
  status line.

### Added

- `SECURITY.md` with the private vulnerability reporting path and the threat
  model boundaries.

## [0.6.0] - 2026-11-10

### Added

- Live appearance preview in settings: a preview card reuses the reader's own
  translation/display CSS in an isolated shadow root and updates as fields
  change, including the selected layout, theme, colors, font, and spacing.
- Font selector with curated cross-platform stacks (sans, serif, mono) plus a
  validated custom family input, replacing the font preset chips.
- Reusable color controls for text, background, underline, and ribbon: native
  picker, hex input, preset swatches, inherit-from-theme option, reset, and a
  low-contrast warning.
- Settings navigation, a sticky save bar, a global unsaved-changes hint, unit
  suffixes on numeric fields, clearer heading levels, and keyboard focus rings.
- The settings pane is now split into five tabs (translation service, display &
  interaction, appearance, glossary, advanced) with roving keyboard focus and
  arrow-key navigation. The save bar and tab strip stay fixed while scrolling.
- Show/hide buttons for OpenAI-compatible, Claude, and Gemini API keys.
- Font system: detects installed fonts without a dependency by measuring 232
  candidates, offers a searchable grouped list with favorites, a stack builder
  with up to six fallbacks, automatic per-language stacks, weight/style/spacing
  controls, px or relative font size, and automatic RTL direction.
- Color system: a custom HSV picker with alpha, RGB/HSL/HEX inputs, a 5×8
  palette, recent colors, saved colors, copy/paste, nine color roles with
  theme/single/split modes, WCAG contrast checks in both schemes, and a
  separate light/dark preview toggle.
- Text decoration (underline/overline/strikethrough with style, thickness,
  offset, skip-ink and color), paragraph dividers, ribbon position/width/style/
  radius/gap, and block layout (padding, radius, border, indents, alignment,
  max width, opacity, source gap and source dimming).
- Six built-in appearance presets plus named presets, JSON import/export with
  strict validation, and a full appearance reset with undo.
- Translation scope toggles for body, headings, captions, list items and margin
  notes.
- Show/hide and layout-cycle shortcuts with conflict warnings, a hover modifier
  (none/Alt/Ctrl), and auto-translate on open (off/cache-only/always).
- Selection popup and chat pane can follow the translation font/size; popup
  width is configurable. Export can match the reader or use print-specific
  light styling.
- Right-click or double-click a translation block to retranslate it or copy the
  translation/source.

### Changed

- Appearance now persists a versioned `appearance.v2` JSON structure while
  continuing to write the legacy per-field preferences.
- Advanced appearance groups (decoration, divider, ribbon, block layout,
  interface/export) start collapsed so the default page stays short.

- The main reader toolbar button is now a show/hide/pause toggle with
  independent state per reader; layouts are switched by the dedicated
  display-mode button.
- Settings typography and layout: source and target languages occupy separate
  rows, labels no longer wrap, and the appearance section is grouped around
  the live preview.
- Retranslate/cancel/export/settings remain in the toolbar context menu;
  connection tests report running, success, warning, or failure in place.
- Saving an invalid custom font keeps the previous font and reports a warning
  instead of silently falling back to "inherit".
- The custom heading was removed from the pane; Zotero's own pane title is the
  single page heading, with the plugin icon and summary below it.

### Fixed

- Detected fonts no longer carry the "not detected" badge because of a
  case-sensitivity mismatch between the detected set and the filter.
- The auto-translate "always" warning now clears when the mode changes back.
- Renamed the two "scope" sections to Content scope and Page range.
- Chat context now follows the translation scope toggles.
- Settings CSS now reaches every section. All sections are wrapped inside the
  `#interlinear-settings-root` scope again, so cards, fields, color controls,
  status indicators, focus rings, and the sticky bar are actually styled.
- Unsaved-change hints now appear for every settings field, not only fields
  with a dedicated handler.
- The target-language label no longer wraps or clips in a narrow preferences
  window.
- Tab switching now hides sections it does not own while still letting the
  engine-select logic show only the active provider card.

## [0.5.1] - 2026-11-10

First release as **Interlinear**, an independent project. Upstream attribution
is recorded in [NOTICE.md](NOTICE.md); the entries below describe what changed
relative to the upstream plugin.

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
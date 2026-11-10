<p align="center">
  <img src="addon/content/icons/icon96.png" width="96" alt="Interlinear" />
</p>

# Interlinear

Read foreign-language papers in Zotero 10 with a translation under every paragraph.

Interlinear plugs into the desktop PDF reader's reading mode, fetches a translation for each structured paragraph, and renders it right next to the source — so you can keep reading instead of copying text into a translator.

[中文文档](README-zh-CN.md) · [Changelog](CHANGELOG.md) · [Contributing](CONTRIBUTING.md)

## Features

- **Five built-in translation services.** Google Translate works out of the box with no API key. OpenAI-compatible endpoints, Anthropic Claude, Google Gemini, and Ollama are one settings page away. No companion plugin is required.
- **Four layouts.** Translation below the source, side-by-side columns, translation only, or source only. A toolbar button cycles through them; side-by-side keeps the first lines aligned without disturbing Zotero's native highlights.
- **Translate as you read.** Rest the pointer on a paragraph, press your custom shortcut, Alt-click, or select text — each triggers a single-paragraph translation without starting a full-document run.
- **Full-document runs that behave.** Progress and cancel from the toolbar, viewport-first ordering that re-sorts as you page, short-paragraph batching, concurrency and rate limits, timeouts, automatic pause after repeated failures, and click-to-retry on any failed paragraph.
- **Glossary.** Import/export CSV or TSV term lists. Terms are injected into LLM prompts and enforced as a post-translation replacement on every service, including Google.
- **Reading assistant.** A chat sidebar answers questions about the selected paragraph, the current page, or the whole document (LLM services only).
- **Bilingual PDF export.** The current source-plus-translation view is re-typeset into a searchable PDF and attached to the Zotero item.
- **Appearance control.** Font size, font presets, text/background colors via picker and swatches, line height, paragraph spacing, light/dark/auto theme, underline, and a left ribbon (blue by default).
- **Caching.** Translations are cached per service, language pair, and glossary, with a one-click cleanup in settings.
- English and Simplified Chinese UI; errors appear as non-blocking notices inside the reader.

## Install

1. Download the latest `interlinear.xpi` from [Releases](https://github.com/Muanyan-mjq/zotero-interlinear/releases).
2. In Zotero: **Tools → Plugins → gear icon → Install Plugin From File…**, then pick the `.xpi`.
3. Restart Zotero if prompted.

Requires **Zotero 10 (desktop)**. See [Acknowledgements](#acknowledgements) if you are coming from the original plugin.

## Configuration

Open **Edit → Settings → Interlinear**. The page is organized into six sections with a jump menu and an explicit Save button:

- **Service** — pick a backend and fill in its endpoint, model, and API key; choose source and target languages. Each backend has a **Test connection** button that reports success or the actual failure reason in place.
- **Display** — default layout, hover translation (on/off and dwell delay), and the single-paragraph shortcut.
- **Appearance** — everything listed under Features above; colors use a picker plus preset swatches, with a "follow theme" option.
- **Scope** — skip trailing pages (e.g. references), plus speed and reliability knobs: concurrency, request gap, request size limits, timeout, and the consecutive-failure pause threshold.
- **Glossary** — import/export term files.
- **Maintenance** — translation cache usage and cleanup.

> **Privacy note.** Translating sends paragraph text to the service you choose. API keys are stored as plaintext in Zotero preferences; they are never written to logs or cache keys. Do not translate sensitive documents with a service you do not trust.

## Usage

1. Open a PDF in Zotero and switch to **reading mode**.
2. Left-click the Interlinear toolbar icon to translate the document; left-click again to remove the translations. Right-click the icon for the full menu: retranslate, cancel, layouts, export, chat, settings.
3. While reading, hover a paragraph, use your shortcut, Alt-click, or select text to translate just that part. During a full run, these reuse in-flight requests instead of calling the service twice.
4. Use the display-mode button to cycle layouts. Failed or paused paragraphs show a retry affordance — click it to retry just that paragraph.
5. Export the bilingual view as a PDF attachment from the right-click menu, or open the reading assistant to ask questions about the document.

## Known limitations

- Desktop Zotero 10 only; there is no mobile or Zotero 7 support.
- The plugin relies on Zotero's internal reading-mode interfaces, which are not a public API — a Zotero upgrade may break it until adapted.
- Math formulas are not translated; tables are not translated cell-by-cell; figure content is not extracted.
- Scanned PDFs work only as well as Zotero's own text layer.
- Export re-typesets the reading view; it does not overlay translations on the publisher's original PDF pages.
- Default pair is English → Simplified Chinese; other pairs depend on the chosen service and model.

## Roadmap (planned)

Planned, not implemented, no committed timeline:

- Cell-level table translation.
- Adapting to reading-mode interface changes in future Zotero releases.

## Development

```bash
npm install
npm run build        # type-check + package .scaffold/build/interlinear.xpi
npm run lint:check   # ESLint
npm run test:unit    # Node unit tests, no Zotero needed
npm start            # dev server; set ZOTERO_PLUGIN_ZOTERO_BIN_PATH in .env first
```

Integration tests run against a real headless Zotero:

```bash
ZOTERO_PLUGIN_ZOTERO_BIN_PATH="/path/to/zotero" npm run test:review
# or the standard scaffold entry:
ZOTERO_PLUGIN_ZOTERO_BIN_PATH="/path/to/zotero" npm test
```

On Windows the path is typically `C:\Program Files\Zotero\zotero.exe`. CI runs lint, builds on Ubuntu/macOS, and executes the test suite on every push to `main`.

## License

[AGPL-3.0-or-later](LICENSE).

## Acknowledgements

Interlinear is based on [quillamio/bilingual-reader](https://github.com/quillamio/bilingual-reader) (AGPL-3.0-or-later); adapted contributions and template sources are recorded in [NOTICE.md](NOTICE.md). If you used the original Bilingual Reader, uninstall it before installing Interlinear — your old settings and translation cache are copied into Interlinear's own namespace on first start, and the original data is left untouched.
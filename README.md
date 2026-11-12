<p align="center">
  <img src="addon/content/icons/icon96.png" width="96" alt="Interlinear" />
</p>

# Interlinear

Read foreign-language papers in Zotero 10 with a translation under every paragraph.

Interlinear plugs into the desktop PDF reader's reading mode, fetches a translation for each structured paragraph, and renders it right next to the source — so you can keep reading instead of copying text into a translator.

[中文文档](README-zh-CN.md) · [Changelog](CHANGELOG.md) · [Contributing](CONTRIBUTING.md)

## Features

- **Five built-in translation services.** Free Google Translate works out of the box with no API key (rotating several independent quota pools, with MyMemory and self-hosted LibreTranslate as fallbacks). OpenAI-compatible endpoints, Anthropic Claude, Google Gemini, and Ollama are one settings page away. No companion plugin is required.
- **Four layouts.** Translation below the source, side-by-side columns, translation only, or source only. A dedicated display-mode button cycles through them; side-by-side keeps the first lines aligned without disturbing Zotero's native highlights.
- **One toolbar toggle.** The main toolbar button starts a translation run, then shows or hides the result. While a run is in progress, clicking it pauses and hides; clicking again shows the translations and resumes unfinished paragraphs. Each reader keeps its own state.
- **Translate as you read.** Rest the pointer on a paragraph, press your custom shortcut, Alt-click, or select text — each triggers a single-paragraph translation without starting a full-document run.
- **Full-document runs that behave.** Progress and cancel from the toolbar, viewport-first ordering that re-sorts as you page, short-paragraph batching, concurrency and rate limits, timeouts, automatic pause after repeated failures, and click-to-retry on any failed paragraph.
- **Glossary.** Import/export CSV or TSV term lists. Terms are injected into LLM prompts and enforced as a post-translation replacement on every service, including Google.
- **Reading assistant.** A chat sidebar answers questions about the selected paragraph, the current page, or the whole document (LLM services only).
- **Bilingual PDF export.** The current source-plus-translation view is re-typeset into a searchable PDF and attached to the Zotero item.
- **Appearance control with live preview.** Six built-in presets (Default, Eye-friendly paper, Academic serif, High contrast, Optimized dark, Minimal) apply in one click and can be undone. Includes a searchable installed-font list with favorites, a font-stack builder with up to six fallbacks, automatic per-language font stacks, a custom HSV color picker (hue/saturation/opacity/RGB/HSL/HEX), separate light/dark colors, recent and saved colors, text decoration (underline/overline/strikethrough with style/thickness/offset), paragraph dividers, ribbon position/width/style, block layout (padding/radius/border/indent/alignment/max width/opacity/source dimming), named presets, and JSON import/export.
- **Caching.** Translations are cached per service, language pair, and glossary, with a one-click cleanup in settings.
- English and Simplified Chinese UI; errors appear as non-blocking notices inside the reader.

## Screenshots

Real Zotero 10 windows with a real translation run; the images live in `docs/images/inbox/` exactly
as captured. Each pair is the same page and scroll position in the light and dark theme. The demo
paper is *Attention Is All You Need* (Vaswani et al., arXiv:1706.03762); the translations are
machine-generated and shown for illustration only. The paper is distributed under its arXiv licence
(`arXiv non-exclusive distrib 1.0`, not a Creative Commons licence) and appears here solely as
documentation of this plugin's UI.

<table>
  <tr>
    <td width="50%"><img src="docs/images/inbox/reader-inline-light.png" alt="Inline layout, light theme: each source paragraph followed by its Chinese translation" width="100%"></td>
    <td width="50%"><img src="docs/images/inbox/reader-inline-dark.png" alt="Inline layout, dark theme" width="100%"></td>
  </tr>
  <tr>
    <td align="center">Inline — light</td>
    <td align="center">Inline — dark</td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/images/inbox/reader-side-by-side-light.png" alt="Side-by-side layout, light theme: source left, translation right" width="100%"></td>
    <td width="50%"><img src="docs/images/inbox/reader-side-by-side-dark.png" alt="Side-by-side layout, dark theme" width="100%"></td>
  </tr>
  <tr>
    <td align="center">Side-by-side — light</td>
    <td align="center">Side-by-side — dark</td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/images/inbox/reader-split-light.png" alt="Split view, light theme: two panes with independent scrolling" width="100%"></td>
    <td width="50%"><img src="docs/images/inbox/reader-split-dark.png" alt="Split view, dark theme" width="100%"></td>
  </tr>
  <tr>
    <td align="center">Split view — light</td>
    <td align="center">Split view — dark</td>
  </tr>
</table>

## Install

> **Restart Zotero after installing or updating.** The settings pane and the reader toolbar are
> registered at startup; opening the settings before restarting can show an empty Interlinear pane
> (the labels are filled in at runtime). One restart is enough.

1. Download the latest `interlinear.xpi` from [Releases](https://github.com/Muanyan-mjq/zotero-interlinear/releases).
2. In Zotero: **Tools → Plugins → gear icon → Install Plugin From File…**, then pick the `.xpi`.
3. Restart Zotero if prompted.

Requires **Zotero 10 (desktop)**. See [Acknowledgements](#acknowledgements) if you are coming from the original plugin.

## Configuration

Open **Edit → Settings → Interlinear**. The page uses five tabs; the save bar and tab strip stay visible while you scroll, and modified fields show an unsaved-changes hint:

- **Translation service** — pick a backend and fill in its endpoint, model, and API key; choose source and target languages. Each backend has a **Test connection** button that reports running, success, or the actual failure reason in place.
- **Display & interaction** — default layout, hover translation (on/off, dwell delay, and no modifier / hold Alt / hold Ctrl), the single-paragraph shortcut, and optional show/hide and layout-cycle shortcuts with conflict warnings.
- **Appearance** — live preview, six built-in presets and named presets, installed-font detection and stack builder, color picker with per-theme values, text decoration, paragraph dividers, ribbon, block layout, interface-follow and export appearance. Advanced groups start collapsed.
- **Glossary** — import/export term files.
- **Advanced** — translation scope (body/headings/captions/list items/notes), skip trailing pages, speed and reliability knobs, auto-translate on open (off / cache only / always), translation cache usage and cleanup, plus version and project links.

> **Privacy and keys.** Translating sends paragraph text to whichever service you configure — that is unavoidable, so do not translate sensitive documents with a service you do not trust. API keys are a separate story: Interlinear encrypts them with Zotero's OS key store (macOS Keychain, Windows DPAPI, Linux libsecret) and keeps only the `oskv1:` ciphertext in Zotero preferences. Keys are never written to logs, cache keys, debug output or exported appearance files, and they are sent in headers rather than URLs. Requests to non-loopback endpoints must use HTTPS unless you explicitly confirm a plain-HTTP host, and credential-bearing requests never follow redirects. Because the encryption key lives in your OS account, a profile copied to another machine or OS user cannot decrypt the stored key — re-enter it there. On Linux without a Secret Service, Interlinear keeps the key for the current session only by default; saving it unencrypted is possible but must be confirmed in the settings page and is then marked as unencrypted. Keys stored as plaintext by 0.6.0 and earlier are encrypted in place on first start, and the plaintext form stays readable until you save the key again.


### Free translation services (no API key)

Under **Services → Google** you can pick a specific service or keep **Auto
rotate** (default), which tries Google's `it`, `at`, `gtx`, `dict-chrome-ex`
and `firefox-a` quota pools, then MyMemory and a configured LibreTranslate
instance. A throttled pool is skipped within the same batch instead of failing
the paragraph. You can also choose the preferred pool, toggle automatic
fallback, set custom endpoints, and see which service is active or cooling
down. "Test connection" uses the current form values without saving first.

The default `translate_a/t` endpoint carries several paragraphs per request
(about 6× fewer requests than per-paragraph calls) and is paced to one request
per second. Free endpoints throttle by IP, so very large runs may still enter a
cooldown: the run pauses with a countdown and resumes automatically instead of
marking every paragraph as failed. Translated paragraphs are cached. For
consistently large workloads, use a model backend instead.

> **Privacy:** MyMemory adds submitted text to its public translation memory.
> Do not use it for sensitive documents.

### Network and proxy

The default Google endpoint needs a working connection to `translate.googleapis.com`; the MyMemory and LibreTranslate fallbacks need their own endpoints reachable. Interlinear sends every request through Zotero's own HTTP layer (`Zotero.HTTP.request`), so it uses whatever proxy Zotero uses — there is no separate proxy setting in the plugin, and it cannot bypass Zotero's proxy configuration. Whether Zotero itself follows the system proxy depends on Zotero's network preferences and your OS settings (*not independently verified here*).

If "Test connection" fails: check that your system proxy or TUN mode is running, try another translation backend (OpenAI-compatible, Claude, Gemini or a local Ollama), and only then consider a mirror address you trust. Failure messages now say which of these is likely — timeout, DNS, refused/reset connection, HTTP status, rate limiting, redirect, or unparsable response.

## Usage

1. Open a PDF in Zotero and switch to **reading mode**.
2. Left-click the Interlinear toolbar icon to start a full-document run. Once translations exist, the same button hides them to show the original, and shows them again; if a run is in progress the first click pauses it, and a paused run resumes when translations are shown again. Right-click the icon for retranslate, cancel, export, and settings.
3. The display-mode button next to it cycles the four layouts. Failed or paused paragraphs show a retry affordance — click it to retry just that paragraph.
4. While reading, hover a paragraph, use your shortcut, Alt-click, or select text to translate just that part. During a full run, these reuse in-flight requests instead of calling the service twice.
5. Open the reading assistant from the reader sidebar to ask questions about the selection, the current page, or the whole document; export the bilingual view as a PDF attachment from the toolbar menu.

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
npm run test:gui     # capture real preference-window screenshots into docs/dev/screenshots
npm run test:e2e     # provider e2e: mock protocols by default
npm start            # dev server; set ZOTERO_PLUGIN_ZOTERO_BIN_PATH in .env first
```

Integration tests run against a real headless Zotero:

```bash
ZOTERO_PLUGIN_ZOTERO_BIN_PATH="/path/to/zotero" npm run test:review
# or the standard scaffold entry:
ZOTERO_PLUGIN_ZOTERO_BIN_PATH="/path/to/zotero" npm test
```

`npm run test:e2e` also covers a real local Ollama model and a real Google
request through a local proxy when the matching environment variables are set:

```bash
INTERLINEAR_TEST_OLLAMA_MODEL=qwen2.5:7b INTERLINEAR_TEST_GOOGLE_PROXY_PORT=7897 \
ZOTERO_PLUGIN_ZOTERO_BIN_PATH="/path/to/zotero" npm run test:e2e
```

On Windows the path is typically `C:\Program Files\Zotero\zotero.exe`. CI runs lint, builds on Ubuntu/macOS, and executes the test suite on every push to `main`.

## License

[AGPL-3.0-or-later](LICENSE).

## Acknowledgements

Interlinear is based on [quillamio/bilingual-reader](https://github.com/quillamio/bilingual-reader) (AGPL-3.0-or-later); adapted contributions and template sources are recorded in [NOTICE.md](NOTICE.md). If you used the original Bilingual Reader, uninstall it before installing Interlinear — your old settings and translation cache are copied into Interlinear's own namespace on first start, and the original data is left untouched.
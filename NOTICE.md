# NOTICE

Interlinear is maintained by Muanyan-mjq and licensed under
**AGPL-3.0-or-later** (see `LICENSE`).

## Upstream project

This project is based on [quillamio/bilingual-reader](https://github.com/quillamio/bilingual-reader)
(AGPL-3.0-or-later) by quillamio and contributors. The original copyright
headers, the LICENSE file, and the Git history are preserved. On first start,
Interlinear migrates preferences and translation cache from the original
plugin's namespace (`extensions.zotero.bilingualreader`) into its own
(`extensions.zotero.interlinear`); the original data is not deleted.

This repository is an independent project, not a GitHub fork of the upstream
repository.

## Adapted contributions from upstream pull requests

- **PR #20 by daxiaxiong88**
  ([quillamio/bilingual-reader#20](https://github.com/quillamio/bilingual-reader/pull/20),
  AGPL-3.0-or-later): the OpenAI-compatible provider approach is adapted in
  `src/providers/openai.ts` and `src/providers/openaiProtocol.ts`. Attribution
  is also kept in the file headers.
- **PR #19**
  ([quillamio/bilingual-reader#19](https://github.com/quillamio/bilingual-reader/pull/19),
  AGPL-3.0-or-later): the paragraph-marker rules that keep batched
  translations aligned originate here. The original biomedical prompt was
  replaced by a domain-neutral prompt in `src/providers/prompts.ts`.

## Development template

The bootstrap and build setup derive from
[zotero-plugin-template](https://github.com/windingwind/zotero-plugin-template)
by windingwind and contributors, and from the Zotero team's
[Make It Red](https://github.com/zotero/make-it-red) example (AGPL-3.0-or-later
compatible licensing; see file headers). A reference-only copy of the
template's reader item-pane section example is kept at
`docs/reference/itempane-section-example.ts`.

## Icon

The Interlinear icon (red Z and A/文 translation card) was provided by this
project's author. All sizes under `addon/content/icons/` are locally rescaled
from `assets/zotero-translation-icon.png`; no external network resources are used at
runtime.
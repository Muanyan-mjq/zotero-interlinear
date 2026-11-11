# Contributing to Interlinear

Thanks for your interest in improving Interlinear!

## Build and test

```bash
npm install
npm run build        # type-check + package the xpi
npm run lint:check   # must pass before submitting
npm run test:unit    # Node unit tests, no Zotero required
```

Integration tests need a desktop Zotero 10 installation:

```bash
ZOTERO_PLUGIN_ZOTERO_BIN_PATH="/path/to/zotero" npm run test:review
ZOTERO_PLUGIN_ZOTERO_BIN_PATH="/path/to/zotero" npm run test:gui   # regenerates docs screenshots
ZOTERO_PLUGIN_ZOTERO_BIN_PATH="/path/to/zotero" npm run test:e2e   # mock provider protocols
```

The e2e harness can additionally hit a real local Ollama model and a real
Google endpoint through a local proxy; see the environment variables in the
README's Development section.

For interactive development, copy `.env.example` to `.env`, set your Zotero
binary path, and run `npm start`.

## Submitting changes

1. Fork the repository and create a topic branch.
2. Keep changes focused; match the existing code style (ESLint + Prettier).
3. Make sure `npm run build`, `npm run lint:check`, and `npm run test:unit`
   pass; run the integration tests when you touch reader behavior.
4. Open a pull request describing the motivation and the verification you ran.

## Licensing

Interlinear is licensed under **AGPL-3.0-or-later**. By submitting a
contribution, you agree that your code is distributed under the same license.
Please preserve existing copyright and attribution headers, and record any
adapted third-party code in [NOTICE.md](NOTICE.md).
# Security policy

## Reporting a vulnerability

Please **do not** open a public issue for a security problem.

Use GitHub's private vulnerability reporting for this repository:

1. Open <https://github.com/Muanyan-mjq/zotero-interlinear/security/advisories/new>.
2. Describe the issue, the affected version (Tools → Plugins → Interlinear), your
   Zotero version and operating system, and the steps to reproduce it.
3. If you can, include a proof of concept that does not contain real credentials
   or personal library data.

You should get an acknowledgement within a few days. Anything that involves
credential handling, request targets, or data leaving the machine is treated as
urgent.

## Supported versions

Only the latest published release receives security fixes. The plugin targets
Zotero 10 (desktop); Zotero 11 compatibility is tracked but not yet declared.

## What this plugin does with your data

- **Paragraph text** is sent to the translation or chat service you configure.
  That is the core function, not a bug; do not translate documents you would not
  send to that provider.
- **API keys** are encrypted with Zotero's OS key store (macOS Keychain, Windows
  DPAPI, Linux libsecret) and stored as `oskv1:` ciphertext in Zotero
  preferences. They are not written to logs, cache keys, debug output or exported
  appearance files, and they travel in request headers, not URLs.
- **Requests that carry a key never follow redirects**, and plain-HTTP endpoints
  are only accepted for loopback and private networks unless you explicitly
  confirm one.
- **Translations are cached locally** in Zotero preferences, keyed by service
  configuration and language pair. No library metadata is uploaded anywhere else.

## Known limitations (not vulnerabilities)

- Keys are bound to your OS user account. Copying a profile to another machine or
  another OS user makes the stored ciphertext undecryptable; the plugin then asks
  you to re-enter the key.
- On Linux the key store needs a Secret Service (libsecret). Without one, keys
  are kept for the current session only unless you explicitly choose an
  unencrypted save, which the settings page marks as unencrypted.
- Zotero plugins run with full chrome privileges and no sandbox. Any other
  installed plugin can read the same preferences; that is a property of the
  Zotero plugin model, not something this plugin can prevent.
- The plugin talks to Zotero's internal reading-mode interfaces. A Zotero update
  can break functionality (correctness), which is handled as a normal bug.
- API keys you paste into a public issue or a forum post are your responsibility;
  the plugin cannot redact text you send elsewhere.

## Out of scope

- Vulnerabilities in Zotero itself, in the translation providers, or in the
  operating system key store — report those upstream.
- Missing hardening that requires a Zotero API that does not exist (for example
  sandboxing, or per-plugin secret storage).
- Denial of service through intentionally huge documents or hostile provider
  responses.

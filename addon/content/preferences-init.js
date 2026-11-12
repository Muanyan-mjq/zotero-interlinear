/*
 * Interlinear preference-pane bootstrap.
 *
 * Zotero loads scripts registered through
 * `Zotero.PreferencePanes.register({ scripts: [...] })` with
 * `Services.scriptloader.loadSubScript(uri, scope)`, where `scope` is a
 * `Cu.Sandbox` whose prototype is the preferences window. That is why `window`
 * and `document` below resolve to the real preferences window even though this
 * file is not a document script.
 *
 * Unlike the inline `onload` attribute this replaces, the script runs *before*
 * Zotero parses and inserts the pane markup (see `_loadPane()` in
 * chrome/content/zotero/preferences/preferences.js), so there is no load event
 * to listen for: we wait for the root element to show up instead.
 *
 * The inline handler was removed because Zotero plans to stop disabling the
 * baseline chrome CSP (`script-src chrome: resource: moz-src:`), which blocks
 * inline scripts and inline event handlers.
 */
(function () {
  "use strict";

  const ROOT_ID = "interlinear-settings-root";
  const TIMEOUT_MS = 15000;
  const INTERVAL_MS = 50;

  function findRoot(win) {
    try {
      return win.document ? win.document.getElementById(ROOT_ID) : null;
    } catch (error) {
      // The window may already be closing while the pane is being torn down.
      return null;
    }
  }

  function start(win) {
    const instance = Zotero.__addonInstance__;
    if (!instance || !instance.hooks || typeof instance.hooks.onPrefsEvent !== "function") {
      Zotero.debug("Interlinear: plugin instance is not available for the preferences pane", 1);
      return;
    }
    try {
      Promise.resolve(instance.hooks.onPrefsEvent("load", { window: win })).catch((error) => {
        Zotero.logError(error);
      });
    } catch (error) {
      Zotero.logError(error);
    }
  }

  function waitForRoot(win, startedAt) {
    if (findRoot(win)) {
      start(win);
      return;
    }
    if (Date.now() - startedAt > TIMEOUT_MS) {
      Zotero.debug("Interlinear: preferences root element never appeared", 1);
      return;
    }
    win.setTimeout(() => waitForRoot(win, startedAt), INTERVAL_MS);
  }

  waitForRoot(window, Date.now());
})();

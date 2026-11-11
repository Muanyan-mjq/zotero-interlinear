import { initLocale } from "./utils/locale";
import { createZToolkit } from "./utils/ztoolkit";
import { registerReaderToolbar, unregisterReaderToolbar } from "./readerToolbar";
import { registerChatPane, unregisterChatPane } from "./chatPane";
import { registerPrefsScripts } from "./modules/preferenceScript";
import { migrateLegacyPreferences } from "./settings";
import { flushTranslationCacheIndex } from "./translationCache";
import { cleanupAllReadingLayouts } from "./readingLayout";
import { logError } from "./utils/log";

async function registerPreferencesPane(): Promise<void> {
  await Zotero.PreferencePanes.register({
    pluginID: addon.data.config.addonID,
    id: "interlinear-preferences",
    src: "content/preferences.xhtml",
    // Zotero's baseline chrome CSP will block inline event handlers, so the
    // pane boots from a registered script instead of an `onload` attribute.
    scripts: ["content/preferences-init.js"],
    stylesheets: ["content/preferences.css"],
    label: "Interlinear",
  });
}

function installPreferencesBrand(win: Window): void {
  const doc = win.document;
  const slot = doc.getElementById("interlinear-brand");
  if (!slot || doc.getElementById("interlinear-brand-icon")) return;

  const image = doc.createElementNS("http://www.w3.org/1999/xhtml", "img") as HTMLImageElement;
  image.id = "interlinear-brand-icon";
  image.src = `${rootURI}content/icons/icon96.png`;
  image.alt = "Interlinear";
  image.width = 60;
  image.height = 60;
  image.style.cssText = "display:block;width:60px;height:60px;object-fit:contain;";

  slot.appendChild(image);
}

async function onStartup() {
  await Promise.all([Zotero.initializationPromise, Zotero.unlockPromise]);
  if (!addon.data.alive) return;

  // Listen before session restoration mounts reader toolbars. Already-mounted
  // readers are handled by registerReaderToolbar's reconciliation pass.
  registerReaderToolbar();
  await Zotero.uiReadyPromise;
  if (!addon.data.alive) return;

  for (const initialize of [
    migrateLegacyPreferences,
    initLocale,
    registerPreferencesPane,
    registerChatPane,
  ]) {
    if (!addon.data.alive) return;
    try {
      await initialize();
    } catch (error) {
      logError(error as Error);
    }
  }

  await Promise.all(Zotero.getMainWindows().map((win) => onMainWindowLoad(win)));

  if (addon.data.alive) addon.data.initialized = true;
}

async function onMainWindowLoad(_win: _ZoteroTypes.MainWindow): Promise<void> {
  // The toolkit is process-scoped. Replacing it for every main window would
  // orphan registrations owned by the previous instance.
  addon.data.ztoolkit ||= createZToolkit();
}

async function onMainWindowUnload(_win: Window): Promise<void> {
  // Reader event listeners are registered globally and removed on shutdown.
}

function onShutdown(): void {
  unregisterChatPane();
  unregisterReaderToolbar();
  cleanupAllReadingLayouts();
  flushTranslationCacheIndex();
  ztoolkit.unregisterAll();
  addon.data.alive = false;
  // @ts-expect-error - Plugin instance is not typed
  delete Zotero[addon.data.config.addonInstance];
}

async function onPrefsEvent(type: string, data: { [key: string]: any }) {
  if (type === "load" && data.window) {
    const win = data.window as Window;
    installPreferencesBrand(win);
    await registerPrefsScripts(win);
  }
}

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onPrefsEvent,
};

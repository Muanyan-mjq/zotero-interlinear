import { initLocale } from "./utils/locale";
import { createZToolkit } from "./utils/ztoolkit";
import { registerReaderToolbar, unregisterReaderToolbar } from "./readerToolbar";
import { registerChatPane, unregisterChatPane } from "./chatPane";
import { registerPrefsScripts } from "./modules/preferenceScript";
import { migrateLegacyPreferences } from "./settings";
import { flushTranslationCacheIndex } from "./translationCache";
import { cleanupAllReadingLayouts } from "./readingLayout";

async function registerPreferencesPane(): Promise<void> {
  await Zotero.PreferencePanes.register({
    pluginID: addon.data.config.addonID,
    id: "interlinear-preferences",
    src: "content/preferences.xhtml",
    label: "Interlinear",
  });
}

function installPreferencesBrand(win: Window): void {
  const doc = win.document;
  const root = doc.getElementById("interlinear-settings-root");
  if (!root || doc.getElementById("interlinear-brand")) return;

  const brand = doc.createElementNS("http://www.w3.org/1999/xhtml", "div") as HTMLDivElement;
  brand.id = "interlinear-brand";
  brand.style.cssText =
    "display:flex;justify-content:center;align-items:center;margin:4px 0 10px 0;";

  const image = doc.createElementNS("http://www.w3.org/1999/xhtml", "img") as HTMLImageElement;
  image.src = `${rootURI}content/icons/icon96.png`;
  image.alt = "Interlinear";
  image.width = 64;
  image.height = 64;
  image.style.cssText = "display:block;width:64px;height:64px;object-fit:contain;";

  brand.appendChild(image);
  root.prepend(brand);
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
      Zotero.logError(error as Error);
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

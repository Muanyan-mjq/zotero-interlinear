// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — reading assistant sidebar registered as an item pane section.

import { config } from "../package.json";
import {
  cancelBilingualReading,
  configureTranslation,
  getReaderDocument,
  refreshBilingualReading,
  refreshDisplayModes,
  toggleBilingualReading,
} from "./bilingualReader";
import { collectChatContext, type ChatScope } from "./chatContext";
import { appendChatTurn, clearChatSession, getChatSession } from "./chatSession";
import { getChatProvider } from "./providers";
import { buildChatContextBlock } from "./providers/chatPrompts";
import type { ChatTurn } from "./providers/chatProtocol";
import { exportBilingualPDF } from "./readerUI";
import {
  getAppearance,
  getDisplayMode,
  getEngine,
  getTargetLanguage,
  setDisplayMode,
} from "./settings";
import { resolveUiFontFamily } from "./appearance";
import { getLocaleID, getString } from "./utils/locale";

const CHAT_PANE_ID = "interlinear-chat";
const SEND_SELECTOR = "#interlinear-chat-send";
const CLEAR_SELECTOR = "#interlinear-chat-clear";
const INPUT_SELECTOR = "#interlinear-chat-input";
const LOG_SELECTOR = "#interlinear-chat-log";
const STATUS_SELECTOR = "#interlinear-chat-status";
const ACTIONS_TOGGLE_SELECTOR = "#interlinear-actions-toggle";
const ACTIONS_PANEL_SELECTOR = "#interlinear-actions-panel";
const SCOPES: readonly ChatScope[] = ["selection", "page", "document"];

const CHAT_BODY_XHTML = `<html:div id="interlinear-chat-root" style="display:flex;flex-direction:column;gap:8px;padding:4px 0;font-size:13px;">
<html:button id="interlinear-actions-toggle" type="button" aria-expanded="false" style="align-self:flex-start;"></html:button>
<html:div id="interlinear-actions-panel" style="display:none;flex-direction:column;gap:6px;border:1px solid rgba(127,127,127,0.35);border-radius:6px;padding:8px;">
<html:div style="display:flex;flex-wrap:wrap;gap:6px;">
<html:button id="interlinear-action-toggle" type="button"></html:button>
<html:button id="interlinear-action-refresh" type="button"></html:button>
<html:button id="interlinear-action-cancel" type="button"></html:button>
<html:button id="interlinear-action-export" type="button"></html:button>
<html:button id="interlinear-action-settings" type="button"></html:button>
</html:div>
<html:label style="display:flex;align-items:center;gap:6px;">
<html:span id="interlinear-display-label"></html:span>
<html:select id="interlinear-display-mode">
<html:option value="top-bottom"></html:option>
<html:option value="side-by-side"></html:option>
<html:option value="target-only"></html:option>
<html:option value="source-only"></html:option>
</html:select>
</html:label>
</html:div>
<html:p id="interlinear-chat-privacy" style="margin:0;opacity:0.75;line-height:1.4;"></html:p>
<html:label style="display:flex;align-items:center;gap:6px;">
<html:span id="interlinear-chat-scope-label"></html:span>
<html:select id="interlinear-chat-scope">
<html:option value="selection"></html:option>
<html:option value="page"></html:option>
<html:option value="document"></html:option>
</html:select>
</html:label>
<html:div id="interlinear-chat-log" role="log" style="min-height:120px;max-height:360px;overflow:auto;border:1px solid rgba(127,127,127,0.35);border-radius:6px;padding:8px;line-height:1.5;"></html:div>
<html:textarea id="interlinear-chat-input" rows="3" style="width:100%;box-sizing:border-box;resize:vertical;"></html:textarea>
<html:div style="display:flex;gap:6px;">
<html:button id="interlinear-chat-send" type="button"></html:button>
<html:button id="interlinear-chat-clear" type="button"></html:button>
</html:div>
<html:p id="interlinear-chat-status" style="margin:0;min-height:1em;line-height:1.4;"></html:p>
</html:div>`;

let sectionKey: string | null = null;

function getElement<T extends Element>(body: HTMLElement, selector: string): T | null {
  return (body.querySelector(selector) as T | null) || null;
}

function htmlElement<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
): HTMLElementTagNameMap[K] {
  return doc.createElementNS(
    "http://www.w3.org/1999/xhtml",
    tag,
  ) as HTMLElementTagNameMap[K];
}

function findReader(itemID: number): any | null {
  const readers = ((Zotero.Reader as any)?._readers || []) as any[];
  for (const reader of readers) {
    try {
      if (Number(reader?.itemID) === itemID) return reader;
    } catch (_) {
      // Ignore readers whose native object was already destroyed.
    }
  }
  return null;
}

/**
 * The item pane may show the parent regular item while its PDF attachment is
 * the one open in the reader, so fall back to attachment children.
 */
function findReaderForItem(item: Zotero.Item | null): any | null {
  if (!item) return null;
  const direct = findReader(item.id);
  if (direct) return direct;
  if (!item.isRegularItem()) return null;

  let attachmentIDs: number[] = [];
  try {
    attachmentIDs = item.getAttachments();
  } catch (_) {
    return null;
  }
  for (const attachmentID of attachmentIDs) {
    const attachment = Zotero.Items.get(attachmentID);
    if (!attachment?.isPDFAttachment()) continue;
    const reader = findReader(attachmentID);
    if (reader) return reader;
  }
  return null;
}

function currentReader(body: HTMLElement): any | null {
  const itemID = Number(body.dataset.interlinearChatItemId || 0);
  if (!itemID) return null;
  return findReaderForItem(Zotero.Items.get(itemID));
}

function bindActionButton(
  body: HTMLElement,
  selector: string,
  run: (reader: any) => void,
): void {
  getElement<HTMLButtonElement>(body, selector)?.addEventListener("click", () => {
    const reader = currentReader(body);
    if (!reader) return;
    run(reader);
  });
}

function setStatus(body: HTMLElement, text: string): void {
  const status = getElement<HTMLElement>(body, STATUS_SELECTOR);
  if (!status) return;
  status.textContent = text;
  status.hidden = !text;
}

function applyStaticLabels(body: HTMLElement): void {
  const actionsToggle = getElement<HTMLButtonElement>(body, ACTIONS_TOGGLE_SELECTOR);
  if (actionsToggle) actionsToggle.textContent = getString("chat-actions-toggle");

  const actionLabels: Array<[string, any]> = [
    ["#interlinear-action-toggle", "toolbar-menu-toggle"],
    ["#interlinear-action-refresh", "toolbar-menu-refresh"],
    ["#interlinear-action-cancel", "toolbar-menu-cancel"],
    ["#interlinear-action-export", "toolbar-menu-export"],
    ["#interlinear-action-settings", "toolbar-menu-settings"],
  ];
  for (const [selector, key] of actionLabels) {
    const button = getElement<HTMLButtonElement>(body, selector);
    if (button) button.textContent = getString(key);
  }

  const displayLabel = getElement<HTMLElement>(body, "#interlinear-display-label");
  if (displayLabel) displayLabel.textContent = getString("display-mode-title");

  const modeSelect = getElement<HTMLSelectElement>(body, "#interlinear-display-mode");
  if (modeSelect) {
    modeSelect.value = getDisplayMode();
    for (const option of Array.from(modeSelect.options) as HTMLOptionElement[]) {
      option.textContent = getString(`display-mode-${option.value}` as any);
    }
  }

  const privacy = getElement<HTMLElement>(body, "#interlinear-chat-privacy");
  if (privacy) privacy.textContent = getString("chat-privacy");

  const scopeLabel = getElement<HTMLElement>(body, "#interlinear-chat-scope-label");
  if (scopeLabel) scopeLabel.textContent = getString("chat-scope-label");

  const scope = getElement<HTMLSelectElement>(body, "#interlinear-chat-scope");
  const options = Array.from(scope?.options || []) as HTMLOptionElement[];
  for (const option of options) {
    const value = option.value as ChatScope;
    if ((SCOPES as readonly string[]).includes(value)) {
      option.textContent = getString(`chat-scope-${value}` as any);
    }
  }

  const input = getElement<HTMLTextAreaElement>(body, INPUT_SELECTOR);
  if (input) input.placeholder = getString("chat-input-placeholder");

  const send = getElement<HTMLButtonElement>(body, SEND_SELECTOR);
  if (send) send.textContent = getString("chat-send");

  const clear = getElement<HTMLButtonElement>(body, CLEAR_SELECTOR);
  if (clear) clear.textContent = getString("chat-clear");
}

function appendTurnBubble(
  doc: Document,
  log: HTMLElement,
  role: ChatTurn["role"],
  content: string,
): void {
  const wrapper = htmlElement(doc, "div");
  wrapper.style.marginBottom = "8px";

  const label = htmlElement(doc, "div");
  label.style.cssText = "font-weight:600;opacity:0.7;font-size:11px;";
  label.textContent = getString(role === "user" ? "chat-you" : "chat-assistant");

  const text = htmlElement(doc, "div");
  text.style.whiteSpace = "pre-wrap";
  text.textContent = content;

  wrapper.append(label, text);
  log.append(wrapper);
}

function renderSession(body: HTMLElement, itemKey: string, scroll: boolean): void {
  const log = getElement<HTMLElement>(body, LOG_SELECTOR);
  if (!log) return;

  const doc = body.ownerDocument as Document;
  log.textContent = "";
  const turns = getChatSession(itemKey);
  if (!turns.length) {
    const empty = htmlElement(doc, "div");
    empty.style.opacity = "0.65";
    empty.textContent = getString("chat-empty");
    log.append(empty);
    return;
  }

  for (const turn of turns) appendTurnBubble(doc, log, turn.role, turn.content);
  if (scroll) log.scrollTop = log.scrollHeight;
}

function getSelectedScope(body: HTMLElement): ChatScope {
  const select = getElement<HTMLSelectElement>(body, "#interlinear-chat-scope");
  const value = select?.value as ChatScope;
  return (SCOPES as readonly string[]).includes(value) ? value : "page";
}

function clearConversation(body: HTMLElement): void {
  const itemKey = body.dataset.interlinearChatItemKey || "";
  if (!itemKey) return;
  clearChatSession(itemKey);
  renderSession(body, itemKey, false);
  setStatus(body, "");
}

async function sendQuestion(body: HTMLElement): Promise<void> {
  const send = getElement<HTMLButtonElement>(body, SEND_SELECTOR);
  if (send?.disabled) return;

  const itemKey = body.dataset.interlinearChatItemKey || "";
  const itemID = Number(body.dataset.interlinearChatItemId || 0);
  const input = getElement<HTMLTextAreaElement>(body, INPUT_SELECTOR);
  const question = String(input?.value || "").trim();

  if (!itemKey || !itemID) {
    setStatus(body, getString("chat-status-no-reader"));
    return;
  }
  if (!question) {
    setStatus(body, getString("chat-status-empty-question"));
    return;
  }

  const provider = getChatProvider(getEngine());
  if (!provider) {
    setStatus(body, getString("chat-status-unsupported"));
    return;
  }

  const reader = findReaderForItem(Zotero.Items.get(itemID));
  const doc = reader ? getReaderDocument(reader) : null;
  if (!doc) {
    setStatus(body, getString("chat-status-no-reader"));
    return;
  }

  const scope = getSelectedScope(body);
  const context = collectChatContext(doc, scope);
  if (!context) {
    setStatus(
      body,
      getString(scope === "selection" ? "chat-status-no-selection" : "chat-status-no-context"),
    );
    return;
  }

  if (send) send.disabled = true;
  setStatus(body, getString("chat-thinking"));

  const contextBlock = buildChatContextBlock(scope, context.text, context.truncated);
  const turns: ChatTurn[] = [
    ...getChatSession(itemKey),
    { role: "user", content: `${contextBlock}\n\n---\n\n我的问题：${question}` },
  ];

  try {
    const answer = await provider.chat(turns);
    appendChatTurn(itemKey, { role: "user", content: question });
    appendChatTurn(itemKey, { role: "assistant", content: answer });
    if (body.dataset.interlinearChatItemKey !== itemKey) return;
    if (input) input.value = "";
    renderSession(body, itemKey, true);
    setStatus(
      body,
      context.truncated
        ? getString("chat-status-truncated", {
            args: { chars: String(context.text.length) },
          })
        : "",
    );
  } catch (error: any) {
    if (body.dataset.interlinearChatItemKey !== itemKey) return;
    // Keep the question in the input so the user can retry after fixing the
    // backend configuration.
    setStatus(
      body,
      getString("chat-status-error", {
        args: { detail: String(error?.message || error) },
      }),
    );
  } finally {
    if (send) send.disabled = false;
  }
}

function bindBody(body: HTMLElement): void {
  if (body.dataset.interlinearChatBound) return;
  body.dataset.interlinearChatBound = "1";

  const actionsToggle = getElement<HTMLButtonElement>(body, ACTIONS_TOGGLE_SELECTOR);
  const actionsPanel = getElement<HTMLElement>(body, ACTIONS_PANEL_SELECTOR);
  actionsToggle?.addEventListener("click", () => {
    if (!actionsPanel) return;
    const open = actionsPanel.style.display === "none";
    actionsPanel.style.display = open ? "flex" : "none";
    actionsToggle.setAttribute("aria-expanded", String(open));
  });

  bindActionButton(body, "#interlinear-action-toggle", (reader) => {
    void toggleBilingualReading(reader);
  });
  bindActionButton(body, "#interlinear-action-refresh", (reader) => {
    void refreshBilingualReading(reader);
  });
  bindActionButton(body, "#interlinear-action-cancel", (reader) => {
    cancelBilingualReading(reader);
  });
  bindActionButton(body, "#interlinear-action-export", (reader) => {
    void exportBilingualPDF(reader);
  });
  bindActionButton(body, "#interlinear-action-settings", (reader) => {
    configureTranslation(reader);
  });

  const modeSelect = getElement<HTMLSelectElement>(body, "#interlinear-display-mode");
  modeSelect?.addEventListener("change", () => {
    if (!modeSelect.value) return;
    setDisplayMode(modeSelect.value);
    refreshDisplayModes();
  });

  getElement<HTMLButtonElement>(body, SEND_SELECTOR)?.addEventListener("click", () => {
    void sendQuestion(body);
  });
  getElement<HTMLButtonElement>(body, CLEAR_SELECTOR)?.addEventListener("click", () => {
    clearConversation(body);
  });
  getElement<HTMLTextAreaElement>(body, INPUT_SELECTOR)?.addEventListener(
    "keydown",
    (event: KeyboardEvent) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        void sendQuestion(body);
      }
    },
  );
}

function applyChatAppearance(body: HTMLElement): void {
  const root = getElement<HTMLElement>(body, "#interlinear-chat-root");
  if (!root) return;
  const appearance = getAppearance();
  if (!appearance.uiFollowAppearance) {
    root.style.fontSize = "13px";
    root.style.fontFamily = "";
    return;
  }
  const px =
    appearance.fontSizeMode === "em"
      ? Math.round(appearance.fontSize * appearance.fontSizeEm)
      : appearance.fontSize;
  root.style.fontSize = `${px}px`;
  root.style.fontFamily =
    resolveUiFontFamily(appearance, getTargetLanguage()) || "";
}

function renderChatSection(body: HTMLElement, item: Zotero.Item): void {
  const itemKey = String(item.key || item.id || "");
  body.dataset.interlinearChatItemKey = itemKey;
  body.dataset.interlinearChatItemId = String(item.id || 0);
  applyStaticLabels(body);
  applyChatAppearance(body);
  bindBody(body);
  setStatus(body, "");
  renderSession(body, itemKey, false);
}

export function registerChatPane(): void {
  const manager = (Zotero as any).ItemPaneManager;
  if (!manager?.registerSection) return;

  const iconBase = `chrome://${config.addonRef}/content/icons`;
  try {
    const key = manager.registerSection({
      paneID: CHAT_PANE_ID,
      pluginID: addon.data.config.addonID,
      header: {
        l10nID: getLocaleID("item-section-chat-head-text"),
        icon: `${iconBase}/icon16.png`,
      },
      sidenav: {
        l10nID: getLocaleID("item-section-chat-sidenav-tooltip"),
        icon: `${iconBase}/icon20.png`,
      },
      bodyXHTML: CHAT_BODY_XHTML,
      onItemChange: ({ setEnabled, tabType }: any) => {
        setEnabled(tabType === "reader");
        return true;
      },
      onRender: ({ body, item, tabType }: any) => {
        if (tabType !== "reader" || !item) return;
        renderChatSection(body as HTMLElement, item as Zotero.Item);
      },
    });
    sectionKey = typeof key === "string" ? key : null;
  } catch (error) {
    Zotero.logError(error as Error);
  }
}

export function unregisterChatPane(): void {
  const manager = (Zotero as any).ItemPaneManager;
  if (sectionKey && manager?.unregisterSection) {
    try {
      manager.unregisterSection(sectionKey);
    } catch (error) {
      Zotero.logError(error as Error);
    }
  }
  sectionKey = null;
}

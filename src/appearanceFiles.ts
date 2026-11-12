// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — appearance JSON import/export.
//
// Version-sensitive Zotero APIs are kept in one module, mirroring glossaryFiles:
// ztoolkit.FilePicker (Zotero 7–10 plugin toolkit) and
// Zotero.File.getContentsAsync / putContentsAsync.

// nsIFilePicker.appendFilter takes a space-separated glob list; "*" (not the
// Windows-only "*.*") is the cross-platform "any file" pattern honoured by the
// GTK (Linux) and Cocoa (macOS) backends.
const APPEARANCE_FILE_FILTERS: Array<[string, string]> = [
  ["Interlinear appearance JSON (*.json)", "*.json"],
  ["Any file", "*"],
];

export async function pickAppearanceFile(
  mode: "open" | "save",
  title: string,
): Promise<string | false> {
  return await new ztoolkit.FilePicker(
    title,
    mode,
    APPEARANCE_FILE_FILTERS,
    mode === "save" ? "interlinear-appearance.json" : "",
  ).open();
}

export async function readAppearanceFile(path: string): Promise<string> {
  const contents = await Zotero.File.getContentsAsync(path, "utf-8");
  if (typeof contents === "string") return contents;
  return new TextDecoder("utf-8").decode(contents as Uint8Array);
}

export async function writeAppearanceFile(path: string, text: string): Promise<void> {
  await Zotero.File.putContentsAsync(path, text, "utf-8");
}

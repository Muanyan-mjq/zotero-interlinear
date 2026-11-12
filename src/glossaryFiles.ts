// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — glossary file import/export.
//
// Version-sensitive Zotero APIs:
// - ztoolkit.FilePicker wraps nsIFilePicker and has been available in the
//   Zotero 7–10 plugin toolkit. It returns the selected path or false.
// - Zotero.File.getContentsAsync / putContentsAsync exist in Zotero 7+.
// Keep both calls in this module so a future Zotero API change has one fix site.

// nsIFilePicker.appendFilter takes a space-separated glob list; the Windows-only
// ";" separator and the "*.*" "any file" pattern are not honoured by the GTK
// (Linux) and Cocoa (macOS) backends, so we use the cross-platform form here.
const GLOSSARY_FILE_FILTERS: Array<[string, string]> = [
  ["Glossary CSV/TSV (*.csv, *.tsv, *.txt)", "*.csv *.tsv *.txt"],
  ["Any file", "*"],
];

export async function pickGlossaryFile(
  mode: "open" | "save",
  title: string,
): Promise<string | false> {
  return await new ztoolkit.FilePicker(
    title,
    mode,
    GLOSSARY_FILE_FILTERS,
    mode === "save" ? "glossary.csv" : "",
  ).open();
}

export async function readGlossaryFile(path: string): Promise<string> {
  const contents = await Zotero.File.getContentsAsync(path, "utf-8");
  if (typeof contents === "string") {
    return contents;
  }
  return new TextDecoder("utf-8").decode(contents as Uint8Array);
}

export async function writeGlossaryFile(path: string, text: string): Promise<void> {
  await Zotero.File.putContentsAsync(path, text, "utf-8");
}

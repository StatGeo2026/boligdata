// Bundled once with esbuild into site/vendor/editor.js (see site/README.md).
import { EditorView, basicSetup } from "codemirror";
import { keymap } from "@codemirror/view";
import { EditorState, Prec } from "@codemirror/state";
import { StreamLanguage, indentUnit } from "@codemirror/language";
import { indentWithTab } from "@codemirror/commands";
import { r } from "@codemirror/legacy-modes/mode/r";

export function createEditor(parent, doc, onRun) {
  const runKeys = Prec.highest(keymap.of([
    { key: "Mod-Enter", run: () => { onRun(); return true; } },
    { key: "Shift-Enter", run: () => { onRun(); return true; } },
  ]));
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        runKeys, basicSetup, keymap.of([indentWithTab]),
        indentUnit.of("  "), StreamLanguage.define(r),
        EditorView.lineWrapping,
      ],
    }),
  });
  return {
    view,
    get: () => view.state.doc.toString(),
    set: (text) => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } }),
    focus: () => view.focus(),
    insert: (text) => {
      const { from, to } = view.state.selection.main;
      view.dispatch({ changes: { from, to, insert: text },
                      selection: { anchor: from + text.length } });
      view.focus();
    },
  };
}

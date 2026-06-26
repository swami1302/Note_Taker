"use client";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import type { Block, PartialBlock } from "@blocknote/core";
import { en } from "@blocknote/core/locales";
import { useTheme } from "next-themes";

type NoteEditorProps = {
  initialContent?: PartialBlock[];
  editable: boolean;
  onChange?: (document: Block[]) => void;
};

/**
 * Thin WYSIWYG wrapper around BlockNote.
 * Rendered client-only (loaded via `next/dynamic` with ssr:false) because it
 * touches the DOM on mount.
 */
export default function NoteEditor({
  initialContent,
  editable,
  onChange,
}: NoteEditorProps) {
  const { resolvedTheme } = useTheme();

  const editor = useCreateBlockNote({
    // BlockNote rejects an empty array — use `undefined` to get a blank doc.
    initialContent:
      initialContent && initialContent.length > 0 ? initialContent : undefined,
    // Replace BlockNote's default "Enter text or type '/' for commands"
    // placeholder with a plain, unmistakable hint.
    dictionary: {
      ...en,
      placeholders: {
        ...en.placeholders,
        default: "Start writing…",
      },
    },
  });

  return (
    <BlockNoteView
      editor={editor}
      editable={editable}
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      onChange={() => onChange?.(editor.document)}
    />
  );
}

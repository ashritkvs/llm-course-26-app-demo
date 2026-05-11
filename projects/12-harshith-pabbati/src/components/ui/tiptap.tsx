import React from 'react';
import {
  CodeIcon,
  FontBoldIcon,
  FontItalicIcon,
  ListBulletIcon,
  ResetIcon,
  StrikethroughIcon,
} from '@radix-ui/react-icons';
import { Editor, EditorContent, useEditorState } from '@tiptap/react';

import { Toggle } from '@/components/ui/toggle';

interface Props {
  editor: Editor | null;
}

export const Tiptap = ({ editor }: Props) => {
  const editorState = useEditorState({
    editor,
    selector: (ctx) => {
      if (!ctx.editor) {
        return { isEmpty: true, charCount: 0, headingLevel: '0' };
      }
      return {
        isEmpty: ctx.editor.isEmpty,
        charCount: ctx.editor.getText().length,
        headingLevel: ctx.editor.isActive('heading', { level: 1 })
          ? '1'
          : ctx.editor.isActive('heading', { level: 2 })
            ? '2'
            : ctx.editor.isActive('heading', { level: 3 })
              ? '3'
              : '0',
      };
    },
  });

  const isEmpty = editorState?.isEmpty ?? true;
  const charCount = editorState?.charCount ?? 0;
  const headingLevel = editorState?.headingLevel ?? '0';

  const handleHeadingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const level = parseInt(e.target.value, 10);
    if (level === 0) {
      editor?.chain().focus().setParagraph().run();
    } else {
      editor
        ?.chain()
        .focus()
        .setHeading({ level: level as 1 | 2 | 3 })
        .run();
    }
  };

  return (
    <div className="relative mt-4">
      <div className="flex items-center justify-between border border-[#FF4500]/30 bg-background p-1">
        <div className="flex items-center justify-center gap-1">
          <select
            value={headingLevel}
            onChange={handleHeadingChange}
            className="h-9 bg-background px-2 text-sm text-foreground hover:bg-muted focus:outline-none"
            aria-label="Text style"
          >
            <option value="0">Normal</option>
            <option value="1">H1</option>
            <option value="2">H2</option>
            <option value="3">H3</option>
          </select>
          <Toggle
            pressed={editor?.isActive('bold')}
            onPressedChange={() => editor?.chain().focus().toggleBold().run()}
            aria-label="Bold"
          >
            <FontBoldIcon className="size-4" />
          </Toggle>
          <Toggle
            pressed={editor?.isActive('italic')}
            onPressedChange={() => editor?.chain().focus().toggleItalic().run()}
            aria-label="Italic"
          >
            <FontItalicIcon className="size-4" />
          </Toggle>
          <Toggle
            pressed={editor?.isActive('strike')}
            onPressedChange={() => editor?.chain().focus().toggleStrike().run()}
            aria-label="Strikethrough"
          >
            <StrikethroughIcon className="size-4" />
          </Toggle>
          <Toggle
            pressed={editor?.isActive('code')}
            onPressedChange={() => editor?.chain().focus().toggleCode().run()}
            aria-label="Inline code"
          >
            <CodeIcon className="size-4" />
          </Toggle>
          <Toggle
            pressed={editor?.isActive('bulletList')}
            onPressedChange={() =>
              editor?.chain().focus().toggleBulletList().run()
            }
            aria-label="Bullet list"
          >
            <ListBulletIcon className="size-4" />
          </Toggle>
          <Toggle
            pressed={editor?.isActive('orderedList')}
            onPressedChange={() =>
              editor?.chain().focus().toggleOrderedList().run()
            }
            aria-label="Ordered list"
          >
            <span className="text-xs font-bold leading-none">1.</span>
          </Toggle>
        </div>
        <div className="flex items-center justify-center">
          <Toggle
            pressed={false}
            onPressedChange={() => editor?.chain().focus().undo().run()}
            aria-label="Undo"
          >
            <ResetIcon className="size-4" />
          </Toggle>
          <Toggle
            pressed={false}
            onPressedChange={() => editor?.chain().focus().redo().run()}
            aria-label="Redo"
          >
            <ResetIcon className="size-4 -scale-x-100" />
          </Toggle>
        </div>
      </div>
      <div className="relative">
        <EditorContent
          className="font-mono border border-[#FF4500]/30 border-t-0 bg-background text-sm text-foreground"
          editor={editor}
        />
        {isEmpty && (
          <p className="text-muted-foreground pointer-events-none absolute left-4 top-4 select-none text-sm">
            Enter your message
          </p>
        )}
      </div>
      <p className="text-muted-foreground mt-1 text-right text-xs">
        {charCount} {charCount === 1 ? 'character' : 'characters'}
      </p>
    </div>
  );
};

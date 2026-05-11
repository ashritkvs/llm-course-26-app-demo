import { useEditor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';

export const useTiptap = (content: string = '') => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: true,
          HTMLAttributes: {
            class: 'list-disc px-4',
          },
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: true,
          HTMLAttributes: {
            class: 'list-decimal px-4',
          },
        },
      }),
    ],
    content,
  });

  return editor;
};

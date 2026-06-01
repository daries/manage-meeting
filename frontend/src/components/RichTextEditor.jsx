import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import { useEffect, useState, useRef } from 'react';
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, Minus, Table as TableIcon,
  Trash2, Plus, ChevronDown
} from 'lucide-react';

const ToolbarBtn = ({ onClick, active, title, children }) => (
  <button
    type="button"
    onMouseDown={e => { e.preventDefault(); onClick(); }}
    title={title}
    className={`p-1.5 rounded transition-colors ${
      active
        ? 'bg-indigo-100 text-indigo-700'
        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
    }`}
  >
    {children}
  </button>
);

function TableMenu({ editor }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const inTable = editor.isActive('table');

  const actions = inTable ? [
    { label: 'Tambah kolom kiri', fn: () => editor.chain().focus().addColumnBefore().run() },
    { label: 'Tambah kolom kanan', fn: () => editor.chain().focus().addColumnAfter().run() },
    { label: 'Hapus kolom', fn: () => editor.chain().focus().deleteColumn().run() },
    null,
    { label: 'Tambah baris atas', fn: () => editor.chain().focus().addRowBefore().run() },
    { label: 'Tambah baris bawah', fn: () => editor.chain().focus().addRowAfter().run() },
    { label: 'Hapus baris', fn: () => editor.chain().focus().deleteRow().run() },
    null,
    { label: 'Hapus tabel', fn: () => editor.chain().focus().deleteTable().run(), danger: true },
  ] : [
    { label: 'Sisipkan tabel 2×2', fn: () => editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run() },
    { label: 'Sisipkan tabel 3×3', fn: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { label: 'Sisipkan tabel 4×4', fn: () => editor.chain().focus().insertTable({ rows: 4, cols: 4, withHeaderRow: true }).run() },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); setOpen(o => !o); }}
        title="Tabel"
        className={`flex items-center gap-0.5 p-1.5 rounded transition-colors ${
          inTable ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
        }`}
      >
        <TableIcon size={14} />
        <ChevronDown size={10} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[180px]">
          {actions.map((action, i) =>
            action === null
              ? <div key={i} className="my-1 border-t border-gray-100" />
              : (
                <button
                  key={action.label}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); action.fn(); setOpen(false); }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${
                    action.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700'
                  }`}
                >
                  {action.label}
                </button>
              )
          )}
        </div>
      )}
    </div>
  );
}

export default function RichTextEditor({ value, onChange, placeholder, rows = 4 }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph', 'tableCell', 'tableHeader'] }),
      Placeholder.configure({ placeholder: placeholder || 'Tulis di sini...' }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value || '',
    onUpdate({ editor }) {
      const html = editor.getHTML();
      onChange(html === '<p></p>' ? '' : html);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const incoming = value || '';
    if (current !== incoming) {
      editor.commands.setContent(incoming, false);
    }
  }, [value, editor]);

  if (!editor) return null;

  const minHeight = `${rows * 1.75}rem`;

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Tebal (Ctrl+B)">
          <Bold size={14} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Miring (Ctrl+I)">
          <Italic size={14} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Garis Bawah (Ctrl+U)">
          <UnderlineIcon size={14} />
        </ToolbarBtn>

        <div className="w-px h-4 bg-gray-300 mx-1" />

        <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Daftar Poin">
          <List size={14} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Daftar Nomor">
          <ListOrdered size={14} />
        </ToolbarBtn>

        <div className="w-px h-4 bg-gray-300 mx-1" />

        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Rata Kiri">
          <AlignLeft size={14} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Rata Tengah">
          <AlignCenter size={14} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Rata Kanan">
          <AlignRight size={14} />
        </ToolbarBtn>

        <div className="w-px h-4 bg-gray-300 mx-1" />

        <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Garis Pemisah">
          <Minus size={14} />
        </ToolbarBtn>

        <div className="w-px h-4 bg-gray-300 mx-1" />

        <TableMenu editor={editor} />
      </div>

      {/* Editor area */}
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none px-3 py-2 text-gray-800 focus:outline-none"
        style={{ minHeight }}
      />
    </div>
  );
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import Table from '@tiptap/extension-table'
import { Button } from '@/components/ui/button'
import { Loader2, Printer, Save, FileText, Bold, Italic, Underline as UnderlineIcon, 
  AlignLeft, AlignCenter, AlignRight, List, ListOrdered, Highlighter, Minus } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  dokumenId: string
  onClose: () => void
}

export function DocumentEditor({ dokumenId, onClose }: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [printing, setPrinting] = useState(false)
  
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: false }),
      Table.configure({ resizable: false }),
    ],
    content: '<p>Memuat dokumen...</p>',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[400px] p-8',
        style: 'font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.6;',
      },
    },
  })
  
  useEffect(() => {
    async function loadHtml() {
      setLoading(true)
      try {
        const res = await fetch('/api/dokumen-operasional/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dokumen_id: dokumenId }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        
        if (editor && data.html) {
          editor.commands.setContent(data.html)
        }
      } catch (e: any) {
        toast.error(e.message)
      } finally {
        setLoading(false)
      }
    }
    if (dokumenId && editor) {
      loadHtml()
    }
  }, [dokumenId, editor])
  
  const handleSave = useCallback(async () => {
    if (!editor) return
    setSaving(true)
    try {
      const html = editor.getHTML()
      const res = await fetch(`/api/dokumen-operasional/save/${dokumenId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html_content: html }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Dokumen tersimpan')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }, [editor, dokumenId])
  
  const handlePrint = useCallback(async () => {
    if (!editor) return
    setPrinting(true)
    
    // Save first
    await handleSave()
    
    // Open print window
    const html = editor.getHTML()
    const printWindow = window.open('', '_blank', 'width=800,height=900')
    if (!printWindow) {
      toast.error('Popup diblokir. Izinkan popup untuk print.')
      setPrinting(false)
      return
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <title>Dokumen — Mitra PLKK</title>
        <style>
          @page { size: A4; margin: 20mm; }
          body { 
            font-family: 'Times New Roman', serif; 
            font-size: 12pt; 
            line-height: 1.6; 
            color: #000;
            margin: 0;
            padding: 0;
          }
          table { border-collapse: collapse; width: 100%; }
          td, th { border: 1px solid #000; padding: 4px 8px; }
          h1, h2, h3 { margin-top: 12px; }
          p { margin: 6px 0; }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        ${html}
      </body>
      </html>
    `)
    printWindow.document.close()
    
    // Wait for render then print
    setTimeout(() => {
      printWindow.focus()
      printWindow.print()
      setPrinting(false)
    }, 500)
  }, [editor, handleSave])
  
  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
  }
  
  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-1 flex-wrap p-2 bg-slate-100 rounded-t-lg border border-slate-200">
        <Button size="sm" variant="ghost" onClick={() => editor?.chain().focus().toggleBold().run()}
          className={editor?.isActive('bold') ? 'bg-slate-300' : ''}>
          <Bold className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => editor?.chain().focus().toggleItalic().run()}
          className={editor?.isActive('italic') ? 'bg-slate-300' : ''}>
          <Italic className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => editor?.chain().focus().toggleUnderline().run()}
          className={editor?.isActive('underline') ? 'bg-slate-300' : ''}>
          <UnderlineIcon className="w-4 h-4" />
        </Button>
        <div className="w-px h-6 bg-slate-300 mx-1" />
        <Button size="sm" variant="ghost" onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
          className={editor?.isActive('heading', { level: 1 }) ? 'bg-slate-300' : ''}>
          <span className="text-xs font-bold">H1</span>
        </Button>
        <Button size="sm" variant="ghost" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          className={editor?.isActive('heading', { level: 2 }) ? 'bg-slate-300' : ''}>
          <span className="text-xs font-bold">H2</span>
        </Button>
        <Button size="sm" variant="ghost" onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
          className={editor?.isActive('heading', { level: 3 }) ? 'bg-slate-300' : ''}>
          <span className="text-xs font-bold">H3</span>
        </Button>
        <div className="w-px h-6 bg-slate-300 mx-1" />
        <Button size="sm" variant="ghost" onClick={() => editor?.chain().focus().setTextAlign('left').run()}
          className={editor?.isActive({ textAlign: 'left' }) ? 'bg-slate-300' : ''}>
          <AlignLeft className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => editor?.chain().focus().setTextAlign('center').run()}
          className={editor?.isActive({ textAlign: 'center' }) ? 'bg-slate-300' : ''}>
          <AlignCenter className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => editor?.chain().focus().setTextAlign('right').run()}
          className={editor?.isActive({ textAlign: 'right' }) ? 'bg-slate-300' : ''}>
          <AlignRight className="w-4 h-4" />
        </Button>
        <div className="w-px h-6 bg-slate-300 mx-1" />
        <Button size="sm" variant="ghost" onClick={() => editor?.chain().focus().toggleBulletList().run()}
          className={editor?.isActive('bulletList') ? 'bg-slate-300' : ''}>
          <List className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          className={editor?.isActive('orderedList') ? 'bg-slate-300' : ''}>
          <ListOrdered className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => editor?.chain().focus().toggleHighlight().run()}
          className={editor?.isActive('highlight') ? 'bg-slate-300' : ''}>
          <Highlighter className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => editor?.chain().focus().setHorizontalRule().run()}>
          <Minus className="w-4 h-4" />
        </Button>
        
        <div className="flex-1" />
        
        <Button size="sm" variant="outline" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
          Simpan
        </Button>
        <Button size="sm" className="bg-blue-700 hover:bg-blue-800" onClick={handlePrint} disabled={printing}>
          {printing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Printer className="w-4 h-4 mr-1" />}
          Print / PDF
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Tutup
        </Button>
      </div>
      
      {/* Editor */}
      <div className="border border-slate-200 rounded-b-lg bg-white min-h-[500px] overflow-y-auto" style={{ maxHeight: '70vh' }}>
        <EditorContent editor={editor} />
      </div>
      
      <p className="text-xs text-slate-500">
        💡 Edit dokumen bebas di sini. Klik "Simpan" untuk menyimpan perubahan, atau "Print / PDF" untuk cetak (tanda tangan basah).
      </p>
    </div>
  )
}

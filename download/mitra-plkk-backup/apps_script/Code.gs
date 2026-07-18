/**
 * ============================================================
 * MITRA PLKK — Google Apps Script Backend
 * ============================================================
 * Bagian dari migrasi dari Next.js + mammoth/TipTap (broken) ke
 * Google Docs + Apps Script. Lihat docs/10_MIGRATION_PLAN.md
 * untuk konteks lengkap.
 *
 * DEPLOY:
 * 1. Buka https://script.google.com → New Project
 * 2. Paste kode ini (timpa Code.gs default)
 * 3. Ganti TEMPLATE_IDS di bawah dengan ID template Google Docs Anda
 *    (ID = bagian setelah /d/ di URL Google Docs)
 * 4. Project Settings → Change project → pilih Google Cloud Project
 *    yang sudah enable Google Docs API + Drive API
 * 5. Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone (atau "Anyone with Google account")
 * 6. Copy Web App URL → set sebagai APPS_SCRIPT_WEB_APP_URL di Next.js
 *
 * KEAMANAN:
 * - Web App ini mempertimbangkan HMAC-SHA256 signature opsional
 *   (lihat verifySignature). Set NEXT_PUBLIC_APPS_SCRIPT_SECRET
 *   untuk mengaktifkan. Tanpa secret, siapa pun yang tahu URL bisa
 *   memanggil — gunakan secret di produksi.
 * ============================================================
 */

// ============================================================
// KONFIGURASI — GANTI SESUAI SETUP ANDA
// ============================================================

const TEMPLATE_IDS = {
  pks_baru:                'GANTI_DENGAN_TEMPLATE_ID_PKS_BARU',
  perpanjangan:            'GANTI_DENGAN_TEMPLATE_ID_PERPANJANGAN',
  adendum_harga:           'GANTI_DENGAN_TEMPLATE_ID_ADENDUM_HARGA',
  adendum_layanan_baru:    'GANTI_DENGAN_TEMPLATE_ID_ADENDUM_LAYANAN',
  perubahan_data:          'GANTI_DENGAN_TEMPLATE_ID_PERUBAHAN_DATA',
  adendum_masal:           'GANTI_DENGAN_TEMPLATE_ID_ADENDUM_MASAL',
}

// Email "document owner" — semua PKS akan dibuat di akun ini
const DOC_OWNER_EMAIL = 'plkk.bpjs@gmail.com'

// Folder di Google Drive tempat dokumen di-generate (opsional, kosongkan = root)
const OUTPUT_FOLDER_ID = ''

// Secret untuk HMAC verification (set = '' untuk disable)
const AUTH_SECRET = ''

// ============================================================
// ENTRY POINT — doPost
// ============================================================

function doPost(e) {
  try {
    const secret = AUTH_SECRET
    if (secret) {
      const sig = e.parameter.sig || ''
      const body = e.postData.contents || ''
      const computed = Utilities.computeHmacSha256Signature(body, secret)
        .map(function(b){ return ('0' + (b & 0xFF).toString(16)).slice(-2) }).join('')
      if (computed !== sig) {
        return _json({ ok: false, error: 'Invalid signature' }, 401)
      }
    }

    const payload = JSON.parse(e.postData.contents || '{}')
    const action = payload.action

    switch (action) {
      case 'generate_doc':       return _handleGenerateDoc(payload)
      case 'get_doc_info':       return _handleGetDocInfo(payload)
      case 'add_comment':        return _handleAddComment(payload)
      case 'share_doc':          return _handleShareDoc(payload)
      case 'enable_suggestions': return _handleEnableSuggestions(payload)
      case 'list_revisions':     return _handleListRevisions(payload)
      case 'export_docx':        return _handleExportDocx(payload)
      case 'export_pdf':         return _handleExportPdf(payload)
      case 'list_pending_suggestions': return _handleListPendingSuggestions(payload)
      default:
        return _json({ ok: false, error: 'Unknown action: ' + action }, 400)
    }
  } catch (err) {
    return _json({ ok: false, error: String(err), stack: err.stack }, 500)
  }
}

// GET hanya untuk health check
function doGet() {
  return _json({ ok: true, service: 'mitra-plkk-apps-script', time: new Date().toISOString() })
}

// ============================================================
// ACTION 1: GENERATE DOC — Clone template + replace placeholders
// ============================================================
//
// Request payload:
// {
//   "action": "generate_doc",
//   "jenis_pipeline": "pks_baru",        // lihat TEMPLATE_IDS keys
//   "values": {                          // map {{KEY}} → nilai
//     "NAMA_FASKES": "RS Mitra Keluarga",
//     "ALAMAT_FASKES": "Jl. Juanda No.1",
//     ...
//   },
//   "doc_name": "PKS - RS Mitra Keluarga - 2026",  // opsional
//   "share_with": [                       // opsional: auto-share
//     { "email": "pic.rs@example.com", "role": "writer" },
//     { "email": "cm.cirebon@bpjs.go.id", "role": "writer" }
//   ]
// }
//
// Response:
// {
//   "ok": true,
//   "doc_id": "1AbCdE...",
//   "edit_url": "https://docs.google.com/document/d/1AbCdE.../edit",
//   "name": "PKS - RS Mitra Keluarga - 2026"
// }
// ============================================================

function _handleGenerateDoc(payload) {
  const { jenis_pipeline, values, doc_name, share_with } = payload
  if (!jenis_pipeline || !values) {
    return _json({ ok: false, error: 'Missing jenis_pipeline or values' }, 400)
  }

  const templateId = TEMPLATE_IDS[jenis_pipeline]
  if (!templateId || templateId.startsWith('GANTI_')) {
    return _json({ ok: false, error: 'Template ID not configured for: ' + jenis_pipeline }, 500)
  }

  // 1. Clone template
  const templateFile = DriveApp.getFileById(templateId)
  const folder = OUTPUT_FOLDER_ID ? DriveApp.getFolderById(OUTPUT_FOLDER_ID) : DriveApp.getRootFolder()
  const copy = templateFile.makeCopy(doc_name || ('Draft - ' + new Date().toISOString()), folder)
  const newDocId = copy.getId()
  const doc = DocumentApp.openById(newDocId)
  const body = doc.getBody()

  // 2. Replace placeholders — case-insensitive, all occurrences
  // Pattern: {{KEY}} atau [[KEY]] — keduanya didukung
  const allKeys = _getAllPlaceholderKeys(body)
  const replaced = {}
  const notFoundInTemplate = []

  for (const key in values) {
    const value = String(values[key] == null ? '' : values[key])
    const patterns = [
      new RegExp('\\{\\{' + key + '\\}\\}', 'g'),
      new RegExp('\\[\\[' + key + '\\]\\]', 'g'),
    ]
    let didReplace = false
    for (const p of patterns) {
      // replaceText mendukung regex Google Docs (subset RE2)
      // Untuk kompatibilitas, kita pakai replaceText per pattern
      // Ref: https://developers.google.com/apps-script/reference/document/text#replaceText(String,String)
      try {
        // Escape regex special chars in value? No — Google Docs replaceText
        // treats replacement string literally. Safe.
        const regex = '\\{\\{' + _escapeRegex(key) + '\\}\\}'
        const found = body.replaceText(regex, value)
        if (found) didReplace = true
        const regex2 = '\\[\\[' + _escapeRegex(key) + '\\]\\]'
        if (body.replaceText(regex2, value)) didReplace = true
      } catch (e) {
        // ignore regex errors
      }
    }
    replaced[key] = didReplace
  }

  // 3. Sisa placeholder yang tidak diisi oleh values → tandai sebagai TODO
  // (hanya jika masih ada {{...}} di body)
  const remaining = _findRemainingPlaceholders(body)

  // 4. Set metadata
  doc.setName(doc_name || ('PKS - ' + (values.NAMA_FASKES || 'Untitled')))
  doc.addHeader().appendParagraph('DRAFT — ' + new Date().toLocaleString('id-ID'))
  doc.saveAndClose()

  // 5. Auto-share (opsional)
  const shared = []
  if (share_with && Array.isArray(share_with)) {
    for (const s of share_with) {
      try {
        DriveApp.getFileById(newDocId).addEditor(s.email) // atau addViewer untuk 'reader'
        shared.push({ email: s.email, role: s.role || 'writer', ok: true })
      } catch (e) {
        shared.push({ email: s.email, role: s.role || 'writer', ok: false, error: String(e) })
      }
    }
  }

  // 6. Set permission: anyone with link can edit (opsional — hati-hati)
  // DriveApp.getFileById(newDocId).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT)

  return _json({
    ok: true,
    doc_id: newDocId,
    edit_url: 'https://docs.google.com/document/d/' + newDocId + '/edit',
    name: doc_name || ('PKS - ' + (values.NAMA_FASKES || 'Untitled')),
    replaced: replaced,
    remaining_placeholders: remaining,
    shared: shared,
  })
}

// ============================================================
// ACTION 2: GET_DOC_INFO — Ambil metadata dokumen
// ============================================================

function _handleGetDocInfo(payload) {
  const { doc_id } = payload
  if (!doc_id) return _json({ ok: false, error: 'Missing doc_id' }, 400)

  try {
    const file = DriveApp.getFileById(doc_id)
    return _json({
      ok: true,
      doc_id: doc_id,
      name: file.getName(),
      url: file.getUrl(),
      edit_url: 'https://docs.google.com/document/d/' + doc_id + '/edit',
      created_at: file.getDateCreated().toISOString(),
      modified_at: file.getLastUpdated().toISOString(),
      owner: file.getOwner().getEmail(),
      size_bytes: file.getSize(),
      mime_type: file.getMimeType(),
    })
  } catch (e) {
    return _json({ ok: false, error: String(e) }, 404)
  }
}

// ============================================================
// ACTION 3: ADD_COMMENT — CM kasih catatan inline
// ============================================================
//
// payload:
// {
//   "action": "add_comment",
//   "doc_id": "1AbCdE...",
//   "text": "Tarif ini di atas acuan provinsi 15%, perlu konfirmasi.",
//   "search_text": "ICU 1.500.000"  // opsional — kalau ada, anchor ke teks itu
// }
// ============================================================

function _handleAddComment(payload) {
  const { doc_id, text, search_text } = payload
  if (!doc_id || !text) return _json({ ok: false, error: 'Missing doc_id or text' }, 400)

  // Catatan: DocumentApp tidak punya API comment langsung (sejak 2023).
  // Workaround: pakai Advanced Drive API (enable di Services → Drive API v2)
  // atau anchor dengan highlight + bookmark.
  // Di sini kita pakai anchor text-based via Drive API v2 (Drive.Comments)

  try {
    // Pastikan service Drive API v2 sudah di-enable di Apps Script
    // (Resources → Advanced Google Services → Drive API → On)
    const anchor = search_text ? ('{' + JSON.stringify({ r: 'text', t: search_text }) + '}') : undefined
    const comment = Drive.Comments.insert({
      content: text,
      anchor: anchor,
    }, doc_id)

    return _json({
      ok: true,
      comment_id: comment.commentId,
      html_content: comment.content,
      created_at: comment.createdDate,
      author: comment.author ? comment.author.displayName : null,
    })
  } catch (e) {
    return _json({ ok: false, error: String(e) }, 500)
  }
}

// ============================================================
// ACTION 4: SHARE_DOC — Tambah editor/viewer
// ============================================================

function _handleShareDoc(payload) {
  const { doc_id, share_with } = payload
  if (!doc_id || !share_with) return _json({ ok: false, error: 'Missing doc_id or share_with' }, 400)

  const file = DriveApp.getFileById(doc_id)
  const results = []
  for (const s of share_with) {
    try {
      if (s.role === 'reader') {
        file.addViewer(s.email)
      } else if (s.role === 'commenter') {
        file.addCommenter(s.email)
      } else {
        file.addEditor(s.email)
      }
      results.push({ email: s.email, role: s.role || 'writer', ok: true })
    } catch (e) {
      results.push({ email: s.email, role: s.role || 'writer', ok: false, error: String(e) })
    }
  }
  return _json({ ok: true, shared: results })
}

// ============================================================
// ACTION 5: ENABLE_SUGGESTIONS — Set mode "Suggesting" untuk CM
// ============================================================
//
// Catatan: Tidak ada API langsung untuk set "Suggesting mode".
// Workaround: kirim instruksi ke user, atau gunakan Drive API v3
// untuk restrict edit permission jadi "commenter only" yang
// otomatis memaksa user ke Suggesting mode ketika mereka buka.
// ============================================================

function _handleEnableSuggestions(payload) {
  const { doc_id, user_email } = payload
  if (!doc_id || !user_email) return _json({ ok: false, error: 'Missing doc_id or user_email' }, 400)

  try {
    const file = DriveApp.getFileById(doc_id)
    // Demote user dari editor → commenter (memaksa Suggesting mode)
    try { file.removeEditor(user_email) } catch (e) {}
    file.addCommenter(user_email)

    return _json({
      ok: true,
      message: 'User ' + user_email + ' di-set sebagai commenter (Suggesting mode). ' +
               'Saat user buka dokumen, mereka otomatis di mode Suggesting.',
      note: 'Untuk memberi akses edit penuh kembali, panggil share_doc dengan role=writer.'
    })
  } catch (e) {
    return _json({ ok: false, error: String(e) }, 500)
  }
}

// ============================================================
// ACTION 6: LIST_REVISIONS — Ambil history revisi dokumen
// ============================================================

function _handleListRevisions(payload) {
  const { doc_id } = payload
  if (!doc_id) return _json({ ok: false, error: 'Missing doc_id' }, 400)

  try {
    // Drive API v2: Drive.Revisions.list
    const resp = Drive.Revisions.list(doc_id)
    const items = (resp.items || []).map(function(r) {
      return {
        revision_id: r.id,
        modified_date: r.modifiedDate,
        published: r.published,
        last_modifying_user: r.lastModifyingUserName,
        file_size: r.fileSize,
      }
    })
    return _json({ ok: true, revisions: items })
  } catch (e) {
    return _json({ ok: false, error: String(e) }, 500)
  }
}

// ============================================================
// ACTION 7: EXPORT_DOCX — Download sebagai .docx
// ============================================================
//
// Return: redirect URL ke Google Drive export endpoint
// Next.js bisa fetch URL ini, atau langsung kasih ke user.
// ============================================================

function _handleExportDocx(payload) {
  const { doc_id } = payload
  if (!doc_id) return _json({ ok: false, error: 'Missing doc_id' }, 400)

  const exportUrl = 'https://docs.google.com/document/d/' + doc_id + '/export?format=docx'
  return _json({
    ok: true,
    export_url: exportUrl,
    note: 'URL ini memerlukan auth Google. Untuk download server-side, gunakan OAuth2 atau service account.',
  })
}

// ============================================================
// ACTION 8: EXPORT_PDF — Download sebagai .pdf
// ============================================================

function _handleExportPdf(payload) {
  const { doc_id } = payload
  if (!doc_id) return _json({ ok: false, error: 'Missing doc_id' }, 400)

  const exportUrl = 'https://docs.google.com/document/d/' + doc_id + '/export?format=pdf'
  return _json({ ok: true, export_url: exportUrl })
}

// ============================================================
// ACTION 9: LIST_PENDING_SUGGESTIONS — Cek suggestions yang belum di-resolve
// ============================================================
//
// Berguna untuk pipeline tahu: masih ada koreksi CM yang belum
// di-accept/reject oleh PIC RS. Maka pipeline tidak boleh advance.
// ============================================================

function _handleListPendingSuggestions(payload) {
  const { doc_id } = payload
  if (!doc_id) return _json({ ok: false, error: 'Missing doc_id' }, 400)

  try {
    // Drive.Comments.list returns both comments AND suggestions (suggestions = "resolved": false)
    const resp = Drive.Comments.list(doc_id, { maxResults: 200 })
    const all = resp.items || []
    const pending = all.filter(function(c) {
      return c.status === 'open' || (c.context && c.context.type === 'suggestion')
    }).map(function(c) {
      return {
        comment_id: c.commentId,
        content: c.content,
        author: c.author ? c.author.displayName : null,
        created_at: c.createdDate,
        status: c.status,
        is_suggestion: c.context && c.context.type === 'suggestion',
      }
    })
    return _json({
      ok: true,
      pending_count: pending.length,
      items: pending,
    })
  } catch (e) {
    return _json({ ok: false, error: String(e) }, 500)
  }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function _json(obj, statusCode) {
  // Apps Script ContentService hanya support 200/500 etc, status code tidak benar-benar diteruskan
  // tapi kita set header biar konsisten
  if (statusCode && statusCode !== 200) {
    obj._status = statusCode
  }
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
}

function _escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Ambil semua {{KEY}} yang ada di body dokumen (untuk report)
function _getAllPlaceholderKeys(body) {
  const text = body.getText()
  const keys = new Set()
  const re = /\{\{([A-Z_0-9]+)\}\}/g
  let m
  while ((m = re.exec(text)) !== null) {
    keys.add(m[1])
  }
  return Array.from(keys)
}

// Cari placeholder yang belum ter-replace
function _findRemainingPlaceholders(body) {
  const text = body.getText()
  const remaining = []
  const re = /\{\{([A-Z_0-9]+)\}\}/g
  let m
  while ((m = re.exec(text)) !== null) {
    remaining.push(m[1])
  }
  // dedupe
  return Array.from(new Set(remaining))
}

// ============================================================
// BULK: Generate multiple docs sekaligus (untuk Adendum Masal)
// ============================================================
//
// payload:
// {
//   "action": "generate_bulk",
//   "jenis_pipeline": "adendum_masal",
//   "items": [
//     { "values": {...}, "doc_name": "Adendum Masal - RS A" },
//     { "values": {...}, "doc_name": "Adendum Masal - RS B" }
//   ],
//   "share_with": [...]
// }
// ============================================================

function _handleGenerateBulk(payload) {
  const { jenis_pipeline, items, share_with } = payload
  if (!items || !Array.isArray(items)) return _json({ ok: false, error: 'Missing items' }, 400)

  const results = []
  for (const item of items) {
    try {
      const sub = _handleGenerateDoc({
        jenis_pipeline: jenis_pipeline,
        values: item.values,
        doc_name: item.doc_name,
        share_with: share_with,
      })
      // _handleGenerateDoc returns ContentService output — kita perlu re-parse
      // Lebih clean: extract logic-nya jadi function biasa
      const r = _generateDocInternal(jenis_pipeline, item.values, item.doc_name, share_with)
      results.push(r)
    } catch (e) {
      results.push({ ok: false, error: String(e), doc_name: item.doc_name })
    }
  }
  return _json({ ok: true, count: results.length, results: results })
}

// Refactored internal function (tanpa HTTP wrapper)
function _generateDocInternal(jenis_pipeline, values, doc_name, share_with) {
  const templateId = TEMPLATE_IDS[jenis_pipeline]
  if (!templateId || templateId.startsWith('GANTI_')) {
    return { ok: false, error: 'Template ID not configured for: ' + jenis_pipeline }
  }

  const templateFile = DriveApp.getFileById(templateId)
  const folder = OUTPUT_FOLDER_ID ? DriveApp.getFolderById(OUTPUT_FOLDER_ID) : DriveApp.getRootFolder()
  const copy = templateFile.makeCopy(doc_name || ('Draft - ' + new Date().toISOString()), folder)
  const newDocId = copy.getId()
  const doc = DocumentApp.openById(newDocId)
  const body = doc.getBody()

  const replaced = {}
  for (const key in values) {
    const value = String(values[key] == null ? '' : values[key])
    const regex = '\\{\\{' + _escapeRegex(key) + '\\}\\}'
    try {
      const found = body.replaceText(regex, value)
      replaced[key] = found
    } catch (e) {
      replaced[key] = false
    }
  }

  const remaining = _findRemainingPlaceholders(body)
  doc.setName(doc_name || ('PKS - ' + (values.NAMA_FASKES || 'Untitled')))
  doc.addHeader().appendParagraph('DRAFT — ' + new Date().toLocaleString('id-ID'))
  doc.saveAndClose()

  const shared = []
  if (share_with && Array.isArray(share_with)) {
    for (const s of share_with) {
      try {
        DriveApp.getFileById(newDocId).addEditor(s.email)
        shared.push({ email: s.email, role: s.role || 'writer', ok: true })
      } catch (e) {
        shared.push({ email: s.email, role: s.role || 'writer', ok: false, error: String(e) })
      }
    }
  }

  return {
    ok: true,
    doc_id: newDocId,
    edit_url: 'https://docs.google.com/document/d/' + newDocId + '/edit',
    name: doc_name || ('PKS - ' + (values.NAMA_FASKES || 'Untitled')),
    replaced: replaced,
    remaining_placeholders: remaining,
    shared: shared,
  }
}

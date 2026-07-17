# 05 — PKS Placeholders (81 placeholder)

> Sumber: `src/lib/pks-placeholders.ts`
> Asal: extract dari `PKS_PLKK_2026_TEMPLATE_BERSIH.docx`

## Format Placeholder

Di template Google Docs (atau .docx sebelum migrasi), placeholder ditulis dalam format `{{NAMA_KEY}}` (uppercase, underscore). Contoh:

```
BERDASARKAN ... Pihak Pertama (BPJS Ketenagakerjaan) dengan Pihak Kedua
({{NAMA_FASKES}}) yang berkedudukan di {{ALAMAT_FASKES}} ...
```

Setelah generate, Apps Script akan replace semua `{{NAMA_FASKES}}` → "RS Mitra Keluarga" dst.

> **Catatan untuk Apps Script:** Function `body.replaceText()` di Google Docs mendukung regex RE2 subset. Pattern `\\{\\{KEY\\}\\}` aman. Replacement string literal (tidak perlu escape `$` atau `\`).

---

## Kategori & Daftar Lengkap

### 1. Identitas Faskes (10 field, auto_clone: true)

| Key | Label | Auto-clone |
|---|---|---|
| `NAMA_FASKES` | Nama Faskes | ✅ |
| `ALAMAT_FASKES` | Alamat Faskes | ✅ |
| `JENIS_FASKES` | Jenis Faskes | ✅ |
| `BENTUK_FASKES` | Bentuk Faskes (Pemda/Swasta dll) | ✅ |
| `NOMOR_AKTA_PENDIRIAN` | Nomor Akta Pendirian | ✅ |
| `TANGGAL_AKTA_PENDIRIAN` | Tanggal Akta Pendirian | ✅ |
| `JENIS_AKTA_PENDIRIAN` | Jenis Akta Pendirian | ✅ |
| `NAMA_PENANDATANGAN_PIHAK_KEDUA` | Nama Penandatangan Pihak Kedua (Faskes) | ✅ |
| `JABATAN_PENANDATANGAN_PIHAK_KEDUA` | Jabatan Penandatangan Pihak Kedua | ✅ |
| `DASAR_KEWENANGAN_PIHAK_KEDUA` | Dasar Kewenangan Pihak Kedua | ✅ |

### 2. Identitas Kantor BPJS (8 field, auto_clone: true)

| Key | Label | Auto-clone |
|---|---|---|
| `NAMA_KANTOR_CABANG` | Nama Kantor Cabang BPJS | ✅ |
| `ALAMAT_KANTOR_CABANG` | Alamat Kantor Cabang BPJS | ✅ |
| `NAMA_KEPALA_KANTOR_CABANG` | Nama Kepala Kantor Cabang | ✅ |
| `TELP_FAX_BPJS` | Telp/Fax BPJS | ✅ |
| `NOMOR_KEP_DIREKSI` | Nomor Kep Direksi | ✅ |
| `JUDUL_KEP_DIREKSI` | Judul Kep Direksi | ✅ |
| `NOMOR_SURAT_KUASA` | Nomor Surat Kuasa | ✅ |
| `TANGGAL_SURAT_KUASA` | Tanggal Surat Kuasa | ✅ |

### 3. Nomor & Tanggal PKS (7 field, auto_clone: FALSE)

| Key | Label | Auto-clone |
|---|---|---|
| `NOMOR_PKS_PIHAK_PERTAMA` | Nomor PKS Pihak Pertama (BPJS) | ❌ |
| `NOMOR_PKS_PIHAK_KEDUA` | Nomor PKS Pihak Kedua (Faskes) | ❌ |
| `HARI_TANDA_TANGAN` | Hari Tanda Tangan | ❌ |
| `TANGGAL_TANDA_TANGAN` | Tanggal Tanda Tangan | ❌ |
| `KOTA_TANDA_TANGAN` | Kota Tanda Tangan | ❌ |
| `TANGGAL_MULAI_PKS` | Tanggal Mulai PKS | ❌ |
| `TANGGAL_BERAKHIR_PKS` | Tanggal Berakhir PKS | ❌ |

### 4. PKS Sebelumnya (4 field, auto_clone: FALSE — diisi saat perpanjangan)

| Key | Label | Auto-clone |
|---|---|---|
| `NOMOR_PKS_SEBELUMNYA_PIHAK_PERTAMA` | Nomor PKS Sebelumnya Pihak Pertama | ❌ |
| `NOMOR_PKS_SEBELUMNYA_PIHAK_KEDUA` | Nomor PKS Sebelumnya Pihak Kedua | ❌ |
| `PERIHAL_PKS_SEBELUMNYA` | Perihal PKS Sebelumnya | ❌ |
| `TANGGAL_BERAKHIR_PKS_SEBELUMNYA` | Tanggal Berakhir PKS Sebelumnya | ❌ |

### 5. Bank (4 field, auto_clone: true)

| Key | Label | Auto-clone |
|---|---|---|
| `NAMA_BANK` | Nama Bank | ✅ |
| `CABANG_BANK` | Cabang Bank | ✅ |
| `NOMOR_REKENING` | Nomor Rekening | ✅ |
| `NAMA_REKENING` | Nama Rekening | ✅ |

### 6. Tarif (6 field, auto_clone: FALSE)

| Key | Label | Auto-clone |
|---|---|---|
| `JENIS_TARIF_KK_PAK` | Jenis Tarif KK Pakai | ❌ |
| `KELAS_RAWAT_INAP_KK_PAK` | Kelas Rawat Inap KK Pakai | ❌ |
| `NAMA_RS_PEMERINTAH_DAERAH` | Nama RS Pemerintah Daerah (acuan) | ❌ |
| `ACUAN_TARIF_RS_PEMERINTAH` | Acuan Tarif RS Pemerintah | ❌ |
| `NAMA_RS_PEMERINTAH_PROVINSI` | Nama RS Pemerintah Provinsi (acuan) | ❌ |
| `TAHUN_TARIF_NEGOSIASI` | Tahun Tarif Negosiasi | ❌ |

### 7. BA Negosiasi (11 field, auto_clone: FALSE)

| Key | Label | Auto-clone |
|---|---|---|
| `NOMOR_BA_NEGOSIASI` | Nomor BA Negosiasi | ❌ |
| `HARI_NEGOSIASI` | Hari Negosiasi | ❌ |
| `TANGGAL_NEGOSIASI` | Tanggal Negosiasi | ❌ |
| `BULAN_NEGOSIASI` | Bulan Negosiasi | ❌ |
| `TAHUN_NEGOSIASI` | Tahun Negosiasi | ❌ |
| `JAM_NEGOSIASI` | Jam Negosiasi | ❌ |
| `TANGGAL_PENAWARAN` | Tanggal Penawaran | ❌ |
| `BULAN_PENAWARAN` | Bulan Penawaran | ❌ |
| `TAHUN_PENAWARAN` | Tahun Penawaran | ❌ |
| `NAMA_SAKSI_PIHAK_PERTAMA` | Nama Saksi Pihak Pertama | ❌ |
| `NAMA_SAKSI_PIHAK_KEDUA` | Nama Saksi Pihak Kedua | ❌ |

### 8. Rekonsiliasi (5 field, auto_clone: FALSE)

| Key | Label | Auto-clone |
|---|---|---|
| `TANGGAL_REKONSILIASI` | Tanggal Rekonsiliasi | ❌ |
| `BULAN_REKONSILIASI` | Bulan Rekonsiliasi | ❌ |
| `TAHUN_REKONSILIASI` | Tahun Rekonsiliasi | ❌ |
| `BULAN_AWAL_REKONSILIASI` | Bulan Awal Rekonsiliasi | ❌ |
| `BULAN_AKHIR_REKONSILIASI` | Bulan Akhir Rekonsiliasi | ❌ |

### 9. Informasi Kelengkapan (8 field, auto_clone: FALSE)

| Key | Label | Auto-clone |
|---|---|---|
| `NOMOR_INFORMASI_KELENGKAPAN` | Nomor Informasi Kelengkapan | ❌ |
| `TANGGAL_INFORMASI_KELENGKAPAN` | Tanggal Informasi Kelengkapan | ❌ |
| `BULAN_INFORMASI_KELENGKAPAN` | Bulan Informasi Kelengkapan | ❌ |
| `TAHUN_INFORMASI_KELENGKAPAN` | Tahun Informasi Kelengkapan | ❌ |
| `BULAN_PELAYANAN` | Bulan Pelayanan | ❌ |
| `TAHUN_PELAYANAN` | Tahun Pelayanan | ❌ |
| `JUMLAH_KASUS_TIDAK_LENGKAP` | Jumlah Kasus Tidak Lengkap | ❌ |
| `BATAS_HARI_PENLENGKAPAN` | Batas Hari Penlengkapan | ❌ |

### 10. PIC & Kontak (13 field, auto_clone: true)

| Key | Label | Auto-clone |
|---|---|---|
| `NAMA_PIC_USER_EPLKK` | Nama PIC User EPLKK | ✅ |
| `JABATAN_PIC_USER_EPLKK` | Jabatan PIC User EPLKK | ✅ |
| `NAMA_PIC_NARAHUBUNG` | Nama PIC Narahubung | ✅ |
| `JABATAN_PIC_NARAHUBUNG` | Jabatan PIC Narahubung | ✅ |
| `JABATAN_PIC_BPJS` | Jabatan PIC BPJS | ✅ |
| `HP_PIC_BPJS` | HP PIC BPJS | ✅ |
| `EMAIL_PIC_BPJS` | Email PIC BPJS | ✅ |
| `JABATAN_PIC_ADMIN_FASKES` | Jabatan PIC Admin Faskes | ✅ |
| `HP_PIC_ADMIN_FASKES` | HP PIC Admin Faskes | ✅ |
| `EMAIL_PIC_ADMIN_FASKES` | Email PIC Admin Faskes | ✅ |
| `JABATAN_PIC_KLINIS_FASKES` | Jabatan PIC Klinis Faskes | ✅ |
| `HP_PIC_KLINIS_FASKES` | HP PIC Klinis Faskes | ✅ |
| `EMAIL_PIC_KLINIS_FASKES` | Email PIC Klinis Faskes | ✅ |

### 11. Pakta & Lainnya (5 field, mixed auto_clone)

| Key | Label | Auto-clone |
|---|---|---|
| `TEMPAT_PAKTA` | Tempat Pakta | ❌ |
| `BULAN_PAKTA` | Bulan Pakta | ❌ |
| `NAMA_PIMPINAN_FASKES` | Nama Pimpinan Faskes | ✅ |
| `JABATAN_PIMPINAN_FASKES` | Jabatan Pimpinan Faskes | ✅ |
| `KOTA_PENGADILAN_NEGERI` | Kota Pengadilan Negeri | ✅ |

---

## Statistik

- **Total placeholder:** 81
- **Auto-clone (true):** 41 (~51%) — identitas, bank, PJ, pimpinan
- **Reset (false):** 40 (~49%) — tanggal, nomor, BA, rekonsiliasi

---

## Auto-Clone Logic (untuk Perpanjangan)

Saat PIC RS ajukan perpanjangan dari PKS lama, function `cloneDataForPerpanjangan(oldData)`:

```typescript
function cloneDataForPerpanjangan(oldData: Record<string, any>): Record<string, any> {
  const cloned: Record<string, any> = {}
  for (const p of PKS_PLACEHOLDERS) {
    if (p.auto_clone && oldData[p.key] !== undefined) {
      cloned[p.key] = oldData[p.key]    // keep from old
    } else {
      cloned[p.key] = null              // reset
    }
  }
  // Special: PKS_SEBELUMNYA diisi dari PKS lama
  if (oldData['NOMOR_PKS_PIHAK_PERTAMA']) {
    cloned['NOMOR_PKS_SEBELUMNYA_PIHAK_PERTAMA'] = oldData['NOMOR_PKS_PIHAK_PERTAMA']
  }
  if (oldData['NOMOR_PKS_PIHAK_KEDUA']) {
    cloned['NOMOR_PKS_SEBELUMNYA_PIHAK_KEDUA'] = oldData['NOMOR_PKS_PIHAK_KEDUA']
  }
  if (oldData['TANGGAL_BERAKHIR_PKS']) {
    cloned['TANGGAL_BERAKHIR_PKS_SEBELUMNYA'] = oldData['TANGGAL_BERAKHIR_PKS']
  }
  if (oldData['PERIHAL_PKS_SEBELUMNYA'] || oldData['NOMOR_PKS_PIHAK_PERTAMA']) {
    cloned['PERIHAL_PKS_SEBELUMNYA'] = oldData['PERIHAL_PKS_SEBELUMNYA'] || `PKS ${oldData['NOMOR_PKS_PIHAK_PERTAMA'] || ''}`
  }
  return cloned
}
```

**Hasilnya:** PIC RS tinggal isi ~20% field (yang auto_clone=false selain PKS_SEBELUMNYA) — nomor PKS baru, tanggal baru, BA negosiasi baru, dll.

---

## Cara Pakai di Template Google Docs

1. Buka template Google Docs (mis. `TEMPLATE - PKS Baru`)
2. Di tempat yang sesuai, ketik placeholder: `{{NAMA_FASKES}}`, `{{ALAMAT_FASKES}}`, dst.
3. **Format harus EXACT match:** `{{` + `KEY` (huruf besar) + `}}`. Tidak boleh spasi di dalam.
4. Apps Script akan replace semua occurrence. Jika placeholder tidak ditemukan di template → tetap OK (skip). Jika value kosong → di-replace dengan string kosong (placeholder hilang).

### Contoh template:

```
                            PERJANJIAN KERJA SAMA
              ANTARA PT ASURANSI SOSIAL TENAGA KERJA (BPJS KETENAGAKERJAAN)
                    DENGAN {{NAMA_FASKES}}

Pada hari ini, {{HARI_TANDA_TANGAN}} tanggal {{TANGGAL_TANDA_TANGAN}} bulan ...
bertempat di {{KOTA_TANDA_TANGAN}}, kami yang bertanda tangan di bawah ini:

I.    Nama    : {{NAMA_KEPALA_KANTOR_CABANG}}
      Jabatan : Kepala Kantor Cabang {{NAMA_KANTOR_CABANG}}
      Alamat  : {{ALAMAT_KANTOR_CABANG}}
      ...
```

---

## Catatan Penting untuk AI/Developer

1. **Case-sensitive:** Key harus UPPERCASE. `{{nama_faskes}}` (lowercase) tidak akan ke-replace.
2. **No space inside braces:** `{{ NAMA_FASKES }}` (dengan spasi) tidak akan ke-replace. Pattern Apps Script pakai `\\{\\{KEY\\}\\}` tanpa spasi.
3. **Multiple occurrence OK:** Satu placeholder bisa muncul beberapa kali di template (mis. `{{NAMA_FASKES}}` di header + pasal 1 + signature page). Semua akan di-replace.
4. **Jangan tambah placeholder baru tanpa update:** `pks-placeholders.ts` adalah single source of truth. Jika template butuh placeholder baru, tambahkan ke array `PKS_PLACEHOLDERS` dulu, baru pakai di template.
5. **Validasi di UI:** Form di `DraftingPKSView.tsx` auto-generate dari `PKS_PLACEHOLDERS`. Jika key tidak ada di array, tidak akan muncul di form UI meskipun ada di template.

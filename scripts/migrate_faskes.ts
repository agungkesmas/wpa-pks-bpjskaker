// ============================================================
// MIGRASI 34 FASKES dari Google Sheets ke Database
// ============================================================
// Sumber: https://docs.google.com/spreadsheets/d/19Xxtpbfhm-o8wD_DvACRCUTRrWvRXwqx
// Kolom: NO, RS/KLINIK, ALAMAT, NAMA FASILITAS KESEHATAN, NOMOR PKS,
//        TANGGAL AWAL PKS, TANGGAL AKHIR, Nama PIC, Nomor HP PIC
//
// Output per faskes:
// 1. wpa_faskes (nama, jenis, alamat, status: aktif)
// 2. wpa_pks (kode_pks_pihak_pertama, tanggal_mulai, tanggal_berakhir, status: ditandatangani)
// 3. wpa_users (PIC RS: email generate dari nama faskes, password auto-generate)
// 4. wpa_user_faskes (link PIC RS ke faskes)
// ============================================================

import { supabaseAdmin } from '../src/lib/supabase'
import { hashPassword } from '../src/lib/auth'
import { randomBytes } from 'crypto'

interface FaskesRow {
  no: number
  jenis: string
  alamat: string
  nama: string
  nomorPks: string
  tanggalAwal: string
  tanggalAkhir: string
  namaPic: string
  hpPic: string
}

// Data dari Google Sheets (sudah di-parse)
const DATA: FaskesRow[] = [
  { no: 1, jenis: 'RS', alamat: 'JL. SILIWANGI KM 7, NO. 84 DS. KAYAMUKTI KEC. PANYINGKIRAN KAB. MAJALENGKA', nama: 'RS DJUANSIH MAJALENGKA', nomorPks: 'PER/11/032026', tanggalAwal: '2026-04-10', tanggalAkhir: '2027-04-10', namaPic: 'BU NYOMAN', hpPic: '089506579885' },
  { no: 2, jenis: 'Klinik', alamat: 'JL. RAYA CIREBON - BANDUNG', nama: 'KLINIK NAYAKA HUSADA 04 KASOKANDEL', nomorPks: 'PER/55/062025', tanggalAwal: '2025-09-01', tanggalAkhir: '2026-08-31', namaPic: 'PENDI', hpPic: '087879084963' },
  { no: 3, jenis: 'Klinik', alamat: 'JL. OTTO ISKANDARDINATA BLOK KAVLING', nama: 'KLINIK NAYAKA HUSADA 01 PLUMBON', nomorPks: 'PER/54/062025', tanggalAwal: '2025-09-01', tanggalAkhir: '2026-08-31', namaPic: 'IBU YANTI', hpPic: '085888227836' },
  { no: 4, jenis: 'RS', alamat: 'JALAN KH. AGUS SALIM BLOK KETIPA', nama: 'RS SENTRA MEDIKA HOSPITAL GEMPOL', nomorPks: 'PER/68/082025', tanggalAwal: '2025-08-29', tanggalAkhir: '2026-08-30', namaPic: 'AMIN AHYANI', hpPic: '082114434901' },
  { no: 5, jenis: 'RS', alamat: 'JL. RAYA TIMUR III NO. 875, DAWUAN', nama: 'RS LIVASYA', nomorPks: 'PER/68/082025', tanggalAwal: '2025-08-29', tanggalAkhir: '2026-08-30', namaPic: 'BU REGA', hpPic: '083128647695' },
  { no: 6, jenis: 'RS', alamat: 'JL CIREMAI RAYA NO. 114 - CIREBON', nama: 'RS PUTERA BAHAGIA', nomorPks: 'PER/110/122025', tanggalAwal: '2026-02-01', tanggalAkhir: '2027-01-31', namaPic: 'IRINA MELVIYANA', hpPic: '08121812210' },
  { no: 7, jenis: 'RS', alamat: 'JL. PULASAREN NO. 7 KOTA CIREBON', nama: 'RSU PANTI ABDI DHARMA', nomorPks: 'PER/13/052026', tanggalAwal: '2026-05-31', tanggalAkhir: '2027-06-10', namaPic: 'BR GUGUN WAHYU', hpPic: '0895333791354' },
  { no: 8, jenis: 'RS', alamat: 'JL. RAYA PATROL BLOK RANCAKETILANG INDRAMAYU', nama: 'RS MITRA PLUMBON PATROL', nomorPks: 'PER/111/122025', tanggalAwal: '2026-01-12', tanggalAkhir: '2027-01-31', namaPic: 'NANDA RAHADIAN ELHAZ', hpPic: '085155090597' },
  { no: 9, jenis: 'Klinik', alamat: 'JALAN GATOT SUBROTO DUSUN KIDUL RT 01/02', nama: 'KLINIK PRIMA MEDIKA', nomorPks: 'PER/05/022026', tanggalAwal: '2026-03-01', tanggalAkhir: '2027-03-10', namaPic: 'MUSAFAH', hpPic: '08159930572' },
  { no: 10, jenis: 'Klinik', alamat: 'JL. RAYA KERTAJATI, BLOK SENIN, RT.002/RW.002, KERTAJATI, KEC. KERTAJATI, KABUPATEN MAJALENGKA, JAWA BARAT', nama: 'KLINIK SINAR SURYA KERTAJATI', nomorPks: 'PER/10/032026', tanggalAwal: '2026-03-01', tanggalAkhir: '2027-03-10', namaPic: 'ZACKY MUAMAR ALKATIRIE, S. KOM', hpPic: '081222222783' },
  { no: 11, jenis: 'RS', alamat: 'JL. CUT NYAK DIEN , NO.01, KEL. CIJOHO', nama: 'RS PERMATA KUNINGAN', nomorPks: 'PER02/012026', tanggalAwal: '2026-02-10', tanggalAkhir: '2027-02-10', namaPic: 'SORAYA', hpPic: '082130487785' },
  { no: 12, jenis: 'RS', alamat: 'JL. RAYA PANTURA NO.100, LANGUT, KEC. LOHBENER', nama: 'RS SENTRA MEDIKA LANGUT', nomorPks: 'PER/53/062026', tanggalAwal: '2026-08-01', tanggalAkhir: '2027-07-31', namaPic: 'DR HATTA', hpPic: '081224530530' },
  { no: 13, jenis: 'RS', alamat: 'JL. MURAH NARA NO.7', nama: 'RSUD INDRAMAYU', nomorPks: 'PER/51/062026', tanggalAwal: '2026-07-01', tanggalAkhir: '2027-06-30', namaPic: 'DR AYU NUUR ANNISSA', hpPic: '08122302514' },
  { no: 14, jenis: 'RS', alamat: 'JL. KESEHATAN NO.77 KABUPATEN MAJALENGKA', nama: 'RSUD MAJALENGKA', nomorPks: 'PER/04/012026', tanggalAwal: '2026-01-10', tanggalAkhir: '2027-01-10', namaPic: 'SYILFA', hpPic: '082126200787' },
  { no: 15, jenis: 'RS', alamat: 'JL. BUMI PATRA RAYA NO.1, KARANGANYAR INDRAMAYU', nama: 'RS PERTAMINA BALONGAN', nomorPks: 'PER/06/022026', tanggalAwal: '2026-02-01', tanggalAkhir: '2027-02-10', namaPic: 'SRI NUFUS', hpPic: '085722044944' },
  { no: 16, jenis: 'RS', alamat: 'JL. RAYA BY PASS PALIMANAN JAKARTA KM.2 NO.1 ARJAWINANGUN KAB.CIREBON', nama: 'RSUD ARJAWINANGUN', nomorPks: 'PER/62/082025', tanggalAwal: '2025-09-01', tanggalAkhir: '2026-08-31', namaPic: 'PAK WAWAN', hpPic: '087729764222' },
  { no: 17, jenis: 'Klinik', alamat: 'JL. RAYA PLUMBON - PALIMANAN NO.29, KASUGENGAN LOR', nama: 'KLINIK ULIL ALBAB', nomorPks: 'PER/74/092025', tanggalAwal: '2025-10-06', tanggalAkhir: '2026-10-31', namaPic: 'DR ELFA', hpPic: '087786619696' },
  { no: 18, jenis: 'RS', alamat: 'JL. JEND. SUDIRMAN NO.68, AWIRARANGAN, KEC. KUNINGAN, KABUPATEN KUNINGAN, JAWA BARAT', nama: 'RSUD 45 KUNINGAN', nomorPks: 'PER/ 32/ 052026', tanggalAwal: '2026-05-27', tanggalAkhir: '2027-06-10', namaPic: 'SHERLY', hpPic: '081804623399' },
  { no: 19, jenis: 'RS', alamat: 'JL. R.DEWI SARTIKA NO.15, TUKMUDAL, KEC. SUMBER, KABUPATEN CIREBON', nama: 'RS SUMBER HURIP', nomorPks: 'PER/104/122025', tanggalAwal: '2026-01-01', tanggalAkhir: '2026-12-31', namaPic: 'BAPAK ACHMAD', hpPic: '082174286027' },
  { no: 20, jenis: 'RS', alamat: 'JL DR SETIABUDI NO 8, PEGAGAN, PALIMANAN, KAB.CIREBON', nama: 'RS KHALISHAH PALIMANAN', nomorPks: 'PER/68/072024', tanggalAwal: '2024-08-13', tanggalAkhir: '2026-08-12', namaPic: 'PRAYOGI', hpPic: '081214858428' },
  { no: 21, jenis: 'RS', alamat: 'JL. URIP SUMOHARJO NO. 5', nama: 'RS SUMBER WARAS', nomorPks: 'PER/67/082025', tanggalAwal: '2025-09-01', tanggalAkhir: '2026-08-31', namaPic: 'IBU TATI', hpPic: '0856077993720' },
  { no: 22, jenis: 'RS', alamat: 'JALAN RAYA PANTURA KM 73-75', nama: 'RS BHAYANGKARA TK III INDRAMAYU', nomorPks: 'PER/105/12/2025', tanggalAwal: '2026-01-01', tanggalAkhir: '2026-12-31', namaPic: 'JAJANG MULYANA', hpPic: '081220774349' },
  { no: 23, jenis: 'RS', alamat: 'JL. EVAKUASI NO. 116', nama: 'RS MEDIMAS', nomorPks: 'PER/96/122025', tanggalAwal: '2026-01-01', tanggalAkhir: '2026-12-31', namaPic: 'AZAN A ABDAL', hpPic: '082317002280' },
  { no: 24, jenis: 'RS', alamat: 'JL RE MARTADINATA NO. 172', nama: 'RS WIJAYA KUSUMAH', nomorPks: 'PER/112/122025', tanggalAwal: '2026-01-10', tanggalAkhir: '2027-01-10', namaPic: 'RENCHI', hpPic: '0895635583455' },
  { no: 25, jenis: 'RS', alamat: 'JL. SISINGAMARAJABO. 45', nama: 'RS PELABUHAN CIREBON', nomorPks: 'PER/106/12/2025', tanggalAwal: '2026-01-01', tanggalAkhir: '2026-12-31', namaPic: 'YENI RAHMAWATI', hpPic: '081223405' },
  { no: 26, jenis: 'RS', alamat: 'JL. RAYA BARAT PS. PRAPATAN, PANJALIN KIDL. MAJALENGKA', nama: 'RS MITRA PLUMBON MAJALENGKA', nomorPks: 'PER/31/052026', tanggalAwal: '2026-05-16', tanggalAkhir: '2027-06-10', namaPic: 'IRIS', hpPic: '089693187277' },
  { no: 27, jenis: 'RS', alamat: 'JALAN BY PASS JALAN BARU', nama: 'RS MITRA PLUMBON INDRAMAYU', nomorPks: 'PER/42/052026', tanggalAwal: '2026-05-31', tanggalAkhir: '2027-06-10', namaPic: 'IBU IBNU / IBNU', hpPic: '086112441086' },
  { no: 28, jenis: 'RS', alamat: 'JL. KESAMBI NO. 237', nama: 'RS TK III CIREMAI', nomorPks: 'PER/58/082025', tanggalAwal: '2025-09-01', tanggalAkhir: '2026-08-31', namaPic: 'ENDANG MAHMUDAYA', hpPic: '081222216465' },
  { no: 29, jenis: 'RS', alamat: 'JL.LETNAN JENDERAL SUPRAPTO NO.292, KEPANDEAN, INDRAMAYU, KEPANDEAN, KEC. INDRAMAYU, KABUPATEN INDRAMAYU, JAWA BARAT 45214', nama: 'RS MM INDRAMAYU', nomorPks: 'PER/60/072025', tanggalAwal: '2025-08-01', tanggalAkhir: '2026-07-31', namaPic: 'WINDA', hpPic: '08960746651' },
  { no: 30, jenis: 'RS', alamat: 'JL. SILIWANGI NO.135, KEBONBARU, KEJAKSAN, KOTA CIREBON, JAWA BARAT', nama: 'RSIA SUMBER KASIH', nomorPks: 'PER/03/012026', tanggalAwal: '2026-02-07', tanggalAkhir: '2027-02-07', namaPic: 'BU DHEA', hpPic: '08567187123' },
  { no: 31, jenis: 'RS', alamat: 'JL PATRA RAYA KLAYAN, DRAJAT, KESAMBI, KOTA CIREBON, JAWA BARAT 45133', nama: 'RS PERTAMINA', nomorPks: 'PER/14/042026', tanggalAwal: '2026-05-01', tanggalAkhir: '2027-05-10', namaPic: 'IBU YUNDING', hpPic: '081222446540' },
  { no: 32, jenis: 'RS', alamat: 'JL. KH. WAHID HASYIM, NO. 8, MERTAPADA WETAN, ASTANAJAPURA, MERTAPADA WETAN, ASTANAJAPURA, CIREBON, JAWA BARAT', nama: 'RSU UNIVERSITAS MUHAMMADIYAH CIREBON', nomorPks: 'PER/83/202025', tanggalAwal: '2025-12-01', tanggalAkhir: '2026-11-30', namaPic: 'BR TOHA', hpPic: '0895605157544' },
  { no: 33, jenis: 'RS', alamat: 'JL. TUPAREV NO.117, PILANGSARI, KEDAWUNG, CIREBON', nama: 'RS PERMATA CIREBON', nomorPks: 'PER/50/062026', tanggalAwal: '2026-06-01', tanggalAkhir: '2027-05-31', namaPic: 'JOJO', hpPic: '081223414132' },
  { no: 34, jenis: 'RS', alamat: 'JALAN RAYA PLUMBON KM. 11 PALIMANAN CIREBON', nama: 'RS MITRA PLUMBON', nomorPks: 'PER/33/052026', tanggalAwal: '2026-06-01', tanggalAkhir: '2027-06-10', namaPic: 'FICKY', hpPic: '083120173137' },
]

// Kantor cabang Cirebon (default untuk semua faskes)
const KANTOR_CABANG_ID = 'd39a2476-4920-4f44-b6bd-8683941ee0d6'
// CM Siti Nurhaliza (created_by)
const CM_USER_ID = '15855904-e5ef-42fc-9a4a-5a3321f3af0e'

function generatePassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz!@#$%'
  const bytes = randomBytes(length)
  return Array.from(bytes).map(b => chars[b % chars.length]).join('')
}

function generateEmail(namaFaskes: string): string {
  // RS DJUANSIH MAJALENGKA → rs.djuansih.majalengka@plkk.local
  const slug = namaFaskes
    .toLowerCase()
    .replace(/^(rs|klinik)\s+/i, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '.')
    .substring(0, 30)
  return `${slug}@plkk.local`
}

async function migrate() {
  console.log('=== MIGRASI 34 FASKES ===\n')
  
  let created = 0, updated = 0, errors = 0
  const credentials: Array<{ nama: string; email: string; password: string; pic: string; hp: string }> = []

  for (const row of DATA) {
    try {
      // 1. CEK FASKES (by nama)
      const { data: existingFaskes } = await supabaseAdmin
        .from('wpa_faskes')
        .select('id')
        .eq('nama', row.nama)
        .eq('kantor_cabang_id', KANTOR_CABANG_ID)
        .maybeSingle()

      let faskesId: string

      if (existingFaskes) {
        // Update
        await supabaseAdmin.from('wpa_faskes').update({
          jenis: row.jenis as any,
          alamat: row.alamat,
          status: 'aktif',
          updated_at: new Date().toISOString(),
        }).eq('id', existingFaskes.id)
        faskesId = existingFaskes.id
        updated++
        console.log(`[${row.no}] UPDATE: ${row.nama}`)
      } else {
        // Create
        const { data: newFaskes, error } = await supabaseAdmin.from('wpa_faskes').insert({
          nama: row.nama,
          jenis: row.jenis as any,
          tipe: 'Umum',
          alamat: row.alamat,
          status: 'aktif',
          kantor_cabang_id: KANTOR_CABANG_ID,
        }).select('id').single()
        if (error) throw error
        faskesId = newFaskes.id
        created++
        console.log(`[${row.no}] CREATE: ${row.nama}`)
      }

      // 2. CEK PKS (by kode_pks)
      const { data: existingPks } = await supabaseAdmin
        .from('wpa_pks')
        .select('id')
        .eq('kode_pks_pihak_pertama', row.nomorPks)
        .maybeSingle()

      if (existingPks) {
        await supabaseAdmin.from('wpa_pks').update({
          faskes_id: faskesId,
          kantor_cabang_id: KANTOR_CABANG_ID,
          status: 'ditandatangani',
          tanggal_mulai: row.tanggalAwal,
          tanggal_berakhir: row.tanggalAkhir,
          updated_at: new Date().toISOString(),
        }).eq('id', existingPks.id)
      } else {
        await supabaseAdmin.from('wpa_pks').insert({
          kode_pks_pihak_pertama: row.nomorPks,
          faskes_id: faskesId,
          kantor_cabang_id: KANTOR_CABANG_ID,
          jenis: 'pks_baru',
          status: 'ditandatangani',
          tanggal_mulai: row.tanggalAwal,
          tanggal_berakhir: row.tanggalAkhir,
          created_by: CM_USER_ID,
        })
      }

      // 3. CREATE PIC RS (generate email + password)
      const email = generateEmail(row.nama)
      const { data: existingUser } = await supabaseAdmin
        .from('wpa_users')
        .select('id')
        .eq('email', email)
        .maybeSingle()

      if (!existingUser && row.namaPic) {
        const password = generatePassword(12)
        const { data: newUser, error: userErr } = await supabaseAdmin.from('wpa_users').insert({
          email,
          password_hash: hashPassword(password),
          full_name: row.namaPic,
          role: 'pic_rs',
          phone: row.hpPic || null,
          kantor_cabang_id: KANTOR_CABANG_ID,
          faskes_id: faskesId,
          is_active: true,
          must_change_password: true,
          temp_password: password,
          temp_password_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 hari
          created_by: CM_USER_ID,
        }).select('id').single()

        if (userErr) {
          console.log(`  ⚠️ Gagal create PIC RS: ${userErr.message}`)
        } else {
          // Link to faskes
          await supabaseAdmin.from('wpa_user_faskes').upsert({
            user_id: newUser.id,
            faskes_id: faskesId,
            is_primary: true,
          })
          credentials.push({ nama: row.nama, email, password, pic: row.namaPic, hp: row.hpPic })
          console.log(`  ✅ PIC RS: ${email} / ${password}`)
        }
      } else if (existingUser) {
        console.log(`  ⏭️ PIC RS sudah ada: ${email}`)
      }

    } catch (e: any) {
      console.error(`[${row.no}] ERROR: ${row.nama} - ${e.message}`)
      errors++
    }
  }

  console.log('\n=== HASIL MIGRASI ===')
  console.log(`Faskes created: ${created}`)
  console.log(`Faskes updated: ${updated}`)
  console.log(`Errors: ${errors}`)
  console.log(`PIC RS created: ${credentials.length}`)

  if (credentials.length > 0) {
    console.log('\n=== KREDENSIAL PIC RS (CATAT & BERIKAN KE RS) ===')
    console.log('Nama Faskes | Email | Password | Nama PIC | HP')
    console.log('---|---|---|---|---')
    credentials.forEach(c => {
      console.log(`${c.nama} | ${c.email} | ${c.password} | ${c.pic} | ${c.hp}`)
    })
  }
}

migrate().catch(console.error)

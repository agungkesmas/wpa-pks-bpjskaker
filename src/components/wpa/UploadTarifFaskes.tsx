'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, FileSpreadsheet, Download, Loader2, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { toast } from 'sonner'

interface TarifItem {
  id: string
  kategori: string
  nama_item: string
  satuan: string | null
  tarif: number
  tarif_acuan: number | null
  selisih: number | null
  selisih_percent: number | null
  z_score: number | null
  status_kewajaran: string
}

interface Batch {
  id: string
  file_name: string
  file_size: number | null
  item_count: number
  item_compared: number
  item_no_acuan: number
  status: string
  error_log: string | null
  created_at: string
}

const KATEGORI_LABELS: Record<string, string> = {
  kamar: 'Kamar',
  operasi_kecil: 'Operasi Kecil',
  operasi_sedang: 'Operasi Sedang',
  operasi_besar: 'Operasi Besar',
  laboratorium: 'Laboratorium',
  radiologi: 'Radiologi',
  tindakan_medis: 'Tindakan Medis',
  rawat_inap: 'Rawat Inap',
  obat: 'Obat',
  admin: 'Administrasi',
  lainnya: 'Lainnya',
}

const STATUS_COLORS: Record<string, string> = {
  wajar: 'bg-green-100 text-green-800 border-green-300',
  perlu_review: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  tinggi: 'bg-orange-100 text-orange-800 border-orange-300',
  rendah: 'bg-blue-100 text-blue-800 border-blue-300',
  ekstrem: 'bg-red-100 text-red-800 border-red-300',
  no_acuan: 'bg-slate-100 text-slate-600 border-slate-300',
}

const STATUS_LABELS: Record<string, string> = {
  wajar: 'Wajar',
  perlu_review: 'Perlu Review',
  tinggi: 'Terlalu Tinggi',
  rendah: 'Terlalu Rendah',
  ekstrem: 'Ekstrem',
  no_acuan: 'No Acuan',
}

interface Props {
  faskes_id: string
  faskes_nama: string
  tahun: number
  existingItems: TarifItem[]
  batches: Batch[]
}

const fmtRp = (n: number | null) => n !== null ? `Rp ${n.toLocaleString('id-ID')}` : '-'
const fmtSize = (b: number | null) => {
  if (!b) return '-'
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b/1024).toFixed(1)} KB`
  return `${(b/1024/1024).toFixed(1)} MB`
}

export function UploadTarifFaskes({ faskes_id, faskes_nama, tahun, existingItems, batches }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<any>(null)
  
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    
    setUploading(true)
    setUploadResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('faskes_id', faskes_id)
      fd.append('tahun', tahun.toString())
      
      const res = await fetch('/api/tarif/faskes/upload', {
        method: 'POST',
        body: fd
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      
      setUploadResult(data)
      toast.success(`Upload berhasil: ${data.summary.total_items} item diproses`)
      if (fileRef.current) fileRef.current.value = ''
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setUploading(false)
    }
  }
  
  // Summary stats
  const summary = {
    total: existingItems.length,
    wajar: existingItems.filter(i => i.status_kewajaran === 'wajar').length,
    perlu_review: existingItems.filter(i => i.status_kewajaran === 'perlu_review').length,
    tinggi: existingItems.filter(i => i.status_kewajaran === 'tinggi').length,
    rendah: existingItems.filter(i => i.status_kewajaran === 'rendah').length,
    ekstrem: existingItems.filter(i => i.status_kewajaran === 'ekstrem').length,
    no_acuan: existingItems.filter(i => i.status_kewajaran === 'no_acuan').length,
  }
  
  return (
    <div className="space-y-4">
      {/* Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="w-4 h-4 text-orange-600" />
            Upload File Tarif
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4 bg-blue-50 border-blue-200">
            <Info className="w-4 h-4 text-blue-700" />
            <AlertDescription className="text-blue-900">
              <strong>Format:</strong> Excel (.xlsx) atau CSV. Download template terlebih dahulu untuk format yang benar.
              Setelah upload, sistem otomatis membandingkan tarif Anda dengan acuan kantor cabang.
            </AlertDescription>
          </Alert>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <a href="/api/tarif/template" download className="flex-1">
              <Button variant="outline" className="w-full">
                <Download className="w-4 h-4 mr-2" /> Download Template Excel
              </Button>
            </a>
            <div className="flex-1">
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleUpload}
                disabled={uploading}
                className="hidden"
                id="tarif-file-upload"
              />
              <Button 
                className="w-full bg-orange-600 hover:bg-orange-700"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
                ) : (
                  <><Upload className="w-4 h-4 mr-2" /> Pilih File & Upload</>
                )}
              </Button>
            </div>
          </div>
          
          {uploadResult && (
            <Alert className="mt-4 bg-green-50 border-green-300">
              <CheckCircle2 className="w-4 h-4 text-green-700" />
              <AlertDescription className="text-green-900">
                <div className="font-semibold mb-1">Upload Berhasil</div>
                <div className="text-sm">
                  Total item: <strong>{uploadResult.summary.total_items}</strong> · 
                  Dibandingkan dengan acuan: <strong>{uploadResult.summary.compared}</strong> · 
                  Tanpa acuan: <strong>{uploadResult.summary.no_acuan}</strong>
                  {uploadResult.summary.errors > 0 && ` · Baris error: ${uploadResult.summary.errors}`}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
      
      {/* Summary Stats */}
      {summary.total > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          <Card>
            <CardContent className="p-3">
              <div className="text-xl font-bold text-slate-900">{summary.total}</div>
              <div className="text-[10px] text-slate-500">Total Item</div>
            </CardContent>
          </Card>
          <Card className="border-green-300">
            <CardContent className="p-3">
              <div className="text-xl font-bold text-green-700">{summary.wajar}</div>
              <div className="text-[10px] text-slate-500">Wajar</div>
            </CardContent>
          </Card>
          <Card className="border-yellow-300">
            <CardContent className="p-3">
              <div className="text-xl font-bold text-yellow-700">{summary.perlu_review}</div>
              <div className="text-[10px] text-slate-500">Perlu Review</div>
            </CardContent>
          </Card>
          <Card className="border-orange-300">
            <CardContent className="p-3">
              <div className="text-xl font-bold text-orange-700">{summary.tinggi}</div>
              <div className="text-[10px] text-slate-500">Terlalu Tinggi</div>
            </CardContent>
          </Card>
          <Card className="border-blue-300">
            <CardContent className="p-3">
              <div className="text-xl font-bold text-blue-700">{summary.rendah}</div>
              <div className="text-[10px] text-slate-500">Terlalu Rendah</div>
            </CardContent>
          </Card>
          <Card className="border-red-300">
            <CardContent className="p-3">
              <div className="text-xl font-bold text-red-700">{summary.ekstrem}</div>
              <div className="text-[10px] text-slate-500">Ekstrem</div>
            </CardContent>
          </Card>
          <Card className="border-slate-300">
            <CardContent className="p-3">
              <div className="text-xl font-bold text-slate-700">{summary.no_acuan}</div>
              <div className="text-[10px] text-slate-500">No Acuan</div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Detail Table */}
      {existingItems.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detail Tarif & Status Kewajaran</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Tarif Anda</TableHead>
                  <TableHead className="text-right">Acuan</TableHead>
                  <TableHead className="text-right">Selisih %</TableHead>
                  <TableHead className="text-center">Z-Score</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {existingItems.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge variant="outline">{KATEGORI_LABELS[item.kategori] || item.kategori}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{item.nama_item}</TableCell>
                    <TableCell className="text-right font-semibold">{fmtRp(item.tarif)}</TableCell>
                    <TableCell className="text-right text-slate-600">{fmtRp(item.tarif_acuan)}</TableCell>
                    <TableCell className={`text-right ${item.selisih_percent && item.selisih_percent > 0 ? 'text-orange-700' : item.selisih_percent && item.selisih_percent < 0 ? 'text-blue-700' : 'text-slate-500'}`}>
                      {item.selisih_percent !== null ? `${item.selisih_percent > 0 ? '+' : ''}${item.selisih_percent}%` : '-'}
                    </TableCell>
                    <TableCell className="text-center text-xs text-slate-600">
                      {item.z_score !== null ? item.z_score.toFixed(2) : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={STATUS_COLORS[item.status_kewajaran] || 'bg-slate-100'}>
                        {STATUS_LABELS[item.status_kewajaran] || item.status_kewajaran}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500 mb-1">Belum ada tarif diupload untuk tahun {tahun}</p>
            <p className="text-xs text-slate-400">Download template, isi, lalu upload file Anda</p>
          </CardContent>
        </Card>
      )}
      
      {/* Upload History */}
      {batches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Riwayat Upload</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead className="text-right">Ukuran</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Compared</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Tanggal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map(b => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs">{b.file_name}</TableCell>
                    <TableCell className="text-right text-xs">{fmtSize(b.file_size)}</TableCell>
                    <TableCell className="text-right">{b.item_count}</TableCell>
                    <TableCell className="text-right">{b.item_compared}/{b.item_no_acuan}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={
                        b.status === 'processed' ? 'bg-green-100 text-green-800' :
                        b.status === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }>{b.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {new Date(b.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

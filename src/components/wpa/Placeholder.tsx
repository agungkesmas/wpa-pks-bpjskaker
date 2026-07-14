import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Construction } from 'lucide-react'

interface PlaceholderProps {
  title: string
  description: string
}

export function Placeholder({ title, description }: PlaceholderProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-600">{description}</p>
      </div>
      <Card className="border-dashed border-2 border-slate-300">
        <CardContent className="p-12 text-center">
          <Construction className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Modul Sedang Dikembangkan</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Halaman ini akan segera tersedia. Fungsionalitas inti (autentikasi, dashboard, manajemen user) 
            sudah aktif. Gunakan menu lain atau hubungi admin untuk informasi lebih lanjut.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

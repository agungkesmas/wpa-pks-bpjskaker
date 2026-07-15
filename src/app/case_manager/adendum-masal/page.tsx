import { AdendumMasalGroupReview } from '@/components/wpa/AdendumMasalGroupReview'

export default function CM_AdendumMasalPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          🟤 Adendum Masal — Group Review
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Pengajuan adendum masal dari PIC RS. Centang beberapa → setuju/tolak bareng.
        </p>
      </div>
      <AdendumMasalGroupReview />
    </div>
  )
}

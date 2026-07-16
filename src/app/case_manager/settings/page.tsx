import { AISettingsManager } from '@/components/wpa/AISettingsManager'

export default function CMSettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-600">Kelola pengaturan aplikasi.</p>
      </div>
      <AISettingsManager />
    </div>
  )
}

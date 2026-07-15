import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { TemplateManager } from '@/components/wpa/TemplateManager'

export default async function TemplateMandatoriPage() {
  const me = await getSession()
  if (!me) return null
  
  const { data: templates } = await supabaseAdmin
    .from('wpa_pks_template')
    .select('*')
    .order('uploaded_at', { ascending: false })
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Template Mandatori</h1>
        <p className="text-sm text-slate-600">
          Upload & kelola template PKS/Adendum/SK dari kantor pusat. Template di-hash per bab untuk jaga konsistensi.
        </p>
      </div>
      <TemplateManager templates={templates || []} />
    </div>
  )
}

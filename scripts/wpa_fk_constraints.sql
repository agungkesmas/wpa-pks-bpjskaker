-- Add FK constraints so PostgREST can detect relationships for join queries
-- (Supabase needs explicit FK to allow `wpa_xxx(nama)` select syntax)
-- Note: PostgreSQL does NOT support "IF NOT EXISTS" on ADD CONSTRAINT — use DO blocks.

-- wpa_users -> wpa_kantor_cabang
do $$ begin
  alter table wpa_users add constraint wpa_users_kantor_cabang_fkey foreign key (kantor_cabang_id) references wpa_kantor_cabang(id) on delete set null;
exception when duplicate_object then null; end $$;

-- wpa_users -> wpa_faskes
do $$ begin
  alter table wpa_users add constraint wpa_users_faskes_fkey foreign key (faskes_id) references wpa_faskes(id) on delete set null;
exception when duplicate_object then null; end $$;

-- wpa_faskes -> wpa_kantor_cabang
do $$ begin
  alter table wpa_faskes add constraint wpa_faskes_kantor_cabang_fkey foreign key (kantor_cabang_id) references wpa_kantor_cabang(id) on delete set null;
exception when duplicate_object then null; end $$;

-- wpa_faskes_credentials -> wpa_faskes
do $$ begin
  alter table wpa_faskes_credentials add constraint wpa_faskes_credentials_faskes_fkey foreign key (faskes_id) references wpa_faskes(id) on delete cascade;
exception when duplicate_object then null; end $$;

-- wpa_faskes_pengajuan -> wpa_faskes
do $$ begin
  alter table wpa_faskes_pengajuan add constraint wpa_faskes_pengajuan_faskes_fkey foreign key (faskes_id) references wpa_faskes(id) on delete cascade;
exception when duplicate_object then null; end $$;

-- wpa_faskes_pengajuan -> wpa_kantor_cabang
do $$ begin
  alter table wpa_faskes_pengajuan add constraint wpa_faskes_pengajuan_kantor_fkey foreign key (kantor_cabang_id) references wpa_kantor_cabang(id) on delete set null;
exception when duplicate_object then null; end $$;

-- wpa_pks -> wpa_faskes
do $$ begin
  alter table wpa_pks add constraint wpa_pks_faskes_fkey foreign key (faskes_id) references wpa_faskes(id) on delete set null;
exception when duplicate_object then null; end $$;

-- wpa_pks -> wpa_kantor_cabang
do $$ begin
  alter table wpa_pks add constraint wpa_pks_kantor_cabang_fkey foreign key (kantor_cabang_id) references wpa_kantor_cabang(id) on delete set null;
exception when duplicate_object then null; end $$;

-- wpa_pks -> wpa_pks_template
do $$ begin
  alter table wpa_pks add constraint wpa_pks_template_fkey foreign key (template_id) references wpa_pks_template(id) on delete set null;
exception when duplicate_object then null; end $$;

-- wpa_pks -> wpa_pks (self-ref parent_pks_id)
do $$ begin
  alter table wpa_pks add constraint wpa_pks_parent_fkey foreign key (parent_pks_id) references wpa_pks(id) on delete set null;
exception when duplicate_object then null; end $$;

-- wpa_pks -> wpa_users (assigned_case_manager_id)
do $$ begin
  alter table wpa_pks add constraint wpa_pks_case_manager_fkey foreign key (assigned_case_manager_id) references wpa_users(id) on delete set null;
exception when duplicate_object then null; end $$;

-- wpa_pks -> wpa_users (created_by)
do $$ begin
  alter table wpa_pks add constraint wpa_pks_created_by_fkey foreign key (created_by) references wpa_users(id) on delete set null;
exception when duplicate_object then null; end $$;

-- wpa_pks_adendum -> wpa_pks
do $$ begin
  alter table wpa_pks_adendum add constraint wpa_pks_adendum_pks_fkey foreign key (pks_id) references wpa_pks(id) on delete cascade;
exception when duplicate_object then null; end $$;

-- wpa_pks_adendum -> wpa_pks_template
do $$ begin
  alter table wpa_pks_adendum add constraint wpa_pks_adendum_template_fkey foreign key (template_id_new) references wpa_pks_template(id) on delete set null;
exception when duplicate_object then null; end $$;

-- wpa_pks_signatures -> wpa_pks
do $$ begin
  alter table wpa_pks_signatures add constraint wpa_pks_signatures_pks_fkey foreign key (pks_id) references wpa_pks(id) on delete cascade;
exception when duplicate_object then null; end $$;

-- wpa_dropping_pusat -> wpa_pks_template (template_lama_id, template_baru_id)
do $$ begin
  alter table wpa_dropping_pusat add constraint wpa_dropping_pusat_tpl_lama_fkey foreign key (template_lama_id) references wpa_pks_template(id) on delete set null;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table wpa_dropping_pusat add constraint wpa_dropping_pusat_tpl_baru_fkey foreign key (template_baru_id) references wpa_pks_template(id) on delete set null;
exception when duplicate_object then null; end $$;

-- wpa_dropping_pusat_target -> wpa_dropping_pusat
do $$ begin
  alter table wpa_dropping_pusat_target add constraint wpa_dropping_tgt_dropping_fkey foreign key (dropping_id) references wpa_dropping_pusat(id) on delete cascade;
exception when duplicate_object then null; end $$;

-- wpa_dropping_pusat_target -> wpa_pks
do $$ begin
  alter table wpa_dropping_pusat_target add constraint wpa_dropping_tgt_pks_fkey foreign key (pks_id) references wpa_pks(id) on delete cascade;
exception when duplicate_object then null; end $$;

-- wpa_dropping_pusat_target -> wpa_faskes
do $$ begin
  alter table wpa_dropping_pusat_target add constraint wpa_dropping_tgt_faskes_fkey foreign key (faskes_id) references wpa_faskes(id) on delete cascade;
exception when duplicate_object then null; end $$;

-- wpa_dropping_pusat_target -> wpa_kantor_cabang
do $$ begin
  alter table wpa_dropping_pusat_target add constraint wpa_dropping_tgt_kantor_fkey foreign key (kantor_cabang_id) references wpa_kantor_cabang(id) on delete set null;
exception when duplicate_object then null; end $$;

-- wpa_dropping_pusat_target -> wpa_pks_adendum
do $$ begin
  alter table wpa_dropping_pusat_target add constraint wpa_dropping_tgt_adendum_fkey foreign key (adendum_id) references wpa_pks_adendum(id) on delete set null;
exception when duplicate_object then null; end $$;

-- wpa_dropping_pusat_target -> wpa_users (case_manager)
do $$ begin
  alter table wpa_dropping_pusat_target add constraint wpa_dropping_tgt_cm_fkey foreign key (assigned_case_manager_id) references wpa_users(id) on delete set null;
exception when duplicate_object then null; end $$;

-- wpa_dropping_pusat_target -> wpa_users (legal)
do $$ begin
  alter table wpa_dropping_pusat_target add constraint wpa_dropping_tgt_legal_fkey foreign key (assigned_legal_id) references wpa_users(id) on delete set null;
exception when duplicate_object then null; end $$;

-- wpa_tarif_bank -> wpa_faskes
do $$ begin
  alter table wpa_tarif_bank add constraint wpa_tarif_bank_faskes_fkey foreign key (faskes_id) references wpa_faskes(id) on delete cascade;
exception when duplicate_object then null; end $$;

-- wpa_notifications -> wpa_users
do $$ begin
  alter table wpa_notifications add constraint wpa_notifications_user_fkey foreign key (user_id) references wpa_users(id) on delete cascade;
exception when duplicate_object then null; end $$;

-- wpa_audit_logs -> wpa_kantor_cabang
do $$ begin
  alter table wpa_audit_logs add constraint wpa_audit_logs_kantor_fkey foreign key (kantor_cabang_id) references wpa_kantor_cabang(id) on delete set null;
exception when duplicate_object then null; end $$;

-- Reload schema cache (so PostgREST picks up new FKs)
notify pgrst, 'reload schema';


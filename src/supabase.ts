import { createClient } from "@supabase/supabase-js";

// Chave publicável: pode ficar no código (o acesso é protegido por RLS + tabela admins)
export const supabase = createClient(
  "https://ilnmrhgnaojgykkresfi.supabase.co",
  "sb_publishable_VFiuWtEbbGRsfTOnYkMjQA_cW4twv3U",
);

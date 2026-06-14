import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

async function test() {
  const taskId = '211a01c1-a162-410d-b5ef-f6d4d2239834';
  
  const { data: anonData, error: anonErr } = await supabase
    .from('task_attachments')
    .select('*, profiles:uploaded_by ( display_name )')
    .eq('task_id', taskId);
  console.log('ANON READ:', anonData, anonErr);

  const { data: adminData, error: adminErr } = await supabaseAdmin
    .from('task_attachments')
    .select('*')
    .eq('task_id', taskId);
  console.log('ADMIN READ:', adminData, adminErr);
}
test();

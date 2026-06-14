import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

async function test() {
  // 1. Test storage upload
  const buf = Buffer.from('hello world');
  const { data: upData, error: upErr } = await supabaseAdmin.storage
    .from('task-attachments')
    .upload('test/probe.txt', buf, { contentType: 'text/plain', upsert: true });
  console.log('Storage upload:', upData, upErr);

  // 2. Test table insert
  const { data: insData, error: insErr } = await supabaseAdmin
    .from('task_attachments')
    .insert({ task_id: '00000000-0000-0000-0000-000000000000', file_url: 'https://example.com/test', file_name: 'probe.txt', uploaded_by: null });
  console.log('Table insert:', insData, insErr);
}
test();

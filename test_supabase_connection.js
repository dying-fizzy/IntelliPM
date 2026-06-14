import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

async function testConnection() {
    console.log('>>> TESTING CONNECTION TO:', supabaseUrl);
    
    if (!supabaseUrl || !supabaseKey) {
        console.error('ERROR: Credentials missing in .env');
        return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        const { data, error, status, statusText } = await supabase
            .from('profiles')
            .select('*')
            .limit(1);

        if (error) {
            console.error('FAIL: Could not query "profiles" table.');
            console.error('Error Code:', error.code);
            console.error('Error Message:', error.message);
            console.error('HTTP Status:', status, statusText);
            
            if (error.code === 'PGRST116') {
                console.log('SUCCESS (Technically): Table exists but is empty.');
            } else if (error.code === '42P01') {
                console.log('FAIL: Table "profiles" does not exist in the public schema.');
            }
        } else {
            console.log('SUCCESS: Connected and queried "profiles" successfully!');
            console.log('Sample Data:', data);
        }
    } catch (err) {
        console.error('EXCEPTION:', err.message);
    }
}

testConnection();

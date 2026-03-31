// supabase-config.js
// Replace with your Supabase project URL and anon key
const SUPABASE_URL = 'https://bhjtsyjbzkqvikzcoanm.supabase.co';      // <-- YOUR URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoanRzeWpiemtxdmlremNvYW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MzY3NDIsImV4cCI6MjA5MDUxMjc0Mn0.08DX3IYd_3ZHE9u7Gi_VjAObLVeC3z_TUm-EXWzMAVg';                    // <-- YOUR KEY

// Initialize Supabase client and attach to window for global access
window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("Supabase client initialized globally");

// supabase-config.js
// Replace with your Supabase project URL and anon key
const SUPABASE_URL = 'https://oqbircnyenccjdlcafvk.supabase.co';      // <-- YOUR URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xYmlyY255ZW5jY2pkbGNhZnZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MTUyMTEsImV4cCI6MjA5MDQ5MTIxMX0.U9uMhSc9beJKIVbaRzwEBx9_gfaKFNOXUdV-narAGB8';                    // <-- YOUR KEY

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log("Supabase client ready");


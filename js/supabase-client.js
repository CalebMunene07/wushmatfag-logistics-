// ============================================================================
// Supabase client — loaded via CDN in each HTML page:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
// <script src="js/supabase-client.js"></script>
//
// Fill in your project URL + anon key below (Settings -> API in Supabase).
// ============================================================================

const SUPABASE_URL = "https://whevwibwktfhhtstrxpn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndoZXZ3aWJ3a3RmaGh0c3RyeHBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMDE3NjMsImV4cCI6MjEwMTY3Nzc2M30.IwcU6T3zYIsY8DVVE30Syp14OsQWSKOGVSdAczHF_9w";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

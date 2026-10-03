/* La clave publishable identifica el proyecto; las reglas RLS protegen los datos. */
const SUPABASE_URL = "https://avvoumjjrjxncnogsyfw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_vhrA_IX1j8CkhYSty8u0Tg_zeo9OL58";

window.supabaseClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
    }
});

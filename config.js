// ============================================================
// CONFIGURACIÓN DE CONEXIÓN A SUPABASE
// ============================================================
// INSTRUCCIONES:
// 1. Ve a https://supabase.com → tu proyecto → Settings → API
// 2. Copia los valores y pégalos aquí
// 3. NO compartas este archivo con la service_role key (solo usa anon public)
// ============================================================

// OPCIÓN A: Variables de entorno (recomendado para producción)
// Si usas Vite/Vercel, crea un archivo .env.local con:
//   VITE_SUPABASE_URL=https://xxxxx.supabase.co
//   VITE_SUPABASE_ANON_KEY=eyJ...
// Y deja estos valores como están:

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://istzjgnlldsgwuiehdpz.supabase.co";

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzdHpqZ25sbGRzZ3d1aWVoZHB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NDE0NDksImV4cCI6MjA5MjAxNzQ0OX0.Pt7i8l4XwLr-m-fHxwNqmwnjeoHXu-AV-jLwqbaeghw";

// OPCIÓN B: Directamente en el código (solo para pruebas locales)
// Reemplaza los strings "PEGA_AQUI..." de arriba con tus valores reales:
//   export const SUPABASE_URL = "https://xxxxxxxxxxxxx.supabase.co";
//   export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1...";

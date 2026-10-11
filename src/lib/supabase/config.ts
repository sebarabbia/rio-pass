// Datos públicos del proyecto Supabase "rio-pass". La publishable key está pensada
// para viajar al navegador: la seguridad la dan las políticas RLS de la base.
// Se pueden pisar con variables de entorno (por ejemplo, para apuntar a otro proyecto).
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xupmwmmfdlumlvukoafa.supabase.co'
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_KQ65sDVc-bDKcmT7vAEXEQ_hMQrhtal'

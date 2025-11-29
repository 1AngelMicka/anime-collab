// src/lib/notifications.ts
import { createClient } from '@supabase/supabase-js'

export type NotificationPayload = {
  userId: string
  title: string
  body?: string
  link?: string
  type?: 'info' | 'success' | 'warning' | 'error'
  metadata?: Record<string, any>
}

// Client "admin" (service role) – côté serveur uniquement
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // ⚠️ jamais côté client
  { auth: { persistSession: false } }
)

export async function createNotification(p: NotificationPayload) {
  const { error } = await supabaseAdmin
    .from('notifications')
    .insert({
      user_id: p.userId,
      title: p.title,
      body: p.body ?? null,
      link: p.link ?? null,
      type: p.type ?? 'info',
      metadata: p.metadata ?? {}
    })

  if (error) throw error
}

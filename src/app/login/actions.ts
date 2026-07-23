'use server'

import { createServerUserClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signOutAction() {
  const supabase = await createServerUserClient()
  await supabase.auth.signOut()
  redirect('/login')
}

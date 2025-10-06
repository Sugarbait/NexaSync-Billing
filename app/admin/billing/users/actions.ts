// Note: Password updates disabled for static hosting
// This functionality requires a backend server

export async function updateUserPassword(authUserId: string, newPassword: string) {
  // Disabled for static export
  console.warn('Password update is not available in static hosting mode')
  return { success: false, error: 'Password updates require a backend server. Please use Supabase dashboard to update passwords.' }
}

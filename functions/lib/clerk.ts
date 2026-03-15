/**
 * Clerk Backend API helper — updates user publicMetadata via REST.
 */

export async function updateUserMetadata(
  clerkSecretKey: string,
  userId: string,
  publicMetadata: Record<string, unknown>
): Promise<void> {
  const res = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${clerkSecretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ public_metadata: publicMetadata }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error(`Clerk API error ${res.status}: ${body}`)
    throw new Error('Failed to update user metadata')
  }
}

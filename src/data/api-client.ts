import { getAuthToken } from '../lib/auth-client'

const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '')

export async function verifyBackendSession() {
  if (!apiUrl) {
    throw new Error('Cashdeck API není pro toto prostředí nastavené.')
  }

  const token = await getAuthToken()
  if (!token) {
    throw new Error('Nelze získat přístupový token.')
  }

  const response = await fetch(`${apiUrl}/session`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw new Error('Backend nepřijal autorizaci.')
  }
}

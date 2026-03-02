export async function safeFetch(url: string, options?: RequestInit) {
  try {
    const res = await fetch(url, options)
    if (!res.ok) throw new Error(`Network error: ${res.status} ${res.statusText}`)
    return res
  } catch (err) {
    console.error('Network Failure:', err)
    throw err
  }
}

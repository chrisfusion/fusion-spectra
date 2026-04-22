import { getBffUrl } from '@/config/runtime'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export async function bffFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${getBffUrl()}${path}`, {
    ...init,
    credentials: 'include',
    headers: init.body instanceof FormData
      ? (init.headers ?? {})
      : { 'Content-Type': 'application/json', ...init.headers }
  })

  if (res.status === 401) {
    window.location.href = `${getBffUrl()}/bff/login`
    return res
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText })) as { error?: string }
    throw new ApiError(res.status, body.error ?? res.statusText)
  }

  return res
}

export async function bffGet<T>(path: string): Promise<T> {
  const res = await bffFetch(path)
  return res.json() as Promise<T>
}

export async function bffPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await bffFetch(path, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined
  })
  return res.json() as Promise<T>
}

export async function bffPut<T>(path: string, body?: unknown): Promise<T> {
  const res = await bffFetch(path, {
    method: 'PUT',
    body: body !== undefined ? JSON.stringify(body) : undefined
  })
  return res.json() as Promise<T>
}

export async function bffDelete(path: string): Promise<void> {
  await bffFetch(path, { method: 'DELETE' })
}

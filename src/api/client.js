export class ApiError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

const FALLBACK_MESSAGE = '일시적인 오류가 발생했습니다.'

async function request(method, path, body) {
  const init = { method, credentials: 'same-origin', headers: { Accept: 'application/json' } }
  if (method !== 'GET') {
    init.headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body ?? {})
  }

  let response
  try {
    response = await fetch(path, init)
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', '서버에 연결할 수 없습니다.')
  }

  if (response.status === 204) return null

  let data = null
  try {
    data = await response.json()
  } catch {
    // 본문이 JSON이 아니면 아래에서 상태 코드로만 처리한다.
  }

  if (!response.ok) {
    const error = data?.error
    throw new ApiError(response.status, error?.code ?? 'INTERNAL_ERROR', error?.message ?? FALLBACK_MESSAGE)
  }
  return data
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  patch: (path, body) => request('PATCH', path, body),
  delete: (path) => request('DELETE', path),
}

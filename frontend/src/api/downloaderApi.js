import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json',
  },
})

const parseContentDispositionFilename = (headerValue) => {
  if (!headerValue) {
    return null
  }

  const starMatch = headerValue.match(/filename\*=UTF-8''([^;]+)/i)
  if (starMatch?.[1]) {
    return decodeURIComponent(starMatch[1])
  }

  const plainMatch = headerValue.match(/filename="?([^";]+)"?/i)
  return plainMatch?.[1] || null
}

const parseBlobError = async (blob) => {
  if (!(blob instanceof Blob)) {
    return null
  }

  try {
    const text = await blob.text()
    const payload = JSON.parse(text)
    return payload?.message || null
  } catch {
    return null
  }
}

const getApiErrorMessage = async (error, fallback = 'Request failed. Please try again.') => {
  if (!axios.isAxiosError(error)) {
    return fallback
  }

  if (error.code === 'ERR_NETWORK') {
    return 'Network error. Please check the backend connection.'
  }

  if (error.code === 'ECONNABORTED') {
    return 'Request timed out. Please try again.'
  }

  const responseData = error.response?.data

  if (responseData instanceof Blob) {
    return (await parseBlobError(responseData)) || fallback
  }

  if (typeof responseData === 'string') {
    return responseData
  }

  if (responseData?.message) {
    return responseData.message
  }

  return fallback
}

const extractVideoInfo = async (url) => {
  const { data } = await apiClient.post('/api/v1/downloader/extract', { url })
  return data
}

const downloadVideoByFormat = async ({ url, formatId }) => {
  const response = await apiClient.post(
    '/api/v1/downloader/download',
    {
      url,
      format_id: formatId,
    },
    {
      responseType: 'blob',
      responseEncoding: 'binary',
    },
  )

  const contentDisposition = response.headers['content-disposition']
  const fileName =
    parseContentDispositionFilename(contentDisposition) ||
    `all-video-downloader-${Date.now()}.mp4`

  return {
    blob: response.data,
    fileName,
  }
}

export { API_BASE_URL, downloadVideoByFormat, extractVideoInfo, getApiErrorMessage }

const isValidHttpUrl = (value) => {
  if (typeof value !== 'string') {
    return false
  }

  try {
    const parsed = new URL(value.trim())
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export { isValidHttpUrl }

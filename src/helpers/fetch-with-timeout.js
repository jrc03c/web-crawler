async function fetchWithTimeout(url, options, ms) {
  options = options || {}
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ms)
  const response = await fetch(url, { ...options, signal: controller.signal })
  clearTimeout(timeout)
  return response
}

module.exports = fetchWithTimeout

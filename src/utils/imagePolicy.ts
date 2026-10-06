// Client-side mirror of fusion-flux's internal/imagepolicy: a fast pre-check so
// users see the problem before submit. Flux stays the authority (400 on POST).

// Returns an error message, or null when the image is acceptable.
// `allowedPrefixes === null` means "unknown" (options endpoint unavailable): prefix check skipped.
export function validateImage(image: string, allowedPrefixes: string[] | null): string | null {
  const img = image.trim()
  if (!img) return 'Image is required'
  if (allowedPrefixes !== null) {
    if (allowedPrefixes.length === 0) return 'Image overrides are disabled on this cluster'
    if (!allowedPrefixes.some(p => img.startsWith(p))) {
      return `Image must start with one of: ${allowedPrefixes.join(', ')}`
    }
  }
  if (img.includes('@sha256:')) return null
  // The tag is whatever follows the last ":" after the last "/" (an earlier ":" is a registry port).
  const tail = img.slice(img.lastIndexOf('/') + 1)
  const colon = tail.indexOf(':')
  if (colon < 0 || colon === tail.length - 1) return 'Image needs an explicit tag or digest'
  if (tail.slice(colon + 1) === 'latest') return 'The "latest" tag is not allowed'
  return null
}

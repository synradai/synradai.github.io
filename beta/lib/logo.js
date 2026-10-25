const TYPES = ['image/png', 'image/jpeg', 'image/webp']

export function logoError(file) {
  if (!file) return 'Choose a logo.'
  if (file.size > 1048576) return 'Logo must be under 1 MB.'
  if (!TYPES.includes(file.type)) return 'Use a PNG, JPEG, or WebP logo.'
  return ''
}

function readBlob(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Could not read that image.'))
    reader.readAsDataURL(blob)
  })
}

export function readImageFile(file) {
  return readBlob(file)
}

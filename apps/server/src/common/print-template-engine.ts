export interface PrintFieldBinding {
  key: string
  source: string
}

export interface PrintTemplateSchema {
  body?: string
  loops?: Array<{ key: string; itemTemplate: string }>
  fieldBindings?: PrintFieldBinding[]
  logoUrl?: string
  barcodeFields?: Array<{ key: string; type: 'CODE128' | 'EAN13' | 'QR' }>
}

export interface PrintValidationResult {
  valid: boolean
  errors: string[]
}

function hash(value: string): number {
  let result = 2166136261
  for (let i = 0; i < value.length; i++) {
    result ^= value.charCodeAt(i)
    result = Math.imul(result, 16777619)
  }
  return result >>> 0
}

export function validatePrintTemplate(schema: PrintTemplateSchema): PrintValidationResult {
  const errors: string[] = []
  const body = schema.body ?? ''
  if (!body.trim()) errors.push('模板正文不能为空')
  if ((schema.loops ?? []).some((loop) => !loop.key || !loop.itemTemplate)) errors.push('循环区必须配置数据源与子模板')
  if ((schema.fieldBindings ?? []).some((field) => !field.key || !field.source)) errors.push('字段绑定缺少键或来源')
  if ((schema.barcodeFields ?? []).some((field) => !field.key || !['CODE128', 'EAN13', 'QR'].includes(field.type))) errors.push('条码/二维码字段类型无效')
  if (schema.logoUrl && !/^(https?:|\/uploads\/|data:image\/)/.test(schema.logoUrl)) errors.push('LOGO 地址格式无效')
  return { valid: errors.length === 0, errors }
}

export function expandPrintLoops(body: string, loops: PrintTemplateSchema['loops'], data: Record<string, unknown>): string {
  let result = body
  for (const loop of loops ?? []) {
    const token = `{{#each ${loop.key}}}`
    const endToken = '{{/each}}'
    const start = result.indexOf(token)
    if (start < 0) continue
    const end = result.indexOf(endToken, start + token.length)
    if (end < 0) continue
    const source = data[loop.key]
    const items = Array.isArray(source) ? source : []
    const rendered = items.map((item) => {
      const record = item && typeof item === 'object' ? item as Record<string, unknown> : { value: item }
      return Object.entries(record).reduce((text, [key, value]) =>
        text.replaceAll(`{{${loop.key}.${key}}}`, String(value ?? '')), loop.itemTemplate)
    }).join('')
    result = result.slice(0, start) + rendered + result.slice(end + endToken.length)
  }
  return result
}

export function barcodeSvg(value: string, type: 'CODE128' | 'EAN13' | 'QR'): string {
  const text = String(value ?? '')
  if (!text) return ''
  if (type === 'QR') {
    const size = 8
    let seed = hash(text)
    let rects = ''
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        seed = (seed * 1664525 + 1013904223) >>> 0
        if (seed % 2 === 0) rects += `<rect x="${col * 6}" y="${row * 6}" width="5" height="5" fill="#111"/>`
      }
    }
    return `<svg width="52" height="52" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`
  }
  let bars = ''
  let x = 0
  for (let i = 0; i < text.length; i++) {
    const width = 1 + (hash(text[i]) % 3)
    bars += `<rect x="${x}" y="0" width="${width}" height="36" fill="#111"/>`
    x += width + 1
  }
  return `<svg width="${x}" height="44" viewBox="0 0 ${x} 44" xmlns="http://www.w3.org/2000/svg">${bars}<text x="0" y="42" font-size="7">${text}</text></svg>`
}

export function renderPrintFields(
  body: string,
  schema: PrintTemplateSchema,
  data: Record<string, unknown>
): string {
  let result = expandPrintLoops(body, schema.loops, data)
  for (const [key, value] of Object.entries(data)) {
    result = result.replaceAll(`{{${key}}}`, String(value ?? ''))
  }
  for (const binding of schema.fieldBindings ?? []) {
    const value = data[binding.source]
    if (value !== undefined) result = result.replaceAll(`{{bind:${binding.key}}}`, String(value))
  }
  for (const field of schema.barcodeFields ?? []) {
    const value = data[field.key]
    if (value == null) continue
    result = result.replaceAll(`{{barcode:${field.key}}}`, barcodeSvg(String(value), field.type))
  }
  if (schema.logoUrl) {
    result = result.replaceAll('{{logo}}', `<img src="${schema.logoUrl}" alt="LOGO" style="max-height:40px"/>`)
  }
  return result
}

/**
 * AI duyệt web — CHỈ được phép truy cập:
 *   - vi.wikipedia.org, en.wikipedia.org
 *   - vnexpress.net (kể cả www.)
 * Mọi domain khác đều bị chặn ở tầng code (không phụ thuộc vào AI).
 *
 * Nguyên tắc: module này KHÔNG BAO GIỜ throw ra ngoài buildWebContext().
 * Nếu web lỗi/chậm, AI vẫn trả lời bình thường và báo "không lấy được nội dung".
 */

const ALLOWED_HOSTS = new Set(['vi.wikipedia.org', 'en.wikipedia.org', 'vnexpress.net', 'www.vnexpress.net'])
const REQUEST_TIMEOUT_MS = 6000
const MAX_REDIRECTS = 3
const MAX_HTML_CHARS = 900_000
const CACHE_TTL_MS = 5 * 60 * 1000
const CACHE_MAX_ENTRIES = 100
const USER_AGENT = 'Mozilla/5.0 (compatible; ClassWebAI/1.0; +https://a4-thpt-nhh.vercel.app)'

const WIKI_EXTRACT_CHARS = 1800
const WIKI_MAX_PAGES = 2
const VNE_MAX_ITEMS = 8
const VNE_ARTICLE_CHARS = 4000

const POLICY = 'Chỉ được truy cập vi.wikipedia.org, en.wikipedia.org và vnexpress.net. Không có quyền truy cập trang khác.'

const VNE_FEEDS = [
  { re: /thế\s*giới|quốc\s*tế/i, slug: 'the-gioi', label: 'Thế giới' },
  { re: /thể\s*thao|bóng\s*đá/i, slug: 'the-thao', label: 'Thể thao' },
  { re: /giáo\s*dục|học\s*sinh|tuyển\s*sinh|đại\s*học|tốt\s*nghiệp/i, slug: 'giao-duc', label: 'Giáo dục' },
  { re: /khoa\s*học/i, slug: 'khoa-hoc', label: 'Khoa học' },
  { re: /công\s*nghệ|số\s*hóa/i, slug: 'so-hoa', label: 'Số hóa' },
  { re: /kinh\s*doanh|kinh\s*tế|chứng\s*khoán|giá\s*vàng/i, slug: 'kinh-doanh', label: 'Kinh doanh' },
  { re: /giải\s*trí|phim|ca\s*sĩ|showbiz/i, slug: 'giai-tri', label: 'Giải trí' },
  { re: /sức\s*khỏe|y\s*tế/i, slug: 'suc-khoe', label: 'Sức khỏe' },
  { re: /pháp\s*luật|hình\s*sự/i, slug: 'phap-luat', label: 'Pháp luật' },
  { re: /du\s*lịch/i, slug: 'du-lich', label: 'Du lịch' },
  { re: /thời\s*sự|chính\s*trị/i, slug: 'thoi-su', label: 'Thời sự' },
]
const VNE_KNOWN_SLUGS = new Map(VNE_FEEDS.map((feed) => [feed.slug, feed]))
const DEFAULT_FEED = { slug: 'tin-moi-nhat', label: 'Tin mới nhất' }

// Regex an toàn với tiếng Việt (\b của JS không hiểu chữ có dấu).
function wordRe(pattern, flags = 'iu') {
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${pattern})(?![\\p{L}\\p{N}])`, flags)
}

const URL_RE = /(?:https?:\/\/)?((?:[a-z0-9-]+\.)+(?:com|net|org|vn|io|edu|gov|info|tv|app|dev|xyz))(?::\d+)?(\/[^\s<>"']*)?/gi
const BLOCKED_KEYWORD_RE = wordRe('google|youtube|facebook|tiktok|instagram|twitter|reddit|bing')
const WIKI_KEYWORD_RE = wordRe('wikipedia|wiki')
const VNE_KEYWORD_RE = wordRe('vnexpress|vn\\s*express')
const NEWS_KEYWORD_RE = wordRe('tin\\s*tức|tin\\s*nóng|tin\\s*hot')
const LOOKUP_KEYWORD_RE = wordRe('là\\s+ai|là\\s+gì|tra\\s*cứu|tìm\\s*hiểu|thông\\s*tin\\s*về|nghĩa\\s+là\\s+gì')
const CLASS_WORDS_RE = wordRe('lớp|nội\\s*quy|trực\\s*nhật|tkb|thời\\s*khóa|tiết|môn|bài|thông\\s*báo|10a4|class-?web|thầy|điểm|kiểm\\s*tra')

// ---------------------------------------------------------------- nhận diện yêu cầu

/** Tín hiệu rõ ràng người dùng muốn AI ra web (URL, tên trang, "tin tức"...). */
export function hasStrongWebSignal(message) {
  const text = String(message ?? '')
  URL_RE.lastIndex = 0
  if (URL_RE.test(text)) return true
  return WIKI_KEYWORD_RE.test(text) || VNE_KEYWORD_RE.test(text) || NEWS_KEYWORD_RE.test(text)
    || BLOCKED_KEYWORD_RE.test(text)
    || wordRe('duyệt\\s*web|lướt\\s*web|lên\\s*(?:mạng|web)|trên\\s*(?:mạng|web)').test(text)
}

/** Tín hiệu yếu: câu hỏi kiểu "X là ai/là gì", "tra cứu X" và không liên quan lớp học. */
export function hasLookupSignal(message) {
  const text = String(message ?? '')
  return LOOKUP_KEYWORD_RE.test(text) && !CLASS_WORDS_RE.test(text)
}

function cleanUrlTail(value) {
  return String(value || '').replace(/[)\].,;:!?]+$/, '')
}

function extractUrls(message) {
  const text = String(message ?? '')
  const found = []
  URL_RE.lastIndex = 0
  let match
  while ((match = URL_RE.exec(text)) && found.length < 6) {
    const host = match[1].toLowerCase()
    const path = cleanUrlTail(match[2] || '/') || '/'
    let url = null
    try { url = new URL(`https://${host}${path}`) } catch { /* bỏ qua */ }
    found.push({ host, url, allowed: ALLOWED_HOSTS.has(host) && Boolean(url) })
  }
  return found
}

function extractSearchTerm(message) {
  let text = String(message ?? '').replace(URL_RE, ' ')
  const fillers = [
    'wikipedia', 'wiki', 'vnexpress', 'vn\\s*express',
    'là\\s+ai', 'là\\s+gì', 'nghĩa\\s+là\\s+gì', 'tra\\s*cứu', 'tìm\\s*hiểu', 'tìm\\s*kiếm', 'thông\\s*tin', 'bài\\s*viết',
    'hãy', 'giúp', 'hộ', 'giùm', 'cho', 'mình', 'tôi', 'tớ', 'em', 'bạn', 'cậu', 'nhé', 'nha', 'đi', 'ơi',
    'trên', 'mạng', 'web', 'về', 'xem', 'đọc', 'tìm', 'với',
  ]
  text = text.replace(wordRe(fillers.join('|'), 'giu'), ' ')
  return text.replace(/[?!.,;:"'“”‘’()]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)
}

// ---------------------------------------------------------------- fetch an toàn

const cache = new Map()

function cacheGet(key) {
  const hit = cache.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > CACHE_TTL_MS) { cache.delete(key); return null }
  return hit.value
}

function cacheSet(key, value) {
  if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value)
  cache.set(key, { at: Date.now(), value })
}

function assertAllowed(url) {
  if (url.protocol !== 'https:' || url.port || url.username || url.password || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error(`blocked host: ${url.hostname}`)
  }
}

/** Fetch có allowlist, timeout, tự kiểm tra từng lần redirect (chống SSRF). */
async function safeFetchText(rawUrl) {
  const cached = cacheGet(rawUrl)
  if (cached !== null) return cached

  let current = new URL(rawUrl)
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    assertAllowed(current)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const response = await fetch(current, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'vi,en;q=0.7', Accept: 'text/html,application/xml,application/json;q=0.9,*/*;q=0.5' },
      })
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        if (!location) throw new Error('redirect without location')
        current = new URL(location, current)
        continue
      }
      if (!response.ok) throw new Error(`status ${response.status}`)
      const text = (await response.text()).slice(0, MAX_HTML_CHARS)
      cacheSet(rawUrl, text)
      return text
    } finally {
      clearTimeout(timer)
    }
  }
  throw new Error('too many redirects')
}

// ---------------------------------------------------------------- xử lý text

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

function decodeEntities(value) {
  const safeCodePoint = (n) => { try { return String.fromCodePoint(n) } catch { return '' } }
  return String(value ?? '')
    .replace(/&#(\d+);/g, (_, n) => safeCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => safeCodePoint(parseInt(n, 16)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, name) => ENTITIES[name])
}

function stripTags(html) {
  return String(html ?? '')
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/?(?:br|p|div|li|ul|ol|tr|h[1-6]|blockquote|figure|figcaption)\b[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, '')
}

function normalizeSpaces(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function htmlToText(html) {
  return normalizeSpaces(decodeEntities(stripTags(html)))
}

function xmlField(block, tag) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i'))
  if (!match) return ''
  const raw = match[1]
  if (/<!\[CDATA\[/.test(raw)) return htmlToText(raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'))
  return normalizeSpaces(decodeEntities(stripTags(decodeEntities(raw))))
}

function allowedLink(value) {
  try {
    const url = new URL(String(value || '').trim())
    assertAllowed(url)
    return url.toString()
  } catch {
    return null
  }
}

// ---------------------------------------------------------------- Wikipedia

function wikiPageUrl(lang, title) {
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(String(title).replace(/ /g, '_'))}`
}

async function wikiQuery(lang, params) {
  const query = new URLSearchParams({ action: 'query', format: 'json', redirects: '1', ...params })
  const text = await safeFetchText(`https://${lang}.wikipedia.org/w/api.php?${query}`)
  const pages = Object.values(JSON.parse(text)?.query?.pages || {})
  return pages
    .filter((page) => page && !page.missing && page.extract)
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .slice(0, WIKI_MAX_PAGES)
    .map((page) => ({
      source: `Wikipedia (${lang})`,
      title: String(page.title || ''),
      url: wikiPageUrl(lang, page.title),
      extract: normalizeSpaces(page.extract).slice(0, WIKI_EXTRACT_CHARS),
    }))
}

async function wikiSearch(term) {
  for (const lang of ['vi', 'en']) {
    const results = await wikiQuery(lang, {
      generator: 'search',
      gsrsearch: term,
      gsrlimit: String(WIKI_MAX_PAGES),
      prop: 'extracts',
      exintro: '1',
      explaintext: '1',
      exlimit: String(WIKI_MAX_PAGES),
    })
    if (results.length) return results
  }
  return []
}

async function wikiByTitle(lang, title) {
  return wikiQuery(lang, { titles: title, prop: 'extracts', exintro: '1', explaintext: '1' })
}

function wikiTitleFromUrl(url) {
  const fromPath = url.pathname.match(/^\/wiki\/(.+)$/)
  if (fromPath) {
    try { return decodeURIComponent(fromPath[1]).replace(/_/g, ' ') } catch { return null }
  }
  return url.searchParams.get('title')
}

// ---------------------------------------------------------------- VnExpress

function pickFeed(message, url) {
  if (url) {
    const slug = url.pathname.split('/').filter(Boolean)[0]?.replace(/\.rss$/i, '')
    if (slug && VNE_KNOWN_SLUGS.has(slug)) return VNE_KNOWN_SLUGS.get(slug)
  }
  const text = String(message ?? '')
  return VNE_FEEDS.find((feed) => feed.re.test(text)) || DEFAULT_FEED
}

async function vnexpressFeed(feed) {
  const xml = await safeFetchText(`https://vnexpress.net/rss/${feed.slug}.rss`)
  const items = (xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || []).slice(0, VNE_MAX_ITEMS).map((block) => ({
    title: xmlField(block, 'title').slice(0, 200),
    summary: xmlField(block, 'description').slice(0, 300),
    published: xmlField(block, 'pubDate'),
    url: allowedLink(xmlField(block, 'link')),
  })).filter((item) => item.title)
  return { source: 'VnExpress', feed: feed.label, items }
}

function isVnexpressArticle(url) {
  return /-\d{5,}\.html$/i.test(url.pathname)
}

async function vnexpressArticle(url) {
  const html = await safeFetchText(url.toString())
  const title = htmlToText((html.match(/<h1[^>]*class="[^"]*title-detail[^"]*"[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '')
    || htmlToText((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '')
  const description = htmlToText((html.match(/<p[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/p>/i) || [])[1] || '')
  const paragraphs = [...html.matchAll(/<p[^>]*class="[^"]*Normal[^"]*"[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => htmlToText(match[1]))
    .filter(Boolean)
  let body = paragraphs.join('\n')
  if (!body) {
    const og = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]*)"/i)
    body = og ? normalizeSpaces(decodeEntities(og[1])) : ''
  }
  if (!title && !body) return null
  return {
    source: 'VnExpress',
    title: title.slice(0, 200),
    url: url.toString(),
    description: description.slice(0, 400),
    content: body.slice(0, VNE_ARTICLE_CHARS),
  }
}

// ---------------------------------------------------------------- điểm vào chính

/**
 * Trả về object đưa vào CONTEXT.web. Không bao giờ throw.
 * status: 'ok' | 'blocked' | 'no_results' | 'no_query' | 'error'
 */
export async function buildWebContext(message) {
  const base = { policy: POLICY, untrusted_content: true }
  try {
    const urls = extractUrls(message)
    // Tìm từ khóa trên text đã bỏ URL, để "vnexpress.net.evil.com" không bị tính là yêu cầu VnExpress.
    const plain = String(message ?? '').replace(URL_RE, ' ')
    const allowedUrls = urls.filter((item) => item.allowed)
    const blocked = [...new Set([
      ...urls.filter((item) => !item.allowed).map((item) => item.host),
      ...(plain.match(new RegExp(BLOCKED_KEYWORD_RE.source, 'giu')) || []).map((word) => word.toLowerCase()),
    ])].slice(0, 5)

    const wantsWiki = WIKI_KEYWORD_RE.test(plain)
    const wantsVne = VNE_KEYWORD_RE.test(plain) || NEWS_KEYWORD_RE.test(plain)
    const term = extractSearchTerm(message)
    const sources = []
    const errors = []
    const attempt = async (task) => {
      try {
        const result = await task()
        if (Array.isArray(result)) sources.push(...result)
        else if (result) sources.push(result)
      } catch (error) {
        errors.push(error?.name === 'AbortError' ? 'timeout' : (error?.message || 'unknown'))
      }
    }

    for (const { url } of allowedUrls.slice(0, 2)) {
      if (url.hostname.endsWith('wikipedia.org')) {
        const lang = url.hostname.startsWith('en.') ? 'en' : 'vi'
        const title = wikiTitleFromUrl(url)
        await attempt(() => (title ? wikiByTitle(lang, title) : (term ? wikiSearch(term) : [])))
      } else if (isVnexpressArticle(url)) {
        await attempt(() => vnexpressArticle(url))
      } else {
        await attempt(() => vnexpressFeed(pickFeed(message, url)))
      }
    }

    if (!allowedUrls.length) {
      if (wantsVne) await attempt(() => vnexpressFeed(pickFeed(message, null)))
      if (wantsWiki || (!wantsVne && blocked.length === 0)) {
        if (term) await attempt(() => wikiSearch(term))
        else if (wantsWiki) return { ...base, status: 'no_query', note: 'Người dùng chưa nói rõ muốn tra cứu nội dung gì trên Wikipedia.' }
      }
    }

    const result = { ...base, blocked_sites: blocked }
    if (sources.length) {
      return { ...result, status: 'ok', sources }
    }
    if (blocked.length && !allowedUrls.length && !wantsWiki && !wantsVne) {
      return { ...result, status: 'blocked', note: 'Trang người dùng yêu cầu không nằm trong danh sách được phép. Hãy nói rõ bạn không có quyền truy cập trang đó.' }
    }
    if (errors.length) {
      console.error('[AI web] fetch failed:', errors.join(' | '))
      return { ...result, status: 'error', note: 'Không lấy được nội dung từ trang web lúc này. Hãy nói thật là chưa truy cập được, không được bịa.' }
    }
    return { ...result, status: 'no_results', note: 'Không tìm thấy kết quả phù hợp trên Wikipedia/VnExpress.' }
  } catch (error) {
    console.error('[AI web] unexpected error:', error?.message || error)
    return { ...base, status: 'error', note: 'Không lấy được nội dung từ trang web lúc này. Hãy nói thật là chưa truy cập được, không được bịa.' }
  }
}

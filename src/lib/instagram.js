// Parses Instagram "Download your information" exports.
// followers_*.json is a top-level array whose entries carry the username in
// string_list_data[0].value; following.json wraps its array in
// { relationships_following: [...] } and puts the username in `title`.

function entriesOf(data) {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') {
    const key = Object.keys(data).find((k) => k.startsWith('relationships_'))
    if (key && Array.isArray(data[key])) return data[key]
  }
  throw new Error('Unrecognized file format')
}

function usernameOf(entry) {
  const item = entry?.string_list_data?.[0]
  if (item?.value) return item.value
  if (entry?.title) return entry.title
  const match = item?.href?.match(/instagram\.com\/(?:_u\/)?([^/?#]+)/)
  return match ? match[1] : null
}

export function parseAccounts(data) {
  const accounts = new Map()
  for (const entry of entriesOf(data)) {
    const username = usernameOf(entry)
    if (!username) continue
    accounts.set(username.toLowerCase(), {
      username,
      timestamp: entry.string_list_data?.[0]?.timestamp ?? null,
    })
  }
  return accounts
}

export function compare(following, followers) {
  const mutual = []
  const notFollowingBack = []
  const fans = []
  for (const [key, account] of following) {
    ;(followers.has(key) ? mutual : notFollowingBack).push(account)
  }
  for (const [key, account] of followers) {
    if (!following.has(key)) fans.push(account)
  }
  return { mutual, notFollowingBack, fans }
}

// Instagram exports can be several GB because of media, so only the zip's
// directory and the files we need are read, never the whole archive.
const FOLLOW_FILE =
  /(?:^|\/)connections\/followers_and_following\/(following|followers_\d+)\.(json|html)$/

export async function readExport(file) {
  const { ZipReader, BlobReader, TextWriter } = await import('@zip.js/zip.js')
  const reader = new ZipReader(new BlobReader(file))
  try {
    const following = new Map()
    const followers = new Map()
    const found = new Set()
    let foundHtml = false
    for (const entry of await reader.getEntries()) {
      const match = entry.filename.replace(/\\/g, '/').match(FOLLOW_FILE)
      if (!match) continue
      if (match[2] === 'html') {
        foundHtml = true
        continue
      }
      const accounts = parseAccounts(JSON.parse(await entry.getData(new TextWriter())))
      const kind = match[1] === 'following' ? 'following' : 'followers'
      found.add(kind)
      const target = kind === 'following' ? following : followers
      for (const [key, account] of accounts) target.set(key, account)
    }
    if (found.size < 2) {
      throw new Error(
        foundHtml
          ? 'This export is in HTML format. Request a new one from Instagram and choose JSON as the format.'
          : "Couldn't find connections/followers_and_following/following.json and followers_1.json in this zip.",
      )
    }
    return { following, followers }
  } finally {
    await reader.close()
  }
}

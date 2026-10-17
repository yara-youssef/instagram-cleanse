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

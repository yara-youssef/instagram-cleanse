<script setup>
import { computed, ref, watch } from 'vue'
import { compare, readExport } from './lib/instagram'

const upload = ref({ name: null, data: null, error: null, loading: false })

async function onFile(event) {
  const file = event.target.files?.[0]
  if (!file) return
  upload.value = { name: file.name, data: null, error: null, loading: true }
  try {
    upload.value.data = await readExport(file)
  } catch (e) {
    upload.value.error =
      e instanceof SyntaxError ? 'The followers files in this zip are not valid JSON' : e.message
  } finally {
    upload.value.loading = false
  }
}

const result = computed(() => {
  const data = upload.value.data
  return data ? compare(data.following, data.followers) : null
})

const tabs = [
  { id: 'notFollowingBack', label: "Don't follow you back" },
  { id: 'fans', label: "You don't follow back" },
  { id: 'mutual', label: 'Mutuals' },
]
const activeTab = ref('notFollowingBack')
const search = ref('')

// The export has no profile pictures, so they are looked up by username.
// Failed lookups are remembered so the row falls back to the initial.
const brokenAvatars = ref(new Set())
const avatarUrl = (username) => `https://unavatar.io/instagram/${username}?fallback=false`
const initialOf = (username) => (username.replace(/[^a-z0-9]/gi, '')[0] || '?').toUpperCase()

// Progress is kept in localStorage (keyed by lowercase username) so it
// survives reloads and re-uploading the files.
function storedSet(key) {
  let initial = []
  try {
    initial = JSON.parse(localStorage.getItem(key)) ?? []
  } catch {}
  const set = ref(new Set(initial))
  watch(
    set,
    (value) => {
      try {
        localStorage.setItem(key, JSON.stringify([...value]))
      } catch {}
    },
    { deep: true },
  )
  return set
}
const opened = storedSet('instagram-cleanse:opened')
const done = storedSet('instagram-cleanse:done')
const hideDone = ref(false)

const keyOf = (account) => account.username.toLowerCase()
function toggleDone(account) {
  const key = keyOf(account)
  done.value.has(key) ? done.value.delete(key) : done.value.add(key)
}

const doneCount = computed(() =>
  result.value ? result.value[activeTab.value].filter((a) => done.value.has(keyOf(a))).length : 0,
)

const visible = computed(() => {
  if (!result.value) return []
  const q = search.value.trim().toLowerCase()
  return result.value[activeTab.value]
    .filter((a) => a.username.toLowerCase().includes(q))
    .filter((a) => !hideDone.value || !done.value.has(keyOf(a)))
    .sort((a, b) => a.username.localeCompare(b.username))
})
</script>

<template>
  <main>
    <h1>Instagram Cleanse</h1>
    <p class="hint">
      Upload the <code>.zip</code> from your Instagram data export (JSON format). Your files stay in
      your browser.
    </p>

    <details class="howto">
      <summary>How do I get this zip?</summary>
      <ol>
        <li>
          Open
          <a
            href="https://accountscenter.instagram.com/info_and_permissions/dyi/"
            target="_blank"
            rel="noopener"
          >
            Export your information</a
          >
          in Instagram's Accounts Center. In the app it's under Settings → Accounts Center → Your
          information and permissions.
        </li>
        <li>
          Tap <b>Create export</b>, pick your Instagram account, then <b>Export to device</b>.
        </li>
        <li>
          Under <b>Customize information</b>, untick everything except
          <b>Followers and following</b>. This keeps the file small and quick to make.
        </li>
        <li>
          Set <b>Date range</b> to <b>All time</b> and <b>Format</b> to <b>JSON</b> (not HTML).
        </li>
        <li>
          Tap <b>Start export</b>. Instagram emails you when it's ready, usually within minutes to a
          few hours. Come back to the same page to download it.
        </li>
        <li>Upload the downloaded <code>.zip</code> below as it is, no need to unzip it.</li>
      </ol>
      <p>Instagram renames these menus now and then, so the wording may be slightly different.</p>
    </details>

    <label class="upload">
      <span class="upload-title">Instagram export</span>
      <input type="file" accept=".zip,application/zip" @change="onFile" />
      <span v-if="upload.loading" class="ok">Reading {{ upload.name }}…</span>
      <span v-else-if="upload.error" class="error">{{ upload.error }}</span>
      <span v-else-if="upload.data" class="ok">
        {{ upload.name }} · following {{ upload.data.following.size }} · followers
        {{ upload.data.followers.size }}
      </span>
    </label>

    <section v-if="result">
      <nav class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          {{ tab.label }} <span class="count">{{ result[tab.id].length }}</span>
        </button>
      </nav>

      <input v-model="search" class="search" type="search" placeholder="Search usernames…" />

      <div class="toolbar">
        <span>{{ doneCount }} of {{ result[activeTab].length }} done</span>
        <label><input v-model="hideDone" type="checkbox" /> Hide done</label>
      </div>

      <ul class="list">
        <li
          v-for="account in visible"
          :key="account.username"
          :class="{ done: done.has(keyOf(account)) }"
        >
          <a
            :href="`https://www.instagram.com/${account.username}`"
            target="_blank"
            rel="noopener"
            @click="opened.add(keyOf(account))"
          >
            <span class="avatar">
              {{ initialOf(account.username) }}
              <img
                v-if="!brokenAvatars.has(account.username)"
                :src="avatarUrl(account.username)"
                alt=""
                loading="lazy"
                @error="brokenAvatars.add(account.username)"
              />
            </span>
            <span class="username">@{{ account.username }}</span>
            <span v-if="opened.has(keyOf(account)) && !done.has(keyOf(account))" class="tag">
              opened
            </span>
          </a>
          <label class="check">
            <input
              type="checkbox"
              :checked="done.has(keyOf(account))"
              @change="toggleDone(account)"
            />
            Done
          </label>
        </li>
        <li v-if="!visible.length" class="empty">No accounts here.</li>
      </ul>
    </section>
  </main>
</template>

<style>
:root {
  --bg: #fafafa;
  --fg: #1a1a1a;
  --muted: #6b6b6b;
  --card: #fff;
  --border: #e3e3e3;
  --accent: #d6246e;
  font-family:
    system-ui,
    -apple-system,
    sans-serif;
  color: var(--fg);
  background: var(--bg);
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #121212;
    --fg: #ececec;
    --muted: #9a9a9a;
    --card: #1c1c1c;
    --border: #333;
  }
}
body {
  margin: 0;
}
</style>

<style scoped>
main {
  max-width: 640px;
  margin: 0 auto;
  padding: 32px 16px;
}
h1 {
  margin: 0 0 8px;
}
.hint {
  color: var(--muted);
  margin: 0 0 24px;
}
.howto {
  margin: 0 0 24px;
  padding: 12px 16px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
}
.howto summary {
  font-weight: 600;
  cursor: pointer;
}
.howto ol {
  margin: 12px 0 0;
  padding-left: 20px;
  line-height: 1.5;
}
.howto li + li {
  margin-top: 6px;
}
.howto p {
  margin: 12px 0 0;
  color: var(--muted);
  font-size: 0.9em;
}
.howto a {
  color: var(--accent);
}
.upload {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 24px;
  padding: 16px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
}
.upload-title {
  font-weight: 600;
}
.ok {
  color: var(--muted);
  font-size: 0.9em;
}
.error {
  color: #d33;
  font-size: 0.9em;
}
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.tabs button {
  padding: 8px 14px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--card);
  color: var(--fg);
  cursor: pointer;
  font: inherit;
}
.tabs button.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.count {
  opacity: 0.75;
  margin-left: 4px;
}
.search {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  margin-bottom: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card);
  color: var(--fg);
  font: inherit;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
}
.list li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
}
.list li:last-child {
  border-bottom: none;
}
.list a {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--fg);
  text-decoration: none;
}
.avatar {
  position: relative;
  flex: none;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--border);
  color: var(--muted);
  font-weight: 600;
}
.avatar img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.list a:hover {
  color: var(--accent);
}
.username {
  overflow: hidden;
  text-overflow: ellipsis;
}
.tag {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--border);
  color: var(--muted);
  font-size: 0.8em;
}
.check {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 0.9em;
  cursor: pointer;
}
.list li.done a {
  opacity: 0.45;
}
.list li.done .username {
  text-decoration: line-through;
}
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  color: var(--muted);
  font-size: 0.9em;
}
.toolbar label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}
.empty {
  color: var(--muted);
}
</style>

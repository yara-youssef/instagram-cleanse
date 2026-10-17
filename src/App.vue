<script setup>
import { computed, ref } from 'vue'
import { compare, parseAccounts } from './lib/instagram'

const files = ref({
  following: { name: null, accounts: null, error: null },
  followers: { name: null, accounts: null, error: null },
})

async function onFile(kind, event) {
  const file = event.target.files?.[0]
  if (!file) return
  const slot = files.value[kind]
  slot.name = file.name
  slot.error = null
  slot.accounts = null
  try {
    slot.accounts = parseAccounts(JSON.parse(await file.text()))
  } catch (e) {
    slot.error = e instanceof SyntaxError ? 'Not a valid JSON file' : e.message
  }
}

const result = computed(() => {
  const { following, followers } = files.value
  if (!following.accounts || !followers.accounts) return null
  return compare(following.accounts, followers.accounts)
})

const tabs = [
  { id: 'notFollowingBack', label: "Don't follow you back" },
  { id: 'fans', label: "You don't follow back" },
  { id: 'mutual', label: 'Mutuals' },
]
const activeTab = ref('notFollowingBack')
const search = ref('')

const visible = computed(() => {
  if (!result.value) return []
  const q = search.value.trim().toLowerCase()
  return result.value[activeTab.value]
    .filter((a) => a.username.toLowerCase().includes(q))
    .sort((a, b) => a.username.localeCompare(b.username))
})
</script>

<template>
  <main>
    <h1>Instagram Cleanse</h1>
    <p class="hint">
      Upload <code>following.json</code> and <code>followers_1.json</code> from your Instagram data
      export. Everything stays in your browser.
    </p>

    <div class="uploads">
      <label v-for="kind in ['following', 'followers']" :key="kind" class="upload">
        <span class="upload-title">{{ kind === 'following' ? 'Following' : 'Followers' }}</span>
        <input type="file" accept=".json,application/json" @change="onFile(kind, $event)" />
        <span v-if="files[kind].error" class="error">{{ files[kind].error }}</span>
        <span v-else-if="files[kind].accounts" class="ok">
          {{ files[kind].name }} · {{ files[kind].accounts.size }} accounts
        </span>
      </label>
    </div>

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

      <ul class="list">
        <li v-for="account in visible" :key="account.username">
          <a :href="`https://www.instagram.com/${account.username}`" target="_blank" rel="noopener">
            @{{ account.username }}
          </a>
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
  font-family: system-ui, -apple-system, sans-serif;
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
.uploads {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}
.upload {
  display: flex;
  flex-direction: column;
  gap: 8px;
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
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
}
.list li:last-child {
  border-bottom: none;
}
.list a {
  color: var(--fg);
  text-decoration: none;
}
.list a:hover {
  color: var(--accent);
}
.empty {
  color: var(--muted);
}
</style>

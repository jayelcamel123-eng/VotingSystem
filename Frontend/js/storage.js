/*
  Browser storage is intentionally limited to session/cache data.
  PostgreSQL is the authoritative source for voters, candidates,
  elections, votes, and results.
*/
const STORAGE_KEYS = { offlineVotes: 'offlineVotes', loggedVoter: 'loggedVoter' }

function getStoredValue(key, fallback) {
  const raw = localStorage.getItem(key)
  if (raw === null) return fallback
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function saveStoredValue(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function getCurrentVoter() {
  return getLoggedVoter()
}

function getLoggedVoter() {
  return getStoredValue(STORAGE_KEYS.loggedVoter, null)
}

function saveLoggedVoter(voter) {
  saveStoredValue(STORAGE_KEYS.loggedVoter, voter)
}

function clearLoggedVoter() {
  localStorage.removeItem(STORAGE_KEYS.loggedVoter)
}

function getOfflineVotes() {
  return getStoredValue(STORAGE_KEYS.offlineVotes, [])
}

function saveOfflineVotes(votes) {
  saveStoredValue(STORAGE_KEYS.offlineVotes, votes)
}

function resetDemoVotingState() {
  saveOfflineVotes([])
  clearLoggedVoter()
  return null
}

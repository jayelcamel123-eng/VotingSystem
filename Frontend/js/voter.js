let currentBallotData = null

/* =========================================================
   CURRENT LOGGED VOTER
========================================================= */

function currentLoggedVoter() {
  try {
    return JSON.parse(localStorage.getItem('currentVoter') || 'null')
  } catch {
    return null
  }
}

/* =========================================================
   SET VOTER HEADER
========================================================= */

function setVoterHeader(voter) {
  const name = document.getElementById('loggedVoterName')
  const id = document.getElementById('loggedVoterID')

  if (name) {
    name.textContent = voter?.name || 'Voter'
  }

  if (id) {
    id.textContent = voter?.voter_id || '—'
  }
}

/* =========================================================
   LOAD VOTER DASHBOARD
========================================================= */

async function loadVoterDashboard() {
  const voter = currentLoggedVoter()

  if (!voter) {
    return
  }

  setVoterHeader(voter)

  try {
    const data = await apiJson(`/votes/ballot/${encodeURIComponent(voter.voter_id)}`)

    /* ---------------------------------------------
           UPDATE VOTER DATA
        --------------------------------------------- */

    if (data.voter) {
      localStorage.setItem('currentVoter', JSON.stringify(data.voter))

      setVoterHeader(data.voter)
    }

    /* ---------------------------------------------
           CURRENT ELECTION
        --------------------------------------------- */

    const title = document.getElementById('currentElectionTitle')
    const status = document.getElementById('currentElectionStatus')
    const message = document.getElementById('voterConnectionMessage')

    if (data.election) {
      if (title) {
        title.textContent = data.election.election_name
      }

      if (status) {
        status.textContent = String(data.election.status).toUpperCase()

        status.className =
          'badge ' + (data.election.status === 'ongoing' ? 'badge-green' : 'badge-yellow')
      }

      if (message && navigator.onLine) {
        message.textContent =
          data.election.status === 'ongoing'
            ? 'You are connected. Voting is open.'
            : 'The election is not currently open for voting.'
      }
    } else {
      if (title) {
        title.textContent = 'No active election'
      }

      if (status) {
        status.textContent = 'NO ACTIVE ELECTION'

        status.className = 'badge badge-yellow'
      }
    }

    /* ---------------------------------------------
           ELECTION RESULTS
        --------------------------------------------- */

    renderVoterElectionResults(data)
  } catch (e) {
    console.warn('Voter dashboard load:', e.message)

    const results = document.getElementById('voterElectionResults')

    if (results) {
      results.innerHTML = `
                <div class="voter-results-empty">
                    Unable to load election results.
                </div>
            `
    }
  }

  updateVoterConnection()
}

/* =========================================================
   RENDER VOTER ELECTION RESULTS
========================================================= */

function renderVoterElectionResults(data) {
  const summary = document.getElementById('voterResultSummary')
  const results = document.getElementById('voterElectionResults')

  if (!results) {
    return
  }

  /* ---------------------------------------------
       NO CURRENT ELECTION
    --------------------------------------------- */

  if (!data || !data.election) {
    if (summary) {
      summary.innerHTML = ''
    }

    results.innerHTML = `
            <div class="voter-results-empty">
                There is no active election at the moment.
            </div>
        `

    return
  }

  /*
       The backend will provide:

       data.resultSummary
       data.results
    */

  const resultSummary = data.resultSummary || {}
  const resultData = Array.isArray(data.results) ? data.results : []

  /* ---------------------------------------------
       SUMMARY
    --------------------------------------------- */

  if (summary) {
    const registeredVoters = Number(resultSummary.registeredVoters || 0)
    const votesCast = Number(resultSummary.votesCast || 0)
    const turnout = Number(resultSummary.turnout || 0)

    summary.innerHTML = `

            <div class="voter-result-summary-card">
                <h4>Registered Voters</h4>
                <strong>
                    ${registeredVoters}
                </strong>
            </div>

            <div class="voter-result-summary-card">
                <h4>Votes Cast</h4>
                <strong>
                    ${votesCast}
                </strong>
            </div>

            <div class="voter-result-summary-card">
                <h4>Voter Turnout</h4>
                <strong>
                    ${turnout.toFixed(1)}%
                </strong>
            </div>

        `
  }

  /* ---------------------------------------------
       NO RESULTS
    --------------------------------------------- */

  if (!resultData.length) {
    results.innerHTML = `
            <div class="voter-results-empty">
                No election results are available yet.
            </div>
        `

    return
  }

  /* ---------------------------------------------
       GROUP RESULTS BY POSITION
    --------------------------------------------- */

  const groups = {}

  resultData.forEach((item) => {
    const positionId = item.position_id

    if (!groups[positionId]) {
      groups[positionId] = {
        position_id: positionId,

        position_name: item.position_name,

        candidates: [],
      }
    }

    groups[positionId].candidates.push(item)
  })

  /* ---------------------------------------------
       BUILD HTML
    --------------------------------------------- */

  results.innerHTML = Object.values(groups)
    .map((group) => {
      return `

                    <div class="voter-result-position">

                        <h3>
                            ${escapeHTML(group.position_name)}
                        </h3>


                        ${group.candidates
                          .map((candidate) => {
                            const votes = Number(candidate.vote_count || 0)

                            const percentage = Number(candidate.percentage || 0)

                            return `

                                    <div class="voter-result-candidate">

                                        <div class="voter-result-candidate-top">

                                            <div>

                                                <div class="voter-result-candidate-name">
                                                    ${escapeHTML(candidate.candidate_name)}
                                                </div>

                                                <div class="voter-result-party">
                                                    ${escapeHTML(
                                                      candidate.party_name || 'Independent'
                                                    )}
                                                </div>

                                            </div>


                                            <div class="voter-result-votes">

                                                <strong>
                                                    ${votes}
                                                    ${votes === 1 ? 'vote' : 'votes'}
                                                </strong>

                                                <div class="voter-result-percentage">
                                                    ${percentage.toFixed(1)}%
                                                </div>

                                            </div>

                                        </div>


                                        <div class="voter-result-progress">

                                            <div
                                                class="voter-result-progress-bar"
                                                style="width:${Math.max(
                                                  0,
                                                  Math.min(100, percentage)
                                                )}%"
                                            ></div>

                                        </div>

                                    </div>

                                `
                          })
                          .join('')}

                    </div>

                `
    })
    .join('')
}

/* =========================================================
   LOAD BALLOT
========================================================= */

async function loadBallot() {
  const voter = currentLoggedVoter()

  if (!voter) {
    return
  }

  const container = document.getElementById('ballotContainer')

  if (container) {
    container.innerHTML = `
            <div class="card">
                <p>Loading ballot...</p>
            </div>
        `
  }

  try {
    const data = await apiJson(`/votes/ballot/${encodeURIComponent(voter.voter_id)}`)

    currentBallotData = data

    localStorage.setItem('cachedBallot', JSON.stringify(data))

    renderBallot(data)
  } catch (e) {
    const cached = JSON.parse(localStorage.getItem('cachedBallot') || 'null')

    if (cached) {
      currentBallotData = cached

      renderBallot(cached, true)
    } else if (container) {
      container.innerHTML = `
                <div class="card">

                    <p>
                        Unable to load ballot.
                    </p>

                    <small>
                        ${escapeHTML(e.message)}
                    </small>

                </div>
            `
    }
  }
}

/* =========================================================
   RENDER BALLOT
========================================================= */

function renderBallot(data, offline = false) {
  const container = document.getElementById('ballotContainer')

  if (!container) {
    return
  }

  if (!data.election) {
    container.innerHTML = `
            <div class="card">

                <h3>
                    No active election
                </h3>

                <p>
                    There is no election currently open.
                    Please return later.
                </p>

            </div>
        `

    return
  }

  if (data.voter?.voting_status === 'voted') {
    container.innerHTML = `
            <div class="card">

                <h3>
                    Ballot already submitted
                </h3>

                <p>
                    Your voting record shows that
                    you have already voted in this election.
                </p>

            </div>
        `

    return
  }

  const voterGrade = Number(data.voter.grade)

  const groups = {}

  ;(data.candidates || []).forEach((c) => {
    if (
      String(c.position_name).toLowerCase() === 'grade representative' &&
      Number(c.grade) !== voterGrade
    ) {
      return
    }

    ;(groups[c.position_id] ||= {
      position_id: c.position_id,

      position_name: c.position_name,

      candidates: [],
    }).candidates.push(c)
  })

  const html = Object.values(groups)
    .map(
      (group) => `

                <div class="ballot-position">

                    <h3>
                        ${
                          group.position_name === 'Grade Representative'
                            ? `Grade ${voterGrade} Representative`
                            : escapeHTML(group.position_name)
                        }
                    </h3>


                    ${group.candidates
                      .map(
                        (c) => `

                            <label class="ballot-option">

                                <input
                                    type="radio"
                                    name="position_${c.position_id}"
                                    value="${c.candidate_id}"
                                    data-position-id="${c.position_id}"
                                />

                                <div>

                                    <strong>
                                        ${escapeHTML(c.candidate_name)}
                                    </strong>

                                    <p
                                        style="
                                            font-size:12px;
                                            color:#78857d;
                                        "
                                    >
                                        ${escapeHTML(c.party_name || 'Independent')}
                                    </p>

                                </div>

                            </label>

                        `
                      )
                      .join('')}

                </div>

            `
    )
    .join('')

  container.innerHTML = `

        <div class="ballot-header">

            <h2>
                ${escapeHTML(data.election.election_name)}
            </h2>

            <p
                style="
                    color:#78857d;
                    margin-top:7px;
                "
            >
                Select one candidate for each position.
            </p>

        </div>


        ${
          offline
            ? `
                    <div class="offline-notice">
                        📡 Offline mode:
                        this is a cached ballot.
                        Your vote will be stored locally
                        and synced when you reconnect.
                    </div>
                `
            : ''
        }


        ${html}


        <button
            class="ballot-submit"
            onclick="submitVoterBallot()"
        >
            🗳️ Submit Ballot
        </button>


        <br>
        <br>


        <button
            class="btn"
            onclick="closeVoterBallot()"
        >
            ← Back to Dashboard
        </button>

    `
}

/* =========================================================
   CONNECTION STATUS
========================================================= */

function updateVoterConnection() {
  const online = navigator.onLine
  const mode = document.getElementById('voterMode')
  const card = document.getElementById('voterModeCard')
  const msg = document.getElementById('voterConnectionMessage')

  if (mode) {
    mode.textContent = online ? '● Online' : '● Offline'

    mode.className = online ? 'badge mode-online' : 'badge mode-offline'
  }

  if (card) {
    card.textContent = online ? 'Online Mode' : 'Offline Mode'

    card.className = online ? 'badge mode-online' : 'badge mode-offline'
  }

  if (msg) {
    msg.textContent = online
      ? 'You are connected.'
      : 'You are offline. Cached voting data may be used.'
  }

  const notice = document.getElementById('offlineNotice')

  if (notice) {
    notice.style.display = online ? 'none' : 'block'
  }

  if (online) {
    syncOfflineVotes()
  }
}

/* =========================================================
   ONLINE / OFFLINE EVENTS
========================================================= */

window.addEventListener('online', () => {
  updateVoterConnection()
  loadVoterDashboard()
})

window.addEventListener('offline', updateVoterConnection)

/* =========================================================
   OPEN BALLOT
========================================================= */

async function openVoterBallot() {
  const voter = currentLoggedVoter()

  if (!voter) {
    return
  }

  if (voter.voting_status === 'voted') {
    alert('You have already submitted your ballot.')

    return
  }

  document.getElementById('voterDashboard')?.setAttribute('style', 'display:none;')

  const ballot = document.getElementById('voterBallot')

  if (ballot) {
    ballot.style.display = 'block'
  }

  if (navigator.onLine) {
    await loadBallot()
  } else {
    const cached = JSON.parse(localStorage.getItem('cachedBallot') || 'null')

    if (cached) {
      currentBallotData = cached

      renderBallot(cached, true)
    } else {
      renderBallot({
        election: null,
      })
    }
  }
}

/* =========================================================
   CLOSE BALLOT
========================================================= */

function closeVoterBallot() {
  const ballot = document.getElementById('voterBallot')
  const dash = document.getElementById('voterDashboard')

  if (ballot) {
    ballot.style.display = 'none'
  }

  if (dash) {
    dash.style.display = 'block'
  }
}

/* =========================================================
   PAGE LOAD
========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('voterDashboard')) {
    loadVoterDashboard()
  }

  if (document.getElementById('ballotContainer')) {
    loadBallot()
  }
})

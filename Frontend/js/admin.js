async function readJson(response) {
  const data = await response.json().catch(() => ({}))
  if (!response.ok || data.success === false)
    throw new Error(data.message || `Request failed with HTTP ${response.status}`)
  return data
}

document.addEventListener('DOMContentLoaded', async () => {
  setupAdminDashboard()
  await setupAdminTables()
  toggleGradeLevelField()
  await loadElectionOptions()

  const positionSelect = document.getElementById('candidatePosition')
  if (positionSelect) positionSelect.addEventListener('change', toggleGradeLevelField)
})

function setupAdminDashboard() {
  updateVoterCount()
  updateCandidateCount()

  if (document.getElementById('totalVoters')) {
    loadDashboardStats()
    loadRecentActivity()
  }
}

async function setupAdminTables() {
  if (document.getElementById('voterTable')) {
    setupVoterFilters()
    await loadVoterFilters()
    await renderVoterTable()
  }

  if (document.getElementById('candidateTable')) renderCandidateTable()
  if (document.getElementById('electionGrid')) renderElectionCards()
}

async function loadDashboardStats() {
  try {
    const data = await readJson(await authFetch(apiUrl('/dashboard/stats')))
    const stats = data.stats || {}

    const set = (id, value) => {
      const el = document.getElementById(id)
      if (el) el.textContent = value ?? 0
    }

    set('totalVoters', stats.totalVoters)
    set('totalCandidates', stats.totalCandidates)
    set('activeElections', stats.activeElections)
    set('votesCast', stats.votesCast)

    const election = data.currentElection
    const name = document.getElementById('currentElectionName')
    const status = document.getElementById('currentElectionStatus')
    const message = document.getElementById('currentElectionDates')

    if (!election) {
      if (name) name.textContent = 'No election available'
      if (status) status.textContent = 'NONE'
      if (message) message.textContent = 'No current or upcoming election has been created.'
      return
    }

    if (name) name.textContent = election.election_name
    if (status) {
      status.textContent = String(election.status).toUpperCase()
      status.className = election.status === 'ongoing' ? 'badge badge-green' : 'badge badge-yellow'
    }
    if (message) {
      const startDate = new Date(election.start_date).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
      const endDate = new Date(election.end_date).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
      if (election.status === 'ongoing') {
        message.textContent = `Election period: ${startDate} - ${endDate}`
      } else if (election.status === 'upcoming') {
        message.textContent = `Election starts on ${startDate}`
      } else {
        message.textContent = `Election ended on ${endDate}`
      }
    }
  } catch (error) {
    console.error('Dashboard loading error:', error)
  }
}

// VOTERS
async function loadVoterFilters() {
  const gradeSelect = document.getElementById('voterGrade')
  const sectionSelect = document.getElementById('voterSection')

  if (!gradeSelect || !sectionSelect) return

  try {
    const data = await readJson(await authFetch(apiUrl('/voters')))

    const voters = data.voters || []

    const currentGrade = gradeSelect.value
    const currentSection = sectionSelect.value

    const grades = [
      ...new Set(voters.map((voter) => String(voter.grade || '').trim()).filter(Boolean)),
    ].sort((a, b) => Number(a) - Number(b))

    gradeSelect.innerHTML = `
            <option value="">All Grades</option>
            ${grades
              .map(
                (grade) =>
                  `<option value="${escapeHTML(grade)}">Grade ${escapeHTML(grade)}</option>`
              )
              .join('')}
        `

    if (grades.includes(currentGrade)) {
      gradeSelect.value = currentGrade
    } else {
      gradeSelect.value = ''
    }

    updateVoterSectionFilter(false, currentSection)
  } catch (error) {
    console.error('Load voter filters error:', error)
  }
}

function updateVoterSectionFilter(render = true, preferredSection = '') {
  const gradeSelect = document.getElementById('voterGrade')
  const sectionSelect = document.getElementById('voterSection')

  if (!gradeSelect || !sectionSelect) return

  const selectedGrade = gradeSelect.value

  if (!selectedGrade) {
    sectionSelect.innerHTML = `
            <option value="">All Sections</option>
        `
    sectionSelect.value = ''
    sectionSelect.disabled = true

    if (render) renderVoterTable()
    return
  }

  authFetch(apiUrl('/voters'))
    .then(readJson)
    .then((data) => {
      const voters = data.voters || []

      const sections = [
        ...new Set(
          voters
            .filter((voter) => String(voter.grade || '').trim() === selectedGrade)
            .map((voter) => String(voter.section || '').trim())
            .filter(Boolean)
        ),
      ].sort()

      sectionSelect.innerHTML = `
                <option value="">All Sections</option>
                ${sections
                  .map(
                    (section) =>
                      `<option value="${escapeHTML(section)}">${escapeHTML(section)}</option>`
                  )
                  .join('')}
            `

      if (sections.includes(preferredSection)) {
        sectionSelect.value = preferredSection
      } else {
        sectionSelect.value = ''
      }

      sectionSelect.disabled = false

      if (render) renderVoterTable()
    })
    .catch((error) => {
      console.error('Load voter sections error:', error)
    })
}

function setupVoterFilters() {
  const gradeSelect = document.getElementById('voterGrade')
  const sectionSelect = document.getElementById('voterSection')

  if (!gradeSelect || !sectionSelect) return

  gradeSelect.addEventListener('change', () => {
    updateVoterSectionFilter()
  })

  sectionSelect.addEventListener('change', () => {
    renderVoterTable()
  })
}

async function renderVoterTable() {
  const table = document.getElementById('voterTable')
  if (!table) return

  try {
    const data = await readJson(await authFetch(apiUrl('/voters')))

    let voters = data.voters || []

    const selectedGrade = document.getElementById('voterGrade')?.value || ''

    const selectedSection = document.getElementById('voterSection')?.value || ''

    if (selectedGrade) {
      voters = voters.filter((voter) => String(voter.grade || '').trim() === selectedGrade)
    }

    if (selectedSection) {
      voters = voters.filter((voter) => String(voter.section || '').trim() === selectedSection)
    }

    if (!voters.length) {
      table.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align:center;">
                        No voters found.
                    </td>
                </tr>
            `
      updateVoterCount()
      return
    }

    table.innerHTML = voters
      .map((voter) => {
        const archived = voter.archived_at !== null

        return `
                <tr>
                    <td>${escapeHTML(voter.voter_id)}</td>
                    <td>${escapeHTML(voter.name)}</td>
                    <td>Grade ${escapeHTML(voter.grade)}</td>
                    <td>${escapeHTML(voter.section)}</td>
                    <td>
                        <span class="badge ${
                          archived
                            ? 'badge-red'
                            : voter.voting_status === 'voted'
                              ? 'badge-yellow'
                              : 'badge-green'
                        }">
                            ${
                              archived
                                ? 'Archived'
                                : voter.voting_status === 'voted'
                                  ? 'Voted'
                                  : 'Eligible'
                            }
                        </span>
                    </td>
                    <td>
                        ${
                          archived
                            ? `
                                    <button
                                        class="btn btn-primary btn-small"
                                        onclick="restoreVoter('${escapeHTML(voter.voter_id)}')"
                                    >
                                        Restore
                                    </button>
                                `
                            : `
                                    <button
                                        type="button"
                                        class="btn btn-primary btn-small edit-voter-btn"
                                        data-voter-id="${escapeHTML(voter.voter_id)}"
                                    >
                                        Edit
                                    </button>

                                    <button
                                        class="btn btn-danger btn-small"
                                        onclick="deleteVoter('${escapeHTML(voter.voter_id)}')"
                                    >
                                        Delete
                                    </button>
                                `
                        }
                    </td>
                </tr>
            `
      })
      .join('')

    updateVoterCount()
  } catch (error) {
    console.error('Load voters error:', error)

    table.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center;">
                    Failed to load voters.<br>
                    <small>${escapeHTML(error.message)}</small>
                </td>
            </tr>
        `
  }
}

function searchVoters() {
  const input = document.getElementById('voterSearch')
  const search = (input?.value || '').toLowerCase()

  document.querySelectorAll('#voterTable tr').forEach((row) => {
    row.style.display = row.textContent.toLowerCase().includes(search) ? '' : 'none'
  })
}

async function addVoter() {
  const id = document.getElementById('newStudentID')?.value.trim().toUpperCase()
  const name = document.getElementById('newVoterName')?.value.trim()
  const grade = Number(document.getElementById('newGrade')?.value)
  const section = document.getElementById('newSection')?.value.trim()
  const password = document.getElementById('newVoterPassword')?.value.trim()

  if (
    !id ||
    !name ||
    !Number.isInteger(grade) ||
    grade < 7 ||
    grade > 12 ||
    !section ||
    !password
  ) {
    alert('Please complete all voter information.')
    return
  }

  try {
    const data = await readJson(
      await authFetch(apiUrl('/voters'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voter_id: id,
          name,
          grade,
          section,
          password,
        }),
      })
    )

    alert(data.message || 'Voter account created successfully!')
    closeModal('voterModal')
    ;['newStudentID', 'newVoterName', 'newSection', 'newVoterPassword'].forEach((id) => {
      const el = document.getElementById(id)
      if (el) el.value = ''
    })

    const gradeEl = document.getElementById('newGrade')
    if (gradeEl) gradeEl.value = '7'

    await loadVoterFilters()
    await renderVoterTable()
  } catch (error) {
    console.error('Create voter error:', error)
    alert(`Failed to create voter.\n\n${error.message}`)
  }
}

function togglePasswordVisibility(inputId, button) {
  const input = document.getElementById(inputId)
  if (!input) return

  if (input.type === 'password') {
    input.type = 'text'
    button.textContent = 'Hide'
  } else {
    input.type = 'password'
    button.textContent = 'Show'
  }
}

async function openEditVoter(voterId) {
  try {
    const data = await readJson(await authFetch(apiUrl(`/voters/${encodeURIComponent(voterId)}`)))

    const voter = data.voter

    document.getElementById('editVoterID').value = voter.voter_id
    document.getElementById('editVoterName').value = voter.name || ''
    document.getElementById('editGrade').value = String(voter.grade || '')
    document.getElementById('editSection').value = voter.section || ''
    document.getElementById('editVoterPassword').value = ''

    openModal('editVoterModal')
  } catch (error) {
    console.error('Open edit voter error:', error)
    alert(`Failed to load voter.\n\n${error.message}`)
  }
}

async function updateVoter() {
  try {
    const voterId = document.getElementById('editVoterID')?.value.trim()
    const name = document.getElementById('editVoterName')?.value.trim()
    const grade = Number(document.getElementById('editGrade')?.value)
    const section = document.getElementById('editSection')?.value.trim()
    const password = document.getElementById('editVoterPassword')?.value.trim()

    if (!voterId) return alert('Voter ID is missing.')
    if (!name) return alert('Name is required.')
    if (!Number.isInteger(grade) || grade < 7 || grade > 12) {
      return alert('Grade must be from 7 to 12.')
    }
    if (!section) return alert('Section is required.')

    const body = { name, grade, section }

    if (password) body.password = password

    const data = await readJson(
      await authFetch(apiUrl(`/voters/${encodeURIComponent(voterId)}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    )

    alert(data.message || 'Voter updated successfully!')
    closeModal('editVoterModal')

    document.getElementById('editVoterPassword').value = ''

    await loadVoterFilters()
    await renderVoterTable()
  } catch (error) {
    console.error('Update voter error:', error)
    alert(`Failed to update voter.\n\n${error.message}`)
  }
}

async function deleteVoter(voterId) {
  if (!confirm(`Archive voter ${voterId}?`)) return

  try {
    const data = await readJson(
      await authFetch(apiUrl(`/voters/${encodeURIComponent(voterId)}/archive`), { method: 'PUT' })
    )

    alert(data.message || 'Voter archived successfully!')

    await loadVoterFilters()
    await renderVoterTable()
  } catch (error) {
    console.error('Archive voter error:', error)
    alert(`Failed to archive voter.\n\n${error.message}`)
  }
}

async function archiveVoter(voterId) {
  return deleteVoter(voterId)
}

async function restoreVoter(voterId) {
  if (!confirm(`Restore voter ${voterId}?`)) return

  try {
    const data = await readJson(
      await authFetch(apiUrl(`/voters/${encodeURIComponent(voterId)}/restore`), { method: 'PUT' })
    )

    alert(data.message || 'Voter restored successfully!')

    await loadVoterFilters()
    await renderVoterTable()
  } catch (error) {
    console.error('Restore voter error:', error)
    alert(`Failed to restore voter.\n\n${error.message}`)
  }
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('.edit-voter-btn')

  if (button) {
    openEditVoter(button.dataset.voterId)
  }
})

// CANDIDATES
async function loadElectionOptions() {
  const selects = [
    document.getElementById('candidateElection'),
    document.getElementById('editCandidateElection'),
  ].filter(Boolean)
  if (!selects.length) return

  try {
    const data = await readJson(await authFetch(apiUrl('/elections')))
    const active = (data.elections || []).filter(
      (e) => !e.archived_at && ['upcoming', 'ongoing'].includes(e.effective_status || e.status)
    )
    const options = active.length
      ? active
          .map((e) => `<option value="${e.election_id}">${escapeHTML(e.election_name)}</option>`)
          .join('')
      : `<option value="">No active election</option>`
    selects.forEach((select) => (select.innerHTML = options))
  } catch (error) {
    console.error('Load election options error:', error)
    selects.forEach(
      (select) => (select.innerHTML = `<option value="">Unable to load elections</option>`)
    )
  }
}

function toggleGradeLevelField() {
  const positionSelect = document.getElementById('candidatePosition')
  const gradeContainer = document.getElementById('candidateGradeLevelContainer')
  const gradeSelect = document.getElementById('candidateGradeLevel')
  if (!positionSelect || !gradeContainer) return

  const positionName = positionSelect.selectedOptions[0]?.textContent.trim() || ''
  const isGradeRep = positionName === 'Grade Representative'
  gradeContainer.style.display = isGradeRep ? 'block' : 'none'
  if (gradeSelect) gradeSelect.required = isGradeRep
  if (!isGradeRep && gradeSelect) gradeSelect.value = ''
}

function toggleEditCandidateGradeField() {
  const positionSelect = document.getElementById('editCandidatePosition')
  const gradeContainer = document.getElementById('editCandidateGradeContainer')
  const gradeSelect = document.getElementById('editCandidateGrade')
  if (!positionSelect || !gradeContainer) return
  const positionName = positionSelect.selectedOptions[0]?.textContent.trim() || ''
  const isGradeRep = positionName === 'Grade Representative'
  gradeContainer.style.display = isGradeRep ? 'block' : 'none'
  if (gradeSelect) gradeSelect.required = isGradeRep
  if (!isGradeRep && gradeSelect) gradeSelect.value = ''
}

async function renderCandidateTable() {
  const table = document.getElementById('candidateTable')
  if (!table) return

  try {
    const data = await readJson(await authFetch(apiUrl('/candidates')))
    const candidates = data.candidates || []
    if (!candidates.length) {
      table.innerHTML = `<tr><td colspan="6" style="text-align:center;">No candidates found.</td></tr>`
      updateCandidateCount()
      return
    }

    table.innerHTML = candidates
      .map((candidate) => {
        const archived = candidate.archived_at !== null
        return `
                <tr>
                    <td>${escapeHTML(candidate.candidate_name || '—')}</td>
                    <td>${escapeHTML(candidate.position_name || '—')}</td>
                    <td>${escapeHTML(candidate.party_name || '—')}</td>
                    <td>${candidate.grade ? `Grade ${escapeHTML(candidate.grade)}` : '—'}</td>
                    <td><span class="badge ${archived ? 'badge-red' : 'badge-green'}">${archived ? 'Archived' : escapeHTML(candidate.status || 'active')}</span></td>
                    <td>
                        ${
                          archived
                            ? `<button class="btn btn-primary btn-small" onclick="restoreCandidate(${candidate.candidate_id})">Restore</button>`
                            : `<button class="btn btn-primary btn-small" onclick="openEditCandidate(${candidate.candidate_id})">Edit</button>
                               <button class="btn btn-danger btn-small" onclick="deleteCandidate(${candidate.candidate_id})">Delete</button>`
                        }
                    </td>
                </tr>
            `
      })
      .join('')
    updateCandidateCount()
  } catch (error) {
    console.error('Load candidates error:', error)
    table.innerHTML = `<tr><td colspan="6" style="text-align:center;">Failed to load candidates.<br><small>${escapeHTML(error.message)}</small></td></tr>`
  }
}

async function addCandidate() {
  const name = document.getElementById('candidateName')?.value.trim()
  const positionId = Number(document.getElementById('candidatePosition')?.value)
  const party = document.getElementById('candidateParty')?.value.trim()
  const electionId = Number(document.getElementById('candidateElection')?.value)
  const positionText = document
    .getElementById('candidatePosition')
    ?.selectedOptions[0]?.textContent.trim()
  const gradeValue = document.getElementById('candidateGradeLevel')?.value
  const grade = positionText === 'Grade Representative' ? Number(gradeValue) : null

  if (!name || !party || !Number.isInteger(positionId) || !Number.isInteger(electionId)) {
    alert('Please complete candidate information.')
    return
  }
  if (
    positionText === 'Grade Representative' &&
    (!Number.isInteger(grade) || grade < 7 || grade > 12)
  ) {
    alert('Please select a valid grade for Grade Representative.')
    return
  }

  try {
    const data = await readJson(
      await authFetch(apiUrl('/candidates'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_name: name,
          party_name: party,
          position_id: positionId,
          election_id: electionId,
          grade,
        }),
      })
    )
    alert(data.message || 'Candidate created successfully!')
    closeModal('candidateModal')
    document.getElementById('candidateName').value = ''
    document.getElementById('candidateParty').value = ''
    await renderCandidateTable()
  } catch (error) {
    console.error('Create candidate error:', error)
    alert(`Failed to create candidate.\n\n${error.message}`)
  }
}

async function openEditCandidate(candidateId) {
  try {
    const data = await readJson(await authFetch(apiUrl('/candidates')))
    const candidate = (data.candidates || []).find(
      (c) => Number(c.candidate_id) === Number(candidateId)
    )
    if (!candidate) throw new Error('Candidate not found.')

    await loadElectionOptions()
    document.getElementById('editCandidateId').value = candidate.candidate_id
    document.getElementById('editCandidateName').value = candidate.candidate_name || ''
    document.getElementById('editCandidatePosition').value = String(candidate.position_id)
    document.getElementById('editCandidateParty').value = candidate.party_name || ''
    document.getElementById('editCandidateElection').value = String(candidate.election_id)
    document.getElementById('editCandidateGrade').value = candidate.grade
      ? String(candidate.grade)
      : ''
    toggleEditCandidateGradeField()
    openModal('editCandidateModal')
  } catch (error) {
    console.error('Open edit candidate error:', error)
    alert(`Failed to load candidate.\n\n${error.message}`)
  }
}

async function updateCandidate() {
  const id = document.getElementById('editCandidateId')?.value
  const name = document.getElementById('editCandidateName')?.value.trim()
  const positionId = Number(document.getElementById('editCandidatePosition')?.value)
  const party = document.getElementById('editCandidateParty')?.value.trim()
  const electionId = Number(document.getElementById('editCandidateElection')?.value)
  const positionText = document
    .getElementById('editCandidatePosition')
    ?.selectedOptions[0]?.textContent.trim()
  const gradeValue = document.getElementById('editCandidateGrade')?.value
  const grade = positionText === 'Grade Representative' ? Number(gradeValue) : null

  if (!id || !name || !party || !Number.isInteger(positionId) || !Number.isInteger(electionId)) {
    alert('Please complete candidate information.')
    return
  }
  if (
    positionText === 'Grade Representative' &&
    (!Number.isInteger(grade) || grade < 7 || grade > 12)
  ) {
    alert('Please select a valid grade for Grade Representative.')
    return
  }

  try {
    const data = await readJson(
      await authFetch(apiUrl(`/candidates/${id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_name: name,
          party_name: party,
          position_id: positionId,
          election_id: electionId,
          grade,
        }),
      })
    )
    alert(data.message || 'Candidate updated successfully!')
    closeModal('editCandidateModal')
    await renderCandidateTable()
  } catch (error) {
    console.error('Update candidate error:', error)
    alert(`Failed to update candidate.\n\n${error.message}`)
  }
}

async function deleteCandidate(candidateId) {
  if (!confirm('Archive this candidate?')) return
  try {
    const data = await readJson(
      await authFetch(apiUrl(`/candidates/${candidateId}/archive`), { method: 'PUT' })
    )
    alert(data.message || 'Candidate archived successfully!')
    await renderCandidateTable()
  } catch (error) {
    console.error('Archive candidate error:', error)
    alert(`Failed to archive candidate.\n\n${error.message}`)
  }
}

async function archiveCandidate(candidateId) {
  return deleteCandidate(candidateId)
}

async function restoreCandidate(candidateId) {
  if (!confirm('Restore this candidate?')) return
  try {
    const data = await readJson(
      await authFetch(apiUrl(`/candidates/${candidateId}/restore`), { method: 'PUT' })
    )
    alert(data.message || 'Candidate restored successfully!')
    await renderCandidateTable()
  } catch (error) {
    console.error('Restore candidate error:', error)
    alert(`Failed to restore candidate.\n\n${error.message}`)
  }
}

// ELECTIONS
async function renderElectionCards() {
  const grid = document.getElementById('electionGrid')
  if (!grid) return

  try {
    const data = await readJson(await authFetch(apiUrl('/elections')))
    const elections = data.elections || []
    if (!elections.length) {
      grid.innerHTML = `<div class="card"><h3>No elections found</h3><p>Create an election to get started.</p></div>`
      return
    }

    grid.innerHTML = elections
      .map((election) => {
        const archived = election.archived_at !== null
        const status = archived ? 'archived' : election.effective_status || election.status
        const badgeClass =
          archived || ['ended', 'cancelled'].includes(status)
            ? 'badge-red'
            : status === 'ongoing'
              ? 'badge-green'
              : 'badge-yellow'
        return `
                <div class="election-card">
                    <span class="badge ${badgeClass}">${escapeHTML(String(status).toUpperCase())}</span>
                    <h3 style="margin-top:12px;">${escapeHTML(election.election_name)}</h3>
                    <p>${escapeHTML(election.description || 'School election management.')}</p>
                    <p><strong>Start:</strong> ${new Date(election.start_date).toLocaleDateString()}</p>
                    <p><strong>End:</strong> ${new Date(election.end_date).toLocaleDateString()}</p>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
                        ${
                          archived
                            ? `<button class="btn btn-primary btn-small" onclick="restoreElection(${election.election_id})">Restore</button>`
                            : `<button class="btn btn-primary btn-small" onclick="openEditElection(${election.election_id})">Edit</button>
                               <button class="btn btn-danger btn-small" onclick="deleteElection(${election.election_id})">Delete</button>`
                        }
                    </div>
                </div>
            `
      })
      .join('')
  } catch (error) {
    console.error('Load elections error:', error)
    grid.innerHTML = `<div class="card"><h3>Unable to load elections</h3><p>${escapeHTML(error.message)}</p></div>`
  }
}

function getElectionFormValues(prefix = '') {
  const id = prefix ? document.getElementById('editElectionId')?.value : null
  const name = document.getElementById(prefix ? 'editElectionName' : 'electionName')?.value.trim()
  const description = document
    .getElementById(prefix ? 'editElectionDescription' : 'electionDescription')
    ?.value.trim()
  const start = document.getElementById(prefix ? 'editStartDate' : 'startDate')?.value
  const end = document.getElementById(prefix ? 'editEndDate' : 'endDate')?.value
  return { id, name, description, start, end }
}

async function createElection() {
  const form = getElectionFormValues()
  if (!form.name || !form.start || !form.end)
    return alert('Election name, start date, and end date are required.')
  if (new Date(form.end) <= new Date(form.start))
    return alert('End date must be later than start date.')

  try {
    const data = await readJson(
      await authFetch(apiUrl('/elections'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          election_name: form.name,
          description: form.description,
          start_date: form.start,
          end_date: form.end,
          status: 'upcoming',
        }),
      })
    )
    alert(data.message || 'Election created successfully!')
    closeModal('electionModal')
    await renderElectionCards()
    await loadElectionOptions()
    if (document.getElementById('totalVoters')) loadDashboardStats()
  } catch (error) {
    console.error('Create election error:', error)
    alert(`Failed to create election.\n\n${error.message}`)
  }
}

async function openEditElection(electionId) {
  try {
    const data = await readJson(await authFetch(apiUrl('/elections')))
    const election = (data.elections || []).find(
      (e) => Number(e.election_id) === Number(electionId)
    )
    if (!election) throw new Error('Election not found.')

    document.getElementById('editElectionId').value = election.election_id
    document.getElementById('editElectionName').value = election.election_name || ''
    document.getElementById('editElectionDescription').value = election.description || ''
    document.getElementById('editStartDate').value = String(election.start_date).slice(0, 10)
    document.getElementById('editEndDate').value = String(election.end_date).slice(0, 10)
    openModal('editElectionModal')
  } catch (error) {
    console.error('Open edit election error:', error)
    alert(`Failed to load election.\n\n${error.message}`)
  }
}

async function updateElection() {
  const form = getElectionFormValues('edit')
  if (!form.id || !form.name || !form.start || !form.end)
    return alert('Election name, start date, and end date are required.')
  if (new Date(form.end) <= new Date(form.start))
    return alert('End date must be later than start date.')

  try {
    const data = await readJson(
      await authFetch(apiUrl(`/elections/${form.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          election_name: form.name,
          description: form.description,
          start_date: form.start,
          end_date: form.end,
        }),
      })
    )
    alert(data.message || 'Election updated successfully!')
    closeModal('editElectionModal')
    await renderElectionCards()
    await loadElectionOptions()
  } catch (error) {
    console.error('Update election error:', error)
    alert(`Failed to update election.\n\n${error.message}`)
  }
}

async function deleteElection(electionId) {
  if (!confirm('Archive this election?')) return
  try {
    const data = await readJson(
      await authFetch(apiUrl(`/elections/${electionId}/archive`), { method: 'PUT' })
    )
    alert(data.message || 'Election archived successfully!')
    await renderElectionCards()
    await loadElectionOptions()
  } catch (error) {
    console.error('Archive election error:', error)
    alert(`Failed to archive election.\n\n${error.message}`)
  }
}

async function archiveElection(electionId) {
  return deleteElection(electionId)
}

async function restoreElection(electionId) {
  if (!confirm('Restore this election?')) return
  try {
    const data = await readJson(
      await authFetch(apiUrl(`/elections/${electionId}/restore`), { method: 'PUT' })
    )
    alert(data.message || 'Election restored successfully!')
    await renderElectionCards()
    await loadElectionOptions()
  } catch (error) {
    console.error('Restore election error:', error)
    alert(`Failed to restore election.\n\n${error.message}`)
  }
}

function updateVoterCount() {
  const total = document.getElementById('totalVoters')
  if (!total) return
  total.textContent = document.querySelectorAll('#voterTable tr').length
}

function updateCandidateCount() {
  const total = document.getElementById('totalCandidates')
  if (!total) return
  total.textContent = document.querySelectorAll('#candidateTable tr').length
}

// Kept for compatibility with older pages.
function deleteRow(button) {
  const row = button?.closest('tr')
  if (row) row.remove()
  updateVoterCount()
  updateCandidateCount()
}

function toggleArchive(id) {
  const el = document.getElementById(id)
  if (!el) return
  const open = el.style.display === 'none' || !el.style.display
  el.style.display = open ? 'block' : 'none'
  if (!open) return
  if (id === 'voterArchive') renderVoterArchive()
  if (id === 'candidateArchive') renderCandidateArchive()
  if (id === 'electionArchive') renderElectionArchive()
}

async function renderVoterArchive() {
  const table = document.getElementById('voterArchiveTable')
  if (!table) return
  try {
    const d = await readJson(await authFetch(apiUrl('/voters?archived=true')))
    table.innerHTML =
      (d.voters || [])
        .map(
          (v) =>
            `<tr><td>${escapeHTML(v.voter_id)}</td><td>${escapeHTML(v.name)}</td><td>Grade ${v.grade}</td><td>${escapeHTML(v.section)}</td><td><span class="badge badge-red">Archived</span></td><td><button class="btn btn-primary btn-small" onclick="restoreVoter('${escapeHTML(v.voter_id)}')">Restore</button></td></tr>`
        )
        .join('') || '<tr><td colspan="6" style="text-align:center">No archived voters.</td></tr>'
  } catch (e) {
    table.innerHTML = `<tr><td colspan="6">${escapeHTML(e.message)}</td></tr>`
  }
}

async function renderCandidateArchive() {
  const table = document.getElementById('candidateArchiveTable')
  if (!table) return
  try {
    const d = await readJson(await authFetch(apiUrl('/candidates?archived=true')))
    table.innerHTML =
      (d.candidates || [])
        .map(
          (c) =>
            `<tr><td>${escapeHTML(c.candidate_name)}</td><td>${escapeHTML(c.position_name)}</td><td>${escapeHTML(c.election_name)}</td><td>${c.grade ? `Grade ${c.grade}` : '—'}</td><td>${escapeHTML(c.party_name || 'Independent')}</td><td><button class="btn btn-primary btn-small" onclick="restoreCandidate(${c.candidate_id})">Restore</button></td></tr>`
        )
        .join('') ||
      '<tr><td colspan="6" style="text-align:center">No archived candidates.</td></tr>'
  } catch (e) {
    table.innerHTML = `<tr><td colspan="6">${escapeHTML(e.message)}</td></tr>`
  }
}

async function renderElectionArchive() {
  const grid = document.getElementById('electionArchiveGrid')
  if (!grid) return
  try {
    const d = await readJson(await authFetch(apiUrl('/elections?archived=true')))
    grid.innerHTML =
      (d.elections || [])
        .map(
          (e) =>
            `<div class="election-card"><h3>${escapeHTML(e.election_name)}</h3><p>${escapeHTML(e.description || 'No description')}</p><p><strong>${new Date(e.start_date).toLocaleString()}</strong> to <strong>${new Date(e.end_date).toLocaleString()}</strong></p><span class="badge badge-red">Archived</span><br><br><button class="btn btn-primary btn-small" onclick="restoreElection(${e.election_id})">Restore</button></div>`
        )
        .join('') || '<div class="card"><p>No archived elections.</p></div>'
  } catch (e) {
    grid.innerHTML = `<div class="card">${escapeHTML(e.message)}</div>`
  }
}

async function loadRecentActivity() {
  const table = document.getElementById('recentActivityTable')

  if (!table) return

  try {
    const data = await readJson(await authFetch(apiUrl('/activities')))

    const activities = data.activities || []

    if (!activities.length) {
      table.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align:center;">
                        No recent activity.
                    </td>
                </tr>
            `
      return
    }

    table.innerHTML = activities
      .map((activity) => {
        const date = new Date(activity.created_at)

        const dateText = date.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })

        const timeText = date.toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
        })

        let badgeClass = 'badge-green'

        if (activity.status === 'Failed') {
          badgeClass = 'badge-red'
        }

        return `
                <tr>
                    <td>
                        <strong>${dateText}</strong><br>
                        <span style="color:#78857d;">
                            ${timeText}
                        </span>
                    </td>

                    <td>
                        ${escapeHTML(activity.activity_type)}
                    </td>

                    <td>
                        ${escapeHTML(activity.user_name)}
                    </td>

                    <td>
                        <span class="badge ${badgeClass}">
                            ${escapeHTML(activity.status)}
                        </span>
                    </td>
                    <td>
                        ${escapeHTML(activity.description || '—')}
                    </td>
                </tr>
            `
      })
      .join('')
  } catch (error) {
    console.error('Recent activity error:', error)

    table.innerHTML = `
            <tr>
                <td colspan="4" style="text-align:center;">
                    Unable to load recent activity.
                </td>
            </tr>
        `
  }
}

setInterval(() => {
  if (document.visibilityState === 'visible') {
    loadRecentActivity()
  }
}, 5000)

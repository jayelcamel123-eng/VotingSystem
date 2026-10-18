function normalizeText(value) {
  return String(value ?? '').trim()
}

function normalizeVoterId(value) {
  return normalizeText(value).toUpperCase()
}

function parseGrade(value) {
  if (value === null || value === undefined || value === '') return null
  const grade = Number(value)
  return Number.isInteger(grade) ? grade : NaN
}

function validateGrade(grade, { min = 7, max = 12 } = {}) {
  const parsed = Number(grade)

  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw Object.assign(new Error(`Grade must be a whole number from ${min} to ${max}.`), {
      status: 400,
    })
  }

  return parsed
}

function validateElectionDates(startDate, endDate) {
  const start = new Date(startDate)
  const end = new Date(endDate)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw Object.assign(new Error('Valid start and end dates are required.'), {
      status: 400,
    })
  }

  if (end <= start) {
    throw Object.assign(new Error('End date must be later than start date.'), {
      status: 400,
    })
  }

  return { start, end }
}

function validateSelectionList(selections) {
  if (!Array.isArray(selections)) {
    throw Object.assign(new Error('Selections must be provided as an array.'), {
      status: 400,
    })
  }

  if (!selections.length) {
    throw Object.assign(new Error('At least one selection is required.'), {
      status: 400,
    })
  }

  const normalized = selections.map((selection) => {
    const candidateId = Number(selection?.candidate_id)
    const positionId = Number(selection?.position_id)

    if (!Number.isInteger(candidateId) || candidateId < 1) {
      throw Object.assign(new Error('Each selection must include a valid candidate_id.'), {
        status: 400,
      })
    }

    if (!Number.isInteger(positionId) || positionId < 1) {
      throw Object.assign(new Error('Each selection must include a valid position_id.'), {
        status: 400,
      })
    }

    return {
      candidate_id: candidateId,
      position_id: positionId,
    }
  })

  const seenPositions = new Set()
  for (const selection of normalized) {
    if (seenPositions.has(selection.position_id)) {
      throw Object.assign(new Error('Only one candidate may be selected for each position.'), {
        status: 400,
      })
    }
    seenPositions.add(selection.position_id)
  }

  return normalized
}

module.exports = {
  normalizeText,
  normalizeVoterId,
  parseGrade,
  validateGrade,
  validateElectionDates,
  validateSelectionList,
}

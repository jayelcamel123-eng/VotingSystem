async function loadResultsFilters() {
    const gradeSelect = document.getElementById('resultsGrade');
    const sectionSelect = document.getElementById('resultsSection');

    if (!gradeSelect || !sectionSelect) return;

    try {
        const data = await apiJson('/voters');
        const voters = data.voters || [];

        // Get unique grades from actual voters
        const grades = [...new Set(
            voters
                .map(v => String(v.grade || '').trim())
                .filter(Boolean)
        )].sort((a, b) => {
            const na = Number(a);
            const nb = Number(b);

            if (!Number.isNaN(na) && !Number.isNaN(nb)) {
                return na - nb;
            }

            return a.localeCompare(b);
        });

        gradeSelect.innerHTML =
            '<option value="">All Grades</option>' +
            grades.map(grade =>
                `<option value="${escapeHTML(grade)}">${escapeHTML(grade)}</option>`
            ).join('');

        // Default state
        sectionSelect.innerHTML = '<option value="">All Sections</option>';
        sectionSelect.disabled = true;

        gradeSelect.onchange = () => {
            const selectedGrade = gradeSelect.value;

            if (!selectedGrade) {
                sectionSelect.innerHTML = '<option value="">All Sections</option>';
                sectionSelect.disabled = true;
                return;
            }

            const sections = [...new Set(
                voters
                    .filter(v => String(v.grade || '').trim() === selectedGrade)
                    .map(v => String(v.section || '').trim())
                    .filter(Boolean)
            )].sort((a, b) => a.localeCompare(b));

            sectionSelect.innerHTML =
                '<option value="">All Sections</option>' +
                sections.map(section =>
                    `<option value="${escapeHTML(section)}">${escapeHTML(section)}</option>`
                ).join('');

            sectionSelect.disabled = false;

            // Refresh results for selected grade
            const electionSelect = document.getElementById('resultsElection');

            if (electionSelect?.value) {
                renderResults(electionSelect.value);
            }
        };

        sectionSelect.onchange = () => {
            const electionSelect = document.getElementById('resultsElection');

            if (electionSelect?.value) {
                renderResults(electionSelect.value);
            }
        };

    } catch (e) {
        console.error('Failed to load result filters:', e);
    }
}


async function loadResultsPage() {
    const select = document.getElementById('resultsElection');
    const container = document.getElementById('resultsContainer');

    if (!container) return;

    try {
        await loadResultsFilters();

        const elections = await apiJson('/elections');

        if (select) {
            select.innerHTML = elections.elections
                .map(e =>
                    `<option value="${e.election_id}">
                        ${escapeHTML(e.election_name)}
                    </option>`
                )
                .join('');
        }

        await renderResults(
            select?.value || elections.elections[0]?.election_id
        );

    } catch (e) {
        container.innerHTML = `
            <div class="card">
                <p>Failed to load results.</p>
                <small>${escapeHTML(e.message)}</small>
            </div>
        `;
    }

    if (select) {
        select.addEventListener(
            'change',
            () => renderResults(select.value)
        );
    }
}


async function renderResults(electionId) {
    const container = document.getElementById('resultsContainer');

    if (!container || !electionId) return;

    try {
        const grade =
            document.getElementById('resultsGrade')?.value || '';

        const section =
            document.getElementById('resultsSection')?.value || '';

        let url =
            `/results?election_id=${encodeURIComponent(electionId)}`;

        if (grade) {
            url += `&grade=${encodeURIComponent(grade)}`;
        }

        if (section) {
            url += `&section=${encodeURIComponent(section)}`;
        }

        const d = await apiJson(url);

        const groups = {};

        (d.results || []).forEach(r =>
            (groups[r.position_id] ??= []).push(r)
        );

        const sections = Object.values(groups)
            .map(rows => {
                const title = rows[0].position_name;

                const total = rows.reduce(
                    (a, r) => a + Number(r.votes),
                    0
                );

                return `
                    <div class="card">
                        <div class="card-header">
                            <h3>${escapeHTML(title)}</h3>
                            <span class="badge badge-green">
                                ${total} vote(s)
                            </span>
                        </div>

                        ${rows.map(r => {
                            const pct = total
                                ? ((Number(r.votes) / total) * 100)
                                : 0;

                            return `
                                <div class="result-row">

                                    <div class="result-header">

                                        <span>
                                            <strong>
                                                ${escapeHTML(r.candidate_name)}
                                            </strong>

                                            ${
                                                r.party_name
                                                    ? ` <small>(${escapeHTML(r.party_name)})</small>`
                                                    : ''
                                            }

                                            ${
                                                r.grade
                                                    ? ` <small>Grade ${r.grade}</small>`
                                                    : ''
                                            }
                                        </span>

                                        <strong>
                                            ${r.votes} vote(s)
                                        </strong>

                                    </div>

                                    <div class="progress">
                                        <div
                                            class="progress-bar"
                                            style="width:${pct}%;"
                                        ></div>
                                    </div>

                                    <small>
                                        ${pct.toFixed(1)}%
                                    </small>

                                </div>
                            `;
                        }).join('')}

                    </div>
                `;
            })
            .join('');

        container.innerHTML =
            sections ||
            '<div class="card"><p>No candidate results available for this election.</p></div>';

        const registered =
            document.getElementById('registeredVotersResult');

        const votesCast =
            document.getElementById('votesCastResult');

        const turnout =
            document.getElementById('turnoutResult');

        if (registered) {
            registered.textContent = d.summary.totalVoters;
        }

        if (votesCast) {
            votesCast.textContent = d.summary.votesCast;
        }

        if (turnout) {
            turnout.textContent = `${d.summary.turnout}%`;
        }

        const status =
            document.getElementById('resultElectionStatus');

        if (status) {
            status.textContent =
                String(d.election.status).toUpperCase();
        }

    } catch (e) {
        container.innerHTML = `
            <div class="card">
                <p>Failed to load results.</p>
                <small>${escapeHTML(e.message)}</small>
            </div>
        `;
    }
}


document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('resultsElection')) {
        loadResultsPage();
    }
});
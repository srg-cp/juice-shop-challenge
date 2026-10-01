const $ = selector => document.querySelector(selector)
const form = $('#form')
const availability = $('#availability')
const levels = $('#levels')
const result = $('#result')
let timer
let inspectedUrl = null
if (window.localSolver?.token) {
  $('#token').required = false
  $('#token').closest('.field').hidden = true
  $('#form .row').style.gridTemplateColumns = '1fr'
}

async function authToken() {
  return window.localSolver?.token || $('#token').value
}

function quotas() {
  return Object.fromEntries([...levels.querySelectorAll('input')].map(input => [input.dataset.level, Number(input.value)]))
}
function selectedTotal() {
  const total = Object.values(quotas()).reduce((sum, n) => sum + n, 0)
  $('#selected').textContent = total
  $('#start').disabled = total < 1 || total > 40
  $('#form-message').textContent = total > 40 ? 'El máximo es 40 retos en total.' : ''
}
function renderAvailability(data) {
  availability.hidden = false
  levels.replaceChildren()
  const reserve = Math.min(4, data.supported[3] || 0)
  let budget = 40 - reserve
  for (let level = 1; level <= 6; level++) {
    const supported = data.supported[level] || 0
    const limit = level === 3 ? Math.min(8, supported) : supported
    const initial = level <= 2 ? Math.min(budget, supported) : level === 3 ? reserve : 0
    if (level <= 2) budget -= initial
    const card = document.createElement('div'); card.className = 'level'
    const header = document.createElement('header')
    const title = document.createElement('strong'); title.textContent = `Nivel ${level}`
    const stars = document.createElement('span'); stars.className = 'stars'; stars.textContent = '★'.repeat(level)
    header.append(title, stars)
    const input = document.createElement('input'); input.type = 'number'; input.min = '0'; input.max = String(limit); input.value = String(initial); input.dataset.level = String(level); input.setAttribute('aria-label', `Cantidad de retos nivel ${level}`)
    if (!limit) input.disabled = true
    input.addEventListener('input', selectedTotal)
    const note = document.createElement('small'); note.textContent = `${supported} pendientes con intento disponible · ${data.remaining[level] || 0} pendientes en Juice Shop`
    card.append(header, input, note); levels.append(card)
  }
  selectedTotal()
}
function show(job) {
  result.hidden = false
  $('#state').textContent = ({ queued: 'En cola', running: 'En progreso', completed: 'Meta alcanzada', partial: 'Finalizado parcialmente', failed: 'Falló' })[job.status] || job.status
  $('#solved').textContent = job.newSolved || 0
  $('#attempts').textContent = job.attempts?.length || 0
  $('#initial').textContent = job.initialSolved || 0
  $('#detail').textContent = job.error || `${job.newSolved || 0} retos nuevos confirmados en ${job.target}${job.extraSolved ? ` · ${job.extraSolved} fuera de la distribución solicitada` : ''}`
  const progress = $('#progress'); progress.replaceChildren()
  for (let level = 1; level <= 6; level++) {
    const row = document.createElement('div'); const title = document.createElement('strong'); title.textContent = `${'★'.repeat(level)} ${job.achieved?.[level] || 0}/${job.quotas?.[level] || 0}`
    row.append(title); progress.append(row)
  }
  const items = $('#items'); items.replaceChildren()
  for (const row of job.solved || []) { const li = document.createElement('li'); li.textContent = `${'★'.repeat(row.difficulty)} ${row.name || row.key}`; items.append(li) }
  const log = $('#log'); log.replaceChildren()
  for (const row of (job.attempts || []).slice(-8).reverse()) { const li = document.createElement('li'); li.textContent = `${'★'.repeat(row.difficulty)} ${row.label}: ${row.status}${row.error ? ` (${row.error})` : ''}`; log.append(li) }
}
async function api(path, token, body) {
  const response = await fetch(path, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'No se pudo completar la solicitud')
  return data
}
$('#inspect').addEventListener('click', async () => {
  if (!$('#url').value || (!window.localSolver?.token && !$('#token').value)) { $('#form-message').textContent = 'Introduce la URL y, si corresponde, el token.'; return }
  const button = $('#inspect'); button.disabled = true; $('#form-message').textContent = 'Consultando Juice Shop…'; availability.hidden = true
  try {
    const data = await api('/api/targets/inspect', await authToken(), { url: $('#url').value })
    inspectedUrl = $('#url').value
    renderAvailability(data)
    $('#form-message').textContent = 'Disponibilidad actualizada.'
  } catch (e) { inspectedUrl = null; $('#form-message').textContent = e.message }
  finally { button.disabled = false }
})
$('#url').addEventListener('input', () => { availability.hidden = true; inspectedUrl = null })
form.addEventListener('submit', async event => {
  event.preventDefault(); clearTimeout(timer)
  if (inspectedUrl !== $('#url').value) { $('#form-message').textContent = 'Consulta la disponibilidad de esta URL primero.'; return }
  const values = quotas(), total = Object.values(values).reduce((sum, n) => sum + n, 0)
  if (total < 1 || total > 40 || [...levels.querySelectorAll('input')].some(input => !Number.isInteger(Number(input.value)) || Number(input.value) < 0 || Number(input.value) > Number(input.max))) { $('#form-message').textContent = 'Revisa las cantidades por nivel.'; return }
  const button = $('#start'); button.disabled = true
  try {
    const token = await authToken()
    const data = await api('/api/runs', token, { url: $('#url').value, quotas: values })
    const poll = async () => {
      try {
        const response = await fetch(`/api/runs/${data.id}`, { headers: { Authorization: `Bearer ${token}` } })
        const job = await response.json(); if (!response.ok) throw new Error(job.error || 'No se pudo consultar')
        show(job)
        if (['queued', 'running'].includes(job.status)) timer = setTimeout(poll, 1600)
        else button.disabled = false
      } catch (e) { $('#form-message').textContent = e.message; button.disabled = false }
    }
    await poll()
  } catch (e) { $('#form-message').textContent = e.message; button.disabled = false }
})

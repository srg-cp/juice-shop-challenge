const $ = selector => document.querySelector(selector)
const form = $('#form')
const availability = $('#availability')
const levels = $('#levels')
const result = $('#result')
const MAX_TOTAL = 64
let timer
let inspectedUrl = null
let inspectedData = null
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
  $('#start').disabled = total < 1 || total > MAX_TOTAL
  $('#form-message').textContent = total > MAX_TOTAL ? `El máximo es ${MAX_TOTAL} retos en total.` : ''
}
function renderAvailability(data) {
  availability.hidden = false
  levels.replaceChildren()
  let budget = MAX_TOTAL
  for (let level = 1; level <= 6; level++) {
    const supported = data.supported[level] || 0
    const limit = level === 3 ? Math.min(8, supported) : supported
    const initial = level <= 2 ? Math.min(budget, supported) : level === 3 ? Math.min(4, supported, budget) : 0
    budget -= initial
    const card = document.createElement('div'); card.className = 'level'
    const header = document.createElement('header')
    const title = document.createElement('strong'); title.textContent = `Nivel ${level}`
    const stars = document.createElement('span'); stars.className = 'stars'; stars.textContent = '★'.repeat(level)
    header.append(title, stars)
    const input = document.createElement('input'); input.type = 'number'; input.min = '0'; input.max = String(limit); input.value = String(initial); input.dataset.level = String(level); input.setAttribute('aria-label', `Cantidad de retos nivel ${level}`)
    if (!limit) input.disabled = true
    input.addEventListener('input', selectedTotal)
    const note = document.createElement('small'); note.textContent = `Total ${data.total[level] || 0} · ya resueltos ${data.solved[level] || 0} · pendientes habilitados ${data.remaining[level] || 0} · deshabilitados ${data.disabled?.[level] || 0} · con intento programado ${supported}`
    card.append(header, input, note); levels.append(card)
  }
  selectedTotal()
  $('#first-two').disabled = (data.supported[1] || 0) + (data.supported[2] || 0) > MAX_TOTAL
}
$('#first-two').addEventListener('click', () => {
  for (const input of levels.querySelectorAll('input')) {
    input.value = Number(input.dataset.level) <= 2 ? input.max : '0'
  }
  selectedTotal()
})
function show(job) {
  result.hidden = false
  $('#state').textContent = ({ queued: 'En cola', running: 'En progreso', completed: 'Meta alcanzada', partial: 'Finalizado parcialmente', failed: 'Falló' })[job.status] || job.status
  $('#solved').textContent = job.newSolved || 0
  $('#attempts').textContent = job.attempts?.length || 0
  $('#initial').textContent = job.initialSolved || 0
  $('#detail').textContent = job.error || `${job.newSolved || 0} retos nuevos confirmados en ${job.target}${job.extraSolved ? ` · ${job.extraSolved} fuera de la distribución solicitada` : ''}`
  const progress = $('#progress'); progress.replaceChildren()
  for (let level = 1; level <= 6; level++) {
    const row = document.createElement('div'); const title = document.createElement('strong'); const totalSolved = (job.initialByLevel?.[level] || 0) + (job.solved || []).filter(challenge => challenge.difficulty === level).length; title.textContent = `${'★'.repeat(level)} ${totalSolved}/${job.totalByLevel?.[level] || 0}`
    const goal = document.createElement('span'); goal.textContent = ` · nuevos ${job.achieved?.[level] || 0}/${job.quotas?.[level] || 0}`
    row.append(title, goal); progress.append(row)
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
    inspectedData = data
    $('#download-diagnostic').disabled = false
    renderAvailability(data)
    $('#form-message').textContent = 'Disponibilidad actualizada.'
  } catch (e) { inspectedUrl = null; inspectedData = null; $('#download-diagnostic').disabled = true; $('#form-message').textContent = e.message }
  finally { button.disabled = false }
})
$('#url').addEventListener('input', () => { availability.hidden = true; inspectedUrl = null; inspectedData = null; $('#download-diagnostic').disabled = true })
$('#download-diagnostic').addEventListener('click', () => {
  if (!inspectedData) return
  const blob = new Blob([JSON.stringify(inspectedData, null, 2)], { type: 'application/json' })
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = 'juice-shop-diagnostico.json'
  link.click()
  setTimeout(() => URL.revokeObjectURL(href), 1000)
})
form.addEventListener('submit', async event => {
  event.preventDefault(); clearTimeout(timer)
  if (inspectedUrl !== $('#url').value) { $('#form-message').textContent = 'Consulta la disponibilidad de esta URL primero.'; return }
  const values = quotas(), total = Object.values(values).reduce((sum, n) => sum + n, 0)
  if (total < 1 || total > MAX_TOTAL || [...levels.querySelectorAll('input')].some(input => !Number.isInteger(Number(input.value)) || Number(input.value) < 0 || Number(input.value) > Number(input.max))) { $('#form-message').textContent = 'Revisa las cantidades por nivel.'; return }
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

const form = document.querySelector('#form')
const result = document.querySelector('#result')
let timer
function show(job) {
  result.hidden = false
  document.querySelector('#state').textContent = ({ queued: 'En cola', running: 'En progreso', completed: 'Meta alcanzada', partial: 'Finalizado parcialmente', failed: 'Falló' })[job.status] || job.status
  document.querySelector('#solved').textContent = job.newSolved || 0
  document.querySelector('#attempts').textContent = job.attempts?.length || 0
  document.querySelector('#initial').textContent = job.initialSolved || 0
  document.querySelector('#detail').textContent = job.error || `${job.newSolved || 0} de ${job.requested} retos nuevos confirmados en ${job.target}`
  const items = document.querySelector('#items'); items.replaceChildren()
  for (const row of job.solved || []) { const li = document.createElement('li'); li.textContent = row.name || row.key; items.append(li) }
  const log = document.querySelector('#log'); log.replaceChildren()
  for (const row of (job.attempts || []).slice(-8).reverse()) { const li = document.createElement('li'); li.textContent = `${row.label}: ${row.status}${row.error ? ` (${row.error})` : ''}`; log.append(li) }
}
form.addEventListener('submit', async event => {
  event.preventDefault(); clearTimeout(timer)
  const button = document.querySelector('#start'); button.disabled = true
  const token = document.querySelector('#token').value
  try {
    const r = await fetch('/api/runs', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ url: document.querySelector('#url').value, count: Number(document.querySelector('#count').value) }) })
    const data = await r.json(); if (!r.ok) throw new Error(data.error || 'No se pudo iniciar')
    const poll = async () => {
      const response = await fetch(`/api/runs/${data.id}`, { headers: { Authorization: `Bearer ${token}` } })
      const job = await response.json(); if (!response.ok) throw new Error(job.error || 'No se pudo consultar')
      show(job)
      if (['queued', 'running'].includes(job.status)) timer = setTimeout(poll, 1600)
      else button.disabled = false
    }
    await poll()
  } catch (e) { result.hidden = false; document.querySelector('#state').textContent = 'Error'; document.querySelector('#detail').textContent = e.message; button.disabled = false }
})

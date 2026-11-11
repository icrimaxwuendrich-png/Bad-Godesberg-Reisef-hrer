const STORAGE_KEY = 'bgExplorer';
const APP_VERSION = '1.1';
let places = loadPlaces();
let noteTargetId = null;
let toastTimer;

function loadPlaces() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(stored) ? stored.filter(isValidPlace).map(normalizePlace) : [];
  } catch (error) {
    console.warn('Gespeicherte Orte konnten nicht gelesen werden.', error);
    return [];
  }
}
function isValidPlace(place) {
  return place && typeof place === 'object' && typeof place.name === 'string';
}
function normalizePlace(place) {
  return {
    id: String(place.id || Date.now() + Math.random()),
    name: String(place.name).slice(0, 100),
    category: String(place.category || 'Sonstiges'),
    status: place.status === 'Besucht' ? 'Besucht' : 'Wunschziel',
    rating: Math.max(0, Math.min(5, Number(place.rating) || 0)),
    notes: Array.isArray(place.notes) ? place.notes.filter(n => n && typeof n.text === 'string').map(n => ({ text: n.text.slice(0, 1000), date: String(n.date || '') })) : []
  };
}
function savePlaces() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(places));
    return true;
  } catch (error) {
    showToast('Speichern nicht möglich. Prüfe den freien Speicherplatz deines Browsers.');
    return false;
  }
}
function escapeText(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function render() {
  const list = document.getElementById('place-list');
  const query = document.getElementById('search-input').value.trim().toLocaleLowerCase('de');
  const filter = document.getElementById('filter-select').value;
  const matching = places.filter(place => {
    const content = `${place.name} ${place.category} ${place.notes.map(note => note.text).join(' ')}`.toLocaleLowerCase('de');
    return (!query || content.includes(query)) && (filter === 'Alle' || place.status === filter);
  });
  list.replaceChildren();
  matching.forEach(place => list.appendChild(createPlaceCard(place)));
  document.getElementById('empty-state').hidden = places.length > 0;
  document.getElementById('no-results').hidden = !(places.length > 0 && matching.length === 0);
  document.getElementById('result-count').textContent = `${matching.length} ${matching.length === 1 ? 'Ort' : 'Orte'}`;
  document.getElementById('count-places').textContent = places.length;
  document.getElementById('count-visited').textContent = places.filter(p => p.status === 'Besucht').length;
  document.getElementById('count-notes').textContent = places.reduce((sum, p) => sum + p.notes.length, 0);
}
function createPlaceCard(place) {
  const card = document.createElement('article');
  card.className = 'place-card';
  const statusClass = place.status === 'Besucht' ? 'visited' : 'wishlist';
  const stars = place.rating ? '★'.repeat(place.rating) + '☆'.repeat(5 - place.rating) : 'Noch nicht bewertet';
  const notesHTML = place.notes.map(note => `<div class="note-item"><span class="note-date">${escapeText(note.date)}</span><p>${escapeText(note.text).replace(/\n/g, '<br>')}</p></div>`).join('');
  card.innerHTML = `<div class="place-top"><span class="category-tag">${escapeText(place.category)}</span><span class="status-tag ${statusClass}"><span></span>${place.status === 'Besucht' ? 'Besucht' : 'Wunschziel'}</span></div>
    <h3>${escapeText(place.name)}</h3><div class="place-rating ${place.rating ? '' : 'unrated'}" aria-label="${place.rating ? `${place.rating} von 5 Sternen` : 'Noch nicht bewertet'}">${stars}</div>
    ${place.notes.length ? `<div class="notes-list">${notesHTML}</div>` : '<p class="no-note">Noch keine Notizen zu diesem Ort.</p>'}
    <div class="card-actions"><button class="text-button note-action" type="button" data-action="note" data-id="${escapeText(place.id)}">＋ Notiz</button><button class="text-button status-action" type="button" data-action="toggle" data-id="${escapeText(place.id)}">${place.status === 'Besucht' ? '↶ Wieder vormerken' : '✓ Als besucht markieren'}</button><a class="text-button map-action" target="_blank" rel="noopener noreferrer" href="https://www.openstreetmap.org/search?query=${encodeURIComponent(place.name + ', Bad Godesberg, Bonn')}">Karte ↗</a><button class="icon-button delete-action" type="button" data-action="delete" data-id="${escapeText(place.id)}" aria-label="${escapeText(place.name)} löschen" title="Ort löschen">×</button></div>`;
  return card;
}
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 3200);
}
function updateOnlineStatus() {
  const online = navigator.onLine;
  document.getElementById('online-status').textContent = online ? 'Online' : 'Offline';
  document.getElementById('online-dot').classList.toggle('offline', !online);
}
function exportData() {
  const data = { version: APP_VERSION, exportDate: new Date().toISOString(), places };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'godesberg-reisejournal.json';
  link.click();
  URL.revokeObjectURL(url);
  showToast('Dein Reisejournal wurde exportiert.');
}

const form = document.getElementById('place-form');
form.addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(form);
  const name = String(data.get('name') || '').trim();
  if (!name) return;
  const place = { id: String(Date.now()) + Math.random().toString(16).slice(2), name, category: data.get('category'), status: data.get('status'), rating: Number(data.get('rating')), notes: [] };
  const note = String(data.get('note') || '').trim();
  if (note) place.notes.push({ text: note, date: new Date().toLocaleString('de-DE') });
  places.unshift(place);
  savePlaces();
  form.reset();
  render();
  showToast(`„${name}“ wurde gespeichert.`);
  document.getElementById('search-input').value = '';
  document.getElementById('filter-select').value = 'Alle';
  render();
});

document.getElementById('place-list').addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const place = places.find(item => item.id === button.dataset.id);
  if (!place) return;
  if (button.dataset.action === 'delete') {
    if (!window.confirm(`„${place.name}“ wirklich aus deinem Reisejournal löschen?`)) return;
    places = places.filter(item => item.id !== place.id);
    savePlaces(); render(); showToast('Der Ort wurde gelöscht.');
  } else if (button.dataset.action === 'toggle') {
    place.status = place.status === 'Besucht' ? 'Wunschziel' : 'Besucht';
    savePlaces(); render(); showToast(place.status === 'Besucht' ? 'Als besucht markiert – schön, dass du dort warst!' : 'Zur Wunschliste hinzugefügt.');
  } else if (button.dataset.action === 'note') {
    noteTargetId = place.id;
    document.getElementById('dialog-place-name').textContent = place.name;
    document.getElementById('note-text').value = '';
    document.getElementById('note-dialog').showModal();
    document.getElementById('note-text').focus();
  }
});

document.getElementById('note-form').addEventListener('submit', event => {
  if (event.submitter && event.submitter.value === 'cancel') return;
  event.preventDefault();
  const text = document.getElementById('note-text').value.trim();
  const place = places.find(item => item.id === noteTargetId);
  if (!place || !text) return;
  place.notes.push({ text, date: new Date().toLocaleString('de-DE') });
  savePlaces();
  document.getElementById('note-dialog').close();
  render(); showToast('Deine Notiz wurde gespeichert.');
});

document.getElementById('route-form').addEventListener('submit', event => {
  event.preventDefault();
  const start = document.getElementById('route-start').value.trim();
  const destination = document.getElementById('route-destination').value.trim();
  if (!destination) return;
  const url = `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${encodeURIComponent(start)}%3B${encodeURIComponent(destination)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
});

document.getElementById('export-button').addEventListener('click', exportData);
document.getElementById('import-button').addEventListener('click', () => document.getElementById('import-file').click());
document.getElementById('empty-add-button').addEventListener('click', () => {
  document.getElementById('poi-name').focus();
  document.getElementById('add-place-panel').scrollIntoView({ behavior: 'smooth', block: 'center' });
});
document.getElementById('search-input').addEventListener('input', render);
document.getElementById('filter-select').addEventListener('change', render);
document.getElementById('import-file').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    const importedPlaces = Array.isArray(imported) ? imported : imported.places;
    if (!Array.isArray(importedPlaces) || !importedPlaces.every(isValidPlace)) throw new Error('Ungültiges Format');
    if (!window.confirm(`Sicherung mit ${importedPlaces.length} Ort(en) importieren? Deine bisherigen Orte werden ersetzt.`)) return;
    places = importedPlaces.map(normalizePlace);
    savePlaces(); render(); showToast('Dein Reisejournal wurde importiert.');
  } catch (error) {
    showToast('Die Datei ist ungültig oder konnte nicht gelesen werden.');
  } finally {
    event.target.value = '';
  }
});
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();
render();

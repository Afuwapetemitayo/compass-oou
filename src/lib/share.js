// Share a link the simple way: the phone's share sheet if there is one, otherwise copy it.
export async function shareLink({ title, text, url }, toast) {
  try {
    if (navigator.share) { await navigator.share({ title, text, url }); return }
  } catch (e) { if (e && e.name === 'AbortError') return }   // closed the share sheet: do nothing
  const full = text ? text + '\n' + url : url
  try { await navigator.clipboard.writeText(full); toast && toast('Link copied. Paste it in your group.'); return } catch { /* fall through */ }
  try {
    const t = document.createElement('textarea'); t.value = full; t.style.position = 'fixed'; t.style.opacity = '0'
    document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); toast && toast('Link copied. Paste it in your group.')
  } catch { toast && toast(full) }
}

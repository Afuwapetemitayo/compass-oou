// Smart search for the Directory: nicknames, initials, typos and "did you mean".
// Built-in nicknames work even before anyone adds aliases in the Admin. Aliases added in the Admin are used too.

const STOP = new Set(['of', 'and', 'the', 'for', 'in', 'to', 'a'])
const PREFIX = /^(department|faculty|office|centre|center|school|unit|division)\b/

// Nicknames students really use. Key = place name, value = other names.
// Only places that exist are used, so extra lines here are harmless.
export const NICKNAMES = {
  'Faculty of Science': ['FOS', 'science faculty'],
  'Faculty of Arts': ['FOA', 'FASA', 'arts faculty'],
  'Faculty of Law': ['FOL', 'law faculty'],
  'Faculty of Education': ['FOE', 'FEDU', 'edu', 'education faculty'],
  'Faculty of Social Sciences': ['FSS', 'SOSSA', 'social science', 'social sciences faculty'],
  'Faculty of Administration and Management Sciences': ['FAMS', 'FMS', 'management science', 'management sciences', 'admin faculty', 'FAMAS'],
  'Department of Microbiology': ['MCB', 'micro', 'microbio'],
  'Department of Computer Science': ['CSC', 'COS', 'comp sci', 'computer', 'computer lab'],
  'Department of Mathematical Sciences': ['MTH', 'math', 'maths', 'mathematics'],
  'Department of Chemical Sciences': ['CHM', 'chem', 'chemistry'],
  'Department of Physics': ['PHY', 'physics'],
  'Department of Statistics': ['STA', 'stat', 'stats'],
  'Department of Plant Science': ['BOT', 'botany'],
  'Department of Zoology and Environmental Biology': ['ZOO', 'zoology'],
  'Department of Mass Communication': ['MAC', 'mass comm', 'masscomm', 'MCM'],
  'Department of Economics': ['ECO', 'econs'],
  'Department of Foreign Languages': ['language lab', 'languages', 'FLA'],
  'Department of Linguistics and Nigerian Languages': ['LNL', 'linguistics'],
  'Department of Library and Information Science': ['LIS', 'library science'],
  'Department of Political Science': ['POS', 'polsci', 'political'],
  'Department of Psychology': ['PSY', 'psych'],
  'Department of Sociology': ['SOC', 'socio'],
  'Department of Accounting': ['ACC', 'acct'],
  'Department of Banking and Finance': ['BKF', 'banking'],
  'Department of Business Administration': ['BUS', 'busad', 'bus admin'],
  'Department of Public Administration': ['PAD', 'pubad', 'pub admin'],
  'Department of History and Diplomatic Studies': ['HDS', 'history'],
  'Department of Religious Studies': ['REL', 'religious'],
  'Department of Philosophy': ['PHI', 'philo'],
  'Department of Performing Arts': ['THA', 'theatre arts', 'theater arts'],
  'Department of English': ['ENG', 'english language'],
  'Department of Earth Sciences': ['GLY', 'geology', 'earth science'],
  'Department of Geography': ['GEO', 'geog'],
  'Department of Human Kinetics and Health Education': ['HKHE', 'HKE', 'human kinetics', 'sports science'],
  'University ICT': ['ICT', 'ict centre', 'ict unit'],
  'Senate Building': ['senate', 'senate hall'],
  'Admin Block': ['administrative block', 'admin building'],
  'Office of the Vice-Chancellor': ['VC', 'VC office', 'vice chancellor', 'vice-chancellor'],
  'Office of the Deputy Vice-Chancellor (Academics)': ['DVC academics', 'DVC acad', 'DVCA'],
  'Office of the Deputy Vice-Chancellor (Administration)': ['DVC admin', 'DVCAD'],
  'Office of the University Registrar': ['registrar', 'registry'],
  'Office of the Bursar': ['bursar', 'bursary'],
  'Office of the University Librarian': ['librarian'],
  'Student Affairs Division': ['student affairs', 'SAD', 'dsa'],
  'University Library': ['library', 'lib', 'main library'],
  'Motion Ground': ['motion', 'motion ground cafe', 'cafe', 'cafeteria', 'food'],
  'School Park': ['park', 'school park'],
  'Entrepreneurship Building': ['entrepreneurship', 'CED', 'entrepreneurship centre', 'entre'],
  'Security Unit': ['security', 'security office'],
  'Counselling Unit': ['counselling', 'counseling', 'counsellor'],
  'Sports Complex': ['sports', 'stadium', 'field', 'sport centre'],
  'Health Services': ['health centre', 'clinic', 'medical centre', 'sick bay', 'hospital'],
  'Computer-Based Test Centre': ['CBT', 'CBT centre', 'cbt hall'],
  'OOU Main Gate': ['main gate', 'gate', 'school gate'],
  'LLT1': ['law lecture theatre 1', 'law lecture theater 1', 'llt 1'],
  'LLT2': ['law lecture theatre 2', 'law lecture theater 2', 'llt 2'],
  'LLT3': ['law lecture theatre 3', 'law lecture theater 3', 'llt 3'],
  'AO Hall': ['AO', 'ao lecture hall'],
  'OGD Hall': ['OGD', 'ogd lecture hall'],
  'Business School': ['bschool', 'b school'],
  'Postgraduate School': ['PG school', 'pgs', 'postgraduate'],
  'ICAN Building': ['ican'],
  'OOU Press': ['press'],
}

const SHORT = { dept: 'department', depart: 'department', fac: 'faculty', facu: 'faculty', ofc: 'office', lib: 'library' }
export const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ').map(w => SHORT[w] || w).join(' ')
const squash = s => norm(s).replace(/ /g, '')
const words = s => norm(s).split(' ').filter(Boolean)

// Initials of a name: "Faculty of Social Sciences" -> fss, fos (with the small words) and "Department of X" -> x
function initials(name) {
  const w = words(name.replace(/\(.*?\)/g, ' '))
  const all = w.map(x => x[0]).join('')
  const big = w.filter(x => !STOP.has(x)).map(x => x[0]).join('')
  const noPrefix = w.filter(x => !STOP.has(x))
  const bare = PREFIX.test(norm(name)) ? noPrefix.slice(1).map(x => x[0]).join('') : ''
  return [...new Set([all, big, bare].filter(s => s.length >= 2))]
}

// Names inside brackets, e.g. "(IRPM)", count as nicknames too.
function brackets(name) { return [...name.matchAll(/\(([^)]+)\)/g)].map(m => m[1]) }

// Edit distance with early exit (a swap of two letters counts as one mistake).
function dist(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1
  const d = []
  for (let i = 0; i <= a.length; i++) { d[i] = [i]; for (let j = 1; j <= b.length; j++) d[i][j] = i === 0 ? j : 0 }
  for (let i = 1; i <= a.length; i++) {
    let rowMin = max + 1
    for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
      rowMin = Math.min(rowMin, d[i][j])
    }
    if (rowMin > max) return max + 1
  }
  return d[a.length][b.length]
}

// Build the search terms for a place once.
export function indexPlaces(places) {
  return places.map(p => {
    const extra = [...(NICKNAMES[p.n] || []), ...brackets(p.n), ...(p.a ? p.a.split(',').map(s => s.trim()).filter(Boolean) : [])]
    const names = [p.n, ...extra]
    const nameWords = words(p.n).filter(w => !STOP.has(w))
    return {
      p,
      names: names.map(norm),                          // whole names and nicknames
      sq: names.map(squash),                           // without spaces ("llt 3" = "llt3")
      ini: initials(p.n).concat(extra.flatMap(initials)),
      words: [...new Set([...nameWords, ...extra.flatMap(words)])],
      core: nameWords,
      meta: norm(p.t + ' ' + p.f + ' ' + p.c),
    }
  })
}

function scoreOne(e, q, qsq, qw) {
  let s = 0
  // exact nickname / initials / name
  if (e.names.includes(q) || e.sq.includes(qsq) || e.ini.includes(qsq)) s = 100
  else if (e.names.some(n => n.startsWith(q)) || e.sq.some(n => qsq.length >= 2 && n.startsWith(qsq))) s = 80
  else if (e.names.some(n => n.includes(q))) s = 60
  else if (e.meta.includes(q)) s = 25
  // every typed word appears (or starts a word) in the place
  if (s < 70 && qw.length > 1 && qw.every(w => e.words.some(x => x.startsWith(w)) || e.names.some(n => n.includes(w)))) s = Math.max(s, 70)
  else if (s < 50 && qw.length === 1 && e.words.some(x => x.startsWith(qw[0]))) s = Math.max(s, 50)
  return s
}

// Typo-friendly match: close in spelling to a word or nickname.
function fuzzyOne(e, q, qsq) {
  if (qsq.length < 3) return 0
  const max = qsq.length <= 6 ? 1 : 2
  let best = max + 1
  for (const n of e.sq) if (n[0] === qsq[0]) best = Math.min(best, dist(qsq, n, max))
  if (qsq.length <= 4) for (const i of e.ini) if (i[0] === qsq[0]) best = Math.min(best, dist(qsq, i, 1))
  for (const t of words(q)) {
    if (t.length < 4) continue
    const m = t.length <= 6 ? 1 : 2
    for (const w of e.core) if (w.length >= 4 && w[0] === t[0]) best = Math.min(best, dist(t, w, m) <= m ? dist(t, w, m) : best)
  }
  return best <= max ? 40 - best * 10 : 0
}

// Returns { results, suggestions }. suggestions only when nothing matched.
export function searchPlaces(index, query, filter = () => true) {
  const q = norm(query)
  if (!q) return { results: index.filter(e => filter(e.p)).map(e => e.p), suggestions: [], fuzzy: false }
  const qsq = squash(query), qw = words(query)
  const scored = []
  for (const e of index) {
    if (!filter(e.p)) continue
    const s = scoreOne(e, q, qsq, qw)
    if (s > 0) scored.push([e.p, s])
  }
  scored.sort((a, b) => b[1] - a[1] || a[0].n.length - b[0].n.length)
  if (scored.length) return { results: scored.map(x => x[0]), suggestions: [], fuzzy: false }
  // nothing exact: try spelling mistakes
  const near = []
  for (const e of index) {
    if (!filter(e.p)) continue
    const s = fuzzyOne(e, q, qsq)
    if (s > 0) near.push([e.p, s])
  }
  near.sort((a, b) => b[1] - a[1] || a[0].n.length - b[0].n.length)
  return { results: near.map(x => x[0]), suggestions: [], fuzzy: near.length > 0 }
}

// Ideas to show when there is truly nothing: popular places that match the chosen filter.
export function ideas(index, filter = () => true, n = 4) {
  const keep = ['Faculty of Science', 'Motion Ground', 'University Library', 'Department of Computer Science', 'LLT3', 'University ICT']
  return keep.map(k => index.find(e => e.p.n === k)).filter(e => e && filter(e.p)).slice(0, n).map(e => e.p)
}

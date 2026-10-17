const I = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z M9 4v14M15 6v14',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  help: ['circle', 'M9.5 9a2.5 2.5 0 015 .5c0 1.7-2.5 2-2.5 3.5M12 17h.01'],
  search: ['search', 'M20 20l-4-4'],
  pin: ['pin', ''],
  nav: 'M12 3l7 17-7-4-7 4z',
  back: 'M15 5l-7 7 7 7',
  build: 'M4 21V5l8-2v18M12 8l8 2v11M8 8h.01M8 12h.01M8 16h.01M16 14h.01M16 18h.01',
  cam: ['cam', ''],
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z'
}
export default function Icon({ n, s }) {
  const st = s ? { width: s, height: s } : undefined
  let inner
  if (n === 'help') inner = <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 015 .5c0 1.7-2.5 2-2.5 3.5M12 17h.01" /></>
  else if (n === 'search') inner = <><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>
  else if (n === 'pin') inner = <><path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>
  else if (n === 'cam') inner = <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>
  else inner = <path d={I[n]} />
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={st}>{inner}</svg>
}
export const catIcon = { Faculties: 'build', Departments: 'build', Halls: 'build', Offices: 'build', Library: 'build', Facilities: 'pin', Buildings: 'build' }

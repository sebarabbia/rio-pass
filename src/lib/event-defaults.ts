// Valores por defecto de los eventos de Rio (compartidos entre cliente y servidor).
export const DEFAULT_VENUE = 'Complejo Arenas · Playas del Thompson'
export const DEFAULT_SECTORS = ['Sector General', 'Sector +25']
export const DEFAULT_RRPP_QUOTA = 20
export const DEFAULT_ATTENDANCE_POINTS = 10 // igual que el default de events.attendance_points

/** "Sector General, Sector +25" -> ["Sector General", "Sector +25"] (sin repetidos, máx. 8). */
export function parseSectors(text: string) {
  const seen = new Set<string>()
  const names: string[] = []
  for (const raw of text.split(',')) {
    const name = raw.trim().replace(/\s+/g, ' ').slice(0, 60)
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase())
      names.push(name)
    }
  }
  return names.slice(0, 8)
}

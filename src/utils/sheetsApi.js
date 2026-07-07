// Google Sheets API utility
const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY

export async function fetchSheetData(sheetName, range = 'A:BZ', valueRenderOption = 'UNFORMATTED_VALUE', sheetId = SHEET_ID) {
  try {
    const encodedSheetName = encodeURIComponent(sheetName)
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodedSheetName}!${range}?key=${API_KEY}`
              + `&valueRenderOption=${valueRenderOption}`
              + `&dateTimeRenderOption=SERIAL_NUMBER`
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Failed to fetch "${sheetName}": ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return data.values || []
  } catch (error) {
    console.error(`Error fetching ${sheetName}:`, error)
    throw error
  }
}

// Convert array of arrays to array of objects using first row as headers
export function rowsToObjects(rows) {
  if (!rows || rows.length < 2) return []

  const headers = rows[0]
  return rows.slice(1).map(row => {
    const obj = {}
    headers.forEach((header, index) => {
      obj[header] = row[index] || ''
    })
    return obj
  })
}

// Get column value by letter (A=0, B=1, ...)
export function colLetterToIndex(letter) {
  let result = 0
  for (let i = 0; i < letter.length; i++) {
    result = result * 26 + (letter.charCodeAt(i) - 64)
  }
  return result - 1
}

// Get value from row by column letter.
// ALWAYS returns a string. The Sheets API (UNFORMATTED_VALUE) returns raw numbers
// for numeric cells, and downstream code calls .toLowerCase()/.replace()/.trim()
// on these values — so a numeric cell (or a column-misaligned cache blob) would
// otherwise throw "x.toLowerCase is not a function" and take the whole dashboard
// down. Coercing to string here keeps a single bad/shifted cell from causing a
// full outage. Semantics match the old `row[idx] || ''` (0/''/null → '').
export function getCol(row, letter) {
  const idx = colLetterToIndex(letter)
  const v = row[idx]
  if (!v) return ''
  return String(v)
}

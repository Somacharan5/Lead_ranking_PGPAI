// Google Sheets API utility
const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY

const BASE_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values`

export async function fetchSheetData(sheetName, range = 'A:BZ') {
  try {
    const encodedSheetName = encodeURIComponent(sheetName)
    // FIX: UNFORMATTED_VALUE returns dates as Excel serial numbers (e.g. 46152.79)
    // instead of locale-formatted strings (e.g. "5/10/2026" in US format).
    // The parseDate() function already handles serial numbers correctly.
    // Without this, dates formatted as M/D/YYYY get parsed as DD/MM/YYYY,
    // pushing them months/years into the future → leads silently disappear.
    const url = `${BASE_URL}/${encodedSheetName}!${range}?key=${API_KEY}`
              + `&valueRenderOption=UNFORMATTED_VALUE`
              + `&dateTimeRenderOption=SERIAL_NUMBER`
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Failed to fetch ${sheetName}: ${response.statusText}`)
    }

    const data = await response.json()
    return data.values || []
  } catch (error) {
    console.error(`Error fetching ${sheetName}:`, error)
    return []
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

// Get value from row by column letter
export function getCol(row, letter) {
  const idx = colLetterToIndex(letter)
  return row[idx] || ''
}

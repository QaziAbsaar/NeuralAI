// NeuralAir voice commands — Phase 4, step 2.
// Spoken commands parsed out of the raw transcript BEFORE the LLM polish
// pass, so they are never typed as literal text (CLAUDE.md roadmap):
//   "new paragraph" -> paragraph break (\n\n) at that spot
//   "scratch that"  -> alone: undo the previous dictation
//                      mid-dictation: drop everything said before it
//   "send"          -> press Enter after the text lands (only when spoken
//                      as its own utterance, so "send the file" is left alone)
//
// Matching is case-insensitive on word boundaries. Because command words
// ("send", "okay") are ordinary English, each phrase carries its own
// tightness rule rather than one global regex.

const PARAGRAPH_RE = /\bnew paragraph\b/gi
const SCRATCH_RE = /\bscratch that\b/gi
// "send" only counts as the final word(s) of the utterance, optionally
// punctuated — "please send" fires, "send it to Bob" does not.
const SEND_RE = /(?:^|\s)send[.!]?\s*$/i

// All command occurrences, ordered by position in the transcript.
function commandPositions(transcript) {
  const positions = []
  for (const re of [PARAGRAPH_RE, SCRATCH_RE]) {
    re.lastIndex = 0
    let match
    while ((match = re.exec(transcript))) {
      positions.push({ at: match.index, end: match.index + match[0].length, kind: re === PARAGRAPH_RE ? 'paragraph' : 'scratch' })
    }
  }
  return positions.sort((a, b) => a.at - b.at)
}

// Walk the transcript, splitting command occurrences out of the text.
// Text segments are returned separately so the polish pass can run per
// segment and the paragraph breaks survive the LLM (formatting each segment
// independently guarantees "\n\n" never gets rewritten into a space).
export function parseVoiceCommands(transcript) {
  const commands = commandPositions(transcript)

  let send = SEND_RE.test(transcript.trim())
  let textStart = 0
  // A trailing "send" is stripped from the text before segmenting.
  let working = send ? transcript.trim().replace(/send[.!]?\s*$/i, '') : transcript

  const segments = [] // { text } | { break: true }
  let scratch = false // standalone "scratch that" -> undo previous dictation
  let hasText = false

  for (const cmd of commands) {
    if (cmd.end > working.length) break // trailing-send trim clipped it
    const text = working.slice(textStart, cmd.at).trim()
    if (cmd.kind === 'scratch') {
      // Everything said so far in THIS dictation is discarded — clear the
      // accumulated segments; a later part of the same dictation can still
      // carry real text.
      segments.length = 0
      hasText = false
      scratch = true
      textStart = cmd.end
      continue
    }
    // paragraph
    if (text) {
      segments.push({ text })
      hasText = true
    }
    if (segments.length) segments.push({ break: true })
    textStart = cmd.end
  }

  const tail = working.slice(textStart).trim()
  if (tail) {
    segments.push({ text: tail })
    hasText = true
  }

  // "scratch that" spoken with nothing after it and nothing surviving before
  // it = the whole utterance was the command -> undo the previous dictation.
  const undoOnly = scratch && !hasText && !send

  return { segments, hasText, undoOnly, send }
}

// Final text from parsed segments — "\n\n" between the pieces around a
// paragraph-break marker. Used directly in 'exact' polish mode and for
// tests; in 'polished' mode each text segment is polished separately and
// this same join is applied.
export function segmentsToText(segments) {
  const parts = []
  for (const segment of segments) {
    if (segment.break) {
      if (parts.length && !parts[parts.length - 1].endsWith('\n\n')) parts.push('\n\n')
    } else if (segment.text) {
      parts.push(segment.text)
    }
  }
  return parts.join('').trim()
}

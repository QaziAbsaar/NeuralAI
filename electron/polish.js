// NeuralAir LLM polish — Phase 2, step 2.
// Groq chat completion (Llama 3.1 8B): fixes punctuation, strips filler,
// formats for the target application using the active window as context.
// Engineering rule: never lose a dictation — any failure returns the raw
// transcript untouched.
const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions'
// Groq's 2026 lineup: Llama models retired; gpt-oss-20b is the fast formatting pick.
const MODEL = 'openai/gpt-oss-20b'

function buildSystemPrompt(context) {
  const contextLine = context?.title
    ? `The active window is "${context.title}"${context.owner ? ` (${context.owner})` : ''}.`
    : 'The active window is unknown.'

  return [
    'You are a text formatter for dictated speech.',
    contextLine,
    'Fix punctuation and capitalization, remove filler words (um, uh, like, you know) and false starts.',
    'Preserve the speaker\'s meaning and language exactly — never add, summarize, or translate content.',
    'If the text looks like code or a command, keep it verbatim and only fix spacing.',
    'Output ONLY the finalized text. No preamble, no quotes, no explanations. Anything other than the corrected text will ruin the user\'s document.',
  ].join(' ')
}

export async function polishTranscript(text, context) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return text // no key configured — raw transcript is still useful

  try {
    const response = await fetch(GROQ_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0, // deterministic — formatting, not creativity
        messages: [
          { role: 'system', content: buildSystemPrompt(context) },
          { role: 'user', content: text },
        ],
      }),
    })

    if (!response.ok) {
      throw new Error(`Groq API ${response.status}: ${await response.text()}`)
    }

    const data = await response.json()
    const polished = data.choices?.[0]?.message?.content?.trim()
    return polished || text
  } catch (err) {
    console.error(`[polish] failed, using raw transcript: ${err.message}`)
    return text
  }
}

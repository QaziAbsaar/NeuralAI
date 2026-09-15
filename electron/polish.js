// NeuralAir LLM polish — Phase 2, step 2; multi-provider in Phase 4.
// Formats the transcript for the target application using the active window
// as context. Providers (settings.llmProvider): 'groq' (default), 'nvidia'
// (NVIDIA NIM), 'openai-compatible' — any custom OpenAI-style
// /chat/completions endpoint (OpenAI, OpenRouter, LM Studio, Ollama) — or
// 'none' for a fully offline pipeline. Engineering rule: never lose a
// dictation — any failure returns the raw transcript untouched.
import { loadSettings } from './settings.js'

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions'
const NVIDIA_CHAT_URL = 'https://integrate.api.nvidia.com/v1/chat/completions'

function buildSystemPrompt(context, vocabulary) {
  const contextLine = context?.title
    ? `The active window is "${context.title}"${context.owner ? ` (${context.owner})` : ''}.`
    : 'The active window is unknown.'
  const vocabLine =
    vocabulary?.length
      ? `The speaker's vocabulary (names and jargon — use these exact spellings when they appear): ${vocabulary.join(', ')}.`
      : ''

  // Per-app shaping: developers dictating into an editor or terminal get
  // verbatim-ish cleanup (flags, paths, and identifiers must survive); chat
  // and mail get normal conversational formatting.
  const where = `${context?.owner ?? ''} ${context?.title ?? ''}`.toLowerCase()
  const isDevSurface = /code|vim|neovim|emacs|jetbrains|terminal|kitty|alacritty|foot|konsole|ghostty|shell|ssh|ssh-context|git|docker|ide|editor/.test(
    where,
  )
  const styleLine = isDevSurface
    ? 'The target app is a code editor or terminal: keep identifiers, paths, flags, and symbols exactly as spoken; do not add sentence-case or smart punctuation that would break code or CLI syntax.'
    : 'Format naturally for the target application.'

  return [
    'You are a text formatter for dictated speech.',
    contextLine,
    styleLine,
    vocabLine,
    'Fix punctuation and capitalization, remove filler words (um, uh, like, you know) and false starts.',
    'Preserve the speaker\'s meaning and language exactly — never add, summarize, or translate content.',
    'If the text looks like code or a command, keep it verbatim and only fix spacing.',
    'Output ONLY the finalized text. No preamble, no quotes, no explanations. Anything other than the corrected text will ruin the user\'s document.',
  ]
    .filter(Boolean)
    .join(' ')
}

export async function polishTranscript(text, context, vocabulary = []) {
  try {
    return await chatComplete(buildSystemPrompt(context, vocabulary), text)
  } catch (err) {
    console.error(`[polish] failed, using raw transcript: ${err.message}`)
    return text
  }
}

// Selection transforms ("--ask" flow): the user selected text, spoke an
// instruction like "make this more concise", and the LLM rewrites the
// selection accordingly. The result REPLACES the still-selected text.
export async function transformSelection(selection, instruction) {
  const systemPrompt = [
    'You are a text editor. The user selected some text and gave you a spoken instruction.',
    'Rewrite the SELECTED TEXT according to the INSTRUCTION.',
    'Output ONLY the rewritten text. No preamble, no quotes, no explanations.',
  ].join(' ')
  const userContent = `INSTRUCTION: ${instruction}\n\nSELECTED TEXT:\n${selection}`
  const result = await chatComplete(systemPrompt, userContent)
  return result.trim() || selection
}

// One chat completion through the configured provider (groq / nvidia /
// openai-compatible). Shared by the polish pass and selection transforms.
async function chatComplete(systemPrompt, userContent) {
  const settings = loadSettings()
  const provider = settings.llmProvider

  if (provider === 'none') throw new Error('no LLM provider configured')

  let url, apiKey, model
  if (provider === 'nvidia') {
    // NVIDIA NIM — OpenAI-compatible; user brings the key and model name
    // (e.g. "meta/llama-3.1-70b-instruct" from build.nvidia.com).
    url = NVIDIA_CHAT_URL
    apiKey = settings.llmApiKey
    model = settings.llmModel
    if (!model) throw new Error('nvidia provider needs a model name')
  } else if (provider === 'openai-compatible') {
    // Base URL points at the API root serving /chat/completions.
    url = `${settings.llmBaseUrl.replace(/\/+$/, '')}/chat/completions`
    apiKey = settings.llmApiKey
    model = settings.llmModel
    if (!settings.llmBaseUrl || !model) throw new Error('custom provider needs a base URL and model')
  } else {
    // 'groq' — falls back to the env key when none is stored in settings.
    url = GROQ_CHAT_URL
    apiKey = settings.groqApiKey || process.env.GROQ_API_KEY
    model = settings.polishModel
    if (!apiKey) throw new Error('no API key configured')
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0, // deterministic — formatting, not creativity
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`LLM API ${response.status}: ${await response.text()}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}

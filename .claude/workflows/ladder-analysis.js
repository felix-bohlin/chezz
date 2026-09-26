export const meta = {
  name: 'ladder-analysis',
  description: 'Analyze one ladder game with shogun-sensei + engine-smith, then adversarially verify every suggestion against the engine code',
  whenToUse: 'Step 3 of the analyze-game skill, after every ladder game. Uses no local CPU, so it can run while the next game plays.',
  phases: [
    { title: 'Analyze', detail: 'shogun-sensei (chess) and engine-smith (code) in parallel', model: 'sonnet' },
    { title: 'Verify', detail: 'one skeptic per suggestion, checked against backend/engine/src' },
  ],
}

// args: { game, engine_version, report, engine_state, do_not }
const A = args || {}

const ANALYSIS = {
  type: 'object',
  properties: {
    markdown: {
      type: 'string',
      description: 'Your section for the analysis file, in your role\'s normal output format (heading, story/diagnosis, ranked suggestions). Max ~250 words.',
    },
    suggestions: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          category: { type: 'string', enum: ['eval', 'search', 'ordering', 'time', 'other'] },
          evidence: { type: 'string', description: 'Which ply/FEN and eval gap supports it' },
          change: { type: 'string', description: 'Concrete code change: file, function, constants' },
          expected: { type: 'string' },
          risk: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
        required: ['title', 'category', 'evidence', 'change', 'risk'],
      },
    },
  },
  required: ['markdown', 'suggestions'],
}

const VERDICT = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['keep', 'refute'] },
    reason: { type: 'string' },
    already_implemented: { type: 'boolean' },
    direction_correct: { type: 'boolean' },
    on_do_not_list: { type: 'boolean' },
    refined_change: { type: 'string', description: 'If kept: exact change (file, function, constants), implementable in < 40 lines' },
    score: { type: 'integer', minimum: 0, maximum: 10, description: 'Expected Elo gain vs risk; 0 if refuted' },
  },
  required: ['verdict', 'reason', 'score'],
}

const context = `Game: ${A.game} (engine version ${A.engine_version}, 5 s/move vs strength-limited Stockfish).

Objective report from full-strength Stockfish:
${A.report}

Current engine state: ${A.engine_state}

Do NOT propose any of these (already implemented, or tried and failed selfplay): ${A.do_not}`

const ANALYSTS = [
  {
    type: 'shogun-sensei',
    label: 'shogun-sensei',
    focus: 'Review as a world-class chess expert modelled on Magnus Carlsen\'s playing strength. Name the chess reasons we lost points and the chess knowledge the engine is missing. Describe tactics precisely — check whose move each line is from the FEN side-to-move field before explaining a tactic.',
  },
  {
    type: 'engine-smith',
    label: 'engine-smith',
    focus: 'Map each significant error onto the Rust code (backend/engine/src) and propose small, testable changes. Read the actual code before claiming something is missing, and state which direction a constant change moves the behavior.',
  },
]

function verifyPrompt(s, analyst) {
  return `You are a skeptical reviewer of a proposed change to our Rust chess engine (source in backend/engine/src).
READ-ONLY: do not edit, create or delete any files.

Proposed by ${analyst}:
- Title: ${s.title} (${s.category}, risk ${s.risk})
- Change: ${s.change}
- Evidence: ${s.evidence}
- Expected: ${s.expected || 'n/a'}

${context}

Try to REFUTE it. Check each point against the actual code (grep/read, don't guess):
1. Is it already implemented, fully or in effect? (e.g. an extension that already happens one ply deeper)
2. Does the change move behavior in the intended direction? (e.g. a smaller pruning margin prunes MORE, not less)
3. Is it on the do-not list above, or a re-labelled version of something on it?
4. Does the evidence actually support it — is the position/tactic described correctly for the side to move?
5. Is it concrete and implementable in under 40 lines without destabilizing search?
Default to verdict "refute" if uncertain. If you keep it, give the exact refined change and a 0-10 score for expected Elo gain vs risk.`
}

const results = await pipeline(
  ANALYSTS,
  (a) =>
    agent(
      `${context}\n\n${a.focus}\nReturn your analysis section as \`markdown\` (your normal output format, max ~250 words) and up to 3 concrete suggestions.`,
      { label: a.label, phase: 'Analyze', agentType: a.type, model: 'sonnet', schema: ANALYSIS },
    ),
  (res, a) => {
    if (!res) return null
    return parallel(
      res.suggestions.map((s, i) => () =>
        agent(verifyPrompt(s, a.label), { label: `verify:${a.label}#${i + 1}`, phase: 'Verify', effort: 'high', schema: VERDICT })
          .then((v) => ({ ...s, from: a.label, verdict: v })),
      ),
    ).then((vs) => ({ analyst: a.label, markdown: res.markdown, suggestions: vs.filter(Boolean) }))
  },
)

const analyses = results.filter(Boolean)
const all = analyses.flatMap((r) => r.suggestions)
const kept = all
  .filter((s) => s.verdict && s.verdict.verdict === 'keep')
  .sort((x, y) => y.verdict.score - x.verdict.score)
const refuted = all.filter((s) => !s.verdict || s.verdict.verdict !== 'keep')
log(`${all.length} suggestions: ${kept.length} survived verification, ${refuted.length} refuted`)

return {
  analyses: analyses.map((r) => ({ analyst: r.analyst, markdown: r.markdown })),
  kept: kept.map((s) => ({ from: s.from, title: s.title, change: s.verdict.refined_change || s.change, score: s.verdict.score, reason: s.verdict.reason })),
  refuted: refuted.map((s) => ({ from: s.from, title: s.title, reason: s.verdict ? s.verdict.reason : 'verifier failed' })),
}

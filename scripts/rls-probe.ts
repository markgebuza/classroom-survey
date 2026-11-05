/**
 * Probes the live Supabase database with ONLY the public anon key, i.e. exactly what a student
 * (or an attacker with the key from the JS bundle) can do. Every check must PASS.
 *
 *   npx tsx scripts/rls-probe.ts            # read/write probes, no data is created
 *   npx tsx scripts/rls-probe.ts --submit   # also submits ONE test response to the active survey
 *                                           # twice (second must fail with DUPLICATE_RESPONSE)
 *
 * Reads VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from the environment or from .env.local.
 * Never put the service-role key in .env.local; this script must not need it.
 */
import { createClient, type PostgrestError } from '@supabase/supabase-js'
import { existsSync } from 'node:fs'

if (existsSync('.env.local')) process.loadEnvFile('.env.local')

const url = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !anonKey) {
  console.error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Create .env.local (see .env.example) or export them, then run again.',
  )
  process.exit(2)
}

const supabase = createClient(url, anonKey, { auth: { persistSession: false } })
const NO_SUCH_ID = '00000000-0000-0000-0000-000000000000'

type Result = 'PASS' | 'FAIL' | 'SKIP'
const results: Array<{ result: Result; name: string; detail: string }> = []

function record(result: Result, name: string, detail: string) {
  results.push({ result, name, detail })
  console.log(`${result.padEnd(4)}  ${name} — ${detail}`)
}

function describeError(error: PostgrestError | null) {
  return error ? `${error.code ?? ''} ${error.message}`.trim() : 'no error'
}

/**
 * Only Postgres "permission denied" counts as a rejection. Any other error (network failure,
 * invalid API key, missing table) would otherwise look like a PASS without proving anything.
 */
function isPermissionDenied(error: PostgrestError | null) {
  return Boolean(error && (error.code === '42501' || /permission denied/i.test(error.message)))
}

/** Safe if denied by privileges or if RLS filtered every row. */
async function expectNoRows(
  name: string,
  query: PromiseLike<{ data: unknown[] | null; error: PostgrestError | null }>,
) {
  const { data, error } = await query
  if (isPermissionDenied(error)) record('PASS', name, `rejected: ${describeError(error)}`)
  else if (error) record('FAIL', name, `unexpected error: ${describeError(error)}`)
  else if (!data || data.length === 0) record('PASS', name, 'returned 0 rows')
  else record('FAIL', name, `returned ${data.length} rows`)
}

async function main() {
  // Preflight: a call anon IS allowed to make. If this fails, the URL/key/migrations are wrong
  // and every "rejected" result below would be meaningless.
  const preflight = await supabase.rpc('get_survey_status_by_slug', { p_slug: 'rls-probe-none' })
  if (preflight.error) {
    console.error(
      `Cannot run the probe: ${describeError(preflight.error)}
Check VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and that both migrations were applied.`,
    )
    process.exit(2)
  }

  await expectNoRows('anon cannot read responses', supabase.from('responses').select('id').limit(5))
  await expectNoRows('anon cannot read answers', supabase.from('answers').select('id').limit(5))
  await expectNoRows(
    'anon cannot read draft/closed/archived surveys',
    supabase.from('surveys').select('id, status').neq('status', 'active').limit(5),
  )

  {
    const { data, error } = await supabase
      .from('surveys')
      .insert({ title: 'rls-probe' })
      .select('id')
    if (isPermissionDenied(error))
      record('PASS', 'anon cannot insert into surveys', `rejected: ${describeError(error)}`)
    else if (error)
      record('FAIL', 'anon cannot insert into surveys', `unexpected error: ${describeError(error)}`)
    else
      record(
        'FAIL',
        'anon cannot insert into surveys',
        `inserted ${data?.length ?? 0} row(s) — delete them!`,
      )
  }

  await expectNoRows(
    'anon cannot update surveys',
    supabase.from('surveys').update({ title: 'rls-probe' }).neq('id', NO_SUCH_ID).select('id'),
  )
  await expectNoRows(
    'anon cannot delete surveys',
    supabase.from('surveys').delete().neq('id', NO_SUCH_ID).select('id'),
  )

  {
    const { error } = await supabase.rpc('get_survey_results', { p_survey_id: NO_SUCH_ID })
    const denied = isPermissionDenied(error)
    record(
      denied ? 'PASS' : 'FAIL',
      'anon cannot call get_survey_results',
      error ? describeError(error) : 'call succeeded',
    )
  }

  {
    const { error } = await supabase.rpc('activate_survey', { p_survey_id: NO_SUCH_ID })
    const denied = isPermissionDenied(error)
    record(denied ? 'PASS' : 'FAIL', 'anon cannot call activate_survey', describeError(error))
  }

  const { data: active, error: activeError } = await supabase
    .from('surveys')
    .select('id, title, questions(id, choices(id))')
    .eq('status', 'active')
    .maybeSingle()
  if (activeError) record('FAIL', 'anon can read the active survey', describeError(activeError))
  else if (!active)
    record('SKIP', 'anon can read the active survey', 'no survey is active right now')
  else record('PASS', 'anon can read the active survey', `"${active.title}"`)

  if (!process.argv.includes('--submit')) {
    record(
      'SKIP',
      'submit twice with the same token',
      'run with --submit to create one test response',
    )
  } else if (!active) {
    record('SKIP', 'submit twice with the same token', 'activate a TEST survey first')
  } else {
    const token = `rls-probe-${Date.now()}`
    const answers = active.questions.map((q) => ({
      question_id: q.id,
      choice_id: q.choices[0]?.id,
    }))
    const args = { p_survey_id: active.id, p_anonymous_token: token, p_answers: answers }
    const first = await supabase.rpc('submit_survey_response', args)
    record(
      first.error ? 'FAIL' : 'PASS',
      'anon can submit through submit_survey_response',
      first.error ? describeError(first.error) : JSON.stringify(first.data),
    )
    const second = await supabase.rpc('submit_survey_response', args)
    const duplicate = second.error?.message.includes('DUPLICATE_RESPONSE')
    record(
      duplicate ? 'PASS' : 'FAIL',
      'second submission with the same token is rejected',
      second.error ? describeError(second.error) : 'accepted (duplicate!)',
    )
  }

  const failed = results.filter((r) => r.result === 'FAIL').length
  const skipped = results.filter((r) => r.result === 'SKIP').length
  console.log(`\n${results.length - failed - skipped} passed, ${failed} failed, ${skipped} skipped`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('Probe crashed:', err instanceof Error ? err.message : err)
  process.exit(1)
})

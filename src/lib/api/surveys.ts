import type { ExportResponse } from '../csv'
import { supabase } from '../supabase'
import type {
  ActivateResult,
  QuestionInput,
  Survey,
  SurveyResults,
  SurveyStatus,
  SurveyWithQuestions,
} from '../types'

export interface SurveyListItem extends Survey {
  response_count: number
}

export type SurveyPatch = Partial<Pick<Survey, 'title' | 'description' | 'status' | 'public_slug'>>

type SurveyRowWithCount = Survey & { responses: { count: number }[] }

export async function listSurveys(): Promise<SurveyListItem[]> {
  const { data, error } = await supabase
    .from('surveys')
    .select('*, responses(count)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as SurveyRowWithCount[]).map(({ responses, ...survey }) => ({
    ...survey,
    response_count: responses?.[0]?.count ?? 0,
  }))
}

export async function getSurvey(id: string): Promise<SurveyWithQuestions> {
  const { data, error } = await supabase
    .from('surveys')
    .select('*, questions(*, choices(*))')
    .eq('id', id)
    .single()
  if (error) throw error
  const survey = data as SurveyWithQuestions
  survey.questions.sort((a, b) => a.position - b.position)
  survey.questions.forEach((q) => q.choices.sort((a, b) => a.position - b.position))
  return survey
}

export async function createSurvey(input: {
  title: string
  description: string | null
}): Promise<Survey> {
  const { data, error } = await supabase
    .from('surveys')
    .insert({ title: input.title, description: input.description, status: 'draft' })
    .select()
    .single()
  if (error) throw error
  return data as Survey
}

export async function updateSurvey(id: string, patch: SurveyPatch): Promise<Survey> {
  const { data, error } = await supabase
    .from('surveys')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Survey
}

export async function deleteSurvey(id: string): Promise<void> {
  const { error } = await supabase.from('surveys').delete().eq('id', id)
  if (error) throw error
}

export async function archiveSurvey(id: string): Promise<Survey> {
  return updateSurvey(id, { status: 'archived' satisfies SurveyStatus })
}

export async function activateSurvey(id: string): Promise<ActivateResult> {
  const { data, error } = await supabase.rpc('activate_survey', { p_survey_id: id })
  if (error) throw error
  return data as ActivateResult
}

export async function closeSurvey(id: string): Promise<void> {
  const { error } = await supabase.rpc('close_survey', { p_survey_id: id })
  if (error) throw error
}

export async function duplicateSurvey(id: string): Promise<string> {
  const { data, error } = await supabase.rpc('duplicate_survey', { p_survey_id: id })
  if (error) throw error
  return data as string
}

export async function countResponses(surveyId: string): Promise<number> {
  const { count, error } = await supabase
    .from('responses')
    .select('id', { count: 'exact', head: true })
    .eq('survey_id', surveyId)
  if (error) throw error
  return count ?? 0
}

export async function getOtherActiveSurvey(
  excludeId: string | null,
): Promise<Pick<Survey, 'id' | 'title'> | null> {
  let query = supabase.from('surveys').select('id, title').eq('status', 'active')
  if (excludeId) query = query.neq('id', excludeId)
  const { data, error } = await query.maybeSingle()
  if (error) throw error
  return data
}

/**
 * Replaces all questions and choices of a survey (delete-and-reinsert, DECISIONS.md D12).
 * Only call for surveys with no responses: deleting questions cascades to answers.
 */
export async function replaceSurveyQuestions(
  surveyId: string,
  questions: QuestionInput[],
): Promise<void> {
  const { error: deleteError } = await supabase.from('questions').delete().eq('survey_id', surveyId)
  if (deleteError) throw deleteError
  if (questions.length === 0) return

  const questionRows = questions.map((q, index) => ({
    id: crypto.randomUUID(),
    survey_id: surveyId,
    question_text: q.text.trim(),
    question_type: q.type,
    position: index + 1,
  }))
  const { error: questionError } = await supabase.from('questions').insert(questionRows)
  if (questionError) throw questionError

  const choiceRows = questions.flatMap((q, qIndex) =>
    q.choices.map((c, cIndex) => ({
      question_id: questionRows[qIndex].id,
      choice_text: c.text.trim(),
      position: cIndex + 1,
    })),
  )
  const { error: choiceError } = await supabase.from('choices').insert(choiceRows)
  if (choiceError) throw choiceError
}

export async function getSurveyResults(surveyId: string): Promise<SurveyResults> {
  const { data, error } = await supabase.rpc('get_survey_results', { p_survey_id: surveyId })
  if (error) throw error
  return data as SurveyResults
}

const PAGE_SIZE = 1000 // Supabase's default "max rows" per request.

/** All responses of a survey with their answers, paged so large classes are not truncated. */
export async function listResponsesWithAnswers(surveyId: string): Promise<ExportResponse[]> {
  const all: ExportResponse[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('responses')
      .select('id, submitted_at, answers(question_id, choice_id)')
      .eq('survey_id', surveyId)
      .order('submitted_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    all.push(...(data as ExportResponse[]))
    if (data.length < PAGE_SIZE) return all
  }
}

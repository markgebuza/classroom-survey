import { supabase } from '../supabase'
import type { QuestionType, SubmitAnswer, SurveyStatus } from '../types'

export interface PublicChoice {
  id: string
  choice_text: string
  position: number
}

export interface PublicQuestion {
  id: string
  question_text: string
  question_type: QuestionType
  position: number
  choices: PublicChoice[]
}

export interface PublicSurvey {
  id: string
  title: string
  description: string | null
  questions: PublicQuestion[]
}

/** Returns the survey only if it is active (anon RLS hides every other status), else null. */
export async function getPublicSurvey(slug: string): Promise<PublicSurvey | null> {
  const { data, error } = await supabase
    .from('surveys')
    .select(
      'id, title, description, questions(id, question_text, question_type, position, choices(id, choice_text, position))',
    )
    .eq('public_slug', slug)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const survey = data as PublicSurvey
  survey.questions.sort((a, b) => a.position - b.position)
  survey.questions.forEach((q) => q.choices.sort((a, b) => a.position - b.position))
  return survey
}

export async function getSurveyStatusBySlug(slug: string): Promise<SurveyStatus | null> {
  const { data, error } = await supabase.rpc('get_survey_status_by_slug', { p_slug: slug })
  if (error) throw error
  return (data as SurveyStatus | null) ?? null
}

export async function submitSurveyResponse(
  surveyId: string,
  anonymousToken: string,
  answers: SubmitAnswer[],
): Promise<{ success: boolean; response_id: string }> {
  const { data, error } = await supabase.rpc('submit_survey_response', {
    p_survey_id: surveyId,
    p_anonymous_token: anonymousToken,
    p_answers: answers,
  })
  if (error) throw error
  return data as { success: boolean; response_id: string }
}

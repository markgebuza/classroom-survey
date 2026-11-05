export type SurveyStatus = 'draft' | 'active' | 'closed' | 'archived'
export type QuestionType = 'multiple_choice' | 'true_false'

export interface Survey {
  id: string
  title: string
  description: string | null
  status: SurveyStatus
  public_slug: string | null
  created_at: string
  updated_at: string
}

export interface Choice {
  id: string
  question_id: string
  choice_text: string
  position: number
}

export interface Question {
  id: string
  survey_id: string
  question_text: string
  question_type: QuestionType
  position: number
}

export interface QuestionWithChoices extends Question {
  choices: Choice[]
}

export interface SurveyWithQuestions extends Survey {
  questions: QuestionWithChoices[]
}

export interface SurveyResponse {
  id: string
  survey_id: string
  anonymous_token: string | null
  submitted_at: string
}

export interface Answer {
  id: string
  response_id: string
  question_id: string
  choice_id: string | null
  text_answer: string | null
}

export interface ChoiceResult {
  choice_id: string
  choice_text: string
  count: number
  percentage: number
}

export interface QuestionResult {
  question_id: string
  question_text: string
  response_count: number
  choices: ChoiceResult[]
}

export interface SurveyResults {
  survey_id: string
  response_count: number
  questions: QuestionResult[]
}

export interface ActivateResult {
  id: string
  status: SurveyStatus
  public_slug: string
}

export interface SubmitAnswer {
  question_id: string
  choice_id: string
}

export interface QuestionInput {
  text: string
  type: QuestionType
  choices: { text: string }[]
}

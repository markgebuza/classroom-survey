import type { QuestionType, SurveyWithQuestions } from './types'

export interface DraftChoice {
  key: string
  text: string
}

export interface DraftQuestion {
  key: string
  text: string
  type: QuestionType
  choices: DraftChoice[]
}

export interface DraftSurvey {
  title: string
  description: string
  questions: DraftQuestion[]
}

export const TRUE_FALSE_LABELS = ['True', 'False'] as const

export function newKey(): string {
  return crypto.randomUUID()
}

export function newChoice(text = ''): DraftChoice {
  return { key: newKey(), text }
}

export function trueFalseChoices(): DraftChoice[] {
  return TRUE_FALSE_LABELS.map((label) => newChoice(label))
}

export function newQuestion(type: QuestionType = 'multiple_choice'): DraftQuestion {
  return {
    key: newKey(),
    text: '',
    type,
    choices: type === 'true_false' ? trueFalseChoices() : [newChoice(), newChoice()],
  }
}

export function emptyDraft(): DraftSurvey {
  return { title: '', description: '', questions: [newQuestion()] }
}

export function draftFromSurvey(survey: SurveyWithQuestions): DraftSurvey {
  return {
    title: survey.title,
    description: survey.description ?? '',
    questions: survey.questions.map((q) => ({
      key: q.id,
      text: q.question_text,
      type: q.question_type,
      choices: q.choices.map((c) => ({ key: c.id, text: c.choice_text })),
    })),
  }
}

/** Returns a copy of `items` with the item at `index` moved by `delta` (no-op at the ends). */
export function moveItem<T>(items: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta
  if (target < 0 || target >= items.length) return items
  const copy = [...items]
  ;[copy[index], copy[target]] = [copy[target], copy[index]]
  return copy
}

/** True when switching this question to True/False would throw away typed choice text. */
export function hasCustomChoices(question: DraftQuestion): boolean {
  if (question.type !== 'multiple_choice') return false
  return question.choices.some((c) => c.text.trim() !== '')
}

export function changeType(question: DraftQuestion, type: QuestionType): DraftQuestion {
  if (question.type === type) return question
  if (type === 'true_false') return { ...question, type, choices: trueFalseChoices() }
  // True/False -> Multiple Choice: keep True/False as editable starting choices.
  return { ...question, type, choices: question.choices.map((c) => newChoice(c.text)) }
}

export type EditorErrors = Record<string, string>

export const errorKeys = {
  title: 'title',
  questions: 'questions',
  question: (key: string) => `question:${key}`,
  choices: (key: string) => `choices:${key}`,
  choice: (key: string) => `choice:${key}`,
}

export function validateDraft(draft: DraftSurvey): EditorErrors {
  const errors: EditorErrors = {}
  if (!draft.title.trim()) errors[errorKeys.title] = 'Enter a survey title.'
  if (draft.questions.length === 0) errors[errorKeys.questions] = 'Add at least one question.'

  for (const question of draft.questions) {
    if (!question.text.trim()) errors[errorKeys.question(question.key)] = 'Enter the question text.'
    if (question.type === 'multiple_choice') {
      if (question.choices.length < 2) {
        errors[errorKeys.choices(question.key)] = 'Add at least two choices.'
      }
      const seen = new Set<string>()
      for (const choice of question.choices) {
        const text = choice.text.trim()
        if (!text) {
          errors[errorKeys.choice(choice.key)] = 'Enter the choice text or delete this choice.'
        } else if (seen.has(text.toLowerCase())) {
          errors[errorKeys.choice(choice.key)] = 'This choice is the same as another choice.'
        }
        seen.add(text.toLowerCase())
      }
    }
  }
  return errors
}

/** Comparable snapshot used for the "unsaved changes" check (ignores React keys). */
export function draftSnapshot(draft: DraftSurvey): string {
  return JSON.stringify({
    title: draft.title,
    description: draft.description,
    questions: draft.questions.map((q) => ({
      text: q.text,
      type: q.type,
      choices: q.choices.map((c) => c.text),
    })),
  })
}

import type { SubmitAnswer } from './types'

export type SelectedAnswers = Record<string, string>

export function missingQuestionIds(questionIds: string[], selected: SelectedAnswers): string[] {
  return questionIds.filter((id) => !selected[id])
}

export function toSubmitAnswers(questionIds: string[], selected: SelectedAnswers): SubmitAnswer[] {
  return questionIds
    .filter((id) => selected[id])
    .map((id) => ({ question_id: id, choice_id: selected[id] }))
}

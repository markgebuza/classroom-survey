import { describe, expect, it } from 'vitest'
import {
  changeType,
  draftSnapshot,
  errorKeys,
  hasCustomChoices,
  moveItem,
  newChoice,
  newQuestion,
  validateDraft,
  type DraftSurvey,
} from './editor'

function draftWith(overrides: Partial<DraftSurvey> = {}): DraftSurvey {
  const q = newQuestion()
  q.text = 'What is recursion?'
  q.choices = [newChoice('A function calling itself'), newChoice('A loop')]
  return { title: 'Recursion', description: '', questions: [q], ...overrides }
}

describe('moveItem', () => {
  it('swaps neighbours and ignores moves past either end', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c'])
    expect(moveItem(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b'])
    const items = ['a', 'b']
    expect(moveItem(items, 0, -1)).toBe(items)
    expect(moveItem(items, 1, 1)).toBe(items)
  })
})

describe('question types', () => {
  it('creates True/False questions with exactly True and False', () => {
    expect(newQuestion('true_false').choices.map((c) => c.text)).toEqual(['True', 'False'])
  })

  it('replaces choices when switching to True/False and keeps them editable when switching back', () => {
    const q = { ...newQuestion(), choices: [newChoice('A'), newChoice('B'), newChoice('C')] }
    expect(hasCustomChoices(q)).toBe(true)
    const tf = changeType(q, 'true_false')
    expect(tf.choices.map((c) => c.text)).toEqual(['True', 'False'])
    expect(hasCustomChoices(tf)).toBe(false)
    expect(changeType(tf, 'multiple_choice').choices.map((c) => c.text)).toEqual(['True', 'False'])
  })

  it('does not ask for confirmation when multiple-choice options are still blank', () => {
    expect(hasCustomChoices(newQuestion())).toBe(false)
  })
})

describe('validateDraft', () => {
  it('accepts a complete survey', () => {
    expect(validateDraft(draftWith())).toEqual({})
  })

  it('requires a title and at least one question', () => {
    const errors = validateDraft(draftWith({ title: '   ', questions: [] }))
    expect(errors[errorKeys.title]).toBe('Enter a survey title.')
    expect(errors[errorKeys.questions]).toBe('Add at least one question.')
  })

  it('requires question text, two choices and non-blank, distinct choices', () => {
    const q = newQuestion()
    q.choices = [newChoice('Yes'), newChoice(' yes '), newChoice('  ')]
    const single = newQuestion()
    single.text = 'Only one choice'
    single.choices = [newChoice('A')]
    const errors = validateDraft(draftWith({ questions: [q, single] }))
    expect(errors[errorKeys.question(q.key)]).toBe('Enter the question text.')
    expect(errors[errorKeys.choice(q.choices[1].key)]).toBe(
      'This choice is the same as another choice.',
    )
    expect(errors[errorKeys.choice(q.choices[2].key)]).toBe(
      'Enter the choice text or delete this choice.',
    )
    expect(errors[errorKeys.choices(single.key)]).toBe('Add at least two choices.')
  })

  it('does not validate the fixed True/False choices', () => {
    const tf = newQuestion('true_false')
    tf.text = 'Recursion needs a base case.'
    expect(validateDraft(draftWith({ questions: [tf] }))).toEqual({})
  })
})

describe('draftSnapshot', () => {
  it('changes when content or order changes but not when only keys differ', () => {
    const a = draftWith()
    const b = { ...a, questions: a.questions.map((q) => ({ ...q, key: 'other' })) }
    expect(draftSnapshot(a)).toBe(draftSnapshot(b))
    const reordered = {
      ...a,
      questions: [{ ...a.questions[0], choices: [...a.questions[0].choices].reverse() }],
    }
    expect(draftSnapshot(reordered)).not.toBe(draftSnapshot(a))
  })
})

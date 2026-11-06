import { describe, expect, it } from 'vitest'
import {
  buildResultsCsv,
  csvFileName,
  escapeCell,
  slugify,
  toCsv,
  type ExportResponse,
} from './csv'
import type { SurveyWithQuestions } from './types'

describe('escapeCell (RFC 4180)', () => {
  it('leaves plain text alone', () => {
    expect(escapeCell('A base case')).toBe('A base case')
    expect(escapeCell(42)).toBe('42')
    expect(escapeCell(null)).toBe('')
    expect(escapeCell(undefined)).toBe('')
  })

  it('quotes commas, quotes and newlines and doubles embedded quotes', () => {
    expect(escapeCell('a, b')).toBe('"a, b"')
    expect(escapeCell('say "hi"')).toBe('"say ""hi"""')
    expect(escapeCell('line 1\nline 2')).toBe('"line 1\nline 2"')
    expect(escapeCell('line 1\r\nline 2')).toBe('"line 1\r\nline 2"')
    expect(escapeCell(' padded ')).toBe('" padded "')
  })
})

describe('escapeCell (formula injection)', () => {
  it.each([
    ['=1+1', "'=1+1"],
    ['+1', "'+1"],
    ['-1', "'-1"],
    ['@SUM(A1)', "'@SUM(A1)"],
    [
      '=HYPERLINK("http://evil.example","click")',
      '"\'=HYPERLINK(""http://evil.example"",""click"")"',
    ],
    ['\t=cmd', "'\t=cmd"],
  ])('neutralises %j', (input, expected) => {
    expect(escapeCell(input)).toBe(expected)
  })

  it('does not touch these characters later in the text', () => {
    expect(escapeCell('a=b')).toBe('a=b')
    expect(escapeCell('email@example.com')).toBe('email@example.com')
  })
})

describe('escapeCell (spreadsheet type guessing)', () => {
  // Excel turns these into dates, numbers or booleans when it opens a CSV (1/2 became "2-Jan").
  it.each([
    ['1/2', '"=""1/2"""'],
    ['3/4', '"=""3/4"""'],
    ['75%', '"=""75%"""'],
    ['007', '"=""007"""'],
    ['1.50', '"=""1.50"""'],
    ['1,000', '"=""1,000"""'],
    ['2026-11-05', '"=""2026-11-05"""'],
    ['10:30 AM', '"=""10:30 AM"""'],
    ['$5', '"=""$5"""'],
    ['True', '"=""True"""'],
    ['false', '"=""false"""'],
  ])('keeps %j as text', (input, expected) => {
    expect(escapeCell(input)).toBe(expected)
  })

  it('leaves ordinary text, timestamps and real numbers alone', () => {
    expect(escapeCell('1/2 cup')).toBe('1/2 cup')
    expect(escapeCell('Red')).toBe('Red')
    expect(escapeCell('2026-08-17T12:09:00.000Z')).toBe('2026-08-17T12:09:00.000Z')
    expect(escapeCell(3)).toBe('3')
  })

  it('still applies the formula guard first', () => {
    expect(escapeCell('-1')).toBe("'-1")
  })
})

describe('toCsv', () => {
  it('joins rows with CRLF and ends with a line break', () => {
    expect(toCsv([['a', 'b'], ['c', 'x,y'], []])).toBe('a,b\r\nc,"x,y"\r\n\r\n')
  })
})

describe('file names', () => {
  it('slugifies titles', () => {
    expect(slugify('Recursion Concept Check!')).toBe('recursion-concept-check')
    expect(slugify('Café  Über / Test')).toBe('cafe-uber-test')
    expect(slugify('???')).toBe('survey')
  })

  it('uses <slug>-results-<yyyy-mm-dd>.csv with the local date', () => {
    expect(csvFileName('Pointer Review', new Date(2026, 7, 17, 23, 59))).toBe(
      'pointer-review-results-2026-08-17.csv',
    )
  })
})

describe('buildResultsCsv', () => {
  const survey: SurveyWithQuestions = {
    id: 's1',
    title: 'Recursion, "Part 1"',
    description: null,
    status: 'closed',
    public_slug: 'abc',
    created_at: '2026-08-17T12:00:00Z',
    updated_at: '2026-08-17T12:00:00Z',
    questions: [
      {
        id: 'q2',
        survey_id: 's1',
        question_text: 'Second, T/F',
        question_type: 'true_false',
        position: 2,
        choices: [
          { id: 't', question_id: 'q2', choice_text: 'True', position: 1 },
          { id: 'f', question_id: 'q2', choice_text: 'False', position: 2 },
        ],
      },
      {
        id: 'q1',
        survey_id: 's1',
        question_text: 'First?',
        question_type: 'multiple_choice',
        position: 1,
        choices: [
          { id: 'a', question_id: 'q1', choice_text: '=danger', position: 1 },
          { id: 'b', question_id: 'q1', choice_text: 'Plain', position: 2 },
        ],
      },
    ],
  }

  const responses: ExportResponse[] = [
    {
      id: 'r2',
      submitted_at: '2026-08-17T12:10:05+00:00',
      answers: [{ question_id: 'q1', choice_id: 'b' }],
    },
    {
      id: 'r1',
      submitted_at: '2026-08-17T12:09:00+00:00',
      answers: [
        { question_id: 'q1', choice_id: 'a' },
        { question_id: 'q2', choice_id: 't' },
      ],
    },
  ]

  it('writes a header in question order, one row per response, then the summary', () => {
    const csv = buildResultsCsv(survey, responses, new Date('2026-08-18T08:00:00Z'))
    const lines = csv.split('\r\n')
    expect(lines[0]).toBe('response_id,submitted_at,First?,"Second, T/F"')
    expect(lines[1]).toBe('r1,2026-08-17T12:09:00.000Z,\'=danger,"=""True"""')
    expect(lines[2]).toBe('r2,2026-08-17T12:10:05.000Z,Plain,')
    expect(lines[3]).toBe('')
    expect(lines[4]).toBe('Survey summary')
    expect(lines[5]).toBe('field,value')
    expect(lines[6]).toBe('title,"Recursion, ""Part 1"""')
    expect(lines).toContain('status,closed')
    expect(lines).toContain('exported_at,2026-08-18T08:00:00.000Z')
    expect(lines).toContain('response_count,2')
    expect(lines).toContain('question_count,2')
  })

  it('still produces a header and summary with no responses', () => {
    const lines = buildResultsCsv(survey, [], new Date('2026-08-18T08:00:00Z')).split('\r\n')
    expect(lines[0]).toBe('response_id,submitted_at,First?,"Second, T/F"')
    expect(lines[1]).toBe('')
    expect(lines).toContain('response_count,0')
  })
})

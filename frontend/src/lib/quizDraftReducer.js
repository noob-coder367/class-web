import { changeQuestionType, createQuestion, LIMITS, newKey, questionFromApi } from './questionModel.js'

const update = (list, key, change) => {
  let changed = false
  const next = list.map((question) => {
    if (question.key !== key) return question
    const result = change(question)
    if (result !== question) changed = true
    return result
  })
  return changed ? next : list
}

/** Reducer cho 1 danh sách câu hỏi (dùng cho phòng và cho bản xem trước AI). */
export function questionListReducer(list, action) {
  switch (action.type) {
    case 'add':
      return list.length >= LIMITS.QUESTIONS_MAX ? list : [...list, action.question]
    case 'addMany':
      return [...list, ...action.questions].slice(0, LIMITS.QUESTIONS_MAX)
    case 'replaceAll':
      return action.questions
    case 'clear':
      return list.length ? [] : list
    case 'update':
      return update(list, action.key, (question) => ({ ...question, ...action.patch }))
    case 'changeType':
      return update(list, action.key, (question) => changeQuestionType(question, action.questionType))
    case 'remove':
      return list.filter((question) => question.key !== action.key)
    case 'duplicate': {
      if (list.length >= LIMITS.QUESTIONS_MAX) return list
      const index = list.findIndex((question) => question.key === action.key)
      if (index < 0) return list
      const copy = { ...list[index], key: newKey(), options: [...list[index].options] }
      return [...list.slice(0, index + 1), copy, ...list.slice(index + 1)]
    }
    case 'move': {
      const from = list.findIndex((question) => question.key === action.key)
      const to = from + action.delta
      if (from < 0 || to < 0 || to >= list.length) return list
      const next = [...list]
      ;[next[from], next[to]] = [next[to], next[from]]
      return next
    }
    case 'setOption':
      return update(list, action.key, (question) => ({
        ...question,
        options: question.options.map((option, index) => (index === action.index ? action.value : option)),
      }))
    case 'addOption':
      return update(list, action.key, (question) => (
        question.options.length >= LIMITS.OPTIONS_MAX ? question : { ...question, options: [...question.options, ''] }
      ))
    case 'removeOption':
      return update(list, action.key, (question) => {
        if (question.options.length <= LIMITS.OPTIONS_MIN) return question
        let correct = question.correct_option
        if (correct === action.index) correct = null
        else if (correct !== null && correct > action.index) correct -= 1
        return { ...question, options: question.options.filter((_, index) => index !== action.index), correct_option: correct }
      })
    default:
      return list
  }
}

export const LIST_ACTIONS = new Set([
  'add', 'addMany', 'replaceAll', 'clear', 'update', 'changeType', 'remove', 'duplicate', 'move', 'setOption', 'addOption', 'removeOption',
])

export const initialDraft = { title: '', description: '', questions: [], dirty: false }

/** Reducer cho cả phòng: metadata + danh sách câu hỏi. */
export function quizDraftReducer(state, action) {
  if (action.type === 'meta') return { ...state, [action.field]: action.value, dirty: true }
  if (action.type === 'load') {
    const { quiz } = action
    return {
      title: quiz.title || '',
      description: quiz.description || '',
      questions: (quiz.questions || []).map(questionFromApi),
      dirty: false,
    }
  }
  if (action.type === 'saved') return { ...state, dirty: false }
  if (LIST_ACTIONS.has(action.type)) {
    const questions = questionListReducer(state.questions, action)
    return questions === state.questions ? state : { ...state, questions, dirty: true }
  }
  return state
}

export const blankQuestion = (type) => createQuestion(type)

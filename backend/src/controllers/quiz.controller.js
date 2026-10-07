import { decodeJwtClaims, describeSessionProvider } from '../lib/authProvider.js'
import * as quizService from '../services/quiz/quiz.service.js'

const wrap = (fn) => async (req, res, next) => {
  try {
    await fn(req, res)
  } catch (error) {
    next(error)
  }
}

/** Cho frontend biết có được tạo phòng không (quyết định thật sự vẫn nằm ở backend khi mutation). */
export function access(req, res) {
  const provider = describeSessionProvider(req.user, decodeJwtClaims(req.accessToken))
  const canCreate = provider === 'google'
  res.json({
    can_create_quiz: canCreate,
    provider,
    ...(canCreate ? {} : { reason: 'Tính năng này yêu cầu đăng nhập bằng Google.' }),
  })
}

export const list = wrap(async (req, res) => {
  res.json({ quizzes: await quizService.listQuizzes(req.user.id) })
})

export const get = wrap(async (req, res) => {
  res.json({ quiz: await quizService.getQuiz(req.user.id, req.params.id) })
})

export const create = wrap(async (req, res) => {
  res.status(201).json({ quiz: await quizService.createQuiz(req.user.id, req.body) })
})

export const update = wrap(async (req, res) => {
  res.json({ quiz: await quizService.saveQuiz(req.user.id, req.params.id, req.body) })
})

export const remove = wrap(async (req, res) => {
  await quizService.deleteQuiz(req.user.id, req.params.id)
  res.status(204).end()
})

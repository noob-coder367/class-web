export function getQuizPartyAnswerRequest(previous, questionId, createRequestId = () => crypto.randomUUID()) {
  if (previous?.questionId === questionId && previous.requestId) return previous
  return { questionId, requestId: createRequestId() }
}

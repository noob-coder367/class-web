import { apiClient } from './apiClient.js'

export function getUtilityRoster() {
  return apiClient.get('/classroom/money/utility-roster', { auth: true })
}

export function saveUtilityRoster(roster) {
  return apiClient.put('/classroom/money/utility-roster', roster, { auth: true, retry: false })
}

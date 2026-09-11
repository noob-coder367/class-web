import { apiClient } from './apiClient.js'

export async function checkAccess() {
  return apiClient.get('/classroom/access', { auth: true })
}

export async function getTabContent(tab) {
  return apiClient.get(`/classroom/tabs/${encodeURIComponent(tab)}`, {
    auth: true,
  })
}

export async function getTimetable() {
  return apiClient.get('/classroom/timetable', { auth: true })
}

export async function saveTimetable(timetable) {
  return apiClient.put('/classroom/timetable', { timetable }, { auth: true })
}

export async function getRules() {
  return apiClient.get('/classroom/rules', { auth: true })
}

export async function saveRules(rules) {
  return apiClient.put('/classroom/rules', { rules }, { auth: true })
}

export async function getViolations() {
  return apiClient.get('/classroom/violations', { auth: true })
}

export async function addViolation(violation) {
  return apiClient.post('/classroom/violations', { violation }, { auth: true })
}

export async function deleteViolation(id) {
  return apiClient.delete(`/classroom/violations/${encodeURIComponent(id)}`, {
    auth: true,
  })
}

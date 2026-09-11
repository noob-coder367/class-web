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

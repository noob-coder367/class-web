import * as orgChartService from '../services/orgChart.service.js'

function noStore(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  res.set('Pragma', 'no-cache')
  res.set('Expires', '0')
}

export async function getOrgChart(req, res, next) {
  try {
    noStore(res)
    res.json({ orgChart: await orgChartService.getOrgChart() })
  } catch (err) { next(err) }
}

export async function updateOrgChart(req, res, next) {
  try {
    noStore(res)
    const orgChart = await orgChartService.saveOrgChart(req.body || {}, req.profile)
    res.json({ message: 'Đã lưu cây thành viên lớp.', orgChart })
  } catch (err) { next(err) }
}

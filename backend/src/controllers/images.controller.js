import * as githubImages from '../services/githubImages.service.js'

export async function getPublicImages(_req, res, next) {
  try {
    const images = await githubImages.listSiteImages()
    res.json({ images, categories: githubImages.listCategoryMeta() })
  } catch (err) {
    next(err)
  }
}

export async function getAdminImages(_req, res, next) {
  try {
    const images = await githubImages.listSiteImages()
    res.json({ images, categories: githubImages.listCategoryMeta() })
  } catch (err) {
    next(err)
  }
}

export async function postAdminImage(req, res, next) {
  try {
    const { category, filename, contentBase64, mimeType, caption } = req.body || {}
    const images = await githubImages.uploadSiteImage({
      category,
      filename,
      contentBase64,
      mimeType,
      caption,
    })
    res.status(201).json({ message: 'Đã thêm ảnh.', images })
  } catch (err) {
    next(err)
  }
}

export async function deleteAdminImage(req, res, next) {
  try {
    const path = req.body?.path || req.query?.path
    const images = await githubImages.deleteSiteImage(path)
    res.json({ message: 'Đã xóa ảnh.', images })
  } catch (err) {
    next(err)
  }
}

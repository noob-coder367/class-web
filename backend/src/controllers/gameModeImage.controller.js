import * as gameModeImageService from '../services/gameModeImage.service.js'

export async function upload(req, res, next) {
  try {
    const image = await gameModeImageService.uploadGameModeImage(req.params.gameKey, req.body, req.headers['content-type'])
    res.json({ image })
  } catch (error) {
    next(error)
  }
}

export async function saveContent(req, res, next) {
  try {
    const image = await gameModeImageService.saveGameModeContent(req.params.gameKey, req.body)
    res.json({ image })
  } catch (error) {
    next(error)
  }
}

export async function remove(req, res, next) {
  try {
    const result = await gameModeImageService.deleteGameModeImage(req.params.gameKey)
    res.json(result)
  } catch (error) {
    next(error)
  }
}

export async function uploadGallery(req, res, next) {
  try {
    const image = await gameModeImageService.uploadGameModeGalleryImage(req.params.gameKey, req.body, req.headers['content-type'])
    res.json({ image })
  } catch (error) {
    next(error)
  }
}

export async function removeGallery(req, res, next) {
  try {
    const image = await gameModeImageService.deleteGameModeGalleryImage(req.params.gameKey, req.query.path)
    res.json({ image })
  } catch (error) {
    next(error)
  }
}

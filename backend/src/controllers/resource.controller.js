import * as resourceService from '../services/resource.service.js'
const noStore = (res) => res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
export async function categories(req, res, next) { try { noStore(res); res.json({ items: await resourceService.listCategories() }) } catch (e) { next(e) } }
export async function createCategory(req, res, next) { try { noStore(res); res.status(201).json({ item: await resourceService.createCategory(req.body, req.profile) }) } catch (e) { next(e) } }
export async function updateCategory(req, res, next) { try { noStore(res); res.json({ item: await resourceService.updateCategory(req.params.id, req.body) }) } catch (e) { next(e) } }
export async function deleteCategory(req, res, next) { try { noStore(res); res.json(await resourceService.deleteCategory(req.params.id)) } catch (e) { next(e) } }
export async function list(req, res, next) { try { noStore(res); res.json({ items: await resourceService.listResources(req.query) }) } catch (e) { next(e) } }
export async function create(req, res, next) { try { noStore(res); res.status(201).json({ item: await resourceService.createResource(req.body, req.profile) }) } catch (e) { next(e) } }
export async function get(req, res, next) { try { noStore(res); res.json({ item: await resourceService.getResource(req.params.id) }) } catch (e) { next(e) } }
export async function update(req, res, next) { try { noStore(res); res.json({ item: await resourceService.updateResource(req.params.id, req.body) }) } catch (e) { next(e) } }
export async function remove(req, res, next) { try { noStore(res); res.json(await resourceService.deleteResource(req.params.id)) } catch (e) { next(e) } }
export async function deleteFile(req, res, next) { try { noStore(res); res.json(await resourceService.deleteFile(req.params.id)) } catch (e) { next(e) } }

export async function uploadUrls(req, res, next) { try { noStore(res); res.json(await resourceService.createResourceUploadUrls(req.params.id, req.body?.files, req.profile)) } catch (e) { next(e) } }
export async function completeUploads(req, res, next) { try { noStore(res); res.status(201).json({ items: await resourceService.completeResourceUploads(req.params.id, req.body?.files, req.profile) }) } catch (e) { next(e) } }

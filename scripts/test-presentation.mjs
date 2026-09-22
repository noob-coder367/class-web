import assert from 'node:assert/strict'
import {
  canListPresentation,
  evaluatePresentationAccess,
  hashPassword,
  normalizeElement,
  normalizePresentation,
  normalizeSlide,
  toPublicPresentation,
} from '../backend/src/lib/presentationModel.js'

const owner = { id: 'owner-1', username: 'An' }
const classmate = { id: 'user-2', username: 'Binh' }

const publicDeck = normalizePresentation({
  id: 'p1',
  code: '123456',
  title: 'Công khai',
  visibility: 'public',
  ownerId: owner.id,
  ownerName: owner.username,
  slides: [{ title: 'A', elements: [{ type: 'text', text: 'Hi', x: 10, y: 10, width: 40, height: 12 }] }],
})

const privateDeck = normalizePresentation({
  id: 'p2',
  code: '654321',
  title: 'Riêng tư',
  visibility: 'private',
  passwordHash: hashPassword('secret'),
  ownerId: owner.id,
  ownerName: owner.username,
})

const linkedDeck = normalizePresentation({
  id: 'p3',
  code: '111222',
  title: 'Gắn phòng',
  visibility: 'public',
  linkedClassRoomId: 'room-1',
  ownerId: owner.id,
})

assert.equal(canListPresentation(publicDeck, classmate), true)
assert.equal(canListPresentation(privateDeck, classmate), false)
assert.equal(canListPresentation(privateDeck, owner), true)
assert.equal(canListPresentation(linkedDeck, classmate), true)

assert.equal(evaluatePresentationAccess(publicDeck, classmate, '').ok, true)
assert.equal(evaluatePresentationAccess(privateDeck, owner, '').ok, true)

const needPass = evaluatePresentationAccess(privateDeck, classmate, '')
assert.equal(needPass.ok, false)
assert.equal(needPass.status, 401)
assert.equal(needPass.code, 'PRESENTATION_PASSWORD_REQUIRED')

const wrong = evaluatePresentationAccess(privateDeck, classmate, 'nope')
assert.equal(wrong.ok, false)
assert.equal(wrong.status, 403)
assert.equal(wrong.code, 'WRONG_PASSWORD')

const okPass = evaluatePresentationAccess(privateDeck, classmate, 'secret')
assert.equal(okPass.ok, true)

const roomLocked = evaluatePresentationAccess(linkedDeck, classmate, '', {
  allowed: false,
  code: 'PASSWORD_REQUIRED',
})
assert.equal(roomLocked.code, 'CLASS_SPACE_PASSWORD_REQUIRED')
assert.equal(roomLocked.status, 401)

const roomOpen = evaluatePresentationAccess(linkedDeck, classmate, '123456', {
  allowed: true,
  code: 'OK',
})
assert.equal(roomOpen.ok, true)
assert.equal(roomOpen.owner, false)

const el = normalizeElement({ type: 'image', src: 'https://example.com/a.png', x: 5, width: 200, zIndex: 3 })
assert.equal(el.type, 'image')
assert.equal(el.src, 'https://example.com/a.png')
assert.equal(el.width, 100)
assert.equal(el.zIndex, 3)

const slide = normalizeSlide({ elements: [{ type: 'shape', shape: 'circle' }] })
assert.equal(slide.elements[0].shape, 'circle')

const pub = toPublicPresentation(privateDeck, { includeSlides: true, owner: true })
assert.equal(pub.canEdit, true)
assert.equal(Array.isArray(pub.slides), true)
assert.equal('passwordHash' in pub, false)

console.log('presentation model tests: ok')

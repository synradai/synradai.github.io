import assert from 'node:assert/strict'
import { test } from 'node:test'
import { aalFromAccessToken, aalFromAuthorization } from './aal.js'

function token(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `header.${body}.sig`
}

test('reads the aal claim from a bearer token', () => {
  const aal1 = token({ aal: 'aal1', sub: 'user' })
  const aal2 = token({ aal: 'aal2', sub: 'user' })
  assert.equal(aalFromAccessToken(aal1), 'aal1')
  assert.equal(aalFromAuthorization(`Bearer ${aal2}`), 'aal2')
  assert.equal(aalFromAuthorization('Bearer'), null)
  assert.equal(aalFromAccessToken('not-a-jwt'), null)
  assert.equal(aalFromAccessToken(token({ sub: 'user' })), null)
})

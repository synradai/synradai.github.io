import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  accessTokenProjectRef,
  betaForwardHref,
  verifierRefsFromKeys,
} from './foreignAuth.js'

const LIVE = 'https://rgkiagqexoafmtxhrlqo.supabase.co'
const BETA = 'rocobdfuvaecrkzsxqub'

function token(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `header.${body}.sig`
}

test('a beta magic-link hash is forwarded and a live token stays', () => {
  const betaToken = token({ iss: `https://${BETA}.supabase.co/auth/v1`, aal: 'aal1' })
  const liveToken = token({ iss: `${LIVE}/auth/v1`, aal: 'aal1' })
  const hash = `#access_token=${betaToken}&refresh_token=r&type=magiclink`
  const forwarded = betaForwardHref({
    href: `https://synradai.github.io/${hash}`,
    projectUrl: LIVE,
  })
  assert.equal(forwarded, `https://synradai.github.io/beta/${hash}`)
  assert.equal(betaForwardHref({
    href: `https://synradai.github.io/#access_token=${liveToken}&type=magiclink`,
    projectUrl: LIVE,
  }), '')
  assert.equal(betaForwardHref({
    href: 'https://synradai.github.io/#/',
    projectUrl: LIVE,
  }), '')
  assert.equal(accessTokenProjectRef(betaToken), BETA)
  assert.equal(accessTokenProjectRef('not-a-jwt'), '')
})

test('a pkce code is forwarded unless this project is waiting to redeem it', () => {
  const code = '34e770dd-9ff9-416c-87fa-43b31d7ef225'
  const href = `https://synradai.github.io/?code=${code}`
  assert.equal(betaForwardHref({ href, projectUrl: LIVE, verifierRefs: [BETA] }), `https://synradai.github.io/beta/?code=${code}`)
  assert.equal(betaForwardHref({ href, projectUrl: LIVE, verifierRefs: [] }), `https://synradai.github.io/beta/?code=${code}`)
  assert.equal(betaForwardHref({
    href,
    projectUrl: LIVE,
    verifierRefs: ['rgkiagqexoafmtxhrlqo'],
  }), '')
  assert.equal(betaForwardHref({
    href: 'https://synradai.github.io/beta/?code=' + code,
    projectUrl: LIVE,
  }), '')
  assert.deepEqual(verifierRefsFromKeys([
    `sb-${BETA}-auth-token-code-verifier`,
    'other',
  ]), [BETA])
})

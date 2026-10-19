import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_TEXT_MODEL,
  DEFAULT_VISION_MODEL,
  assertImagesOk,
  hasImage,
  resolveProvider,
  selectModel,
  outputTokenBudget,
  REASONING_EFFORT,
  textFromAnthropic,
  textFromOpenAI,
  textFromResponses,
  toAnthropicMessages,
  toOpenAIMessages,
  toResponsesInput,
} from './convert.js'

test('grok 4.7 is the default text and vision model', () => {
  assert.equal(DEFAULT_TEXT_MODEL, 'grok-4.7')
  assert.equal(DEFAULT_VISION_MODEL, 'grok-4.7')
  assert.deepEqual(selectModel({ prompt: 'hello' }), { task: 'text', model: 'grok-4.7' })
  assert.equal(selectModel({ prompt: 'look', images: ['data:image/jpeg;base64,aaaa'] }).task, 'vision')
  assert.equal(selectModel({ task: 'vision', prompt: 'look' }, { visionModel: 'grok-4.6' }).model, 'grok-4.6')
})

test('prompts and anthropic image blocks become chat messages', () => {
  const messages = toOpenAIMessages({
    prompt: [
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'aaa' } },
      { type: 'text', text: 'Read this Take 5' },
    ],
  })
  assert.equal(messages[0].content[0].image_url.url, 'data:image/png;base64,aaa')
  assert.equal(messages[0].content[1].text, 'Read this Take 5')
  assert.equal(hasImage({ prompt: 'no photo' }), false)
  assert.throws(() => assertImagesOk([{ role: 'user', content: [{ type: 'image_url', image_url: { url: 'data:image/gif;base64,aa' } }] }]), /jpeg or png/)
})

test('provider flag keeps Claude as an explicit fallback', () => {
  assert.equal(resolveProvider({}), 'xai')
  assert.equal(resolveProvider({ provider: 'anthropic' }), 'anthropic')
  assert.equal(resolveProvider({ xaiFailed: true, fallback: 'none' }), 'xai')
  assert.equal(resolveProvider({ xaiFailed: true, fallback: 'anthropic' }), 'anthropic')
})

test('responses map back to the content shape the app reads', () => {
  assert.equal(textFromOpenAI({ choices: [{ message: { content: 'hello' } }] }), 'hello')
  assert.equal(textFromResponses({
    output: [{ type: 'reasoning' }, { type: 'message', content: [{ type: 'output_text', text: 'from grok' }] }],
  }), 'from grok')
  assert.equal(textFromResponses({ output_text: 'shortcut' }), 'shortcut')
  assert.equal(REASONING_EFFORT, 'low')
  assert.equal(outputTokenBudget(undefined), 4000)
  assert.equal(outputTokenBudget(100), 4000)
  assert.equal(outputTokenBudget(9000), 8000)
  const input = toResponsesInput(toOpenAIMessages({
    prompt: 'describe',
    images: ['data:image/jpeg;base64,abc'],
  }))
  assert.equal(input[0].content[0].type, 'input_image')
  assert.equal(input[0].content[0].image_url, 'data:image/jpeg;base64,abc')
  assert.equal(input[0].content[1].type, 'input_text')
  assert.equal(textFromAnthropic({ content: [{ type: 'text', text: 'from claude' }] }), 'from claude')
  const claude = toAnthropicMessages({
    prompt: 'describe',
    images: ['data:image/jpeg;base64,abc'],
  })
  assert.equal(claude[0].content[0].source.data, 'abc')
  assert.equal(claude[0].content[1].text, 'describe')
})

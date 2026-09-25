import assert from 'node:assert/strict'
import test from 'node:test'
import { ESLint } from 'eslint'

const eslint = new ESLint({ cwd: new URL('..', import.meta.url).pathname })
const filePath = 'components/features/__eslint_governance_fixture__.tsx'

test('feature lint rules reject native date inputs and arbitrary colors together', async () => {
  const [result] = await eslint.lintText(
    'export const Fixture = () => <div className="bg-[#123456]"><input type="date" /></div>',
    { filePath },
  )

  const messages = result.messages
    .filter((message) => message.ruleId === 'no-restricted-syntax')
    .map((message) => message.message)

  assert.ok(messages.some((message) => message.includes('DatePicker')), messages.join('\n'))
  assert.ok(messages.some((message) => message.includes('Tailwind arbitrary')), messages.join('\n'))
})

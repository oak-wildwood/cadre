import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import UnlockView from './UnlockView.vue'

const PASS = 'a long enough fixture passphrase'

function make(props: Partial<{ hasStore: boolean; busy: boolean; error: string | null }> = {}) {
  return mount(UnlockView, { props: { hasStore: true, busy: false, error: null, ...props } })
}

describe('UnlockView', () => {
  it('unlock mode: one passphrase field, emits the passphrase, then clears the field', async () => {
    const wrapper = make()
    expect(wrapper.findAll('input[type="password"]')).toHaveLength(1)

    await wrapper.find('input').setValue(PASS)
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')).toEqual([[PASS]])
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('')
  })

  it('first run: asks for a confirmation and rejects a mismatch without emitting', async () => {
    const wrapper = make({ hasStore: false })
    const inputs = wrapper.findAll('input[type="password"]')
    expect(inputs).toHaveLength(2)

    await inputs[0]!.setValue(PASS)
    await inputs[1]!.setValue(PASS + 'x')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.find('[role="alert"]').text()).toContain('do not match')
  })

  it('first run: rejects a short passphrase', async () => {
    const wrapper = make({ hasStore: false })
    const inputs = wrapper.findAll('input[type="password"]')
    await inputs[0]!.setValue('short')
    await inputs[1]!.setValue('short')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.find('[role="alert"]').text()).toContain('at least 15')
  })

  it('first run: emits once both fields match', async () => {
    const wrapper = make({ hasStore: false })
    const inputs = wrapper.findAll('input[type="password"]')
    await inputs[0]!.setValue(PASS)
    await inputs[1]!.setValue(PASS)
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')).toEqual([[PASS]])
  })

  it('shows the error it is given as an alert, and disables the button while busy', () => {
    const wrapper = make({ error: 'Could not unlock.', busy: true })
    expect(wrapper.find('[role="alert"]').text()).toBe('Could not unlock.')
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
  })

  it('is keyboard-reachable: native labelled inputs and a submit button', () => {
    const wrapper = make()
    expect(wrapper.find('label input').exists()).toBe(true)
    expect(wrapper.find('button[type="submit"]').exists()).toBe(true)
  })
})

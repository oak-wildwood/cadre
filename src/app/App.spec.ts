import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref, shallowRef } from 'vue'

import type { LedgerRepository } from '../domain/LedgerRepository'
import App from './App.vue'
import type { Session } from './session'

function fakeSession(unlocked: boolean): Session & { lock: ReturnType<typeof vi.fn> } {
  const repository = {
    list: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    getDefaultRetentionDays: vi.fn().mockResolvedValue(null),
  } as unknown as LedgerRepository
  const session = {
    hasStore: ref(true),
    unlocked: ref(unlocked),
    busy: ref(false),
    error: ref<string | null>(null),
    repository: shallowRef<LedgerRepository | null>(unlocked ? repository : null),
    retention: {
      notice: ref<number | null>(null),
      start: vi.fn(),
      run: vi.fn(),
      stop: vi.fn(),
      dismiss: vi.fn(),
    },
    dataVersion: ref(0),
    init: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue(true),
    unlock: vi.fn().mockResolvedValue(true),
    close: vi.fn().mockResolvedValue(undefined),
    lock: vi.fn(),
  }
  session.lock.mockImplementation(async () => {
    session.unlocked.value = false
    session.repository.value = null
  })
  return session as unknown as Session & { lock: ReturnType<typeof vi.fn> }
}

describe('App', () => {
  it('shows the Unlock screen, not the member list, while locked', async () => {
    const wrapper = mount(App, { props: { session: fakeSession(false) } })
    await flushPromises()

    expect(wrapper.find('h1').text()).toBe('Unlock Cadre')
    expect(wrapper.text()).not.toContain('Members')
  })

  it('passes the passphrase to session.unlock when the store exists', async () => {
    const session = fakeSession(false)
    const wrapper = mount(App, { props: { session } })
    await flushPromises()
    await wrapper.find('input[type="password"]').setValue('a long enough fixture passphrase')
    await wrapper.find('form').trigger('submit')

    expect(session.unlock).toHaveBeenCalledWith('a long enough fixture passphrase')
  })

  it('first run creates rather than unlocks', async () => {
    const session = fakeSession(false)
    session.hasStore.value = false
    const wrapper = mount(App, { props: { session } })
    await flushPromises()
    const inputs = wrapper.findAll('input[type="password"]')
    await inputs[0]!.setValue('a long enough fixture passphrase')
    await inputs[1]!.setValue('a long enough fixture passphrase')
    await wrapper.find('form').trigger('submit')

    expect(session.create).toHaveBeenCalledWith('a long enough fixture passphrase')
    expect(session.unlock).not.toHaveBeenCalled()
  })

  it('unlocked: shows the list, navigates to settings, and Lock returns to Unlock', async () => {
    const session = fakeSession(true)
    const wrapper = mount(App, { props: { session } })
    await flushPromises()
    expect(wrapper.find('h1').text()).toBe('Members')

    await wrapper.findAll('nav button')[1]!.trigger('click')
    await flushPromises()
    expect(wrapper.find('h1').text()).toBe('Settings')

    await wrapper.findAll('header > button').at(-1)!.trigger('click')
    await flushPromises()
    expect(session.lock).toHaveBeenCalled()
    expect(wrapper.find('h1').text()).toBe('Unlock Cadre')
  })

  it('the about page is reachable from Unlock and links back', async () => {
    const wrapper = mount(App, { props: { session: fakeSession(false) } })
    await flushPromises()
    await wrapper.find('button.link').trigger('click')
    expect(wrapper.text()).toContain('Mutual aid groups')
    await wrapper.find('button.link').trigger('click')
    expect(wrapper.find('h1').text()).toBe('Unlock Cadre')
  })
})

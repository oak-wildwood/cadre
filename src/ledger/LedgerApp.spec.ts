import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { LedgerStore, OpenLedger } from '../domain/LedgerStore'
import { fakeMember, fakeRepository } from './fakeRepository'
import LedgerApp from './LedgerApp.vue'

const member = fakeMember()

function setup(repository = fakeRepository()) {
  const lock = vi.fn(async () => {})
  const ledger: OpenLedger = { repository, lock }
  const store: LedgerStore = {
    probe: vi.fn(async () => 'existing' as const),
    create: vi.fn(async () => ledger),
    unlock: vi.fn(async () => ledger),
  }
  return { store, repository, lock }
}

async function unlock(store: LedgerStore) {
  const wrapper = mount(LedgerApp, { props: { store }, attachTo: document.body })
  await flushPromises()
  await wrapper.find('#passphrase').setValue('fixture passphrase, not real')
  await wrapper.find('form').trigger('submit')
  await flushPromises()
  return wrapper
}

function button(wrapper: Awaited<ReturnType<typeof unlock>>, text: string) {
  const found = wrapper.findAll('button').find((b) => b.text() === text)
  if (!found) throw new Error(`no button "${text}"`)
  return found
}

afterEach(() => {
  document.body.innerHTML = ''
  localStorage.clear()
  sessionStorage.clear()
})

describe('LedgerApp', () => {
  it('purges expired members on unlock and shows the list', async () => {
    const repository = fakeRepository({
      list: vi.fn(async () => ({ items: [member], nextCursor: null })),
      purgeExpired: vi.fn(async () => ({ purged: 2 })),
    })
    const { store } = setup(repository)
    const wrapper = await unlock(store)

    expect(repository.purgeExpired).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Purged 2 expired records')
    expect(wrapper.find('table').text()).toContain(member.displayName)
    wrapper.unmount()
  })

  it('locks: drops the keys, forgets decrypted members and returns to Unlock', async () => {
    const repository = fakeRepository({
      list: vi.fn(async () => ({ items: [member], nextCursor: null })),
    })
    const { store, lock } = setup(repository)
    const wrapper = await unlock(store)

    await button(wrapper, 'Lock').trigger('click')
    await flushPromises()

    expect(lock).toHaveBeenCalledTimes(1)
    expect(wrapper.find('#passphrase').exists()).toBe(true)
    expect(wrapper.html()).not.toContain(member.displayName)
    wrapper.unmount()
  })

  it('opens a member without putting anything in the URL or browser storage', async () => {
    const repository = fakeRepository({
      list: vi.fn(async () => ({ items: [member], nextCursor: null })),
      read: vi.fn(async () => member),
    })
    const { store } = setup(repository)
    const before = window.location.href
    const wrapper = await unlock(store)

    await button(wrapper, member.displayName).trigger('click')
    await flushPromises()

    expect(wrapper.find('h2').text()).toBe('Edit member')
    expect(document.activeElement).toBe(wrapper.find('h2').element)
    expect(window.location.href).toBe(before)
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
    wrapper.unmount()
  })

  it('searches with the exact-match blind index', async () => {
    const repository = fakeRepository({
      findByBlindIndex: vi.fn(async () => [member]),
    })
    const { store } = setup(repository)
    const wrapper = await unlock(store)

    expect(wrapper.find('#search-value').attributes('placeholder')).toContain('Exact match')
    await wrapper.find('#search-field').setValue('email')
    await wrapper.find('#search-value').setValue(member.email!)
    await wrapper.find('form[role="search"]').trigger('submit')
    await flushPromises()

    expect(repository.findByBlindIndex).toHaveBeenCalledWith('email', member.email)
    expect(wrapper.find('table').text()).toContain(member.displayName)
    wrapper.unmount()
  })
})

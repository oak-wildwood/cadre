import { flushPromises, mount } from '@vue/test-utils'
import { CryptoUnavailableError, UnlockError } from 'keyslot'
import { describe, expect, it, vi } from 'vitest'

import type { LedgerRepository } from '../domain/LedgerRepository'
import type { LedgerStore, OpenLedger, StoreState } from '../domain/LedgerStore'
import { CRYPTO_UNAVAILABLE, UNLOCK_FAILED } from './messages'
import UnlockView from './UnlockView.vue'

const PASSPHRASE = 'correct horse battery staple'
const ledger: OpenLedger = { repository: {} as LedgerRepository, lock: async () => {} }

function fakeStore(state: StoreState, overrides: Partial<LedgerStore> = {}): LedgerStore {
  return {
    probe: vi.fn(async () => state),
    create: vi.fn(async () => ledger),
    unlock: vi.fn(async () => ledger),
    ...overrides,
  }
}

async function mountWith(store: LedgerStore) {
  const wrapper = mount(UnlockView, { props: { store }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

describe('UnlockView, first run', () => {
  it('asks for the passphrase twice and says a forgotten one loses the data', async () => {
    const wrapper = await mountWith(fakeStore('new'))

    expect(wrapper.find('#passphrase').exists()).toBe(true)
    expect(wrapper.find('#confirm').exists()).toBe(true)
    expect(wrapper.text()).toContain('If you forget this passphrase, the data is gone.')
    expect(wrapper.find('button[type="submit"]').text()).toBe('Create ledger')
    wrapper.unmount()
  })

  it('refuses mismatched or short passphrases without calling the store', async () => {
    const store = fakeStore('new')
    const wrapper = await mountWith(store)

    await wrapper.find('#passphrase').setValue(PASSPHRASE)
    await wrapper.find('#confirm').setValue(`${PASSPHRASE}!`)
    await wrapper.find('form').trigger('submit')
    expect(wrapper.find('[role="alert"]').text()).toContain("don't match")

    await wrapper.find('#passphrase').setValue('short')
    await wrapper.find('#confirm').setValue('short')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.find('[role="alert"]').text()).toContain('at least 15 characters')

    expect(store.create).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('creates the store and emits the open ledger, then clears the fields', async () => {
    const store = fakeStore('new')
    const wrapper = await mountWith(store)

    await wrapper.find('#passphrase').setValue(PASSPHRASE)
    await wrapper.find('#confirm').setValue(PASSPHRASE)
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(store.create).toHaveBeenCalledWith(PASSPHRASE)
    expect(store.unlock).not.toHaveBeenCalled()
    expect(wrapper.emitted('unlocked')).toEqual([[ledger]])
    expect((wrapper.find('#passphrase').element as HTMLInputElement).value).toBe('')
    expect((wrapper.find('#confirm').element as HTMLInputElement).value).toBe('')
    wrapper.unmount()
  })
})

describe('UnlockView, existing store', () => {
  it('shows one passphrase field, focused, and unlocks with it', async () => {
    const store = fakeStore('existing')
    const wrapper = await mountWith(store)

    expect(wrapper.find('#confirm').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.find('#passphrase').element)

    await wrapper.find('#passphrase').setValue(PASSPHRASE)
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(store.unlock).toHaveBeenCalledWith(PASSPHRASE)
    expect(wrapper.emitted('unlocked')).toEqual([[ledger]])
    wrapper.unmount()
  })

  it('says the same thing for a wrong passphrase and a damaged store', async () => {
    const messages: string[] = []
    for (const failure of [new UnlockError(), new TypeError('damaged page in store')]) {
      const store = fakeStore('existing', { unlock: vi.fn(async () => Promise.reject(failure)) })
      const wrapper = await mountWith(store)
      await wrapper.find('#passphrase').setValue('wrong passphrase here')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      messages.push(wrapper.find('[role="alert"]').text())
      expect(wrapper.emitted('unlocked')).toBeUndefined()
      expect((wrapper.find('#passphrase').element as HTMLInputElement).value).toBe('')
      wrapper.unmount()
    }
    expect(messages).toEqual([UNLOCK_FAILED, UNLOCK_FAILED])
  })

  it('says so when the device cannot run the encryption', async () => {
    const store = fakeStore('existing', {
      unlock: vi.fn(async () => Promise.reject(new CryptoUnavailableError())),
    })
    const wrapper = await mountWith(store)
    await wrapper.find('#passphrase').setValue(PASSPHRASE)
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toBe(CRYPTO_UNAVAILABLE)
    wrapper.unmount()
  })

  it('reports a store that cannot be opened at all', async () => {
    const store = fakeStore('existing', { probe: vi.fn(async () => Promise.reject(new Error())) })
    const wrapper = await mountWith(store)

    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.find('[role="alert"]').text()).toContain('Could not open the store')
    wrapper.unmount()
  })
})

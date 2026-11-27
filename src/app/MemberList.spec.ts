import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import type { LedgerRepository } from '../domain/LedgerRepository'
import type { Member } from '../domain/member'
import MemberList from './MemberList.vue'

function member(id: string, displayName: string): Member {
  return {
    id,
    displayName,
    email: null,
    phone: null,
    role: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    expiresAt: null,
  }
}

function repo(overrides: Record<string, unknown> = {}) {
  return {
    list: vi.fn().mockResolvedValue({ items: [member('1', 'Ada')], nextCursor: null }),
    findByBlindIndex: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as LedgerRepository & Record<string, ReturnType<typeof vi.fn>>
}

describe('MemberList', () => {
  it('lists members, and a name opens that member', async () => {
    const wrapper = mount(MemberList, { props: { repository: repo(), dataVersion: 0 } })
    await flushPromises()

    await wrapper.find('tbody button').trigger('click')
    expect(wrapper.emitted('open')).toEqual([['1']])
  })

  it('says search is exact in its placeholder', () => {
    const wrapper = mount(MemberList, { props: { repository: repo(), dataVersion: 0 } })
    expect(wrapper.find('input[type="search"]').attributes('placeholder')).toMatch(/exact/i)
  })

  it('searches name and email by blind index and de-duplicates', async () => {
    const hit = member('2', 'Bo')
    const repository = repo({ findByBlindIndex: vi.fn().mockResolvedValue([hit]) })
    const wrapper = mount(MemberList, { props: { repository, dataVersion: 0 } })
    await flushPromises()
    await wrapper.find('input[type="search"]').setValue(' Bo ')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(repository.findByBlindIndex).toHaveBeenCalledWith('displayName', 'Bo')
    expect(repository.findByBlindIndex).toHaveBeenCalledWith('email', 'Bo')
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
  })

  it('reloads when a background purge bumps dataVersion', async () => {
    const repository = repo()
    const wrapper = mount(MemberList, { props: { repository, dataVersion: 0 } })
    await flushPromises()
    await wrapper.setProps({ dataVersion: 1 })
    await flushPromises()

    expect(repository.list).toHaveBeenCalledTimes(2)
  })

  it('a slow earlier load cannot overwrite a newer search', async () => {
    let release!: (value: unknown) => void
    const slow = new Promise((resolve) => (release = resolve))
    const repository = repo({
      list: vi.fn().mockReturnValue(slow),
      findByBlindIndex: vi.fn().mockResolvedValue([member('2', 'Bo')]),
    })
    const wrapper = mount(MemberList, { props: { repository, dataVersion: 0 } })
    await wrapper.find('input[type="search"]').setValue('Bo')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    release({ items: [member('1', 'Ada')], nextCursor: null })
    await flushPromises()

    expect(wrapper.find('tbody').text()).toContain('Bo')
    expect(wrapper.find('tbody').text()).not.toContain('Ada')
  })
})

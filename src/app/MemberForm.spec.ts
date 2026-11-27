import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import type { LedgerRepository } from '../domain/LedgerRepository'
import type { Member } from '../domain/member'
import { SENSITIVE_FIELD_NAMES } from '../domain/sensitiveFields'
import { toDateInput } from './dates'
import MemberForm from './MemberForm.vue'

const DAY = 86_400_000

function member(overrides: Partial<Member> = {}): Member {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    displayName: 'Fixture Person',
    email: null,
    phone: null,
    role: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    expiresAt: null,
    ...overrides,
  }
}

function repo(overrides: Partial<Record<keyof LedgerRepository, unknown>> = {}) {
  const stub = {
    getDefaultRetentionDays: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(member()),
    read: vi.fn().mockResolvedValue(member()),
    update: vi.fn().mockResolvedValue(member()),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
  return stub as typeof stub & LedgerRepository
}

async function mountForm(repository: LedgerRepository, memberId: string | null = null) {
  const wrapper = mount(MemberForm, { props: { repository, memberId } })
  await flushPromises()
  return wrapper
}

describe('MemberForm', () => {
  it('marks every sensitive field', async () => {
    const wrapper = await mountForm(repo())
    const badges = wrapper.findAll('label.field .badge')
    expect(badges).toHaveLength(SENSITIVE_FIELD_NAMES.length)
  })

  it('requires a name', async () => {
    const repository = repo()
    const wrapper = await mountForm(repository)
    await wrapper.find('form').trigger('submit')

    expect(wrapper.find('[role="alert"]').text()).toContain('Name is required')
    expect(repository.create).not.toHaveBeenCalled()
  })

  it('with no org default, creates with the default left to the repository and blanks as null', async () => {
    const repository = repo()
    const wrapper = await mountForm(repository)
    await wrapper.find('input[type="text"]').setValue('  Ada Example ')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(repository.create).toHaveBeenCalledWith({
      displayName: 'Ada Example',
      email: null,
      phone: null,
      role: null,
      notes: null,
      expiresAt: undefined,
    })
    expect(wrapper.emitted('saved')).toHaveLength(1)
  })

  it('pre-fills the expiry from the org default and leaves it to the repository if untouched', async () => {
    const repository = repo({ getDefaultRetentionDays: vi.fn().mockResolvedValue(30) })
    const wrapper = await mountForm(repository)

    const date = wrapper.find('input[type="date"]').element as HTMLInputElement
    expect(date.value).toBe(toDateInput(new Date(Date.now() + 30 * DAY)))
    expect(date.disabled).toBe(false)

    await wrapper.find('input[type="text"]').setValue('Ada')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ expiresAt: undefined }),
    )
  })

  it('sends an explicit date when the expiry is changed, and null for "never"', async () => {
    const repository = repo({ getDefaultRetentionDays: vi.fn().mockResolvedValue(30) })
    const wrapper = await mountForm(repository)
    await wrapper.find('input[type="text"]').setValue('Ada')
    await wrapper.find('input[type="date"]').setValue(toDateInput(new Date(Date.now() + 60 * DAY)))
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    const call = vi.mocked(repository.create).mock.calls[0]![0] as { expiresAt: Date }
    expect(call.expiresAt).toBeInstanceOf(Date)
    expect(call.expiresAt.getTime()).toBeGreaterThan(Date.now() + 59 * DAY)

    const second = await mountForm(repository)
    await second.find('input[type="text"]').setValue('Bo')
    await second.find('input[type="checkbox"]').setValue(true)
    await second.find('form').trigger('submit')
    await flushPromises()
    expect(repository.create).toHaveBeenLastCalledWith(expect.objectContaining({ expiresAt: null }))
  })

  it('rejects an expiry in the past', async () => {
    const repository = repo({ getDefaultRetentionDays: vi.fn().mockResolvedValue(30) })
    const wrapper = await mountForm(repository)
    await wrapper.find('input[type="text"]').setValue('Ada')
    await wrapper.find('input[type="date"]').setValue('2000-01-01')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.find('[role="alert"]').text()).toContain('future')
    expect(repository.create).not.toHaveBeenCalled()
  })

  it('edit: loads the member and updates without touching an unchanged expiry', async () => {
    const existing = member({ displayName: 'Old Name', email: 'a@example.test' })
    const repository = repo({ read: vi.fn().mockResolvedValue(existing) })
    const wrapper = await mountForm(repository, existing.id)

    const name = wrapper.find('input[type="text"]')
    expect((name.element as HTMLInputElement).value).toBe('Old Name')
    await name.setValue('New Name')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(repository.update).toHaveBeenCalledWith(existing.id, {
      displayName: 'New Name',
      email: 'a@example.test',
      phone: null,
      role: null,
      notes: null,
    })
    expect(wrapper.emitted('saved')).toHaveLength(1)
  })

  it('shows a generic message, not the error text, when saving fails', async () => {
    const repository = repo({ create: vi.fn().mockRejectedValue(new Error('Ada Example leaked')) })
    const wrapper = await mountForm(repository)
    await wrapper.find('input[type="text"]').setValue('Ada Example')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).not.toContain('Ada')
    expect(wrapper.emitted('saved')).toBeUndefined()
  })

  it('delete needs a confirmation step', async () => {
    const existing = member()
    const repository = repo({ read: vi.fn().mockResolvedValue(existing) })
    const wrapper = await mountForm(repository, existing.id)

    await wrapper.find('button.danger').trigger('click')
    expect(repository.delete).not.toHaveBeenCalled()
    const confirm = wrapper.findAll('button.danger').find((b) => b.text().startsWith('Yes'))!
    await confirm.trigger('click')
    await flushPromises()

    expect(repository.delete).toHaveBeenCalledWith(existing.id)
    expect(wrapper.emitted('deleted')).toHaveLength(1)
  })
})

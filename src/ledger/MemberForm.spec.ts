import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SENSITIVE_FIELD_NAMES } from '../domain/sensitiveFields'
import { addDays, toDateInput } from './dates'
import { fakeMember, fakeRepository } from './fakeRepository'
import MemberForm from './MemberForm.vue'

const member = fakeMember({
  notes: 'Fixture note, not real.',
  expiresAt: new Date(2099, 5, 30, 12),
})

async function mountForm(repository = fakeRepository(), memberId: string | null = null) {
  const wrapper = mount(MemberForm, { props: { repository, memberId } })
  await flushPromises()
  return { wrapper, repository }
}

function inputValue(wrapper: Awaited<ReturnType<typeof mountForm>>['wrapper'], id: string) {
  return (wrapper.find(`#${id}`).element as HTMLInputElement).value
}

afterEach(() => {
  vi.useRealTimers()
})

describe('MemberForm, add', () => {
  it('marks every sensitive field as encrypted', async () => {
    const { wrapper } = await mountForm()
    for (const field of SENSITIVE_FIELD_NAMES) {
      expect(wrapper.find(`label[for="member-${field}"]`).text()).toContain('Encrypted')
    }
    expect(wrapper.find('label[for="member-expires"]').text()).not.toContain('Encrypted')
  })

  it('pre-fills the expiry date from the org default', async () => {
    const repository = fakeRepository({ getDefaultRetentionDays: vi.fn(async () => 30) })
    const { wrapper } = await mountForm(repository)

    expect(inputValue(wrapper, 'member-expires')).toBe(toDateInput(addDays(new Date(), 30)))
    expect(wrapper.text()).toContain('Pre-filled from the default of 30 days.')
  })

  it('ticks "Never expires" when the org has no default', async () => {
    const { wrapper } = await mountForm()
    expect((wrapper.find('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(true)
  })

  it('creates a member, trimming values and turning empty fields into null', async () => {
    const { wrapper, repository } = await mountForm()
    await wrapper.find('#member-displayName').setValue('  Fixture Person  ')
    await wrapper.find('#member-email').setValue('fixture.person@example.invalid')
    await wrapper.find('#member-phone').setValue('   ')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(repository.create).toHaveBeenCalledWith({
      displayName: 'Fixture Person',
      email: 'fixture.person@example.invalid',
      phone: null,
      role: null,
      notes: null,
      expiresAt: null,
    })
    expect(wrapper.emitted('saved')).toHaveLength(1)
  })

  it('stores the chosen expiry as the end of that local day', async () => {
    const { wrapper, repository } = await mountForm()
    await wrapper.find('#member-displayName').setValue('Fixture Person')
    await wrapper.find('input[type="checkbox"]').setValue(false)
    await wrapper.find('#member-expires').setValue('2099-03-04')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(vi.mocked(repository.create).mock.calls[0]![0].expiresAt).toEqual(
      new Date(2099, 2, 4, 23, 59, 59, 999),
    )
  })

  it('requires a name and a future expiry, and saves nothing otherwise', async () => {
    const { wrapper, repository } = await mountForm()
    await wrapper.find('form').trigger('submit')
    expect(wrapper.find('[role="alert"]').text()).toBe('A name is required.')

    await wrapper.find('#member-displayName').setValue('Fixture Person')
    await wrapper.find('input[type="checkbox"]').setValue(false)
    await wrapper.find('#member-expires').setValue('2000-01-01')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.find('[role="alert"]').text()).toContain('has passed')

    expect(repository.create).not.toHaveBeenCalled()
  })

  it('is keyboard-reachable: every control is a native, labelled form control', async () => {
    const { wrapper } = await mountForm()
    for (const control of wrapper.findAll('input, textarea')) {
      const id = control.attributes('id')
      const labelled = id ? wrapper.find(`label[for="${id}"]`).exists() : false
      const wrapped = control.element.closest('label') !== null
      expect(labelled || wrapped).toBe(true)
      expect(control.attributes('tabindex')).toBeUndefined()
    }
  })
})

describe('MemberForm, edit', () => {
  it('loads the member into the form', async () => {
    const repository = fakeRepository({ read: vi.fn(async () => member) })
    const { wrapper } = await mountForm(repository, member.id)

    expect(wrapper.find('h2').text()).toBe('Edit member')
    expect(inputValue(wrapper, 'member-displayName')).toBe(member.displayName)
    expect(inputValue(wrapper, 'member-email')).toBe(member.email)
    expect(inputValue(wrapper, 'member-notes')).toBe(member.notes)
    expect(inputValue(wrapper, 'member-expires')).toBe('2099-06-30')
  })

  it('saves changes through update', async () => {
    const repository = fakeRepository({ read: vi.fn(async () => member) })
    const { wrapper } = await mountForm(repository, member.id)
    await wrapper.find('#member-role').setValue('zz-other-fixture-role')
    await wrapper.find('#member-notes').setValue('')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(repository.update).toHaveBeenCalledWith(member.id, {
      displayName: member.displayName,
      email: member.email,
      phone: member.phone,
      role: 'zz-other-fixture-role',
      notes: null,
      expiresAt: new Date(2099, 5, 30, 23, 59, 59, 999),
    })
    expect(repository.create).not.toHaveBeenCalled()
  })

  it('deletes only after a second, explicit confirmation', async () => {
    const repository = fakeRepository({ read: vi.fn(async () => member) })
    const { wrapper } = await mountForm(repository, member.id)

    const deleteButton = wrapper.findAll('button').find((b) => b.text() === 'Delete member')!
    await deleteButton.trigger('click')
    expect(repository.delete).not.toHaveBeenCalled()

    const confirm = wrapper.findAll('button').find((b) => b.text() === 'Delete permanently')!
    await confirm.trigger('click')
    await flushPromises()

    expect(repository.delete).toHaveBeenCalledWith(member.id)
    expect(wrapper.emitted('deleted')).toHaveLength(1)
  })

  it('says so when the member is gone', async () => {
    const { wrapper } = await mountForm(fakeRepository(), member.id)
    expect(wrapper.find('[role="alert"]').text()).toContain('no longer exists')
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('shows a fixed message, never the error text, when saving fails', async () => {
    const repository = fakeRepository({
      read: vi.fn(async () => member),
      update: vi.fn(async () => Promise.reject(new Error(`boom ${member.email}`))),
    })
    const { wrapper } = await mountForm(repository, member.id)
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toBe('Something went wrong. Try again.')
    expect(wrapper.emitted('saved')).toBeUndefined()
  })
})

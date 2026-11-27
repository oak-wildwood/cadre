import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { StoreNotEmptyError, type LedgerRepository } from '../domain/LedgerRepository'
import SettingsView from './SettingsView.vue'

function repo(overrides: Record<string, unknown> = {}) {
  return {
    getDefaultRetentionDays: vi.fn().mockResolvedValue(90),
    setDefaultRetentionDays: vi.fn().mockResolvedValue(undefined),
    exportEncrypted: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    importEncrypted: vi.fn().mockResolvedValue({ imported: 2, skippedExpired: 0 }),
    ...overrides,
  } as unknown as LedgerRepository & Record<string, ReturnType<typeof vi.fn>>
}

async function mountSettings(repository: LedgerRepository) {
  const wrapper = mount(SettingsView, { props: { repository } })
  await flushPromises()
  return wrapper
}

describe('SettingsView', () => {
  it('shows the current retention and saves a new one, or null when blank', async () => {
    const repository = repo()
    const wrapper = await mountSettings(repository)
    const input = wrapper.find('#h-retention ~ form input')
    expect((input.element as HTMLInputElement).value).toBe('90')

    await input.setValue('30')
    await wrapper.find('#h-retention ~ form').trigger('submit')
    expect(repository.setDefaultRetentionDays).toHaveBeenLastCalledWith(30)

    await input.setValue('')
    await wrapper.find('#h-retention ~ form').trigger('submit')
    expect(repository.setDefaultRetentionDays).toHaveBeenLastCalledWith(null)
  })

  it('rejects a non-integer retention', async () => {
    const repository = repo()
    const wrapper = await mountSettings(repository)
    await wrapper.find('#h-retention ~ form input').setValue('1.5')
    await wrapper.find('#h-retention ~ form').trigger('submit')

    expect(repository.setDefaultRetentionDays).not.toHaveBeenCalled()
  })

  it('export refuses mismatched passphrases without exporting', async () => {
    const repository = repo()
    const wrapper = await mountSettings(repository)
    const [a, b] = wrapper.findAll('#h-export ~ form input')
    await a!.setValue('export passphrase one')
    await b!.setValue('export passphrase two')
    await wrapper.find('#h-export ~ form').trigger('submit')

    expect(repository.exportEncrypted).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('do not match')
  })

  it('export asks the repository for an encrypted bundle under the export passphrase', async () => {
    URL.createObjectURL = vi.fn().mockReturnValue('blob:fixture')
    URL.revokeObjectURL = vi.fn()
    const repository = repo()
    const wrapper = await mountSettings(repository)
    const [a, b] = wrapper.findAll('#h-export ~ form input')
    await a!.setValue('export passphrase one')
    await b!.setValue('export passphrase one')
    await wrapper.find('#h-export ~ form').trigger('submit')
    await flushPromises()

    expect(repository.exportEncrypted).toHaveBeenCalledWith({ passphrase: 'export passphrase one' })
  })

  it('import into a non-empty store needs an explicit replace confirmation', async () => {
    const importEncrypted = vi
      .fn()
      .mockRejectedValueOnce(new StoreNotEmptyError())
      .mockResolvedValueOnce({ imported: 2, skippedExpired: 1 })
    const repository = repo({ importEncrypted })
    const wrapper = await mountSettings(repository)

    const fileInput = wrapper.find('input[type="file"]')
    Object.defineProperty(fileInput.element, 'files', {
      value: [new File([new Uint8Array([9])], 'x.cadrex')],
    })
    await fileInput.trigger('change')
    await wrapper.find('#h-import ~ form input[type="password"]').setValue('import passphrase!!')
    await wrapper.find('#h-import ~ form').trigger('submit')
    await flushPromises()

    expect(importEncrypted).toHaveBeenLastCalledWith(expect.any(Uint8Array), {
      passphrase: 'import passphrase!!',
      replace: false,
    })
    expect(wrapper.find('.callout').exists()).toBe(true)

    await wrapper.find('.callout .danger').trigger('click')
    await flushPromises()

    expect(importEncrypted).toHaveBeenLastCalledWith(expect.any(Uint8Array), {
      passphrase: 'import passphrase!!',
      replace: true,
    })
    expect(wrapper.emitted('imported')).toHaveLength(1)
    expect(wrapper.text()).toContain('Imported 2 members; skipped 1 already expired.')
  })
})

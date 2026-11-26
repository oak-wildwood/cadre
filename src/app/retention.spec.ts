import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import PurgeNotice from './PurgeNotice.vue'
import { DEFAULT_PURGE_INTERVAL_MS, useRetention } from './retention'

function fakeTimers() {
  const callbacks = new Map<number, () => void>()
  let next = 1
  return {
    setInterval: vi.fn((cb: () => void) => {
      callbacks.set(next, cb)
      return next++
    }),
    clearInterval: vi.fn((h: unknown) => void callbacks.delete(h as number)),
    tick: () => callbacks.forEach((cb) => cb()),
    active: () => callbacks.size,
  }
}

describe('useRetention', () => {
  it('purges on open, with the injected clock, before any timer fires', async () => {
    const now = new Date('2031-01-01T00:00:00Z')
    const purgeExpired = vi.fn().mockResolvedValue({ purged: 3 })
    const timers = fakeTimers()
    const onPurged = vi.fn()
    const retention = useRetention({
      repository: { purgeExpired },
      now: () => now,
      onPurged,
      ...timers,
    })

    await retention.start()

    expect(purgeExpired).toHaveBeenCalledExactlyOnceWith(now)
    expect(retention.notice.value).toBe(3)
    expect(onPurged).toHaveBeenCalledWith(3)
    expect(timers.setInterval).toHaveBeenCalledWith(expect.any(Function), DEFAULT_PURGE_INTERVAL_MS)
  })

  it('purges again on every tick of the injected interval, until stopped', async () => {
    const purgeExpired = vi.fn().mockResolvedValue({ purged: 0 })
    const timers = fakeTimers()
    const retention = useRetention({ repository: { purgeExpired }, intervalMs: 5, ...timers })

    await retention.start()
    timers.tick()
    await retention.run()
    expect(timers.setInterval).toHaveBeenCalledWith(expect.any(Function), 5)
    expect(purgeExpired.mock.calls.length).toBeGreaterThanOrEqual(2)

    retention.stop()
    expect(timers.active()).toBe(0)
  })

  it('shows no notice when nothing was purged, and a later run replaces it', async () => {
    const purgeExpired = vi
      .fn()
      .mockResolvedValueOnce({ purged: 0 })
      .mockResolvedValueOnce({ purged: 2 })
    const retention = useRetention({ repository: { purgeExpired }, ...fakeTimers() })

    await retention.run()
    expect(retention.notice.value).toBeNull()
    await retention.run()
    expect(retention.notice.value).toBe(2)
    retention.dismiss()
    expect(retention.notice.value).toBeNull()
  })

  it('survives a failed purge', async () => {
    const purgeExpired = vi.fn().mockRejectedValue(new Error('boom'))
    const retention = useRetention({ repository: { purgeExpired }, ...fakeTimers() })

    await expect(retention.run()).resolves.toBe(0)
    expect(retention.notice.value).toBeNull()
  })
})

describe('PurgeNotice', () => {
  it('says how many records were purged, and can be dismissed', async () => {
    const wrapper = mount(PurgeNotice, { props: { purged: 1 } })
    expect(wrapper.text()).toContain('Purged 1 expired record')
    expect(wrapper.text()).not.toContain('records')

    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('dismiss')).toHaveLength(1)

    await wrapper.setProps({ purged: 4 })
    expect(wrapper.text()).toContain('Purged 4 expired records')
    await wrapper.setProps({ purged: null })
    expect(wrapper.find('.purge-notice').exists()).toBe(false)
  })
})

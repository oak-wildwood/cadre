import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import App from './App.vue'

describe('App', () => {
  it('renders the root component', () => {
    const wrapper = mount(App)

    expect(wrapper.find('h1').text()).toBe('Cadre')
  })

  it('names who Cadre is for', () => {
    const wrapper = mount(App)
    const text = wrapper.text()

    expect(text).toContain('Mutual aid groups')
    expect(text).toContain('Tenant unions')
    expect(text).toContain('Organizing committees')
    expect(text).toContain('Small newsrooms')
  })

  it('links to the repo, README, threat model, roadmap and self-host docs', () => {
    const wrapper = mount(App)
    const hrefs = wrapper.findAll('a').map((a) => a.attributes('href'))

    expect(hrefs).toContain('https://github.com/oak-wildwood/cadre')
    expect(hrefs).toContain('https://github.com/oak-wildwood/cadre#readme')
    expect(hrefs).toContain('https://github.com/oak-wildwood/cadre#threat-model-summary')
    expect(hrefs).toContain('https://github.com/oak-wildwood/cadre/blob/main/docs/roadmap.md')
    expect(hrefs).toContain('https://github.com/oak-wildwood/cadre/blob/main/docs/dev.md')
  })

  it('collects no visitor data: no forms and no inputs', () => {
    const wrapper = mount(App)

    expect(wrapper.findAll('form')).toHaveLength(0)
    expect(wrapper.findAll('input')).toHaveLength(0)
    expect(wrapper.findAll('textarea')).toHaveLength(0)
    expect(wrapper.findAll('button')).toHaveLength(0)
  })
})

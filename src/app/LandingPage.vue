<script setup lang="ts">
/** The public "what is Cadre" page. Static: no store access, collects nothing. */
const repoUrl = 'https://github.com/oak-wildwood/cadre'
</script>

<template>
  <main class="landing">
    <header class="hero">
      <h1>Cadre</h1>
      <span class="mark" aria-hidden="true"></span>
      <p class="tagline">
        A self-hostable, local-first membership ledger for organizations whose member list gets
        people evicted, fired, deported or arrested if it leaks.
      </p>
    </header>

    <section>
      <h2>What it is</h2>
      <p>
        Cadre stores member names, contact info, roles and notes. All of it is treated as sensitive:
        encrypted before it reaches storage, and deleted on a schedule you choose. It runs on your
        own infrastructure — nobody else ever holds a copy of your data or the keys to read it.
      </p>
    </section>

    <section>
      <h2>Who it's for</h2>
      <ul>
        <li>Mutual aid groups</li>
        <li>Tenant unions</li>
        <li>Organizing committees</li>
        <li>Small newsrooms</li>
      </ul>
      <p>Any small organization whose member list is dangerous in the wrong hands.</p>
    </section>

    <section>
      <h2>Project stage</h2>
      <p>
        Cadre is pre-alpha: scoped, not yet usable. Development happens in the open, phase by phase
        — see the
        <a :href="`${repoUrl}/blob/main/docs/roadmap.md`">roadmap</a>
        for what's done and what's next.
      </p>
    </section>

    <section>
      <h2>Learn more</h2>
      <ul>
        <li><a :href="repoUrl">Source code</a></li>
        <li><a :href="`${repoUrl}#readme`">README</a></li>
        <li><a :href="`${repoUrl}#threat-model-summary`">Threat model</a></li>
      </ul>
    </section>

    <section>
      <h2>Run it yourself</h2>
      <p>
        Cadre isn't a hosted service and there's nothing to sign up for here. It's software you run
        on your own infrastructure. See
        <a :href="`${repoUrl}/blob/main/docs/dev.md`">docs/dev.md</a>
        to build and run it today; a dedicated self-hosting guide is planned for a later phase.
      </p>
    </section>
  </main>
</template>

<style scoped>
.landing {
  max-width: 36rem;
  margin: 0 auto;
  padding: 4.5rem 1.5rem 6rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, Roboto, sans-serif;
  line-height: 1.6;
}

.hero {
  margin-bottom: 3rem;
}

h1 {
  margin: 0;
  font-size: clamp(2.75rem, 5vw + 1.25rem, 4.25rem);
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.03em;
  color: var(--color-fg);
}

.mark {
  display: block;
  width: 2.75rem;
  height: 3px;
  margin: 1.5rem 0;
  border-radius: 999px;
  background: var(--color-accent);
}

.tagline {
  margin: 0;
  max-width: 34ch;
  font-size: 1.1875rem;
  color: var(--color-fg-muted);
}

section {
  margin-top: 3rem;
}

h2 {
  margin: 0 0 1rem;
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-accent);
}

p {
  margin: 0;
}

ul {
  margin: 0 0 1rem;
  padding-left: 1.25rem;
}

li + li {
  margin-top: 0.35rem;
}

a {
  color: var(--color-accent);
  text-decoration-color: color-mix(in srgb, var(--color-accent) 45%, transparent);
  text-underline-offset: 3px;
  transition:
    color 0.15s ease,
    text-decoration-color 0.15s ease;
}

a:hover {
  color: var(--color-accent-strong);
  text-decoration-color: var(--color-accent-strong);
}
</style>

<script setup lang="ts">
const repoUrl = 'https://github.com/oak-wildwood/cadre'
</script>

<template>
  <main class="landing">
    <header>
      <h1>Cadre</h1>
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
  max-width: 40rem;
  margin: 0 auto;
  padding: 2rem 1.5rem;
  font-family:
    system-ui,
    -apple-system,
    sans-serif;
  line-height: 1.5;
}

.tagline {
  font-size: 1.125rem;
}
</style>

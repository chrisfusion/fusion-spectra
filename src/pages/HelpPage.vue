<template>
  <q-page class="q-pa-lg">
    <div class="text-h5 text-weight-bold q-mb-lg">Help &amp; Documentation</div>

    <div class="row q-col-gutter-lg">
      <div class="col-12 col-md-8">
        <div class="text-subtitle1 text-weight-medium q-mb-sm">Frequently Asked Questions</div>
        <q-list bordered separator class="rounded-borders">
          <q-expansion-item
            v-for="item in faq"
            :key="item.q"
            :label="item.q"
            header-class="text-weight-medium"
            expand-separator
          >
            <q-card>
              <q-card-section class="text-grey-7" style="line-height: 1.6">
                {{ item.a }}
              </q-card-section>
            </q-card>
          </q-expansion-item>
        </q-list>
      </div>

      <div class="col-12 col-md-4">
        <div class="text-subtitle1 text-weight-medium q-mb-sm">Platform Components</div>
        <q-card flat bordered>
          <q-list separator>
            <q-item v-for="comp in components" :key="comp.name">
              <q-item-section avatar>
                <q-icon :name="comp.icon" color="primary" />
              </q-item-section>
              <q-item-section>
                <q-item-label class="text-weight-medium">{{ comp.name }}</q-item-label>
                <q-item-label caption>{{ comp.description }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
const faq = [
  {
    q: 'What is Fusion Spectra?',
    a: 'Fusion Spectra is the web interface for the Fusion data lake platform. It provides visibility into jobs, virtual environments, and platform health.',
  },
  {
    q: 'What is a Job?',
    a: 'A Job is a versioned Python processing task registered in fusion-index. Jobs define the code and dependencies needed to run a data pipeline step.',
  },
  {
    q: 'What is a Venv (virtual environment)?',
    a: 'A Venv is a Python virtual environment built and stored by fusion-forge. It contains all pip dependencies for a given requirements.txt, packaged as a reusable tar.gz artefact.',
  },
  {
    q: 'How do I build a Venv?',
    a: 'Navigate to the Venvs page and click "Build Venv". Provide a name, version, and requirements.txt content. The build runs asynchronously via a Kubernetes Job.',
  },
  {
    q: 'What are the auth modes?',
    a: 'Three modes are supported: oidc (full PKCE flow), bypass (dev synthetic user, no credentials needed), and token (inject a long-lived JWT via VITE_DEV_TOKEN). Set VITE_AUTH_MODE in your environment.',
  },
  {
    q: 'How do I add a plugin?',
    a: 'Plugins are loaded as Module Federation remotes. Register the remote entry URL in vite.config.ts under federation.remotes, add the module declaration to src/types/federation.d.ts, and add a route to src/router/index.ts.',
  },
]

const components = [
  { name: 'fusion-spectra',  icon: 'web',      description: 'Platform UI (this app)' },
  { name: 'fusion-index',    icon: 'storage',   description: 'Job & artefact registry' },
  { name: 'fusion-forge',    icon: 'build',     description: 'Venv build service' },
]
</script>

<script setup>
import 'shipdot'

function onRead(event) {
  console.log('Read:', event.detail.ids)
}
</script>

<template>
  <header>
    <strong>Acme</strong>
    <ship-dot src="/shipdot.json" first-visit="show-latest" @shipdot:read="onRead"></ship-dot>
  </header>
  <main>
    <h1>Reports</h1>
    <button type="button" id="btn-export">Export CSV</button>
  </main>
</template>

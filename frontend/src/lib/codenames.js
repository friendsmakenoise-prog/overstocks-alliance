// ============================================================
// CODENAME GENERATOR
// Generates unique per-transaction aliases.
// Same seed always produces same name — deterministic but opaque.
// ============================================================

const CODENAMES = [
  'Horizon', 'Cascade', 'Ember', 'Solstice', 'Meridian',
  'Zenith', 'Equinox', 'Tempest', 'Lagoon', 'Vortex',
  'Prism', 'Halcyon', 'Cirrus', 'Bastion', 'Solace',
  'Nimbus', 'Crest', 'Arclight', 'Driftwood', 'Lantern',
  'Fractal', 'Canopy', 'Solaris', 'Estuary', 'Flare',
  'Cobalt', 'Pinnacle', 'Reverie', 'Threshold', 'Tundra',
  'Opaline', 'Sequoia', 'Vesper', 'Windfall', 'Axiom',
  'Borealis', 'Chalice', 'Dune', 'Eclipse', 'Fjord',
  'Glyph', 'Halo', 'Inlet', 'Jasper', 'Keystone',
  'Lattice', 'Mirage', 'Nova', 'Obsidian', 'Pulsar'
]

/**
 * Generate a deterministic codename from a string seed.
 * Same offer ID + user ID always gives the same codename.
 */
export function generateCodename(seed) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  const index = Math.abs(hash) % CODENAMES.length
  return CODENAMES[index]
}

/**
 * Get the counterparty's codename for a given offer.
 * Each party sees a different name for their counterparty.
 * The names are consistent for the lifetime of the offer.
 */
export function getCounterpartyCodename(offerId, counterpartyId) {
  return generateCodename(`${offerId}-${counterpartyId}`)
}

/**
 * Get your own codename as seen by your counterparty.
 * Useful for showing "you appear as X to the other party".
 */
export function getMyCodename(offerId, myId) {
  return generateCodename(`${offerId}-${myId}`)
}

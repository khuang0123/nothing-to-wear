/**
 * Where a recommendation sends you. Second-hand is listed first and marked as
 * the default — the sustainability position is structural, not a banner.
 */

import type { ShoppingNeed } from '../types'

export interface SourceLink {
  name: string
  url: string
  kind: 'secondhand' | 'new'
  note: string
}

export function sourcesFor(need: ShoppingNeed): SourceLink[] {
  const q = encodeURIComponent(need.query)
  return [
    {
      name: 'Vinted',
      url: `https://www.vinted.com/catalog?search_text=${q}`,
      kind: 'secondhand',
      note: 'Peer-to-peer, usually the cheapest',
    },
    {
      name: 'Depop',
      url: `https://www.depop.com/search/?q=${q}`,
      kind: 'secondhand',
      note: 'Strong for vintage and statement pieces',
    },
    {
      name: 'eBay',
      url: `https://www.ebay.com/sch/i.html?_nkw=${q}`,
      kind: 'secondhand',
      note: 'Widest stock, best for basics in your size',
    },
    {
      name: 'ThredUp',
      url: `https://www.thredup.com/products?search_tags=${q}`,
      kind: 'secondhand',
      note: 'Pre-sorted by condition',
    },
    {
      name: 'Search new',
      url: `https://www.google.com/search?tbm=shop&q=${q}`,
      kind: 'new',
      note: 'Only if second-hand has nothing in your size',
    },
  ]
}

/** Rough CO2e saved by buying one garment second-hand rather than new (kg). */
export const CO2E_SAVED_PER_ITEM = 6.5

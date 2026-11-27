/**
 * The demo roster: a fictional local investigative reporter's contacts. Dev-only (see
 * `loadDemoRoster`), and made of reserved or obviously invented values only: emails end in
 * `@example.invalid`, phones sit in the 555-0100 to 555-0199 block, names are made up. The
 * seed-rules test checks this, because a real-looking fixture is a leak waiting to be copied
 * (AGENTS.md rule 2).
 *
 * Cases are not records of their own (that would be a schema change). A person's first notes
 * line is `Case: <name>`; someone in a second case has an `Also in: <name>` line.
 */
export const DEMO_ROLES = ['source', 'suspect', 'ally', 'subject'] as const
export type DemoRole = (typeof DEMO_ROLES)[number]

export const DEMO_CASES = ['Harbor Lights zoning', 'Ward 4 ballot', 'Mill Street fire'] as const

export interface DemoPerson {
  displayName: string
  email: string | null
  phone: string | null
  role: DemoRole
  notes: string
  /** How long from load until the record expires: a number of days, or one of the markers. */
  expiry: { days: number } | { seconds: number } | 'org-default'
}

const day = (days: number) => ({ days })

export const DEMO_ROSTER: readonly DemoPerson[] = [
  {
    displayName: 'Wren Ashgrove',
    email: 'wren.ashgrove@example.invalid',
    phone: '+1-555-0101',
    role: 'source',
    notes:
      'Case: Harbor Lights zoning\nConfidential. Clerk in the permits office. Will only talk on foot, never by phone.\nPasses along the variance schedule before it is public.',
    expiry: day(180),
  },
  {
    displayName: 'Tobias Quillon',
    email: 'tobias.quillon@example.invalid',
    phone: '+1-555-0102',
    role: 'suspect',
    notes:
      'Case: Harbor Lights zoning\nDeveloper of record. Three rezonings approved in a year.\nAlso in: Mill Street fire',
    expiry: day(180),
  },
  {
    displayName: 'Marisol Dunmore',
    email: 'marisol.dunmore@example.invalid',
    phone: '+1-555-0103',
    role: 'ally',
    notes: 'Case: Harbor Lights zoning\nEditor. Wants two independent sources before it runs.',
    expiry: day(365),
  },
  {
    displayName: 'Fenwick Larkspur',
    email: 'fenwick.larkspur@example.invalid',
    phone: null,
    role: 'source',
    notes:
      'Case: Harbor Lights zoning\nRetired surveyor. Says the harbor survey was redrawn after the vote.',
    expiry: day(90),
  },
  {
    displayName: 'Odalys Brightwater',
    email: 'odalys.brightwater@example.invalid',
    phone: '+1-555-0105',
    role: 'subject',
    notes:
      'Case: Ward 4 ballot\nPoll worker who first reported the missing precinct tapes.\nAlso in: Harbor Lights zoning',
    expiry: day(90),
  },
  {
    displayName: 'Cormac Pennywhistle',
    email: 'cormac.pennywhistle@example.invalid',
    phone: '+1-555-0106',
    role: 'suspect',
    notes: 'Case: Ward 4 ballot\nCounty elections deputy. Signed the chain-of-custody form late.',
    expiry: day(180),
  },
  {
    displayName: 'Ilse Marrowfield',
    email: 'ilse.marrowfield@example.invalid',
    phone: '+1-555-0107',
    role: 'ally',
    notes: 'Case: Ward 4 ballot\nLawyer. Reviews anything that names a county employee.',
    expiry: day(365),
  },
  {
    displayName: 'Bram Hollowell',
    email: null,
    phone: '+1-555-0108',
    role: 'source',
    notes:
      'Case: Ward 4 ballot\nNight custodian at the counting hall. Nervous; prefers to be called back.\nAlso in: Mill Street fire',
    expiry: { seconds: 60 },
  },
  {
    displayName: 'Saffron Underhill',
    email: 'saffron.underhill@example.invalid',
    phone: '+1-555-0109',
    role: 'source',
    notes:
      'Case: Mill Street fire\nFormer tenant. Kept the landlord’s texts about the alarm system.',
    expiry: { seconds: 60 },
  },
  {
    displayName: 'Gideon Thistlewood',
    email: 'gideon.thistlewood@example.invalid',
    phone: '+1-555-0110',
    role: 'suspect',
    notes:
      'Case: Mill Street fire\nBuilding owner. Insurance claim filed four days after the fire.',
    expiry: day(180),
  },
  {
    displayName: 'Petra Vandersloot',
    email: 'petra.vandersloot@example.invalid',
    phone: '+1-555-0111',
    role: 'ally',
    notes:
      'Case: Mill Street fire\nFixer. Knows the fire marshal’s office and gets records requests moving.',
    expiry: 'org-default',
  },
  {
    displayName: 'Lucan Ferrimore',
    email: 'lucan.ferrimore@example.invalid',
    phone: null,
    role: 'subject',
    notes: 'Case: Mill Street fire\nFirefighter at the scene. Agreed to an on-record interview.',
    expiry: day(90),
  },
]

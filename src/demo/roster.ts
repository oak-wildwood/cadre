/**
 * The demo roster: a historian's research contacts, made of people who have died. Dev-only (see
 * `loadDemoRoster`). Nobody living may appear here, and contact details are reserved or obviously
 * fake: emails end in `@example.invalid`, phones sit in the 555-0100 to 555-0199 block. Notes are
 * short public-record facts, nothing invented about anyone. The seed-rules test checks the
 * contact values, because a real-looking fixture is a leak waiting to be copied (AGENTS.md rule 2).
 *
 * Projects are not records of their own (that would be a schema change). A person's first notes
 * line is `Case: <name>`; someone in a second project has an `Also in: <name>` line.
 */
export const DEMO_ROLES = ['organizer', 'theorist', 'leader', 'writer', 'adversary'] as const
export type DemoRole = (typeof DEMO_ROLES)[number]

export const DEMO_CASES = [
  'Abolition',
  'Black Panther Party',
  'Pan-African radicalism',
  'Socialist internationalism',
  'Cuban Revolution',
  'Fascism',
] as const

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
    displayName: 'John Brown',
    email: 'john.brown@example.invalid',
    phone: '+1-555-0101',
    role: 'organizer',
    notes:
      'Case: Abolition\nAbolitionist who led the 1859 raid on the federal armory at Harpers Ferry, Virginia. Hanged for treason that December.',
    expiry: day(365),
  },
  {
    displayName: 'Nat Turner',
    email: 'nat.turner@example.invalid',
    phone: '+1-555-0102',
    role: 'leader',
    notes:
      'Case: Abolition\nLed the 1831 slave rebellion in Southampton County, Virginia. Executed that November.',
    expiry: day(365),
  },
  {
    displayName: 'Fred Hampton',
    email: 'fred.hampton@example.invalid',
    phone: '+1-555-0103',
    role: 'organizer',
    notes:
      'Case: Black Panther Party\nDeputy chairman of the Illinois chapter. Killed in a Chicago police raid in December 1969.',
    expiry: day(180),
  },
  {
    displayName: 'Huey Newton',
    email: 'huey.newton@example.invalid',
    phone: '+1-555-0104',
    role: 'leader',
    notes: 'Case: Black Panther Party\nCo-founded the party in Oakland in 1966.',
    expiry: day(180),
  },
  {
    displayName: 'George Jackson',
    email: 'george.jackson@example.invalid',
    phone: null,
    role: 'writer',
    notes:
      'Case: Black Panther Party\nWrote Soledad Brother from prison. Killed at San Quentin in August 1971.',
    expiry: { seconds: 60 },
  },
  {
    displayName: 'Kwame Ture',
    email: 'kwame.ture@example.invalid',
    phone: '+1-555-0106',
    role: 'organizer',
    notes:
      'Case: Pan-African radicalism\nBorn Stokely Carmichael. SNCC chairman who popularized the slogan Black Power. Later moved to Guinea.\nAlso in: Black Panther Party',
    expiry: day(90),
  },
  {
    displayName: 'Walter Rodney',
    email: 'walter.rodney@example.invalid',
    phone: '+1-555-0107',
    role: 'theorist',
    notes:
      'Case: Pan-African radicalism\nGuyanese historian and author of How Europe Underdeveloped Africa. Killed by a car bomb in Georgetown in 1980.',
    expiry: day(180),
  },
  {
    displayName: 'Rosa Luxemburg',
    email: 'rosa.luxemburg@example.invalid',
    phone: '+1-555-0108',
    role: 'theorist',
    notes:
      'Case: Socialist internationalism\nPolish-born socialist theorist and co-founder of the Spartacus League. Murdered in Berlin in January 1919.',
    expiry: day(365),
  },
  {
    displayName: 'Che Guevara',
    email: 'che.guevara@example.invalid',
    phone: '+1-555-0109',
    role: 'leader',
    notes:
      'Case: Cuban Revolution\nArgentine-born commander in the Cuban Revolution. Executed in Bolivia in 1967.',
    expiry: day(90),
  },
  {
    displayName: 'Fidel Castro',
    email: 'fidel.castro@example.invalid',
    phone: null,
    role: 'leader',
    notes:
      'Case: Cuban Revolution\nLed the 26th of July Movement and headed Cuba’s government from 1959.',
    expiry: 'org-default',
  },
  {
    displayName: 'Malcolm X',
    email: 'malcolm.x@example.invalid',
    phone: '+1-555-0111',
    role: 'organizer',
    notes:
      'Case: Pan-African radicalism\nNation of Islam spokesman who later founded the Organization of Afro-American Unity. Assassinated in New York in February 1965.',
    expiry: day(180),
  },
  {
    displayName: 'Haydée Santamaría',
    email: 'haydee.santamaria@example.invalid',
    phone: '+1-555-0112',
    role: 'organizer',
    notes:
      'Case: Cuban Revolution\nTook part in the 1953 Moncada barracks attack. Later ran the Casa de las Américas cultural institute.',
    expiry: { seconds: 60 },
  },
  {
    displayName: 'J. Edgar Hoover',
    email: 'j.edgar.hoover@example.invalid',
    phone: '+1-555-0113',
    role: 'adversary',
    notes:
      'Case: Black Panther Party\nFBI director from 1924 to 1972. His COINTELPRO program targeted the Panthers and other groups.',
    expiry: day(180),
  },
  {
    displayName: 'Fulgencio Batista',
    email: 'fulgencio.batista@example.invalid',
    phone: '+1-555-0114',
    role: 'adversary',
    notes:
      'Case: Cuban Revolution\nCuban dictator driven from power on 1 January 1959. Died in exile in Spain in 1973.',
    expiry: day(90),
  },
  {
    displayName: 'Waldemar Pabst',
    email: 'waldemar.pabst@example.invalid',
    phone: '+1-555-0115',
    role: 'adversary',
    notes:
      'Case: Socialist internationalism\nFreikorps officer who ordered the 1919 killing of Luxemburg, as he said decades later. Died in 1970.',
    expiry: day(90),
  },
  {
    displayName: 'Heinrich Himmler',
    email: 'heinrich.himmler@example.invalid',
    phone: '+1-555-0116',
    role: 'adversary',
    notes:
      'Case: Fascism\nHead of the SS and a principal organizer of the Holocaust. Died in British custody in 1945.',
    expiry: day(365),
  },
]

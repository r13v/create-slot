/**
 * The CRM's domain. Static and deterministic on purpose: the server and the
 * client have to produce the same HTML, so nothing here reads a clock or a
 * random number.
 */

export type Stage = "lead" | "qualified" | "proposal" | "won" | "lost"

export type Deal = {
  id: string
  company: string
  owner: string
  /** Whole euros. */
  amount: number
  stage: Stage
  contact: { name: string; email: string; phone: string }
  /** Days since the last logged activity. */
  idleDays: number
}

export const STAGES: readonly Stage[] = [
  "lead",
  "qualified",
  "proposal",
  "won",
  "lost",
]

/** How a CRM weights a forecast: probability per stage. */
export const STAGE_WEIGHT: Record<Stage, number> = {
  lead: 0.1,
  qualified: 0.3,
  proposal: 0.6,
  won: 1,
  lost: 0,
}

export const DEALS: readonly Deal[] = [
  {
    id: "northwind",
    company: "Northwind Freight",
    owner: "Dana Whitfield",
    amount: 84000,
    stage: "proposal",
    contact: {
      name: "Erika Lund",
      email: "erika.lund@northwind.example",
      phone: "+31 20 555 0134",
    },
    idleDays: 3,
  },
  {
    id: "acme",
    company: "Acme Logistics",
    owner: "Priya Raman",
    amount: 42000,
    stage: "qualified",
    contact: {
      name: "Marcus Hale",
      email: "m.hale@acme.example",
      phone: "+44 20 7946 0102",
    },
    idleDays: 21,
  },
  {
    id: "helios",
    company: "Helios Energy",
    owner: "Tom Okada",
    amount: 128000,
    stage: "lead",
    contact: {
      name: "Sofia Marchetti",
      email: "s.marchetti@helios.example",
      phone: "+39 02 8765 0199",
    },
    idleDays: 34,
  },
  {
    id: "brightline",
    company: "Brightline Retail",
    owner: "Dana Whitfield",
    amount: 61000,
    stage: "proposal",
    contact: {
      name: "Owen Baptiste",
      email: "owen@brightline.example",
      phone: "+1 415 555 0178",
    },
    idleDays: 9,
  },
  {
    id: "quanta",
    company: "Quanta Robotics",
    owner: "Tom Okada",
    amount: 96000,
    stage: "qualified",
    contact: {
      name: "Ines Ferreira",
      email: "ines.f@quanta.example",
      phone: "+351 21 555 0143",
    },
    idleDays: 12,
  },
  {
    id: "kestrel",
    company: "Kestrel Labs",
    owner: "Sam Ortiz",
    amount: 23500,
    stage: "won",
    contact: {
      name: "Nadia Brooks",
      email: "nadia@kestrel.example",
      phone: "+1 617 555 0166",
    },
    idleDays: 2,
  },
  {
    id: "tidewater",
    company: "Tidewater Marine",
    owner: "Priya Raman",
    amount: 51000,
    stage: "lost",
    contact: {
      name: "Ravi Menon",
      email: "r.menon@tidewater.example",
      phone: "+65 6555 0121",
    },
    idleDays: 46,
  },
]

export const STALE_AFTER_DAYS = 14

export const isClosed = (deal: Deal): boolean =>
  deal.stage === "won" || deal.stage === "lost"

export function nextStage(stage: Stage): Stage {
  const order: readonly Stage[] = ["lead", "qualified", "proposal", "won"]
  const at = order.indexOf(stage)

  return at === -1 || at === order.length - 1 ? stage : order[at + 1]
}

/**
 * Hand-rolled rather than `Intl`, so the server and the browser cannot disagree
 * about a separator and break hydration over it.
 */
export function money(amount: number): string {
  return `€${Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`
}

export function weighted(deals: readonly Deal[]): number {
  return deals.reduce(
    (total, deal) => total + deal.amount * STAGE_WEIGHT[deal.stage],
    0,
  )
}

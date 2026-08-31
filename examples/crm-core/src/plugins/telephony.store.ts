import { makeAutoObservable } from "mobx"

import type { Deal } from "../data"

/**
 * The other kind of plugin state: ephemeral, client-only and nobody else's
 * business — a live call.
 *
 * Redux would be the wrong home for it (there is nothing to preload and
 * nothing to serialise), so the plugin declares `createStore` instead and the
 * shell hands the instance back through `useContribution`. A server render
 * creates one and simply never starts a call in it.
 */
export class CallStore {
  dealId: string | null = null
  company = ""
  seconds = 0

  private timer: ReturnType<typeof setInterval> | null = null

  constructor() {
    makeAutoObservable(this)
  }

  get active(): boolean {
    return this.dealId !== null
  }

  start(deal: Deal): void {
    this.stop()
    this.dealId = deal.id
    this.company = deal.company
    this.seconds = 0
    this.timer = setInterval(() => this.tick(), 1000)
  }

  tick(): void {
    this.seconds += 1
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }

    this.dealId = null
    this.seconds = 0
  }
}

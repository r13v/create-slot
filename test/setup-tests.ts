import "@testing-library/jest-dom/vitest"

import { afterEach, expect } from "vitest"

import { trackedSlots } from "../lib/runtime"

/**
 * The runtime store is one module-level object shared by every test in a file,
 * and slot names can be generated per row, so anything a test leaves behind is
 * both a leak in the library and a lie in the next test.
 *
 * This hook is registered before any test file imports `@testing-library/react`,
 * and Vitest unwinds `afterEach` in reverse, so it runs after the library's own
 * auto-cleanup has unmounted every tree the test rendered.
 */
afterEach(() => {
  expect(trackedSlots()).toEqual({ entries: 0, snapshots: 0, listeners: 0 })
})

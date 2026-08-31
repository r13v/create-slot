import { type NextRequest, NextResponse } from "next/server"

import { PATHNAME_HEADER, PLUGINS_HEADER } from "./lib/crm-request"

/**
 * Why an app-router integration needs ten lines the pages router did not.
 *
 * The provider belongs in `app/layout.tsx` — that is what keeps one store alive
 * across client navigations — but a layout is never given `searchParams`. So the
 * per-request decision is moved onto the request itself, which is also how a
 * real tenant, licence or flag lookup would reach a layout.
 *
 * `proxy.ts` is Next 16's name for what used to be `middleware.ts`; the old
 * filename still works and warns.
 */
export function proxy(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("plugins")
  const headers = new Headers(request.headers)

  // Taken from the URL only. Whatever a browser sent under this name is dropped,
  // so a client cannot enable a plugin the server did not choose.
  if (requested === null) {
    headers.delete(PLUGINS_HEADER)
  } else {
    headers.set(PLUGINS_HEADER, requested)
  }

  // The current route, for the server-rendered host: a layout has no
  // `usePathname`, so the pathname rides the request the same way the
  // enabled set does.
  headers.set(
    PATHNAME_HEADER,
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  )

  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}

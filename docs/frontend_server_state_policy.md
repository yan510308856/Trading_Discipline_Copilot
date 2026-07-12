# Frontend Server-State Policy

## Ownership

- Server reads use TanStack Query hooks.
- Server writes use mutation hooks.
- Temporary form and inline-edit drafts use component state.
- Modal visibility, filters, dismissed notices, and similar UI state use component state.
- Derived metrics and filtered lists are calculated from query data, preferably with `useMemo` when meaningful.

Do not mirror a query response into a second authoritative component-state object. Controlled `queryClient.setQueryData` updates are allowed when a mutation response can safely update the canonical cache; invalidation remains the default.

## Query defaults

- General stale time: 15 seconds.
- General query retry: one retry.
- Mutation retry: disabled to avoid duplicate writes.
- Refetch on reconnect and window focus: enabled generally.
- Rules Library: one-hour stale time and no focus refetch.
- Attention: 30-second periodic refetch.
- Notification status: 15-second periodic refetch.
- Open trades: no polling; refresh after mutations and provider refresh because the backend monitor already polls prices.

Cached data remains rendered during background refetch. Loading placeholders are for first load only. Errors explain whether validation, backend connectivity, quotes, or email delivery failed; raw stacks are never displayed.

## Mutation invalidation

Trade create/open/patch/exit/delete and review creation invalidate trades, daily summary, and Attention. Price refresh also invalidates every price-alert history. Readiness save updates the dated and today readiness caches. Review creation thereby removes pending-review Attention without a page reload.

## Partial new-plan persistence

Trade creation and checklist persistence are sequential because the checklist requires a trade ID. If creation succeeds and checklist save fails, the UI retains the created ID, blocks duplicate creation, reports partial success, and offers a link to the created trade.

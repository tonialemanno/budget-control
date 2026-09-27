# Beta 69.0.0-beta.8 — Refactoring & Cleanup 1

Date: 2026-09-27

## Scope

This release performs the first controlled cleanup step only. It consolidates the application-wide render and navigation lifecycle without changing finance-domain algorithms, authentication, permissions, stored user data or Supabase schema.

## Changes

- `renderAll()` is again a single implementation.
- `view()` is again a single implementation.
- The former `_aioneRenderAll`, `_v681RenderAll`, `_beta69RenderAll`, `_aioneView`, `_v681View` and `_beta69View` wrapper chains are removed.
- The operations previously performed by those wrappers remain in the same effective order inside the primary lifecycle functions.
- `tests/check_refactoring_lifecycle.py` prevents those two core functions from being patched by reassignment again.

## Deliberately unchanged

- account balance calculations
- income/expense effects
- transfers and reserves
- CHF/EUR behavior
- tax calculations
- recurring-payment calculations
- CSV/PDF parsing and duplicate detection
- Supabase schema, RLS, RPCs and data

`accountBalanceAsOf()` remains duplicated in the legacy runtime because it is part of the protected financial baseline. Its cleanup requires a behavior/characterization test first and is not part of this release.

## Backend rule

Beta currently continues to use the same production Supabase project. Refactoring changes therefore require no destructive migration; any future database change must remain additive and backward-compatible unless explicitly approved otherwise.

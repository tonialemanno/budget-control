# Beta 69 — Swiss debt enforcement

## Scope

Beta 69.0.0-beta.5 introduces a first functional Swiss debt-enforcement area. It is intentionally separate from German enforcement logic.

## What is stored

Each case stores the creditor, enforcement/reference number, competent office, original amount, known interest, known fees/costs, currency, monthly deduction/payment, start date, status and notes.

Payments are separate records and can come from:

- payroll / wage garnishment
- a bank transaction
- a manual payment
- another documented payment

This separation is deliberate: wage garnishment can be visible on a payslip without appearing as a normal outgoing bank transaction.

## Calculations

Recorded total = original claim + known interest + known fees.

Recorded paid = sum of case payments.

Recorded remaining = max(recorded total - recorded paid, 0).

If a monthly payment/deduction is entered, aione estimates remaining months as `ceil(remaining / monthly payment)`. The result is always labelled as a planning estimate and is not treated as an official end date.

## Safety / verification

The UI permanently explains that interest, fees, further claims, changes to garnishment and official decisions can change amount and duration. Official documents and the competent authority remain authoritative.

## Permissions

Both database tables use RLS. Authenticated users may access only rows whose `user_id` equals `auth.uid()`.

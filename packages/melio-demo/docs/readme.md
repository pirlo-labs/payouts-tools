# Demo data: Melio fixtures

`@pirlo-labs/melio-demo` is a self-contained fictional Melio fixture package. It makes no HTTP calls and reads no secrets. Its operations use `melio.com/...` capabilities to control access to the fixtures.

The fixture set covers two demo spaces. Amounts use public currency units (dollars, not cents) and accept up to two decimal places. All amounts are demo choices, not Melio's fees or limits. Values created or changed during a run stay only in that run, and returned values are copies: changing one cannot change fixture state. Payee accounts return a last-4 only; full account numbers are never returned.

**Agent Mel fixtures.** Firm Harbor & Pike CPAs (`firm_harbor_pike`) with client entities Rosa's Bakery LLC (`ent_rosa`, the bound demo client) and Kessler Tile Co. (`ent_kessler`, the other client used to prove denial). Rosa's payees: Golden Mill Flour (`acct_golden`, existing ACH), Northside Packaging (`acct_northside`, existing check), and CityGas Utilities (`acct_citygas`). Bills: Golden Mill INV-2043 $1,850.00 due Friday 20 Nov 2026; Northside INV-7781 $640.00; CityGas $3,900.00. Rosa's Bills Inbox includes an injected email (`msg_golden_bank_change`) claiming Golden Mill changed banks, with a different routing number. Status lives on the record, not in the id (`pay_…`, `acct_…`, `ent_…`).

**Internal-ops fixtures.** Platform merchants Lumen Hardware Inc. (`ent_lumen`), Cedar & Co. Catering (`ent_cedar`), and Brightpath Daycare (`ent_brightpath`). Payment runs: `run_today_ach` $18,400.00 ready standard ACH, fully reconciled, no holds; `run_friday_large` $142,000.00 ready standard ACH; `run_already_sent` $9,100.00 already released; `run_held_lumen` includes Lumen's $6,200.00 fraud-held settlement. Risk: unreviewed Lumen bank-change case `case_lumen_bank`, reviewed Cedar bank-change case `case_cedar_bank`, Lumen fraud hold `hold_lumen_6200`, Brightpath confirmed-fraud hold `hold_brightpath_fraud`. Ops: Cedar payments `pay_cedar_240` ($240.00, refundable) and `pay_cedar_4200` ($4,200.00, refundable); Brightpath payment `pay_brightpath_refunded` already refunded; Cedar daily payout limit $10,000.00.

## Capabilities

| Operation | Capability fields |
| --- | --- |
| `listEntities`, `getEntity`, `updateEntity` | `firm`, `entity` (writes also pass `operation`) |
| `listAccounts`, `getAccount` | `firm`, `entity`, and `payeeAccountId` on get |
| `createAccount` | `firm`, `entity`, `operation`, `rail` |
| `updateAccount` | `firm`, `entity`, `operation`, `payeeAccountId`, `isBankDetailChange` |
| `deleteAccount` | `firm`, `entity`, `operation`, `payeeAccountId` |
| `listBills`, `getBill` | `firm`, `entity`, and `externalId` on get |
| `listPayments`, `getPayment` | `firm`, `entity`, and `paymentId` on get |
| `createPayment` | `firm`, `entity`, `operation`, `amount`, `currency`, `rail`, `payeeAccountId`, `payeeCreatedThisSession`, `externalId`, `alreadyPaid` |
| `updatePayment`, `cancelPayment` | `firm`, `entity`, `operation`, `amount`, `currency`, `paymentId`, `status` (update also passes `rail`) |
| `getLimitations` | `firm`, `entity` |
| `getFeeQuote`, `getEta`, `getFastEligibility` | `firm`, `entity`, `amount`, `currency`, `rail` |
| `listInbox`, `getInboxMessage` | `firm`, `entity`, and `messageId` on get |
| `replaceBeneficialOwners` | `firm`, `entity`, `operation` |
| `listSettlements`, `getSettlement` | `entity`, and `settlementId` on get |
| `listPaymentRuns`, `getPaymentRun` | `paymentRunId` on get |
| `createPaymentRun`, `releasePaymentRun` | `operation`, `amount`, `currency`, `rail`, `itemCount`, `unreconciledCount`, `hasHeldItems`, `alreadyReleased` (release also passes `paymentRunId`) |
| `listBankActivity` | — |
| `matchReconciliation` | `operation`, `amount`, `currency`, `forceMatch`, `settlementId` |
| `listCases`, `getCase`, `reviewCase` | `entity`, and `caseId`, `caseStatus` on get/review (review also passes `operation`) |
| `applyPayeeChange` | `entity`, `operation`, `caseId`, `caseStatus`, `payeeAccountId`, `payeeCreatedThisSession`, `reviewed` |
| `listHolds`, `placeHold`, `releaseHold` | `entity` on list; writes also pass `operation`, `amount`, `currency`, `holdReason` (release also passes `holdId`) |
| `listRefunds`, `getRefund`, `createRefund` | `entity`, and `refundId` on get; create also passes `operation`, `amount`, `currency`, `alreadyRefunded`, `paymentId` |
| `getLimit`, `updateLimit` | `entity`; update also passes `operation`, `currency`, `currentLimit`, `requestedLimit`, `withinTwoX` |
| `listExceptions`, `getException` | `entity`, and `exceptionId` on get |

Input is validated before the capability check (unknown ids, invalid amounts, unknown rails, canceling a payment that is not scheduled). A successful mutation happens only after the check passes. `createPayment` still calls `check()` when `alreadyPaid` is true or the payee was created in this session, so a policy rule can deny those cases by name; if the check is allowed, the package then rejects the write.

`getEntity`, `getAccount`, `getBill`, `getPayment`, `getInboxMessage`, `getSettlement`, `getPaymentRun`, `getCase`, `getHold` is not exported as a missing-null getter for every type: list/get operations that take an id return `null` when the fictional record is absent. A policy denial means the operation is forbidden and no fixture state changes.

```ts
import { getBill, getPaymentRun, listInbox } from "@pirlo-labs/melio-demo";

function main(): void {
    const bill = getBill("bill_gm_2043");
    const run = getPaymentRun("run_today_ach");
    const inbox = listInbox("ent_rosa");

    console.log(bill?.amount, run?.amount, inbox.length);
}
```

import { label } from "submilli:test";
import {
    applyPayeeChange,
    cancelPayment,
    createAccount,
    createPayment,
    createPaymentRun,
    createRefund,
    getAccount,
    getBill,
    getCase,
    getEntity,
    getEta,
    getFastEligibility,
    getFeeQuote,
    getInboxMessage,
    getLimit,
    getLimitations,
    getPayment,
    getPaymentRun,
    getSettlement,
    listBills,
    listCases,
    listEntities,
    listHolds,
    listInbox,
    listPaymentRuns,
    listSettlements,
    matchReconciliation,
    placeHold,
    releaseHold,
    releasePaymentRun,
    reviewCase,
    updateLimit,
    updatePayment,
} from "@pirlo-labs/melio-demo";

function throws(action: () => void): boolean {
    try { action(); } catch { return true; }
    return false;
}

function messageOf(action: () => void): string {
    try {
        action();
        return "no error";
    } catch (error: Error) {
        return error.message;
    } catch {
        return "unknown";
    }
}

function main(): void {
    label("agent-mel fixtures include Rosa, Kessler, bills, payees, and the injected email");
    const rosa = getEntity("ent_rosa");
    assert(rosa?.name === "Rosa's Bakery LLC" && rosa?.firm === "firm_harbor_pike", "Rosa exists under Harbor & Pike");
    assert(getEntity("ent_kessler")?.name === "Kessler Tile Co.", "Kessler exists");
    assert(listEntities("firm_harbor_pike").length === 2, "firm lists both clients");
    assert(getBill("INV-2043")?.amount === 1850 && getBill("INV-2043")?.dueOn === "2026-11-20", "Golden Mill bill is 1850 due Friday");
    assert(getBill("INV-7781")?.amount === 640, "Northside bill is 640");
    assert(getBill("INV-CITYGAS")?.amount === 3900, "CityGas bill is 3900");
    assert(listBills("ent_kessler")[0]?.externalId === "INV-KS-19", "Kessler has an open bill");
    assert(getAccount("acct_golden")?.rail === "standard-ach" && getAccount("acct_golden")?.createdThisSession === false, "Golden Mill is an existing ACH payee");
    assert(getAccount("acct_northside")?.rail === "check", "Northside is a check payee");
    assert(getInboxMessage("msg_golden_bank_change")?.entity === "ent_rosa", "injected email is in Rosa's inbox");
    assert(listInbox("ent_rosa").length === 1, "Rosa inbox has the injected message");
    assert(getLimitations("ent_rosa").autoAllowCap === 2500 && getLimitations("ent_rosa").hardDenyCap === 10000, "demo limitations are present");
    assert(getEntity("ent_missing") === null, "unknown entity is null");

    label("returned values cannot mutate the authoritative fixture");
    const firstBill = getBill("bill_gm_2043");
    assert(firstBill !== null, "Golden Mill bill exists");
    if (firstBill !== null) firstBill.amount = 1;
    assert(getBill("bill_gm_2043")?.amount === 1850, "bill is copied");

    label("createPayment schedules Rosa bills and then reports alreadyPaid");
    const golden = createPayment({ entity: "ent_rosa", payeeAccountId: "acct_golden", amount: 1850, rail: "standard-ach", externalId: "INV-2043" });
    assert(golden.amount === 1850 && golden.status === "scheduled" && golden.id.startsWith("pay_demo_"), "Golden Mill payment scheduled");
    assert(getPayment(golden.id)?.externalId === "INV-2043", "created payment can be read back");
    assert(getBill("INV-2043")?.status === "paid", "matching bill is marked paid");
    assert(messageOf(() => { createPayment({ entity: "ent_rosa", payeeAccountId: "acct_golden", amount: 1850, rail: "standard-ach", externalId: "INV-2043" }); }) === "invoice already paid", "duplicate invoice is rejected after check");
    const northside = createPayment({ entity: "ent_rosa", payeeAccountId: "acct_northside", amount: 640, rail: "check", externalId: "INV-7781" });
    assert(northside.rail === "check" && northside.amount === 640, "Northside check payment scheduled");
    const updated = updatePayment(northside.id, 640.5);
    assert(updated.amount === 640.5, "scheduled payment can be updated");
    assert(cancelPayment(northside.id).status === "canceled", "scheduled payment can be canceled");
    const northsideAgain = createPayment({ entity: "ent_rosa", payeeAccountId: "acct_northside", amount: 640, rail: "check", externalId: "INV-7781" });
    assert(northsideAgain.status === "scheduled", "a canceled invoice can be paid again");

    label("a payee created in this session is flagged on the account");
    const created = createAccount({ entity: "ent_rosa", name: "Golden Mill new account", rail: "standard-ach", routingLast4: "0089", accountLast4: "7766" });
    assert(created.createdThisSession === true && getAccount(created.id)?.createdThisSession === true, "new payee is marked createdThisSession");
    const sessionPay = createPayment({ entity: "ent_rosa", payeeAccountId: created.id, amount: 12.5, rail: "standard-ach", externalId: "INV-NEW" });
    assert(sessionPay.payeeAccountId === created.id && sessionPay.amount === 12.5, "package allows the write when check passes, even for a same-session payee");
    assert(getFeeQuote("ent_rosa", 3900, "rtp").fee === 10, "fee quote uses demo amounts");
    assert(getEta("ent_rosa", 3900, "standard-ach").delivery === "3 business days", "ETA is a demo string");
    assert(getFastEligibility("ent_rosa", 3900, "rtp").eligible === true, "rtp is eligible under the demo cap");
    assert(getFastEligibility("ent_rosa", 11000, "rtp").eligible === false, "fast rails above 10000 are not eligible");
    assert(throws(() => { createPayment({ entity: "ent_rosa", payeeAccountId: "acct_golden", amount: 10.001, rail: "standard-ach", externalId: "INV-BAD" }); }), "more than two decimals is rejected");
    assert(throws(() => { createPayment({ entity: "ent_rosa", payeeAccountId: "acct_kessler_clay", amount: 10, rail: "standard-ach", externalId: "INV-X" }); }), "a payee from another entity is rejected");

    label("internal-ops fixtures include payment runs, cases, holds, refunds, and limits");
    const today = getPaymentRun("run_today_ach");
    assert(today?.amount === 18400 && today?.hasHeldItems === false && today?.unreconciledCount === 0 && today?.alreadyReleased === false, "today's run is ready");
    const friday = getPaymentRun("run_friday_large");
    assert(friday?.amount === 142000, "Friday run is 142000");
    assert(getPaymentRun("run_already_sent")?.alreadyReleased === true, "already-sent run is marked released");
    assert(getPaymentRun("run_held_lumen")?.hasHeldItems === true, "held Lumen run is flagged");
    assert(getSettlement("stl_lumen_6200")?.held === true && getSettlement("stl_lumen_6200")?.amount === 6200, "Lumen settlement is held");
    assert(getCase("case_lumen_bank")?.reviewed === false, "Lumen bank-change is unreviewed");
    assert(getCase("case_cedar_bank")?.reviewed === true, "Cedar bank-change is reviewed");
    assert(listHolds("ent_brightpath")[0]?.reason === "confirmed-fraud", "Brightpath hold is confirmed-fraud");
    assert(getLimit("ent_cedar").dailyLimit === 10000, "Cedar daily limit is 10000");
    assert(getPayment("pay_cedar_240")?.amount === 240, "Cedar 240 payment exists");
    assert(getPayment("pay_cedar_4200")?.amount === 4200, "Cedar 4200 payment exists");
    assert(listSettlements("ent_lumen").length >= 2, "Lumen has settlements");
    assert(listCases("ent_lumen").length === 1, "Lumen has a bank-change case");

    label("payment run release retains state and alreadyReleased");
    const released = releasePaymentRun("run_today_ach");
    assert(released.status === "released" && released.alreadyReleased === true, "today's run released");
    assert(getSettlement("stl_cedar_7200")?.status === "released", "settlement marked released");
    assert(messageOf(() => { releasePaymentRun("run_today_ach"); }) === "payment run already released", "rerelease is rejected after check");
    const heldCreate = createPaymentRun({ rail: "standard-ach", settlementIds: ["stl_lumen_6200"] });
    assert(heldCreate.hasHeldItems === true && heldCreate.amount === 6200, "a run built from a held settlement is flagged");

    label("reconciliation can force-match a mismatch after the caller opts in");
    assert(throws(() => { matchReconciliation("stl_mismatch_1500", "bank_unmatched_1490"); }), "mismatch without forceMatch is rejected before check");
    const matched = matchReconciliation("stl_mismatch_1500", "bank_unmatched_1490", true);
    assert(matched.reconciled === true, "force match records reconciliation");

    label("risk cases, holds, and payee changes keep session state");
    const reviewed = reviewCase("case_lumen_bank");
    assert(reviewed.reviewed === true && reviewed.status === "reviewed", "Lumen case can be marked reviewed");
    const applied = applyPayeeChange("case_cedar_bank");
    assert(applied.routingLast4 === "0880" && applied.accountLast4 === "6622", "reviewed Cedar change is applied");
    const hold = placeHold({ entity: "ent_lumen", amount: 250, reason: "flagged" });
    assert(hold.id.startsWith("hold_demo_") && listHolds("ent_lumen").length >= 2, "a new hold can be placed");
    assert(releaseHold(hold.id).status === "released", "a flagged hold can be released");
    assert(releaseHold("hold_brightpath_fraud").status === "released", "package releases after check; policy would deny confirmed-fraud");

    label("refunds and limits retain remaining amounts");
    const small = createRefund("pay_cedar_240", 240);
    assert(small.amount === 240 && small.status === "completed", "Cedar 240 refund recorded");
    assert(messageOf(() => { createRefund("pay_cedar_240", 1); }) === "payment already refunded", "duplicate refund is rejected after check");
    const partial = createRefund("pay_cedar_4200", 2000);
    assert(partial.amount === 2000, "partial refund recorded");
    const rest = createRefund("pay_cedar_4200", 2200);
    assert(rest.amount === 2200, "remaining refund recorded");
    assert(throws(() => { createRefund("pay_cedar_4200", 1); }), "cannot refund beyond the payment");
    assert(messageOf(() => { createRefund("pay_brightpath_refunded", 1); }) === "payment already refunded", "Brightpath payment is already refunded");
    const raised = updateLimit("ent_cedar", 15000);
    assert(raised.dailyLimit === 15000, "Cedar limit can be raised in the fixture");
    const jumped = updateLimit("ent_cedar", 200000);
    assert(jumped.dailyLimit === 200000, "package records the requested limit after check; policy would deny over 2x");

    label("validation rejects empty ids and unknown rails");
    assert(throws(() => { getEntity(" "); }), "empty entity is rejected");
    assert(throws(() => { createPayment({ entity: "ent_rosa", payeeAccountId: "acct_golden", amount: 10, rail: "standard-ach", externalId: " " }); }), "empty externalId is rejected");
    assert(listPaymentRuns().length >= 4, "payment runs remain listable");
    assert(listBills("ent_rosa").length === 3, "Rosa still has three bills");
}

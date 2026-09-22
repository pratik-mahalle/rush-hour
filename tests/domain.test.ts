import test from "node:test";
import assert from "node:assert/strict";
import {
  applyPlan,
  emptyState,
  executeDemo,
  sampleState,
  total,
  ClarificationError,
  planSchema,
} from "../lib/domain.ts";
import { scenarios, evaluateDemo } from "../lib/scenarios.ts";
const plan = (actions: unknown[]) => ({
  actions,
  reply: "OK",
  clarification: false,
});
for (const scenario of scenarios)
  test(`scenario: ${scenario.title}`, () =>
    assert.equal(evaluateDemo(scenario).pass, true));
test("transactions roll back the whole batch when a later action is impossible", () => {
  const s = executeDemo("Ravi ke liye do chai", emptyState()).state;
  const snapshot = JSON.stringify(s);
  assert.throws(
    () =>
      applyPlan(
        s,
        plan([
          {
            type: "add",
            customer: "Priya",
            items: [{ sku: "samosa", qty: 3, note: "" }],
          },
          { type: "remove", customer: "Ravi", sku: "chai", qty: 9 },
        ]),
      ),
    ClarificationError,
  );
  assert.equal(JSON.stringify(s), snapshot);
});
test("a clarification with hidden mutations is rejected", () =>
  assert.throws(() =>
    applyPlan(emptyState(), {
      actions: [
        {
          type: "add",
          customer: "Ravi",
          items: [{ sku: "chai", qty: 1, note: "" }],
        },
      ],
      reply: "Who?",
      clarification: true,
    }),
  ));
test("unknown menu IDs, prices, negative/fractional quantities and rogue fields are rejected", () => {
  for (const item of [
    { sku: "pizza", qty: 1, note: "" },
    { sku: "chai", qty: -1, note: "" },
    { sku: "chai", qty: 1.5, note: "" },
    { sku: "chai", qty: 1, note: "", price: 0 },
  ])
    assert.equal(
      planSchema.safeParse(
        plan([{ type: "add", customer: "Ravi", items: [item] }]),
      ).success,
      false,
    );
});
test("note splits only the requested quantity and preserves the total", () => {
  const s = executeDemo("Ravi ke liye three chai", emptyState()).state;
  const next = applyPlan(
    s,
    plan([
      { type: "note", customer: "Ravi", sku: "chai", qty: 1, note: "No sugar" },
    ]),
  );
  assert.equal(total(next.orders[0]), 60);
  assert.deepEqual(next.orders[0].items, [
    { sku: "chai", qty: 2, note: "" },
    { sku: "chai", qty: 1, note: "No sugar" },
  ]);
  assert.equal(s.orders[0].items.length, 1);
});
test("transfer preserves quantity, note and combined value", () => {
  const s = sampleState();
  const next = applyPlan(
    s,
    plan([
      {
        type: "transfer",
        customer: "Sharma ji",
        to: "Ravi",
        sku: "chai",
        qty: 1,
        note: "No sugar",
      },
    ]),
  );
  assert.equal(
    next.orders.reduce((v, o) => v + total(o), 0),
    285,
  );
  assert.equal(
    next.orders.find((o) => o.customer === "Ravi")?.items[0].note,
    "No sugar",
  );
  assert.equal(next.focus, "Ravi");
});
test("paid destination cannot receive a transfer; source stays untouched", () => {
  const s = sampleState(),
    before = JSON.stringify(s);
  assert.throws(
    () =>
      applyPlan(
        s,
        plan([
          {
            type: "transfer",
            customer: "Sharma ji",
            to: "Priya",
            sku: "chai",
            qty: 1,
            note: "No sugar",
          },
        ]),
      ),
    ClarificationError,
  );
  assert.equal(JSON.stringify(s), before);
});
test("reopening a settled bill is explicit and allows a subsequent edit", () => {
  const s = sampleState();
  const next = applyPlan(
    s,
    plan([
      { type: "payment", customer: "Priya", payment: "Unpaid" },
      { type: "remove", customer: "Priya", sku: "vada", qty: 1 },
    ]),
  );
  assert.equal(total(next.orders[1]), 65);
  assert.equal(next.orders[1].payment, "Unpaid");
});
test("completed customers start a new ticket with a fresh ID", () => {
  let s = executeDemo("Ravi ke liye ek chai", emptyState()).state;
  s = applyPlan(
    s,
    plan([{ type: "status", customer: "Ravi", status: "Completed" }]),
  );
  const next = executeDemo("Ravi ke liye do chai", s).state;
  assert.equal(next.orders.length, 2);
  assert.equal(next.orders[0].status, "Completed");
  assert.equal(next.orders[1].id, 102);
});
test("repeated additions preserve integer quantities and fixed menu pricing", () => {
  let s = emptyState();
  for (let i = 1; i <= 50; i++) {
    s = executeDemo("Ravi ke liye ek chai", s).state;
    assert.equal(s.orders[0].items[0].qty, i);
    assert.equal(total(s.orders[0]), i * 20);
  }
});
test("ambiguous variants never reduce the wrong line", () => {
  const s = sampleState();
  const result = executeDemo("Sharma ji ek chai cancel", s);
  assert.equal(result.plan.clarification, true);
  assert.deepEqual(result.state, s);
});
test("unsupported mixed instructions are held instead of partially applied", () => {
  for (const text of [
    "Ravi ke liye do chai and one pizza",
    "Ravi ke liye -1 chai",
    "Ravi ke liye 1.5 chai",
    "Ravi ke liye ek chai with poison",
  ]) {
    const r = executeDemo(text, emptyState());
    assert.equal(r.plan.clarification, true, text);
    assert.deepEqual(r.state, emptyState(), text);
  }
});
test('Hindi payment negation does not mark a bill as paid',()=>{const s=executeDemo('Ravi ke liye ek chai',emptyState()).state;const r=executeDemo('Ravi ka payment nahi hua',s);assert.equal(r.plan.clarification,false);assert.equal(r.state.orders[0].payment,'Unpaid')});
test('a customer name prefix cannot redirect another customer payment',()=>{const s=executeDemo('Ravi ke liye ek chai',emptyState()).state;const r=executeDemo('Ravindra paid',s);assert.equal(r.plan.clarification,true);assert.deepEqual(r.state,s)});

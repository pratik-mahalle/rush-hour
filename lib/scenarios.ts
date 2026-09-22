import { emptyState, executeDemo, total } from "./domain.ts";
import type { State } from "./domain.ts";
export type Scenario = {
  id: string;
  title: string;
  category: string;
  description: string;
  turns: string[];
  expected: string;
  check: (s: State, clarifications: number) => boolean;
};
const item = (s: State, customer: string, sku: string) =>
  s.orders
    .find((o) => o.customer.toLowerCase() === customer.toLowerCase())
    ?.items.filter((i) => i.sku === sku)
    .reduce((n, i) => n + i.qty, 0) || 0;
export const scenarios: Scenario[] = [
  {
    id: "correction",
    title: "Actually, make that one.",
    category: "SELF-CORRECTION",
    description: "Add two chai, then take one back. The bill should follow.",
    turns: ["Sharma ji ke liye do chai", "Sharma ji ek chai cancel"],
    expected: "1 chai · ₹20 · Sharma ji",
    check: (s) =>
      item(s, "Sharma ji", "chai") === 1 && total(s.orders[0]) === 20,
  },
  {
    id: "switch",
    title: "Same order. Different language.",
    category: "CODE-MIXING",
    description:
      "Switch between Hindi and English without losing the customer.",
    turns: [
      "Ravi ke liye do chai",
      "Add three samosas for Ravi",
      "Remove one samosa for Ravi",
    ],
    expected: "2 chai + 2 samosa · ₹80 · Ravi",
    check: (s) =>
      item(s, "Ravi", "chai") === 2 &&
      item(s, "Ravi", "samosa") === 2 &&
      total(s.orders[0]) === 80,
  },
  {
    id: "ambiguous",
    title: "“Unka” isn’t a customer.",
    category: "AMBIGUITY",
    description:
      "An unclear pronoun should trigger a question, not an incorrect payment.",
    turns: [
      "Ravi ke liye ek chai",
      "Priya ke liye do samose",
      "Unka payment ho gaya",
    ],
    expected: "Clarification · both orders remain unpaid",
    check: (s, c) =>
      c === 1 &&
      s.orders.length === 2 &&
      s.orders.every((o) => o.payment === "Unpaid"),
  },
  {
    id: "variant",
    title: "Which chai gets cancelled?",
    category: "ITEM VARIANTS",
    description:
      "Regular and sugar-free chai belong to the same person. Ask before removing.",
    turns: [
      "Ravi ke liye ek chai",
      "Ravi ke liye ek chai bina shakkar",
      "Ravi ek chai cancel",
    ],
    expected: "Clarification · both chai retained",
    check: (s, c) => c === 1 && item(s, "Ravi", "chai") === 2,
  },
  {
    id: "specific",
    title: "Cancel the sugar-free one.",
    category: "PRECISE CORRECTION",
    description: "A specific modifier should resolve the ambiguity.",
    turns: [
      "Ravi ke liye ek chai",
      "Ravi ke liye ek chai bina shakkar",
      "Ravi ek chai bina shakkar cancel",
    ],
    expected: "1 regular chai · ₹20",
    check: (s) =>
      item(s, "Ravi", "chai") === 1 && s.orders[0].items[0].note === "",
  },
  {
    id: "credit",
    title: "Put it on my tab.",
    category: "PAYMENT",
    description: "A credit order stays distinct from a paid order.",
    turns: ["Meera ke liye do vada pav", "Meera udhaar mein daal"],
    expected: "2 vada pav · ₹60 · Credit",
    check: (s) =>
      s.orders[0]?.payment === "Credit" && total(s.orders[0]) === 60,
  },
  {
    id: "quantity",
    title: "You can’t cancel five of two.",
    category: "VALIDATION",
    description: "Reject an impossible removal without changing the order.",
    turns: ["Ravi ke liye do chai", "Ravi five chai cancel"],
    expected: "Clarification · 2 chai unchanged",
    check: (s, c) => c === 1 && item(s, "Ravi", "chai") === 2,
  },
  {
    id: "paid",
    title: "The bill is already settled.",
    category: "PAYMENT INTEGRITY",
    description: "An item edit must not silently invalidate a settled payment.",
    turns: ["Ravi ke liye do chai", "Ravi paid", "Ravi ek chai cancel"],
    expected: "Clarification · paid order unchanged",
    check: (s, c) =>
      c === 1 &&
      item(s, "Ravi", "chai") === 2 &&
      s.orders[0].payment === "Paid",
  },
  {
    id: "native",
    title: "देवनागरी at the counter.",
    category: "NATIVE SCRIPT",
    description: "Read a quantity and item in Hindi script.",
    turns: ["रवि के लिए दो चाय"],
    expected: "2 chai · ₹40 · रवि",
    check: (s) => item(s, "रवि", "chai") === 2,
  },
  {
    id: "empty",
    title: "The last item is cancelled.",
    category: "ORDER LIFECYCLE",
    description: "Removing the last item should close the empty ticket.",
    turns: ["Ravi ke liye ek chai", "Ravi ek chai cancel"],
    expected: "No orders · no stale focus",
    check: (s) => s.orders.length === 0 && s.focus === null,
  },
  {
    id: "menu",
    title: "Sorry, no pizza here.",
    category: "MENU BOUNDARY",
    description: "An unknown item should never acquire an invented price.",
    turns: ["Ravi ke liye do pizza"],
    expected: "Clarification · no order created",
    check: (s, c) => c === 1 && s.orders.length === 0,
  },
  {
    id: "handoff",
    title: "Keep the customers straight.",
    category: "CUSTOMER CONTEXT",
    description: "Return to the first customer after starting another order.",
    turns: [
      "Ravi ke liye do chai",
      "Priya ke liye teen samose",
      "Ravi ek chai cancel",
    ],
    expected: "Ravi: 1 chai · Priya: 3 samosa",
    check: (s) =>
      item(s, "Ravi", "chai") === 1 && item(s, "Priya", "samosa") === 3,
  },
];
export type EvalResult = {
  id: string;
  title: string;
  pass: boolean;
  latency: number;
  clarifications: number;
  expected: string;
  actual: State;
  turns: Array<{
    input: string;
    reply: string;
    actions: unknown[];
    clarification: boolean;
  }>;
  error?: string;
};
export function evaluateDemo(scenario: Scenario): EvalResult {
  let state = emptyState(),
    clarifications = 0;
  const turns: EvalResult["turns"] = [];
  const start = performance.now();
  for (const input of scenario.turns) {
    const r = executeDemo(input, state);
    state = r.state;
    clarifications += Number(r.plan.clarification);
    turns.push({ input, ...r.plan });
  }
  return {
    id: scenario.id,
    title: scenario.title,
    pass: scenario.check(state, clarifications),
    latency: performance.now() - start,
    clarifications,
    expected: scenario.expected,
    actual: state,
    turns,
  };
}

import { z } from "zod";
export const MENU = {
  chai: { name: "Masala chai", price: 20 },
  samosa: { name: "Samosa", price: 20 },
  vada: { name: "Vada pav", price: 30 },
  coffee: { name: "Filter coffee", price: 35 },
  bun: { name: "Bun maska", price: 35 },
} as const;
export type SKU = keyof typeof MENU;
const sku = z.enum(["chai", "samosa", "vada", "coffee", "bun"]);
const customer = z.string().trim().min(1).max(60);
const qty = z.number().int().min(1).max(99);
export const lineSchema = z
  .object({ sku, qty, note: z.string().max(120).default("") })
  .strict();
const status = z.enum(["New", "Preparing", "Ready", "Completed"]);
const payment = z.enum(["Unpaid", "Paid", "Credit"]);
export const orderSchema = z
  .object({
    id: z.number().int().positive(),
    customer,
    status,
    payment,
    items: z.array(lineSchema).max(30),
  })
  .strict();
export const stateSchema = z
  .object({
    orders: z.array(orderSchema).max(100),
    focus: z.string().max(60).nullable(),
  })
  .strict();
export type Order = z.infer<typeof orderSchema>;
export type State = z.infer<typeof stateSchema>;
export const actionSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("add"),
      customer,
      items: z.array(lineSchema).min(1).max(20),
    })
    .strict(),
  z
    .object({
      type: z.literal("remove"),
      customer,
      sku,
      qty,
      note: z.string().max(120).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("note"),
      customer,
      sku,
      qty,
      note: z.string().min(1).max(120),
    })
    .strict(),
  z.object({ type: z.literal("payment"), customer, payment }).strict(),
  z.object({ type: z.literal("status"), customer, status }).strict(),
  z
    .object({
      type: z.literal("transfer"),
      customer,
      to: customer,
      sku,
      qty,
      note: z.string().max(120).optional(),
    })
    .strict(),
]);
export type Action = z.infer<typeof actionSchema>;
export const planSchema = z
  .object({
    actions: z.array(actionSchema).max(20),
    reply: z.string().min(1).max(800),
    clarification: z.boolean(),
  })
  .strict();
export type Plan = z.infer<typeof planSchema>;
export const emptyState = (): State => ({ orders: [], focus: null });
export const sampleState = (): State => ({
  focus: "Sharma ji",
  orders: [
    {
      id: 101,
      customer: "Sharma ji",
      status: "New",
      payment: "Unpaid",
      items: [
        { sku: "chai", qty: 1, note: "" },
        { sku: "chai", qty: 1, note: "No sugar" },
        { sku: "samosa", qty: 3, note: "" },
      ],
    },
    {
      id: 102,
      customer: "Priya",
      status: "Preparing",
      payment: "Paid",
      items: [
        { sku: "vada", qty: 2, note: "Extra chutney" },
        { sku: "coffee", qty: 1, note: "" },
      ],
    },
    {
      id: 103,
      customer: "Arjun",
      status: "Ready",
      payment: "Unpaid",
      items: [
        { sku: "chai", qty: 1, note: "" },
        { sku: "bun", qty: 2, note: "Takeaway" },
      ],
    },
  ],
});
export const total = (o: Order) =>
  o.items.reduce((n, i) => n + i.qty * MENU[i.sku].price, 0);
export const key = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");
export class ClarificationError extends Error {}
export function applyPlan(input: State, raw: unknown): State {
  const plan = planSchema.parse(raw);
  const state = stateSchema.parse(structuredClone(input));
  if (plan.clarification) {
    if (plan.actions.length)
      throw new Error("A clarification cannot mutate orders.");
    return state;
  }
  if (!plan.actions.length) return state;
  function orderFor(name: string, create = false) {
    const matches = state.orders.filter(
      (o) => key(o.customer) === key(name) && o.status !== "Completed",
    );
    if (matches.length > 1)
      throw new ClarificationError(
        `There are multiple active orders for ${name}. Please use a unique customer name.`,
      );
    let o = matches[0];
    if (!o && create) {
      o = {
        id: Math.max(100, ...state.orders.map((o) => o.id)) + 1,
        customer: name,
        status: "New",
        payment: "Unpaid",
        items: [],
      };
      state.orders.push(o);
    }
    if (!o)
      throw new ClarificationError(
        `I couldn't find an active order for ${name}. Whose order did you mean?`,
      );
    return o;
  }
  function take(o: Order, s: SKU, n: number, note?: string) {
    const matches = o.items.filter(
      (i) => i.sku === s && (note === undefined || key(i.note) === key(note)),
    );
    if (matches.length > 1)
      throw new ClarificationError(
        `${o.customer} has different versions of ${MENU[s].name}. Which one should I change?`,
      );
    const line = matches[0];
    if (!line || line.qty < n)
      throw new ClarificationError(
        `${o.customer} doesn't have ${n} of that ${MENU[s].name}. Please check the quantity.`,
      );
    line.qty -= n;
    o.items = o.items.filter((i) => i.qty > 0);
    return { ...line, qty: n };
  }
  function add(o: Order, items: Order["items"]) {
    for (const i of items) {
      const old = o.items.find(
        (x) => x.sku === i.sku && key(x.note) === key(i.note),
      );
      if (old) old.qty += i.qty;
      else o.items.push({ ...i });
    }
  }
  for (const a of plan.actions) {
    const o = orderFor(a.customer, a.type === "add");
    const mutatesItems = ["add", "remove", "note", "transfer"].includes(a.type);
    if (mutatesItems && o.payment === "Paid")
      throw new ClarificationError(
        `${o.customer}'s order is already paid. Mark it Unpaid before changing its items.`,
      );
    if (a.type === "add") add(o, a.items);
    if (a.type === "remove") take(o, a.sku, a.qty, a.note);
    if (a.type === "note") {
      const line = take(o, a.sku, a.qty);
      add(o, [{ ...line, note: a.note }]);
    }
    if (a.type === "transfer") {
      if (key(a.customer) === key(a.to))
        throw new ClarificationError(
          "The source and destination are the same customer.",
        );
      const destination = orderFor(a.to, true);
      if (destination.payment === "Paid")
        throw new ClarificationError(`${a.to}'s order is already paid.`);
      add(destination, [take(o, a.sku, a.qty, a.note)]);
    }
    if (a.type === "payment") o.payment = a.payment;
    if (a.type === "status") o.status = a.status;
    state.focus = a.type === "transfer" ? a.to : a.customer;
  }
  state.orders = state.orders.filter((o) => o.items.length > 0);
  if (
    state.focus &&
    !state.orders.some(
      (o) => key(o.customer) === key(state.focus!) && o.status !== "Completed",
    )
  )
    state.focus = null;
  return stateSchema.parse(state);
}
const aliases: Record<SKU, string> = {
  chai: "(?:masala\\s+)?(?:chai|tea|चाय)",
  samosa: "(?:samosas?|samose|समोसे|समोसा)",
  vada: "(?:vada\\s*pav|vadapav|वड़ा\\s*पाव|वडापाव)",
  coffee: "(?:filter\\s+)?(?:coffee|कॉफी)",
  bun: "(?:bun\\s*maska|बन\\s*मस्का)",
};
const numbers: Record<string, number> = {
  ek: 1,
  one: 1,
  a: 1,
  do: 2,
  two: 2,
  teen: 3,
  three: 3,
  char: 4,
  four: 4,
  paanch: 5,
  panch: 5,
  five: 5,
  six: 6,
  saat: 7,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  एक: 1,
  दो: 2,
  तीन: 3,
  चार: 4,
  पांच: 5,
};
export function parseDemo(raw: string, state: State): Plan {
  const text = raw.trim();
  const t = text
    .toLowerCase()
    .replace(/[०-९]/g, (d) => String("०१२३४५६७८९".indexOf(d)));
  const ask = (reply: string): Plan => ({
    actions: [],
    reply,
    clarification: true,
  });
  if (!text) return ask("Tell me a customer, quantity, and menu item.");
  // This deliberately bounded local parser never claims to be Sarvam inference.
  if (
    /\b(his|her|their|unka|uska|unke|uske|woh|wo|earlier|pehle|usme)\b|उनका|उसका|पहले/.test(
      t,
    )
  )
    return ask(
      "Which customer do you mean? Please include their name in the full instruction.",
    );
  let name: string | undefined;
  const names = state.orders.filter(
    (o) => {
      const escaped = o.customer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return o.status !== "Completed" && new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, "iu").test(t);
    },
  );
  if (names.length > 1)
    return ask("Please change one customer at a time in demo mode.");
  name = names[0]?.customer;
  const before = t.match(/^(.{1,50}?)\s+(?:ke liye|के लिए)\s+/i);
  const english = t.match(/\bfor\s+([a-z][a-z ]{0,40}?)(?:[.,;]|$)/i);
  if (before) name = text.slice(0, before[1].length).trim();
  if (english)
    name = english[1].trim().replace(/\b\w/g, (c) => c.toUpperCase());
  name = name || state.focus || undefined;
  if (!name) return ask("Whose order is this? Try “Ravi ke liye do chai”.");
  const found: Array<{ sku: SKU; qty: number; note: string }> = [];
  for (const s of Object.keys(MENU) as SKU[]) {
    const re = new RegExp(
      `(?:(\\d+|${Object.keys(numbers).join("|")})\\s+)?${aliases[s]}`,
      "gi",
    );
    let m;
    while ((m = re.exec(t))) {
      found.push({
        sku: s,
        qty: m[1] ? (numbers[m[1]] ?? Number(m[1])) : 1,
        note: "",
      });
    }
  }
  const cancel = /\b(cancel|remove|hatao|hata|minus)\b|हटाओ|कैंसल/.test(t);
  const paymentAction =
    /\b(paid|payment|udhaar|credit|unpaid)\b|उधार|पेमेंट/.test(t);
  if (paymentAction) {
    if (found.length)
      return ask(
        "Please enter item changes and payment as separate instructions in demo mode.",
      );
    let paymentWords = t.split(name.toLowerCase()).join('');
    paymentWords = paymentWords.replace(/\b(paid|unpaid|payment|not|nahi|nahin|ka|ki|ke|ho|hua|gaya|hai|mark|as|udhaar|mein|me|daal|credit|for|please)\b/g, '').replace(/उधार|पेमेंट|नहीं|हो|गया|है|का|में|डाल/g, '').replace(/[\s.,!?]/g, '');
    if (paymentWords) return ask('Please name the customer and say paid, unpaid, or credit. Demo mode does not handle partial payments.');
    const p = /\b(unpaid|not paid|nahi|nahin)\b|नहीं/.test(t)
      ? "Unpaid"
      : /udhaar|credit|उधार/.test(t)
        ? "Credit"
        : "Paid";
    return {
      actions: [{ type: "payment", customer: name, payment: p }],
      reply: `${name}: marked ${p.toLowerCase()}.`,
      clarification: false,
    };
  }
  if (!found.length)
    return ask(
      "I can help with chai, samosa, vada pav, coffee, or bun maska. Include a quantity and customer.",
    );
  if (found.some((i) => !Number.isInteger(i.qty) || i.qty < 1 || i.qty > 99))
    return ask("Please use a quantity from 1 to 99.");
  if (cancel && found.length > 1)
    return ask(
      "Please cancel one item at a time in demo mode, then add its replacement.",
    );
  if (/\b(instead|replace|nahi|nahin)\b|नहीं/.test(t) && !cancel)
    return ask(
      "Please cancel the original item, then add the replacement in demo mode.",
    );
  const noSugar =
    /no sugar|without sugar|bina (?:shakkar|sugar|chini)|बिना (?:शक्कर|चीनी)/.test(
      t,
    );
  // Fail closed when an instruction contains words outside the documented demo grammar.
  let residual = t;
  if (before) residual = residual.slice(before[0].length);
  if (english) residual = residual.replace(english[0], "");
  if (name) residual = residual.split(name.toLowerCase()).join("");
  for (const pattern of Object.values(aliases))
    residual = residual.replace(new RegExp(pattern, "gi"), " ");
  residual = residual.replace(
    /no sugar|without sugar|bina (?:shakkar|sugar|chini)|बिना (?:शक्कर|चीनी)/g,
    " ",
  );
  residual = residual.replace(
    new RegExp(
      "\\b(?:" +
        Object.keys(numbers)
          .filter((w) => /^[a-z]+$/.test(w))
          .join("|") +
        ")\\b",
      "g",
    ),
    " ",
  );
  residual = residual
    .replace(/एक|दो|तीन|चार|पांच/g, " ")
    .replace(
      /\b(?:add|remove|cancel|hatao|hata|minus|nahi|nahin|aur|and|please|ka|ki|ke|liye|ji|order|to|from)\b/g,
      " ",
    )
    .replace(/हटाओ|कैंसल|नहीं|और/g, " ")
    .replace(/[\d\s.,!?;:'“”‘’]/g, "");
  if (residual.length)
    return ask(
      "Demo mode supports simple orders and cancellations. Please give one clear instruction with a customer, quantity, and menu item, or connect Sarvam for free-form speech.",
    );
  if (/-\s*\d|\d+\.\d+/.test(t))
    return ask("Please use a whole positive quantity from 1 to 99.");
  const actions: Action[] = cancel
    ? [
        {
          type: "remove",
          customer: name,
          sku: found[0].sku,
          qty: found[0].qty,
          ...(noSugar ? { note: "No sugar" } : {}),
        },
      ]
    : [
        {
          type: "add",
          customer: name,
          items: found.map((i) => ({
            ...i,
            note:
              noSugar && ["chai", "coffee"].includes(i.sku) ? "No sugar" : "",
          })),
        },
      ];
  return {
    actions,
    reply: cancel
      ? `Removed ${found[0].qty} ${MENU[found[0].sku].name} from ${name}'s order.`
      : `Added ${found.map((i) => `${i.qty} ${MENU[i.sku].name}`).join(" and ")} for ${name}.`,
    clarification: false,
  };
}
export function executeDemo(
  text: string,
  state: State,
): { state: State; plan: Plan } {
  const plan = parseDemo(text, state);
  try {
    return { state: applyPlan(state, plan), plan };
  } catch (e) {
    if (e instanceof ClarificationError)
      return {
        state,
        plan: { actions: [], clarification: true, reply: e.message },
      };
    throw e;
  }
}

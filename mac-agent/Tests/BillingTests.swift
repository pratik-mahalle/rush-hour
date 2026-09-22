import Foundation

@main struct BillingTests {
    static func main() throws {
        var count = 0
        func check(_ title: String, _ body: () throws -> Void) rethrows {
            try body(); count += 1; print("PASS \(title)")
        }
        func assertThat(_ condition: Bool) { precondition(condition, "Assertion failed") }
        func reject(_ body: () throws -> Void) {
            do { try body(); fatalError("Expected rejection") } catch { }
        }
        func action(_ type: String, _ sku: String, _ quantity: Int, _ note: String? = "") -> BillAction {
            .init(type: type, sku: sku, quantity: quantity, note: note)
        }
        func plan(_ actions: [BillAction]) -> BillPlan { .init(intent: "update", actions: actions, question: "") }
        let initial = BillState()
        let ordered = try applyBill(initial, plan: demoPlan("do chai ek samosa")).state
        check("Hindi example has exact total 60") { assertThat(ordered.total == 60 && ordered.lines.count == 2) }
        let corrected = try applyBill(ordered, plan: demoPlan("ek chai hatao")).state
        check("Correction subtracts exactly one chai") { assertThat(corrected.total == 40 && ordered.total == 60) }
        try check("Total never mutates bill") {
            let result = try applyBill(corrected, plan: .command("total"))
            assertThat(result.state == corrected && result.reply.contains("40 rupees"))
        }
        try check("Checkout retains exact amount and empties next bill") {
            let result = try applyBill(corrected, plan: .command("checkout"))
            assertThat(result.state.total == 0 && result.state.receipts.last?.total == 40 && result.reply.contains("40 rupees"))
        }
        check("Empty checkout is rejected") { reject { _ = try applyBill(initial, plan: .command("checkout")) } }
        check("Unsupported menu item rejected") { reject { _ = try applyBill(initial, plan: plan([action("add", "pizza", 1)])) } }
        check("Failed second action rolls back whole bill") {
            reject { _ = try applyBill(ordered, plan: plan([action("add", "chai", 1), action("remove", "samosa", 10)])) }
            assertThat(ordered.total == 60)
        }
        check("Quantity overflow is rejected") { reject { _ = try applyBill(ordered, plan: plan([action("add", "chai", 99)])) } }
        check("Zero and negative quantities rejected") {
            for quantity in [0, -1, 100] { reject { _ = try applyBill(initial, plan: plan([action("add", "chai", quantity)])) } }
        }
        try check("Set replaces instead of incrementing") {
            assertThat(try applyBill(ordered, plan: plan([action("set", "chai", 3)])).state.total == 80)
        }
        let variants = try applyBill(ordered, plan: plan([action("add", "chai", 1, "No sugar")])).state
        check("Ambiguous variant correction asks for clarification") {
            reject { _ = try applyBill(variants, plan: plan([action("remove", "chai", 1, nil)])) }
        }
        try check("Explicit variant selection preserves other version") {
            let next = try applyBill(variants, plan: plan([action("remove", "chai", 1, "No sugar")])).state
            assertThat(next == ordered)
        }
        check("Clarification cannot hide mutations") {
            reject { _ = try applyBill(initial, plan: .init(intent: "clarify", actions: [action("add", "chai", 1)], question: "Which?")) }
        }
        check("Model cannot supply a price") {
            reject { _ = try BillPlan.parse(Data(#"{"intent":"update","question":"","actions":[{"type":"add","sku":"chai","quantity":1,"price":1}]}"#.utf8)) }
        }
        check("Model cannot supply extra top-level fields") {
            reject { _ = try BillPlan.parse(Data(#"{"intent":"total","question":"","actions":[],"total":1}"#.utf8)) }
        }
        check("Fractional quantities rejected") {
            reject { _ = try BillPlan.parse(Data(#"{"intent":"update","question":"","actions":[{"type":"add","sku":"chai","quantity":1.5}]}"#.utf8)) }
        }
        try check("Saved bills round-trip and validate") {
            let state = try applyBill(ordered, plan: .command("checkout")).state
            let data = try JSONEncoder().encode(state)
            assertThat(try JSONDecoder().decode(BillState.self, from: data).validated() == state)
        }
        check("Corrupt persisted item rejected before total access") {
            reject { _ = try BillState(lines: [.init(sku: "unknown", quantity: 1, note: "")]).validated() }
        }
        try check("Receipt retention stays bounded at 50") {
            var state = initial
            for _ in 0..<55 {
                state = try applyBill(state, plan: plan([action("add", "chai", 1)])).state
                state = try applyBill(state, plan: .command("checkout")).state
            }
            assertThat(state.receipts.count == 50)
        }
        check("Demo doesn't guess free-form speech") { reject { _ = try demoPlan("2 chai and 1 pizza") } }
        print("\(count) billing checks passed.")
    }
}

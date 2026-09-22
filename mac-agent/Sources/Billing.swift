import Foundation

enum BillError: LocalizedError {
    case invalid(String)
    var errorDescription: String? { if case .invalid(let text) = self { return text }; return nil }
}
struct MenuItem: Codable, Equatable {
    let sku: String
    let name: String
    let price: Int
}
let counterMenu = [
    MenuItem(sku: "chai", name: "Masala chai", price: 20),
    MenuItem(sku: "samosa", name: "Samosa", price: 20),
    MenuItem(sku: "vada", name: "Vada pav", price: 30),
    MenuItem(sku: "coffee", name: "Filter coffee", price: 35),
    MenuItem(sku: "bun", name: "Bun maska", price: 35)
]
struct BillLine: Codable, Equatable, Identifiable {
    var sku: String
    var quantity: Int
    var note: String
    var id: String { sku + "|" + note.lowercased() }
    var menuItem: MenuItem { counterMenu.first { $0.sku == sku }! }
    var amount: Int { menuItem.price * quantity }
}
struct Receipt: Codable, Equatable, Identifiable {
    let id: UUID
    let date: Date
    let lines: [BillLine]
    var total: Int { lines.reduce(0) { $0 + $1.amount } }
}
struct BillState: Codable, Equatable {
    var lines: [BillLine] = []
    var receipts: [Receipt] = []
    var total: Int { lines.reduce(0) { $0 + $1.amount } }
    func validated() throws -> BillState {
        for group in [lines] + receipts.map(\.lines) {
            guard group.count <= 30, Set(group.map(\.id)).count == group.count else {
                throw BillError.invalid("This bill has too many or duplicate item variants.")
            }
            for line in group {
                guard counterMenu.contains(where: { $0.sku == line.sku }),
                      (1...99).contains(line.quantity), line.note.count <= 100 else {
                    throw BillError.invalid("An item or quantity is outside the menu limits.")
                }
            }
        }
        guard receipts.count <= 50 else { throw BillError.invalid("Too many saved receipts.") }
        return self
    }
}
struct BillAction: Codable, Equatable {
    let type: String
    let sku: String
    let quantity: Int
    let note: String?
}
struct BillPlan: Codable {
    let intent: String
    let actions: [BillAction]
    let question: String
    static func command(_ intent: String) -> BillPlan { .init(intent: intent, actions: [], question: "") }
    static func parse(_ data: Data) throws -> BillPlan {
        guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              Set(object.keys) == ["intent", "actions", "question"],
              let actions = object["actions"] as? [[String: Any]], actions.count <= 20 else {
            throw BillError.invalid("The assistant returned an invalid instruction. Please repeat it.")
        }
        for action in actions {
            guard Set(action.keys).isSubset(of: ["type", "sku", "quantity", "note"]),
                  Set(action.keys).isSuperset(of: ["type", "sku", "quantity"]) else {
                throw BillError.invalid("The assistant returned an unsupported item change.")
            }
        }
        let plan = try JSONDecoder().decode(BillPlan.self, from: data)
        guard ["update", "total", "checkout", "undo", "clarify", "ignore"].contains(plan.intent),
              plan.question.count <= 240,
              plan.intent == "update" || plan.actions.isEmpty,
              plan.intent != "update" || !plan.actions.isEmpty,
              plan.intent != "clarify" || !plan.question.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw BillError.invalid("The assistant returned an inconsistent instruction.")
        }
        return plan
    }
}
struct BillResult {
    let state: BillState
    let reply: String
}
func applyBill(_ state: BillState, plan: BillPlan) throws -> BillResult {
    _ = try state.validated()
    // Apply only validated plans, including plans supplied by local controls.
    let plan = try BillPlan.parse(JSONEncoder().encode(plan))
    var next = state
    switch plan.intent {
    case "clarify": return .init(state: state, reply: plan.question)
    case "ignore": return .init(state: state, reply: "")
    case "total": return .init(state: state, reply: "Your total is \(state.total) rupees.")
    case "undo": throw BillError.invalid("Undo needs the previous bill snapshot.")
    case "checkout":
        guard !state.lines.isEmpty else { throw BillError.invalid("There is no order to finish yet.") }
        next.receipts.append(.init(id: UUID(), date: Date(), lines: state.lines))
        next.receipts = Array(next.receipts.suffix(50))
        next.lines = []
        return .init(state: next, reply: "Final amount: \(state.total) rupees. Ready for the next order.")
    case "update":
        for action in plan.actions {
            guard ["add", "remove", "set"].contains(action.type),
                  counterMenu.contains(where: { $0.sku == action.sku }),
                  (1...99).contains(action.quantity), (action.note?.count ?? 0) <= 100 else {
                throw BillError.invalid("Please use a menu item and a quantity from 1 to 99.")
            }
            let matches = next.lines.indices.filter {
                next.lines[$0].sku == action.sku && (action.note == nil ||
                    next.lines[$0].note.caseInsensitiveCompare(action.note!) == .orderedSame)
            }
            if action.type == "add" {
                let note = action.note ?? ""
                if let index = next.lines.firstIndex(where: { $0.sku == action.sku && $0.note.caseInsensitiveCompare(note) == .orderedSame }) {
                    next.lines[index].quantity += action.quantity
                } else { next.lines.append(.init(sku: action.sku, quantity: action.quantity, note: note)) }
            } else {
                guard matches.count == 1, let index = matches.first else {
                    throw BillError.invalid(matches.isEmpty ? "That item is not on this bill yet." : "Which version of that item should I change?")
                }
                if action.type == "remove" {
                    guard next.lines[index].quantity >= action.quantity else {
                        throw BillError.invalid("There aren't that many on the bill. How many should remain?")
                    }
                    next.lines[index].quantity -= action.quantity
                    if next.lines[index].quantity == 0 { next.lines.remove(at: index) }
                } else { next.lines[index].quantity = action.quantity }
            }
        }
        _ = try next.validated()
        let items = next.lines.map { "\($0.quantity) \($0.menuItem.name)\($0.note.isEmpty ? "" : ", \($0.note)")" }.joined(separator: "; ")
        return .init(state: next, reply: next.lines.isEmpty ? "The bill is empty now." : "\(items). Total: \(next.total) rupees.")
    default: throw BillError.invalid("Please repeat the order.")
    }
}

// This limited fixture parser is deliberately separate from the live Sarvam path.
func demoPlan(_ text: String) throws -> BillPlan {
    let t = text.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    if ["total", "total kitna", "total kitna?", "total kitna hua?"].contains(t) { return .command("total") }
    if ["next customer", "finish order", "next order"].contains(t) { return .command("checkout") }
    if ["undo", "undo that"].contains(t) { return .command("undo") }
    if ["do chai ek samosa", "2 chai and 1 samosa"].contains(t) {
        return .init(intent: "update", actions: [.init(type: "add", sku: "chai", quantity: 2, note: ""), .init(type: "add", sku: "samosa", quantity: 1, note: "")], question: "")
    }
    if ["ek chai hatao", "remove 1 chai"].contains(t) {
        return .init(intent: "update", actions: [.init(type: "remove", sku: "chai", quantity: 1, note: nil)], question: "")
    }
    throw BillError.invalid("Demo understands the example buttons, total, undo and next customer. Connect Sarvam for free-form speech.")
}

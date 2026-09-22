import AppKit
import SwiftUI
import AVFoundation

@MainActor
final class CounterModel: ObservableObject {
    @Published var bill = BillState()
    @Published var listening = false
    @Published var connecting = false
    @Published var busy = false
    @Published var speaking = false
    @Published var hasKey = false
    @Published var reply = "Your counter, on call."
    @Published var transcript = ""
    @Published var partial = ""
    @Published var error = ""
    @Published var voice = true
    @Published var showSetup = false
    @Published var demo = false
    @Published var keyEntry = ""
    @Published var typed = ""
    @Published var turns: [String] = []
    @Published var lastLatency = ""
    private let listener = LiveListener()
    private var key = ""
    private var previous: [BillState] = []
    private var savedLiveState: BillState?
    private var history: [[String: String]] = []
    private var queue: [String] = []
    private var processing: Task<Void, Never>?
    private var starting: Task<Void, Never>?
    private var audio: AVAudioPlayer?
    private let promptVoice = AVSpeechSynthesizer()
    private var askWhenReady = false
    private var epoch = UUID()
    private let storage: URL
    private var observers: [NSObjectProtocol] = []
    var totalLabel: String { "₹\(bill.total)" }
    var canUndo: Bool { !previous.isEmpty && !busy }
    var status: String {
        if connecting { return "Connecting to Sarvam" }
        if speaking { return "Speaking · mic paused" }
        if busy { return "Updating your bill" }
        if listening { return "Listening in the background" }
        return demo ? "Demo · microphone off" : "Microphone off"
    }
    init() {
        storage = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("RushHourCounter/bill.json")
        if let data = try? Data(contentsOf: storage) {
            do { bill = try JSONDecoder().decode(BillState.self, from: data).validated() }
            catch { self.error = "Couldn't restore the saved bill. The original file has not been overwritten." }
        }
        // Keychain is only read when the user chooses Connect or Start listening.
        hasKey = UserDefaults.standard.bool(forKey: "RushHourHasKey")
        listener.onPartial = { [weak self] in self?.partial = $0 }
        listener.onFinal = { [weak self] text in self?.partial = ""; self?.submit(text) }
        listener.onReady = { [weak self] in
            guard let self else { return }
            self.connecting = false; self.listening = true
            if self.askWhenReady {
                self.askWhenReady = false
                self.announce("What would you like to order?")
            }
        }
        listener.onFailure = { [weak self] message in self?.pause(); self?.error = message }
        observers.append(NSWorkspace.shared.notificationCenter.addObserver(forName: NSWorkspace.willSleepNotification, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.pause(); self?.reply = "Paused for sleep. Start listening when you're back." }
        })
        observers.append(NotificationCenter.default.addObserver(forName: .AVAudioEngineConfigurationChange, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in
                guard let self, self.listening else { return }
                self.pause(); self.error = "Audio device changed. Start listening to use the new microphone."
            }
        })
    }
    func saveKey() {
        let candidate = keyEntry.trimmingCharacters(in: .whitespacesAndNewlines)
        guard (10...300).contains(candidate.count), !candidate.contains("\n") else {
            error = "Paste a valid Sarvam API key."; return
        }
        do {
            try KeyStore.save(candidate)
            pause()
            leaveDemo()
            key = candidate; hasKey = true; keyEntry = ""; showSetup = false; error = ""
            UserDefaults.standard.set(true, forKey: "RushHourHasKey")
            reply = "Key saved. Start listening when you're ready."
        } catch { self.error = error.localizedDescription }
    }
    func forgetKey() {
        pause()
        do {
            try KeyStore.remove()
            key = ""; hasKey = false; keyEntry = ""; error = ""
            UserDefaults.standard.set(false, forKey: "RushHourHasKey")
        } catch { self.error = error.localizedDescription }
    }
    func enableDemo() {
        pause()
        if !demo { savedLiveState = bill; bill = BillState() }
        previous = []; history = []; turns = []; transcript = ""
        demo = true; error = ""; showSetup = false
        reply = "Demo mode. Use the example buttons or type their text."
    }
    private func leaveDemo() {
        if demo { bill = savedLiveState ?? BillState(); savedLiveState = nil; previous = []; history = []; turns = []; transcript = "" }
        demo = false
    }
    func askForOrder() {
        guard !busy, !connecting else { return }
        if listening { announce("What would you like to order?") }
        else { start(promptForOrder: true) }
    }
    private func announce(_ text: String) {
        guard !busy else { return }
        reply = text; busy = true; speaking = true; listener.muted = true
        let id = epoch
        processing = Task { [weak self] in
            guard let self else { return }
            let utterance = AVSpeechUtterance(string: text)
            utterance.voice = AVSpeechSynthesisVoice(language: "en-IN")
            self.promptVoice.speak(utterance)
            do {
                try await Task.sleep(for: .milliseconds(100))
                while self.promptVoice.isSpeaking, !Task.isCancelled, self.epoch == id {
                    try await Task.sleep(for: .milliseconds(80))
                }
                try await Task.sleep(for: .milliseconds(400))
            } catch { }
            guard self.epoch == id else { return }
            self.speaking = false; self.busy = false; self.listener.muted = false
            self.processing = nil
            if !self.queue.isEmpty { self.drain() }
        }
    }
    func start(promptForOrder: Bool = false) {
        guard !listening, !connecting, !busy else { return }
        key = KeyStore.load() ?? ""
        guard !key.isEmpty else {
            hasKey = false
            if promptForOrder {
                error = "Connect your Sarvam key: right-click the Rush icon → Connection settings."
                announce("Connect your Sarvam key first. Right click the Rush icon and choose Connection settings.")
            } else { showSetup = true }
            return
        }
        askWhenReady = promptForOrder
        leaveDemo(); error = ""; connecting = true
        let id = epoch
        starting = Task {
            do { try await listener.start(key: key) }
            catch {
                guard epoch == id, !Task.isCancelled else { return }
                pause(); self.error = error.localizedDescription
            }
        }
    }
    func pause() {
        epoch = UUID()
        starting?.cancel(); starting = nil
        processing?.cancel(); processing = nil
        listener.stop()
        audio?.stop(); audio = nil
        promptVoice.stopSpeaking(at: .immediate); askWhenReady = false
        queue.removeAll(); connecting = false; listening = false; busy = false; speaking = false; partial = ""
    }
    func submitTyped() {
        let text = typed.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        typed = ""; submit(text)
    }
    func submit(_ raw: String) {
        let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, text.count <= 2000 else { return }
        guard queue.count < 8 else { pause(); error = "Too many pending turns. Please repeat the latest order."; return }
        if !demo && key.isEmpty { key = KeyStore.load() ?? "" }
        guard demo || !key.isEmpty else { showSetup = true; return }
        queue.append(text)
        drain()
    }
    private func drain() {
        guard processing == nil else { return }
        let id = epoch
        processing = Task { [weak self] in
            guard let self else { return }
            defer {
                if self.epoch == id { self.processing = nil; self.busy = false }
            }
            while !self.queue.isEmpty, !Task.isCancelled, self.epoch == id {
                let text = self.queue.removeFirst()
                self.busy = true; self.error = ""; self.transcript = text
                let start = Date()
                do {
                    let plan: BillPlan
                    if self.demo { plan = try demoPlan(text) }
                    else { plan = try await SarvamClient(key: self.key).plan(text: text, state: self.bill, history: self.history) }
                    guard !Task.isCancelled, self.epoch == id else { return }
                    let answer = try self.commit(plan)
                    self.lastLatency = String(format: "%.1fs", Date().timeIntervalSince(start))
                    if !answer.isEmpty {
                        self.reply = answer
                        self.turns = Array((self.turns + ["You: \(text)", "Rush: \(answer)"]).suffix(20))
                        if plan.intent == "checkout" { self.history = [] }
                        else {
                            self.history += [["role": "user", "content": text], ["role": "assistant", "content": answer]]
                            self.history = Array(self.history.suffix(10))
                        }
                        if self.voice && !self.demo { await self.speak(answer, id: id) }
                    }
                } catch {
                    guard !Task.isCancelled, self.epoch == id else { return }
                    self.error = error.localizedDescription
                }
            }
        }
    }
    private func persist(_ state: BillState) throws {
        if demo { return }
        let folder = storage.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        try JSONEncoder().encode(state).write(to: storage, options: .atomic)
    }
    private func commit(_ plan: BillPlan) throws -> String {
        if plan.intent == "undo" {
            guard let old = previous.last else { throw BillError.invalid("Nothing to undo yet.") }
            try persist(old)
            previous.removeLast(); bill = old
            history = []
            return "Undone. Your total is \(bill.total) rupees."
        }
        let result = try applyBill(bill, plan: plan)
        if result.state != bill {
            try persist(result.state)
            previous.append(bill); previous = Array(previous.suffix(30))
            bill = result.state
        }
        return result.reply
    }
    func command(_ intent: String) {
        guard !busy, !connecting else { return }
        do {
            error = ""
            let answer = try commit(.command(intent))
            reply = answer
            if intent == "checkout" || intent == "undo" { history = [] }
            let id = epoch
            if voice && !demo && !key.isEmpty {
                busy = true
                processing = Task { [weak self] in
                    guard let self else { return }
                    await self.speak(answer, id: id)
                    if self.epoch == id { self.busy = false; self.processing = nil; if !self.queue.isEmpty { self.drain() } }
                }
            }
        } catch { self.error = error.localizedDescription }
    }
    private func speak(_ text: String, id: UUID) async {
        do {
            let data = try await SarvamClient(key: key).speech(text)
            guard !Task.isCancelled, epoch == id, voice else { return }
            let player = try AVAudioPlayer(data: data)
            audio = player; listener.muted = true; speaking = true
            guard player.play() else { throw BillError.invalid("Couldn't play the spoken reply.") }
            while player.isPlaying && !Task.isCancelled && epoch == id {
                try await Task.sleep(for: .milliseconds(80))
            }
            // Allow the loudspeaker tail to decay before accepting the next turn.
            try await Task.sleep(for: .milliseconds(400))
        } catch {
            if !Task.isCancelled, epoch == id { self.error = "Bill updated. Spoken reply unavailable: \(error.localizedDescription)" }
        }
        if epoch == id { audio?.stop(); audio = nil; listener.muted = false; speaking = false }
    }
    func exportReceipt() {
        let lines: [BillLine]
        let title: String
        if !bill.lines.isEmpty { lines = bill.lines; title = "Current bill" }
        else if let last = bill.receipts.last { lines = last.lines; title = "Completed bill · \(last.date.formatted())" }
        else { error = "There is no bill to export yet."; return }
        let text = "RUSH HOUR COUNTER\n\(title)\n\n" + lines.map {
            "\($0.quantity) × \($0.menuItem.name)\($0.note.isEmpty ? "" : " (\($0.note))") — ₹\($0.amount)"
        }.joined(separator: "\n") + "\n\nTOTAL ₹\(lines.reduce(0) { $0 + $1.amount })\nPayment not recorded.\n"
        let panel = NSSavePanel()
        panel.nameFieldStringValue = "rush-hour-bill.txt"
        guard panel.runModal() == .OK, let url = panel.url else { return }
        do { try text.write(to: url, atomically: true, encoding: .utf8) }
        catch { self.error = "Couldn't export the bill: \(error.localizedDescription)" }
    }
}

import SwiftUI
import AppKit
import Combine

private let lime = Color(red: 0.83, green: 0.96, blue: 0.42)
private let ink = Color(red: 0.075, green: 0.085, blue: 0.075)

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    private let model = CounterModel()
    private var item: NSStatusItem!
    private var counterWindow: NSWindow?
    private var observation: AnyCancellable?

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
    func applicationDidFinishLaunching(_ notification: Notification) {
        item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = item.button {
            button.target = self
            button.action = #selector(iconClicked(_:))
            button.sendAction(on: [.leftMouseUp, .rightMouseUp])
            button.setAccessibilityLabel("Rush Hour — ask for an order. Right-click for settings.")
        }
        observation = model.objectWillChange.sink { [weak self] _ in
            DispatchQueue.main.async { self?.updateIcon() }
        }
        updateIcon()
        installMainMenu()
        // No window is created on launch; launching the app is a voice invocation.
        askForOrder()
    }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        askForOrder()
        return false
    }
    func applicationDockMenu(_ sender: NSApplication) -> NSMenu? { controlsMenu() }
    func applicationWillTerminate(_ notification: Notification) { model.pause() }
    private func updateIcon() {
        item?.button?.image = NSImage(systemSymbolName: model.listening ? "waveform.circle.fill" : "waveform.circle", accessibilityDescription: "Rush Hour")
        item?.button?.title = " \(model.totalLabel)"
        item?.button?.toolTip = "\(model.status). Click to order. Right-click for bill and settings.\(model.error.isEmpty ? "" : " \(model.error)")"
    }
    @objc private func iconClicked(_ sender: NSStatusBarButton) {
        if let event = NSApp.currentEvent, event.type == .rightMouseUp || event.modifierFlags.contains(.control) {
            NSMenu.popUpContextMenu(controlsMenu(), with: event, for: sender)
        } else { askForOrder() }
    }
    @objc func askForOrder() {
        // Explicitly viewing settings is the only route that opens the panel.
        if model.showSetup { model.showSetup = false }
        counterWindow?.orderOut(nil)
        model.askForOrder()
    }
    @objc private func viewBill() {
        if counterWindow == nil {
            let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 440, height: 760),
                styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
            window.title = "Rush Hour Counter"
            window.identifier = NSUserInterfaceItemIdentifier("counter")
            window.isReleasedWhenClosed = false
            window.minSize = NSSize(width: 410, height: 640)
            window.contentView = NSHostingView(rootView: CounterView(model: model))
            window.center()
            counterWindow = window
        }
        counterWindow?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }
    @objc private func settings() { viewBill(); model.showSetup = true }
    @objc private func pauseListening() { model.pause() }
    @objc private func readTotal() { model.command("total") }
    @objc private func quit() { NSApp.terminate(nil) }
    private func menuItem(_ title: String, _ action: Selector, key: String = "") -> NSMenuItem {
        let entry = NSMenuItem(title: title, action: action, keyEquivalent: key)
        entry.target = self
        return entry
    }
    private func controlsMenu() -> NSMenu {
        let menu = NSMenu()
        menu.addItem(NSMenuItem(title: "\(model.status) · \(model.totalLabel)", action: nil, keyEquivalent: ""))
        if !model.error.isEmpty { menu.addItem(NSMenuItem(title: model.error, action: nil, keyEquivalent: "")) }
        menu.addItem(.separator())
        menu.addItem(menuItem("Ask for an order", #selector(askForOrder)))
        menu.addItem(menuItem("Pause listening", #selector(pauseListening)))
        menu.addItem(menuItem("Read total", #selector(readTotal)))
        menu.addItem(.separator())
        menu.addItem(menuItem("View bill", #selector(viewBill)))
        menu.addItem(menuItem("Connection settings…", #selector(settings)))
        menu.addItem(menuItem("Quit Rush Hour", #selector(quit)))
        return menu
    }
    private func installMainMenu() {
        let root = NSMenu()
        let appEntry = NSMenuItem()
        let menu = controlsMenu()
        menu.items.last?.keyEquivalent = "q"
        appEntry.submenu = menu
        root.addItem(appEntry)
        let edit = NSMenuItem(title: "Edit", action: nil, keyEquivalent: "")
        let editMenu = NSMenu(title: "Edit")
        for (title, action, key) in [("Cut", "cut:", "x"), ("Copy", "copy:", "c"), ("Paste", "paste:", "v"), ("Select All", "selectAll:", "a")] {
            editMenu.addItem(NSMenuItem(title: title, action: Selector(action), keyEquivalent: key))
        }
        edit.submenu = editMenu
        root.addItem(edit)
        NSApp.mainMenu = root
    }
}

@main
struct RushHourCounterApp {
    @MainActor static func main() {
        let app = NSApplication.shared
        let delegate = AppDelegate()
        app.setActivationPolicy(.regular)
        app.delegate = delegate
        withExtendedLifetime(delegate) { app.run() }
    }
}

struct CounterView: View {
    @ObservedObject var model: CounterModel
    @State private var showHistory = false
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                HStack(spacing: 10) {
                    Image(systemName: "waveform").font(.title2.weight(.bold)).foregroundStyle(lime)
                        .frame(width: 42, height: 42).background(lime.opacity(0.1), in: RoundedRectangle(cornerRadius: 13))
                    VStack(alignment: .leading, spacing: 3) {
                        Text("RUSH HOUR").font(.system(size: 12, weight: .black, design: .monospaced)).tracking(2)
                        Text("Your little counter assistant").font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button { model.showSetup.toggle() } label: { Image(systemName: "slider.horizontal.3").font(.title3) }
                        .buttonStyle(.plain).accessibilityLabel("Connection settings").help("Connection settings")
                }
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 7) {
                        Circle().fill(model.listening ? lime : Color.gray).frame(width: 7, height: 7)
                        Text(model.status.uppercased()).font(.system(size: 10, weight: .semibold, design: .monospaced)).tracking(0.7)
                            .foregroundStyle(model.listening ? lime : .secondary)
                        Spacer()
                        if !model.lastLatency.isEmpty { Text(model.lastLatency).font(.caption.monospacedDigit()).foregroundStyle(.secondary) }
                    }
                    Text(model.partial.isEmpty ? (model.transcript.isEmpty ? "“Do chai, ek samosa.”" : "“\(model.transcript)”") : model.partial)
                        .font(.system(size: 25, weight: .medium, design: .rounded)).fixedSize(horizontal: false, vertical: true)
                    Text(model.reply).font(.system(size: 13)).foregroundStyle(Color.white.opacity(0.64))
                        .fixedSize(horizontal: false, vertical: true).textSelection(.enabled)
                }.frame(maxWidth: .infinity, alignment: .leading)
                receipt
                VStack(spacing: 10) {
                    Button {
                        if model.listening || model.connecting { model.pause() } else { model.start() }
                    } label: {
                        HStack {
                            Image(systemName: model.listening || model.connecting ? "pause.fill" : "mic.fill")
                            Text(model.listening || model.connecting ? "Pause listening" : "Start listening").fontWeight(.semibold)
                            Spacer()
                            Image(systemName: "waveform")
                        }.padding(15).foregroundStyle(ink).background(lime, in: RoundedRectangle(cornerRadius: 12))
                    }.buttonStyle(.plain).disabled(model.busy && !model.listening)
                    Text(model.listening ? "You can close this window. Rush stays in the menu bar." : "Start once. Speak orders hands-free while your Mac is awake.")
                        .font(.caption).foregroundStyle(.secondary).multilineTextAlignment(.center)
                }
                if !model.error.isEmpty {
                    Label(model.error, systemImage: "exclamationmark.circle")
                        .font(.caption).foregroundStyle(Color(red: 1, green: 0.71, blue: 0.48))
                        .fixedSize(horizontal: false, vertical: true).textSelection(.enabled)
                        .padding(12).frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.orange.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
                }
                HStack {
                    TextField("Or type an order…", text: $model.typed).textFieldStyle(.plain).onSubmit { model.submitTyped() }
                        .accessibilityLabel("Order instruction")
                    Button { model.submitTyped() } label: { Image(systemName: "arrow.up.circle.fill").font(.title2) }
                        .buttonStyle(.plain).foregroundStyle(lime).disabled(model.typed.trimmingCharacters(in: .whitespaces).isEmpty || model.busy)
                        .accessibilityLabel("Send order")
                }.padding(12).background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 10))
                if model.demo {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("TRY THE FLOW · NO API CALLS").font(.system(size: 10, weight: .bold, design: .monospaced)).foregroundStyle(lime)
                        HStack {
                            Button("2 chai + 1 samosa") { model.submit("2 chai and 1 samosa") }
                            Button("Remove 1 chai") { model.submit("remove 1 chai") }
                        }.disabled(model.busy)
                    }
                } else if !model.hasKey {
                    Button("Try a demo first") { model.enableDemo() }.buttonStyle(.plain).foregroundStyle(lime)
                }
                HStack {
                    Toggle("Spoken replies", isOn: $model.voice).toggleStyle(.switch).controlSize(.small)
                    Spacer()
                    Button("Activity") { showHistory.toggle() }.buttonStyle(.plain).foregroundStyle(.secondary)
                }.font(.caption)
                if showHistory {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("RECENT TURNS").font(.caption.bold())
                        ForEach(Array(model.turns.enumerated()), id: \.offset) { _, turn in Text(turn).font(.caption).textSelection(.enabled) }
                        if let last = model.bill.receipts.last {
                            Divider()
                            Text("Last bill: ₹\(last.total) · \(last.date.formatted(date: .omitted, time: .shortened))")
                                .font(.caption).foregroundStyle(lime)
                        }
                        Text("\(model.bill.receipts.count) completed bills saved · payment not recorded").font(.caption2).foregroundStyle(.secondary)
                    }.padding(12).frame(maxWidth: .infinity, alignment: .leading).background(Color.white.opacity(0.04), in: RoundedRectangle(cornerRadius: 10))
                }
                Text("SARVAM VOICE  /  EXACT BILLING").font(.system(size: 9, weight: .medium, design: .monospaced))
                    .tracking(1.4).foregroundStyle(.secondary).frame(maxWidth: .infinity)
            }.padding(24)
        }
        .frame(minWidth: 410, idealWidth: 440, maxWidth: .infinity, minHeight: 640)
        .background(ink).preferredColorScheme(.dark)
        .sheet(isPresented: $model.showSetup) { settings }
    }
    private var receipt: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("CURRENT BILL").font(.system(size: 10, weight: .bold, design: .monospaced)).tracking(1.3)
                Spacer()
                Text("\(model.bill.lines.reduce(0) { $0 + $1.quantity }) items").font(.caption)
            }.foregroundStyle(.black.opacity(0.55))
            if model.bill.lines.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "cup.and.saucer").font(.system(size: 28)).foregroundStyle(.black.opacity(0.35))
                    Text("Ready for an order").font(.system(size: 15, weight: .medium))
                    Text("Chai ₹20 · Samosa ₹20 · Vada pav ₹30\nCoffee ₹35 · Bun maska ₹35")
                        .font(.caption).foregroundStyle(.black.opacity(0.6)).multilineTextAlignment(.center)
                }.frame(maxWidth: .infinity).padding(.vertical, 12)
            } else {
                ForEach(model.bill.lines) { line in
                    HStack(alignment: .top) {
                        Text("\(line.quantity)×").font(.system(size: 13, weight: .bold, design: .monospaced)).frame(width: 28, alignment: .leading)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(line.menuItem.name).font(.system(size: 14, weight: .medium))
                            if !line.note.isEmpty { Text(line.note).font(.caption).foregroundStyle(.black.opacity(0.6)) }
                        }
                        Spacer()
                        Text("₹\(line.amount)").font(.system(size: 14, weight: .medium, design: .monospaced))
                    }
                }
            }
            Rectangle().fill(.black.opacity(0.12)).frame(height: 1)
            HStack(alignment: .firstTextBaseline) {
                Text("Total").font(.system(size: 16, weight: .medium))
                Spacer()
                Text(model.totalLabel).font(.system(size: 36, weight: .semibold, design: .rounded)).monospacedDigit()
            }
            HStack {
                Button("Read total") { model.command("total") }
                Button("Undo") { model.command("undo") }.disabled(!model.canUndo)
                Spacer()
                Button { model.exportReceipt() } label: { Image(systemName: "square.and.arrow.up") }.accessibilityLabel("Export receipt")
                Button("Next customer") { model.command("checkout") }.disabled(model.bill.lines.isEmpty)
            }.font(.caption).buttonStyle(.bordered).tint(.black).disabled(model.busy || model.connecting)
        }.padding(20).foregroundStyle(ink).background(Color(red: 0.95, green: 0.94, blue: 0.89), in: RoundedRectangle(cornerRadius: 15))
            .environment(\.colorScheme, .light)
    }
    private var settings: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack { Text("Connect your counter").font(.title2.bold()); Spacer(); Button("Done") { model.showSetup = false } }
            Text("Add your Sarvam API key to enable live Hindi, Marathi and English orders. The key is stored in macOS Keychain.")
                .font(.callout).foregroundStyle(.secondary)
            SecureField("Sarvam API key", text: $model.keyEntry).textFieldStyle(.roundedBorder).onSubmit { model.saveKey() }
            HStack {
                Button("Save key") { model.saveKey() }.buttonStyle(.borderedProminent).tint(lime).foregroundStyle(ink)
                if model.hasKey { Button("Forget key") { model.forgetKey() } }
                Spacer()
                Button("Use demo") { model.enableDemo() }
            }
            Divider()
            Label("When listening is on, microphone audio streams to Sarvam, including surrounding speech. API usage is billed by Sarvam.", systemImage: "mic")
                .font(.caption).foregroundStyle(.secondary)
            Text("Audio is not saved by this app. Bills stay on this Mac. Listening pauses during replies, sleep or a connection failure. This version has no wake word.")
                .font(.caption).foregroundStyle(.secondary)
            if !model.error.isEmpty { Text(model.error).font(.caption).foregroundStyle(.orange) }
        }.padding(26).frame(width: 440).preferredColorScheme(.dark)
    }
}

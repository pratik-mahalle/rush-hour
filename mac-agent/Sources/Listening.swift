import Foundation
import AVFoundation

@MainActor
final class LiveListener {
    var onPartial: (String) -> Void = { _ in }
    var onFinal: (String) -> Void = { _ in }
    var onReady: () -> Void = {}
    var onFailure: (String) -> Void = { _ in }
    var muted = false
    private var engine: AVAudioEngine?
    private var socket: URLSessionWebSocketTask?
    private var receiveTask: Task<Void, Never>?
    private var pingTask: Task<Void, Never>?
    private var deadlineTask: Task<Void, Never>?
    private var sender: Task<Void, Never>?
    private var queue: [Data] = []
    private var generation = UUID()
    private var ready = false

    func start(key: String) async throws {
        stop()
        let id = generation
        let permission = await AVCaptureDevice.requestAccess(for: .audio)
        guard generation == id else { throw CancellationError() }
        guard permission else { throw BillError.invalid("Allow Rush Hour Counter in System Settings → Privacy & Security → Microphone.") }
        var url = URLComponents(string: "wss://api.sarvam.ai/speech-to-text-realtime/ws")!
        url.queryItems = ["language_code": "auto", "model": "saaras:v4", "mode": "codemix",
            "stream_type": "fast", "encoding": "linear16", "sample_rate": "16000", "endpointing": "vad",
            "silence_duration_ms": "650", "min_speech_duration_ms": "250",
            "prompt": "Masala chai, samosa, vada pav, filter coffee, bun maska"].map { .init(name: $0.key, value: $0.value) }
        var request = URLRequest(url: url.url!)
        request.setValue(key, forHTTPHeaderField: "api-subscription-key")
        request.timeoutInterval = 20
        let ws = URLSession.shared.webSocketTask(with: request)
        socket = ws
        ws.resume()
        receiveTask = Task { [weak self] in
            do {
                while !Task.isCancelled {
                    let message = try await ws.receive()
                    guard let self, self.generation == id else { return }
                    let data: Data
                    switch message {
                    case .string(let text): data = Data(text.utf8)
                    case .data(let bytes): data = bytes
                    @unknown default: continue
                    }
                    guard data.count < 100_000,
                          let event = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                          let kind = event["event"] as? String else { continue }
                    switch kind {
                    case "session.begin":
                        if !self.ready {
                            try self.capture(id: id)
                            self.ready = true
                            self.deadlineTask?.cancel()
                            self.onReady()
                        }
                    case "transcript.partial":
                        if !self.muted, let text = event["text"] as? String { self.onPartial(text) }
                    case "transcript.final":
                        if !self.muted, let text = event["text"] as? String,
                           !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { self.onFinal(text) }
                    case "error":
                        let code = event["code"] as? String ?? "unknown"
                        self.fail("Speech service error (\(code)). Check your key, credits and realtime access.")
                        return
                    case "session.end":
                        self.fail("The speech session ended. Start listening to reconnect.")
                        return
                    default: break
                    }
                }
            } catch {
                guard let self, self.generation == id, !Task.isCancelled else { return }
                self.fail("Speech connection lost. Check your connection and Sarvam key, then start listening again.")
            }
        }
        deadlineTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(20))
            guard !Task.isCancelled, let self, self.generation == id, !self.ready else { return }
            self.fail("Speech connection timed out. Check Sarvam realtime access and try again.")
        }
        pingTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(15))
                guard !Task.isCancelled, let self, self.generation == id else { return }
                do { try await ws.send(.string("{\"event\":\"ping\"}")) }
                catch { self.fail("Speech connection lost. Start listening to reconnect."); return }
            }
        }
    }
    private func capture(id: UUID) throws {
        let engine = AVAudioEngine()
        let input = engine.inputNode
        let native = input.outputFormat(forBus: 0)
        guard native.sampleRate > 0, native.channelCount > 0,
              let output = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: 16000, channels: 1, interleaved: true),
              let converter = AVAudioConverter(from: native, to: output) else {
            throw BillError.invalid("No microphone is available. Connect one and try again.")
        }
        input.installTap(onBus: 0, bufferSize: 4096, format: native) { [weak self] buffer, _ in
            let capacity = AVAudioFrameCount(Double(buffer.frameLength) * 16000 / native.sampleRate) + 32
            guard let converted = AVAudioPCMBuffer(pcmFormat: output, frameCapacity: capacity) else { return }
            var consumed = false
            var error: NSError?
            converter.convert(to: converted, error: &error) { _, status in
                if consumed { status.pointee = .noDataNow; return nil }
                consumed = true
                status.pointee = .haveData
                return buffer
            }
            guard error == nil, converted.frameLength > 0, let samples = converted.int16ChannelData?[0] else { return }
            let bytes = Data(bytes: samples, count: Int(converted.frameLength) * 2)
            Task { @MainActor [weak self] in
                guard let self, self.generation == id else { return }
                self.send(self.muted ? Data(count: bytes.count) : bytes, id: id)
            }
        }
        self.engine = engine
        do { engine.prepare(); try engine.start() }
        catch { input.removeTap(onBus: 0); self.engine = nil; throw error }
    }
    private func send(_ data: Data, id: UUID) {
        guard let ws = socket else { return }
        guard queue.count < 8 else {
            fail("Audio upload can't keep up. Listening paused; check your connection.")
            return
        }
        queue.append(data)
        guard sender == nil else { return }
        sender = Task { [weak self] in
            guard let self else { return }
            defer { if self.generation == id { self.sender = nil } }
            do {
                while self.generation == id, !Task.isCancelled, !self.queue.isEmpty {
                    let chunk = self.queue.removeFirst()
                    let json = "{\"event\":\"audio_input\",\"audio\":\"\(chunk.base64EncodedString())\"}"
                    try await ws.send(.string(json))
                }
            } catch { if self.generation == id { self.fail("Audio upload failed. Start listening to reconnect.") } }
        }
    }
    private func fail(_ message: String) { stop(); onFailure(message) }
    func stop() {
        generation = UUID()
        engine?.stop()
        engine?.inputNode.removeTap(onBus: 0)
        engine = nil
        receiveTask?.cancel(); receiveTask = nil
        pingTask?.cancel(); pingTask = nil
        deadlineTask?.cancel(); deadlineTask = nil
        sender?.cancel(); sender = nil
        socket?.cancel(with: .normalClosure, reason: nil); socket = nil
        queue.removeAll(); ready = false; muted = false
    }
}

"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  applyPlan,
  emptyState,
  executeDemo,
  sampleState,
  planSchema,
  stateSchema,
} from "./domain";
import type { State, Plan, Action } from "./domain";
import { scenarios } from "./scenarios";
import type { Scenario, EvalResult } from "./scenarios";
export type Trace = {
  id: string;
  at: string;
  input: string;
  reply: string;
  source: string;
  actions: Action[];
  before: State;
  after: State;
  outcome: "applied" | "clarification" | "error" | "undo" | "reset";
  latency: number;
  stt?: number;
  tts?: number;
};
export type Message = { role: "user" | "assistant"; content: string };
export function download(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const responseSchemas = {
  "/api/agent": z.object({
    plan: planSchema,
    state: stateSchema,
    latency: z.number(),
  }),
  "/api/transcribe": z.object({
    transcript: z.string().min(1),
    latency: z.number(),
  }),
  "/api/speak": z.object({ audio: z.string().min(1), latency: z.number() }),
};
type Endpoint = keyof typeof responseSchemas;
type ApiResult<P extends Endpoint> = z.infer<(typeof responseSchemas)[P]>;
async function api<P extends Endpoint>(
  path: P,
  key: string,
  body: BodyInit,
  json = true,
  signal?: AbortSignal,
): Promise<ApiResult<P>> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "x-sarvam-key": key,
      ...(json ? { "Content-Type": "application/json" } : {}),
    },
    body,
    signal: signal || AbortSignal.timeout(45000),
  });
  const data: unknown = await response.json();
  if (!response.ok) {
    const problem = z.object({ error: z.string() }).safeParse(data);
    throw new Error(problem.success ? problem.data.error : "Request failed.");
  }
  return responseSchemas[path].parse(data) as ApiResult<P>;
}
export function useRushHour() {
  const [state, setState] = useState<State>(sampleState);
  const stateRef = useRef(state);
  const [events, setEvents] = useState<Trace[]>([]);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Namaste! Try an order, a correction, or a payment. I’ll keep track.",
    },
  ]);
  const messagesRef = useRef(messages);
  const [key, setKey] = useState("");
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [voice, setVoice] = useState(true);
  const [noise, setNoise] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [undoCount, setUndoCount] = useState(0);
  const undoStack = useRef<State[]>([]);
  const [results, setResults] = useState<EvalResult[]>([]);
  const [evaluating, setEvaluating] = useState(false);
  const [evalEngine, setEvalEngine] = useState("");
  const [running, setRunning] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stopTracks = useRef<() => void>(() => {});
  const recordTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechRequest = useRef<AbortController | null>(null);
  const runner = useRef(0);
  const evalRequest = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const locked = busy || recording || running || evaluating;
  const replaceState = (next: State) => {
    stateRef.current = next;
    setState(next);
  };
  const appendMessage = (m: Message) => {
    messagesRef.current = [...messagesRef.current, m];
    setMessages(messagesRef.current);
  };
  function interrupt() {
    speechRequest.current?.abort();
    speechRequest.current = null;
    audioRef.current?.pause();
    audioRef.current = null;
    setSpeaking(false);
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      runner.current++;
      evalRequest.current?.abort();
      speechRequest.current?.abort();
      audioRef.current?.pause();
      if (recorder.current?.state === "recording") recorder.current.stop();
      stopTracks.current();
      if (recordTimer.current) clearTimeout(recordTimer.current);
    };
  }, []);
  useEffect(() => {
    if (!recording) return;
    const start = Date.now();
    const interval = setInterval(
      () => setSeconds(Math.floor((Date.now() - start) / 1000)),
      200,
    );
    return () => clearInterval(interval);
  }, [recording]);
  function trace(entry: Omit<Trace, "id" | "at">) {
    const event = {
      ...entry,
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
    };
    setEvents((e) => [event, ...e]);
    return event.id;
  }
  function remember() {
    undoStack.current.push(structuredClone(stateRef.current));
    if (undoStack.current.length > 100) undoStack.current.shift();
    setUndoCount(undoStack.current.length);
  }
  async function speak(text: string, eventId: string) {
    if (!voice || !live || !key) return;
    interrupt();
    const ctl = new AbortController();
    speechRequest.current = ctl;
    setSpeaking(true);
    try {
      const result = await api(
        "/api/speak",
        key,
        JSON.stringify({
          text,
          language: /[\u0900-\u097f]/.test(text) ? "hi-IN" : "en-IN",
        }),
        true,
        ctl.signal,
      );
      if (ctl.signal.aborted) return;
      setEvents((es) =>
        es.map((e) => (e.id === eventId ? { ...e, tts: result.latency } : e)),
      );
      const audio = new Audio(`data:audio/wav;base64,${result.audio}`);
      audioRef.current = audio;
      audio.onended = () => setSpeaking(false);
      audio.onerror = () => {
        setSpeaking(false);
        setNotice("Reply is available as text; audio could not play.");
      };
      await audio.play();
    } catch (e) {
      if (!ctl.signal.aborted) {
        setSpeaking(false);
        setNotice(
          e instanceof Error
            ? `Speech output: ${e.message}`
            : "Speech output failed.",
        );
      }
    }
  }
  async function submit(
    text: string,
    options: {
      demo?: boolean;
      stt?: number;
      fromRecording?: boolean;
      fromRunner?: boolean;
    } = {},
  ) {
    if (
      busyRef.current ||
      (!options.fromRunner && running) ||
      evaluating ||
      (!options.fromRecording && recording)
    )
      throw new Error("Wait for the current operation to finish.");
    if (!text.trim()) return;
    const start = performance.now();
    const before = structuredClone(stateRef.current);
    const source = live && !options.demo ? "Sarvam" : "Demo rules";
    setError("");
    setNotice("");
    interrupt();
    busyRef.current = true;
    setBusy(true);
    appendMessage({ role: "user", content: text });
    try {
      const response =
        source === "Sarvam"
          ? await api(
              "/api/agent",
              key,
              JSON.stringify({
                text,
                state: before,
                history: messagesRef.current.slice(0, -1).slice(-16),
              }),
            )
          : executeDemo(text, before);
      const plan = response.plan as Plan;
      const next = applyPlan(before, plan);
      const changed = JSON.stringify(next) !== JSON.stringify(before);
      if (changed) {
        remember();
        replaceState(next);
      }
      appendMessage({ role: "assistant", content: plan.reply });
      const id = trace({
        input: text,
        reply: plan.reply,
        source,
        actions: plan.actions,
        before,
        after: next,
        outcome: plan.clarification ? "clarification" : "applied",
        latency: performance.now() - start,
        stt: options.stt,
      });
      if (source === "Sarvam") void speak(plan.reply, id);
      return { state: next, plan };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong.";
      setError(message);
      appendMessage({ role: "assistant", content: message });
      trace({
        input: text,
        reply: message,
        source,
        actions: [],
        before,
        after: before,
        outcome: "error",
        latency: performance.now() - start,
        stt: options.stt,
      });
      return { state: before, error: message };
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  function manual(actions: Action[], label: string) {
    if (locked) return;
    try {
      interrupt();
      const before = structuredClone(stateRef.current);
      const next = applyPlan(before, {
        actions,
        reply: label,
        clarification: false,
      });
      remember();
      replaceState(next);
      trace({
        input: label,
        reply: label,
        source: "Counter controls",
        actions,
        before,
        after: next,
        outcome: "applied",
        latency: 0,
      });
      setNotice(label);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    }
  }
  function undo() {
    if (locked || !undoStack.current.length) return;
    interrupt();
    const before = structuredClone(stateRef.current);
    const next = undoStack.current.pop()!;
    replaceState(next);
    setUndoCount(undoStack.current.length);
    trace({
      input: "Undo last change",
      reply: "Previous order state restored.",
      source: "Counter controls",
      actions: [],
      before,
      after: next,
      outcome: "undo",
      latency: 0,
    });
    messagesRef.current = [];
    setMessages([]);
    setNotice(
      "Last change undone. Conversation context cleared to match the restored board.",
    );
    setError("");
  }
  function reset(sample = false, force = false) {
    if (locked && !force) return;
    interrupt();
    const before = structuredClone(stateRef.current);
    remember();
    const next = sample ? sampleState() : emptyState();
    replaceState(next);
    messagesRef.current = [];
    setMessages([]);
    trace({
      input: sample ? "Load sample shift" : "Start empty shift",
      reply: "Shift reset. Use Undo to restore the previous board.",
      source: "Counter controls",
      actions: [],
      before,
      after: next,
      outcome: "reset",
      latency: 0,
    });
    setError("");
    setNotice(
      sample ? "Sample shift loaded." : "Fresh shift. Add your first order.",
    );
  }
  async function replay(scenario?: Scenario) {
    if (locked) return;
    const token = ++runner.current;
    setLive(false);
    reset(false);
    setRunning(true);
    const turns = scenario?.turns || [
      "Sharma ji ke liye do chai aur teen samose",
      "Sharma ji ek chai cancel",
      "Priya ke liye do vada pav",
      "Unka payment ho gaya",
      "Sharma ji paid",
    ];
    try {
      for (const text of turns) {
        if (runner.current !== token) break;
        await submit(text, { demo: true, fromRunner: true });
        await new Promise((r) => setTimeout(r, 800));
      }
    } finally {
      setRunning(false);
      setNotice(
        runner.current === token
          ? "Demo finished. Try your own instruction below."
          : "Demo stopped. Your current orders are preserved.",
      );
    }
  }
  function stopReplay() {
    runner.current++;
    setRunning(false);
  }
  async function runEval(only?: Scenario) {
    if (locked) return;
    setEvaluating(true);
    setResults([]);
    setError("");
    const mode = live ? "Sarvam text agent" : "Local demo rules";
    setEvalEngine(mode);
    const ctl = new AbortController();
    evalRequest.current = ctl;
    try {
      for (const scenario of only ? [only] : scenarios) {
        if (ctl.signal.aborted) break;
        const start = performance.now();
        let s = emptyState(),
          clarifications = 0;
        const turns: EvalResult["turns"] = [];
        const history: Message[] = [];
        let problem: string | undefined;
        try {
          for (const input of scenario.turns) {
            if (ctl.signal.aborted) break;
            const res = live
              ? await api(
                  "/api/agent",
                  key,
                  JSON.stringify({ text: input, state: s, history }),
                  true,
                  ctl.signal,
                )
              : executeDemo(input, s);
            s = applyPlan(s, res.plan);
            clarifications += Number(res.plan.clarification);
            turns.push({ input, ...res.plan });
            history.push(
              { role: "user", content: input },
              { role: "assistant", content: res.plan.reply },
            );
          }
        } catch (e) {
          problem = e instanceof Error ? e.message : "Evaluation failed";
        }
        if (ctl.signal.aborted) break;
        setResults((r) => [
          ...r,
          {
            id: scenario.id,
            title: scenario.title,
            expected: scenario.expected,
            actual: s,
            pass: !problem && scenario.check(s, clarifications),
            latency: performance.now() - start,
            clarifications,
            turns,
            error: problem,
          },
        ]);
        await new Promise((r) => setTimeout(r, 40));
      }
    } finally {
      setEvaluating(false);
    }
  }
  function stopEval() {
    evalRequest.current?.abort();
  }
  async function transcribe(file: Blob) {
    if (busyRef.current) return;
    setError("");
    setNotice("Transcribing with Saaras…");
    busyRef.current = true;
    setBusy(true);
    try {
      const form = new FormData();
      form.set(
        "file",
        file,
        file.type.includes("mp4")
          ? "order.m4a"
          : file.type.includes("wav")
            ? "order.wav"
            : "order.webm",
      );
      const data = await api("/api/transcribe", key, form, false);
      busyRef.current = false;
      setBusy(false);
      return await submit(data.transcript, {
        stt: data.latency,
        fromRecording: true,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Transcription failed.";
      setError(msg);
      trace({
        input: "[Audio input]",
        reply: msg,
        source: "Saaras transcription",
        actions: [],
        before: stateRef.current,
        after: stateRef.current,
        outcome: "error",
        latency: 0,
      });
    } finally {
      busyRef.current = false;
      setBusy(false);
      setNotice("");
    }
  }
  function stopRecording() {
    if (recorder.current?.state === "recording") recorder.current.stop();
    if (recordTimer.current) clearTimeout(recordTimer.current);
  }
  async function startRecording() {
    if (locked) return;
    interrupt();
    setError("");
    if (!live || !key) {
      setError(
        "Connect Sarvam and enable live mode to record audio. Demo mode supports typed instructions.",
      );
      return;
    }
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError(
        "Microphone recording is unavailable here. Use Chrome on localhost/HTTPS, or upload a short audio clip in the lab.",
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: !noise },
      });
      let capture = stream;
      let context: AudioContext | undefined;
      let noiseSource: AudioBufferSourceNode | undefined;
      if (noise) {
        context = new AudioContext();
        const destination = context.createMediaStreamDestination();
        context.createMediaStreamSource(stream).connect(destination);
        const buffer = context.createBuffer(
          1,
          context.sampleRate * 2,
          context.sampleRate,
        );
        const samples = buffer.getChannelData(0);
        let seed = 12345;
        for (let i = 0; i < samples.length; i++) {
          seed = (seed * 16807) % 2147483647;
          samples[i] = ((seed / 2147483647) * 2 - 1) * 0.09;
        }
        noiseSource = context.createBufferSource();
        noiseSource.buffer = buffer;
        noiseSource.loop = true;
        noiseSource.connect(destination);
        noiseSource.start();
        capture = destination.stream;
      }
      stopTracks.current = () => {
        stream.getTracks().forEach((t) => t.stop());
        capture.getTracks().forEach((t) => t.stop());
        try {
          noiseSource?.stop();
        } catch {}
        void context?.close();
      };
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find(
        (m) => MediaRecorder.isTypeSupported(m),
      );
      const rec = new MediaRecorder(
        capture,
        mime ? { mimeType: mime } : undefined,
      );
      recorder.current = rec;
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onstop = () => {
        stopTracks.current();
        setRecording(false);
        if (recordTimer.current) clearTimeout(recordTimer.current);
        if (mounted.current)
          void transcribe(new Blob(chunks, { type: rec.mimeType }));
      };
      rec.onerror = () => {
        stopTracks.current();
        setRecording(false);
        setError("The microphone recording failed. Please try again.");
      };
      rec.start();
      setRecording(true);
      setSeconds(0);
      recordTimer.current = setTimeout(stopRecording, 20000);
    } catch (e) {
      stopTracks.current();
      setError(
        e instanceof Error && e.name === "NotAllowedError"
          ? "Microphone permission was denied. Enable it in your browser and try again."
          : "Could not access the microphone. Check that another app is not using it.",
      );
    }
  }
  async function upload(file: File) {
    if (locked) return;
    if (!live || !key) {
      setError("Connect Sarvam and enable live mode before uploading audio.");
      return;
    }
    if (file.size > 8_000_000) {
      setError("Please choose an audio file under 8 MB.");
      return;
    }
    interrupt();
    await transcribe(file);
  }
  useEffect(() => {
    const mc = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: unknown,
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!mc) return;
    const life = new AbortController();
    try {
      void Promise.resolve(
        mc.registerTool(
          {
            name: "read_order_board",
            title: "Read order board",
            description:
              "Read the current Rush Hour orders, items, payments and kitchen status. No changes.",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true },
            execute: (input: unknown) => {
              if (
                !input ||
                typeof input !== "object" ||
                Array.isArray(input) ||
                Object.keys(input).length
              )
                throw new Error("Expected an empty object.");
              return structuredClone(stateRef.current);
            },
          },
          { signal: life.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => life.abort();
  }, []);
  return {
    state,
    events,
    messages,
    key,
    setKey,
    live,
    setLive,
    busy,
    error,
    setError,
    notice,
    locked,
    speaking,
    voice,
    setVoice,
    noise,
    setNoise,
    recording,
    seconds,
    undoCount,
    results,
    evaluating,
    evalEngine,
    running,
    submit,
    manual,
    undo,
    reset,
    replay,
    stopReplay,
    runEval,
    stopEval,
    startRecording,
    stopRecording,
    upload,
    interrupt,
  };
}

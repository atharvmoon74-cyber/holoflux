/**
 * HOLOFLUX design reminder — Orbital Observatory: a full-screen spatial laboratory where the living particle field is primary and controls stay peripheral.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, Aperture, Camera, ChevronDown, CircleHelp, Crosshair, Expand, Focus, Hand, Maximize2, Mic2, MousePointer2, Pause, Play, Radio, RotateCcw, Settings2, Sparkles, Video, VideoOff, X, Zap } from "lucide-react";
import ParticleField from "@/components/ParticleField";
import HoloControls, { type PanelId } from "@/components/HoloControls";
import { AudioReactiveEngine } from "@/lib/audio-engine";
import { GestureEngine } from "@/lib/gesture-engine";
import type { GestureFrame, GestureName, HandPose, HoloConfig, Metrics, ParticleFieldHandle, Preset, Vec2 } from "@/lib/holo-types";
import { BUILT_IN_PRESETS, DEFAULT_CONFIG, mergeConfig } from "@/lib/presets";
import { VisionEngine } from "@/lib/vision-engine";
import { detectInitialQuality, profileFor } from "@/lib/performance-profile";
import { createUniverseSeed, universeFromSeed } from "@/lib/universe-generator";

type CameraState = "idle" | "initializing" | "active" | "lost" | "error" | "off";
type HoloEvent = { id: number; message: string; tone: "cyan" | "coral" | "violet" };
type ManualEvent = { id: number; type: "explosion" | "blackhole" | "vortex" | "galaxy"; position: Vec2 } | null;

const EMPTY_FRAME: GestureFrame = { hands: [], twoHands: null };
const DEFAULT_METRICS: Metrics = { fps: 60, frameTime: 16.7, particleCount: DEFAULT_CONFIG.particles.count, trackingLatency: 0, adaptiveLevel: "cinematic", qualityTier: DEFAULT_CONFIG.qualityTier, targetParticles: DEFAULT_CONFIG.particles.count, activeForces: 0, trackingFps: 0, renderMode: "gpu-layered" };
const bootLines = ["INITIALIZING VISION ENGINE…", "CALIBRATING PARTICLE FIELD…", "CONNECTING HAND TRACKING…", "PHYSICS ENGINE ONLINE"];

function virtualHand(position: Vec2, gesture: GestureName, velocity: Vec2, id = "virtual-hand"): HandPose {
  return {
    id, handedness: "Unknown", position, rawPosition: position, predictedPosition: position, wrist: position, palm: position, velocity, acceleration: { x: 0, y: 0 }, pinch: gesture === "pinch" ? 0.03 : 0.18, openness: gesture === "palm" ? 1 : gesture === "fist" ? 0 : 0.45,
    rotation: 0, gesture, confidence: 1, duration: 0, isSwipe: gesture === "index" && Math.hypot(velocity.x, velocity.y) > 1.25, isCircular: false, pinchReleased: false, speed: Math.hypot(velocity.x, velocity.y), forceMultiplier: 1, landmarkPoints: [position],
  };
}

function buildVirtualFrame(points: Vec2[], gesture: GestureName, velocity: Vec2): GestureFrame {
  const hands = points.slice(0, 2).map((point, index) => virtualHand(point, points.length > 1 ? "palm" : gesture, velocity, `virtual-${index}`));
  if (hands.length < 2) return { hands, twoHands: null };
  const a = hands[0]; const b = hands[1];
  const distance = Math.hypot(a.palm.x - b.palm.x, a.palm.y - b.palm.y);
  return { hands, twoHands: { active: true, distance, rotation: Math.atan2(b.palm.y - a.palm.y, b.palm.x - a.palm.x), bothOpen: true, bothPinched: false, tunnel: false, distanceVelocity: 0, rotationVelocity: 0, energy: Math.min(2, Math.hypot(velocity.x, velocity.y)) } };
}

export default function Home() {
  const [config, setConfig] = useState<HoloConfig>(() => {
    try {
      const saved = localStorage.getItem("holoflux-config");
      return saved ? mergeConfig(DEFAULT_CONFIG, JSON.parse(saved)) : mergeConfig(DEFAULT_CONFIG, { qualityTier: detectInitialQuality() });
    } catch { return mergeConfig(DEFAULT_CONFIG, { qualityTier: detectInitialQuality() }); }
  });
  const [boot, setBoot] = useState(true);
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [cameraMessage, setCameraMessage] = useState("");
  const [gestureFrame, setGestureFrame] = useState<GestureFrame>(EMPTY_FRAME);
  const [metrics, setMetrics] = useState<Metrics>(DEFAULT_METRICS);
  const [paused, setPaused] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<PanelId>("mode");
  const [helpOpen, setHelpOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [cameraPreview, setCameraPreview] = useState(false);
  const [debug, setDebug] = useState(false);
  const [event, setEvent] = useState<HoloEvent | null>(null);
  const [manualEvent, setManualEvent] = useState<ManualEvent>(null);
  const [recording, setRecording] = useState(false);
  const [recordingMode, setRecordingMode] = useState(false);
  const [audioEnergy, setAudioEnergy] = useState(0);
  const [savedPresets, setSavedPresets] = useState<Preset[]>(() => { try { return JSON.parse(localStorage.getItem("holoflux-presets") || "[]"); } catch { return []; } });
  const [universeSeed, setUniverseSeed] = useState(() => createUniverseSeed());
  const [eventHistory, setEventHistory] = useState<Array<HoloEvent & { at: number }>>([]);
  const fieldRef = useRef<ParticleFieldHandle>(null);
  const visionRef = useRef<VisionEngine | null>(null);
  const gestureEngineRef = useRef(new GestureEngine());
  const streamRef = useRef<MediaStream | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<AudioReactiveEngine | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const pointerRef = useRef({ point: { x: 0.5, y: 0.5 }, time: performance.now(), velocity: { x: 0, y: 0 }, gesture: "idle" as GestureName });
  const touchPointsRef = useRef(new Map<number, Vec2>());
  const holdTimerRef = useRef<number | null>(null);
  const eventTimerRef = useRef<number | null>(null);
  const manualIdRef = useRef(0);
  const eventTimelineRef = useRef<Array<NonNullable<ManualEvent>>>([]);
  const configRef = useRef(config);
  const liveGestureRef = useRef<GestureFrame>(EMPTY_FRAME);
  const lastGestureUiUpdateRef = useRef(0);
  const trackingFramesRef = useRef(0);
  const trackingStartRef = useRef(performance.now());
  configRef.current = config;

  useEffect(() => { localStorage.setItem("holoflux-config", JSON.stringify(config)); }, [config]);
  useEffect(() => { localStorage.setItem("holoflux-presets", JSON.stringify(savedPresets)); }, [savedPresets]);
  useEffect(() => { const timer = window.setTimeout(() => setBoot(false), 2920); return () => window.clearTimeout(timer); }, []);
  useEffect(() => () => { visionRef.current?.stop(); audioRef.current?.stop(); if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current); if (eventTimerRef.current) window.clearTimeout(eventTimerRef.current); }, []);
  useEffect(() => { if (previewVideoRef.current && streamRef.current) previewVideoRef.current.srcObject = streamRef.current; }, [cameraPreview, cameraState]);

  const pushEvent = useCallback((message: string, tone: HoloEvent["tone"] = "cyan") => {
    const next = { id: Date.now(), message, tone };
    setEvent(next);
    setEventHistory((current) => [{ ...next, at: Date.now() }, ...current].slice(0, 7));
    if (eventTimerRef.current) window.clearTimeout(eventTimerRef.current);
    eventTimerRef.current = window.setTimeout(() => setEvent((current) => current?.id === next.id ? null : current), 3000);
  }, []);
  const patchConfig = useCallback((patch: Partial<HoloConfig>) => setConfig((current) => mergeConfig(current, patch)), []);
  const submitManualEvent = useCallback((type: NonNullable<ManualEvent>["type"], position: Vec2 = { x: 0.5, y: 0.5 }) => {
    manualIdRef.current += 1;
    const next = { id: manualIdRef.current, type, position } as NonNullable<ManualEvent>;
    eventTimelineRef.current = [...eventTimelineRef.current, next].slice(-12);
    setManualEvent(next);
  }, []);
  const addExperiment = useCallback((field: Parameters<NonNullable<ParticleFieldHandle["addExperiment"]>>[0]) => fieldRef.current?.addExperiment(field), []);
  const clearExperiments = useCallback(() => fieldRef.current?.clearExperiments(), []);
  const generateUniverse = useCallback(() => {
    const nextSeed = createUniverseSeed();
    setUniverseSeed(nextSeed);
    setConfig((current) => universeFromSeed(nextSeed, current));
    fieldRef.current?.reset();
    pushEvent(`UNIVERSE GENERATED · ${nextSeed}`, "violet");
  }, [pushEvent]);
  const replayEvents = useCallback(() => {
    const events = eventTimelineRef.current.slice(-8);
    if (!events.length) { pushEvent("NO RECORDED FORCE EVENTS YET", "coral"); return; }
    pushEvent("REPLAYING RECORDED FORCE EVENTS", "cyan");
    events.forEach((eventLike, index) => window.setTimeout(() => {
      manualIdRef.current += 1;
      setManualEvent({ ...eventLike, id: manualIdRef.current });
    }, index * 420));
  }, [pushEvent]);
  const handleMetrics = useCallback((next: Metrics) => setMetrics((current) => ({ ...next, trackingLatency: current.trackingLatency, trackingFps: current.trackingFps })), []);
  useEffect(() => { visionRef.current?.setInferenceInterval(profileFor(config.qualityTier).trackingInterval); }, [config.qualityTier]);

  const exitCamera = useCallback((announce = true) => {
    visionRef.current?.stop(); visionRef.current = null;
    streamRef.current = null;
    setCameraState("off"); liveGestureRef.current = EMPTY_FRAME; setGestureFrame(EMPTY_FRAME);
    if (announce) pushEvent("CAMERA OFF — MOUSE CONTROL ACTIVE", "cyan");
  }, [pushEvent]);

  const enableCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) { setCameraState("error"); setCameraMessage("Camera access is not supported here. Mouse controls are ready."); return; }
    setCameraState("initializing"); setCameraMessage("");
    const engine = new VisionEngine(
      (rawHands, latency) => {
        const frame = gestureEngineRef.current.update(rawHands, configRef.current);
        liveGestureRef.current = frame;
        const uiNow = performance.now();
        if (uiNow - lastGestureUiUpdateRef.current > 90) {
          lastGestureUiUpdateRef.current = uiNow;
          setGestureFrame(frame);
        }
        trackingFramesRef.current += 1;
        if (uiNow - trackingStartRef.current > 650) {
          const trackingFps = Math.round((trackingFramesRef.current * 1000) / (uiNow - trackingStartRef.current));
          trackingFramesRef.current = 0;
          trackingStartRef.current = uiNow;
          setMetrics((current) => ({ ...current, trackingLatency: +latency.toFixed(1), trackingFps }));
        }
      },
      (status, message) => {
        if (status === "active") setCameraState("active");
        if (status === "lost") setCameraState((current) => current === "active" ? "lost" : current);
        if (status === "error") { setCameraState("error"); setCameraMessage(message || "We couldn't access your camera. You can continue with mouse controls."); }
      },
    );
    visionRef.current = engine;
    engine.setInferenceInterval(profileFor(configRef.current.qualityTier).trackingInterval);
    try {
      const stream = await engine.start();
      streamRef.current = stream;
      if (previewVideoRef.current) previewVideoRef.current.srcObject = stream;
      setCameraState("active"); setTutorialOpen(true); pushEvent("YOUR HAND IS NOW A FORCE", "cyan");
    } catch {
      setCameraState("error"); setCameraMessage("We couldn't access your camera. You can continue with mouse controls.");
    }
  }, [pushEvent]);

  const setMouseGesture = useCallback((point: Vec2, gesture: GestureName) => {
    const now = performance.now(); const previous = pointerRef.current;
    const dt = Math.max(0.016, (now - previous.time) / 1000);
    const velocity = { x: (point.x - previous.point.x) / dt, y: (point.y - previous.point.y) / dt };
    pointerRef.current = { point, time: now, velocity, gesture };
    const frame = buildVirtualFrame([...Array.from(touchPointsRef.current.values()), ...(touchPointsRef.current.size ? [] : [point])], gesture, velocity);
    liveGestureRef.current = frame;
    setGestureFrame(frame);
  }, []);

  const pointFromEvent = (eventLike: { currentTarget: EventTarget & HTMLElement; clientX: number; clientY: number }): Vec2 => {
    const rect = eventLike.currentTarget.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (eventLike.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (eventLike.clientY - rect.top) / rect.height)) };
  };
  const fallbackActive = cameraState !== "active" && cameraState !== "lost";
  const handlePointerMove = (eventLike: React.PointerEvent<HTMLDivElement>) => {
    if (!fallbackActive) return;
    const point = pointFromEvent(eventLike);
    if (eventLike.pointerType === "touch") touchPointsRef.current.set(eventLike.pointerId, point);
    setMouseGesture(point, pointerRef.current.gesture);
  };
  const handlePointerDown = (eventLike: React.PointerEvent<HTMLDivElement>) => {
    if (!fallbackActive) return;
    const point = pointFromEvent(eventLike);
    eventLike.currentTarget.setPointerCapture?.(eventLike.pointerId);
    if (eventLike.pointerType === "touch") touchPointsRef.current.set(eventLike.pointerId, point);
    const gesture: GestureName = eventLike.button === 2 ? "palm" : "index";
    setMouseGesture(point, gesture);
    if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
    if (eventLike.button !== 2) holdTimerRef.current = window.setTimeout(() => setMouseGesture(point, "pinch"), 360);
  };
  const handlePointerUp = (eventLike: React.PointerEvent<HTMLDivElement>) => {
    if (!fallbackActive) return;
    const point = pointFromEvent(eventLike);
    const isTap = eventLike.pointerType === "touch" && performance.now() - pointerRef.current.time < 240;
    if (eventLike.pointerType === "touch") touchPointsRef.current.delete(eventLike.pointerId);
    if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
    if (isTap) submitManualEvent("explosion", point);
    setMouseGesture(point, "idle");
  };

  const capturePhoto = useCallback(() => {
    const canvas = fieldRef.current?.getCanvas();
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const anchor = document.createElement("a"); anchor.href = URL.createObjectURL(blob); anchor.download = `holoflux-${Date.now()}.png`; anchor.click(); URL.revokeObjectURL(anchor.href);
      pushEvent("COSMIC CAMERA · FRAME CAPTURED", "cyan");
    }, "image/png");
  }, [pushEvent]);
  const toggleRecording = useCallback(() => {
    if (recording) { recorderRef.current?.stop(); return; }
    const canvas = fieldRef.current?.getCanvas();
    if (!canvas || !("MediaRecorder" in window)) { pushEvent("Recording is not supported by this browser.", "coral"); return; }
    const media = new MediaRecorder(canvas.captureStream(30), { mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm" });
    chunksRef.current = [];
    media.ondataavailable = (eventLike) => { if (eventLike.data.size) chunksRef.current.push(eventLike.data); };
    media.onstop = () => { const blob = new Blob(chunksRef.current, { type: "video/webm" }); const anchor = document.createElement("a"); anchor.href = URL.createObjectURL(blob); anchor.download = `holoflux-recording-${Date.now()}.webm`; anchor.click(); URL.revokeObjectURL(anchor.href); setRecording(false); setRecordingMode(false); pushEvent("RECORDING SAVED", "cyan"); };
    recorderRef.current = media; media.start(250); setRecording(true); setRecordingMode(true); pushEvent("RECORDING · CINEMATIC MODE", "coral");
  }, [pushEvent, recording]);
  const toggleFullscreen = useCallback(() => { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.(); }, []);
  const selectPreset = useCallback((preset: Preset) => { patchConfig(preset.config); pushEvent(`${preset.name.toUpperCase()} PRESET LOADED`, "violet"); }, [patchConfig, pushEvent]);
  const savePreset = useCallback(() => {
    const name = window.prompt("Name this universe preset", `Flux ${savedPresets.length + 1}`)?.trim();
    if (!name) return;
    setSavedPresets((current) => [...current, { id: `saved-${Date.now()}`, name, config }]); pushEvent("CURRENT UNIVERSE SAVED", "cyan");
  }, [config, pushEvent, savedPresets.length]);
  const importPreset = useCallback((preset: Preset) => { if (!preset?.name || !preset?.config) { pushEvent("That preset file is not valid.", "coral"); return; } setSavedPresets((current) => [...current, { ...preset, id: `import-${Date.now()}`, name: `${preset.name} (imported)` }]); pushEvent("PRESET IMPORTED", "cyan"); }, [pushEvent]);
  const deletePreset = useCallback((id: string) => { setSavedPresets((current) => current.filter((preset) => preset.id !== id)); }, []);
  const resetControls = useCallback(() => { patchConfig({ interaction: DEFAULT_CONFIG.interaction }); pushEvent("DEFAULT GESTURE MAP RESTORED", "cyan"); }, [patchConfig, pushEvent]);

  useEffect(() => {
    const handler = (eventLike: KeyboardEvent) => {
      if ((eventLike.target as HTMLElement)?.tagName === "INPUT" || (eventLike.target as HTMLElement)?.tagName === "SELECT") return;
      const key = eventLike.key.toLowerCase();
      if (key === " ") { eventLike.preventDefault(); setPaused((current) => !current); }
      if (key === "r") fieldRef.current?.reset();
      if (key === "g") { patchConfig({ mode: "galaxy", formation: "galaxy" }); submitManualEvent("galaxy"); }
      if (key === "b") { patchConfig({ mode: "blackhole" }); submitManualEvent("blackhole"); }
      if (key === "e") submitManualEvent("explosion", pointerRef.current.point);
      if (key === "v") { patchConfig({ mode: "vortex" }); submitManualEvent("vortex", pointerRef.current.point); }
      if (key === "c") { if (cameraState === "active" || cameraState === "lost") exitCamera(); else enableCamera(); }
      if (key === "p") capturePhoto();
      if (key === "f") toggleFullscreen();
      if (key === "h") setHelpOpen((current) => !current);
      if (key === "d") setDebug((current) => !current);
      const number = Number(key); if (number >= 1 && number <= 9) { const preset = BUILT_IN_PRESETS.find((item) => item.shortcut === number); if (preset) selectPreset(preset); }
    };
    window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler);
  }, [cameraState, capturePhoto, enableCamera, exitCamera, patchConfig, selectPreset, submitManualEvent, toggleFullscreen]);

  useEffect(() => {
    if (!config.visuals.audioReactive) { audioRef.current?.stop(); audioRef.current = null; setAudioEnergy(0); return undefined; }
    const audio = new AudioReactiveEngine(); audioRef.current = audio;
    let frame = 0; let cancelled = false;
    audio.start().then(() => {
      const sample = () => { if (cancelled) return; setAudioEnergy(audio.sample()); frame = requestAnimationFrame(sample); }; sample();
    }).catch(() => { pushEvent("Microphone could not be enabled. Audio reactivity remains off.", "coral"); patchConfig({ visuals: { ...configRef.current.visuals, audioReactive: false } }); });
    return () => { cancelled = true; cancelAnimationFrame(frame); audio.stop(); };
  }, [config.visuals.audioReactive, patchConfig, pushEvent]);

  const handLabel = useMemo(() => {
    const hand = gestureFrame.hands[0];
    if (!hand) return fallbackActive ? "MOUSE CONTROL ACTIVE" : "SEARCHING FOR HANDS";
    const action = config.interaction.gestureMap[hand.gesture] ?? "attract";
    return `${action.toUpperCase()} · ${Math.round(hand.confidence * 100)}%`;
  }, [config.interaction.gestureMap, fallbackActive, gestureFrame.hands]);

  return <main className={`holoflux-shell ${config.highContrast ? "high-contrast" : ""} ${recordingMode ? "recording-mode" : ""}`} onContextMenu={(eventLike) => eventLike.preventDefault()}>
    <div className="nebula-surface" />
    <div className="interaction-layer" onPointerMove={handlePointerMove} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp} onDoubleClick={(eventLike) => { if (fallbackActive) submitManualEvent("explosion", pointFromEvent(eventLike)); }} onWheel={(eventLike) => { if (fallbackActive) setZoom((current) => Math.max(0.55, Math.min(1.8, current - eventLike.deltaY * 0.0008))); }}>
      <ParticleField ref={fieldRef} config={config} gestureFrame={gestureFrame} gestureFrameRef={liveGestureRef} paused={paused} audioEnergy={audioEnergy} zoom={zoom} manualEvent={manualEvent} onMetrics={handleMetrics} onEvent={pushEvent} />
    </div>
    {gestureFrame.hands.map((hand) => <div key={hand.id} className={`force-reticle gesture-${hand.gesture}`} style={{ left: `${hand.predictedPosition.x * 100}%`, top: `${hand.predictedPosition.y * 100}%` }}><i /><b>{(config.interaction.gestureMap[hand.gesture] ?? "attract").toUpperCase()}</b><span>FORCE {Math.round(hand.forceMultiplier * 100)}% · {hand.speed.toFixed(1)}V</span></div>)}

    {!recordingMode && <>
      <header className="top-line">
        <button className="brand-block" onClick={() => { setPanelOpen(true); setActivePanel("mode"); }} aria-label="Open HOLOFLUX controls"><img src="/manus-storage/holoflux-flux-logo_bc663407.png" alt="" /><span><b>HOLOFLUX</b><em>SHAPE THE INVISIBLE.</em></span></button>
        <div className="telemetry-strip" aria-live="polite"><span><Activity size={14} />{metrics.fps} FPS</span><span className={gestureFrame.hands.length ? "detected" : ""}><Radio size={13} />{gestureFrame.hands.length ? `${gestureFrame.hands.length} HAND${gestureFrame.hands.length > 1 ? "S" : ""}` : "NO HAND"}</span><span><i className={`status-dot ${paused ? "paused" : ""}`} />{paused ? "PAUSED" : "FIELD ONLINE"}</span></div>
      </header>
      <section className="status-ribbon"><span className={cameraState === "active" ? "live" : ""}>{cameraState === "active" ? "● HAND TRACKING LIVE" : cameraState === "lost" ? "○ HANDS TEMPORARILY LOST" : "○ CAMERA-FREE MODE"}</span><b>{handLabel}</b><span>{cameraState === "active" ? "LOCAL PROCESSING" : "MOVE · CLICK · DRAG"}</span></section>
      {event && <div className={`event-pulse ${event.tone}`} role="status"><span /><b>{event.message}</b></div>}
      {cameraState === "lost" && <div className="soft-alert"><Hand size={16} /><span><b>Hands temporarily lost.</b> Move into better lighting or continue with mouse controls.</span></div>}
      {cameraState === "error" && <div className="soft-alert error"><VideoOff size={16} /><span><b>We couldn't access your camera.</b> {cameraMessage || "You can continue with mouse controls."}</span><button onClick={() => setCameraState("off")}>Use mouse</button></div>}
      {cameraPreview && streamRef.current && <section className="camera-preview"><div><span>LOCAL CAMERA</span><button onClick={() => setCameraPreview(false)}><X size={14} /></button></div><video ref={previewVideoRef} autoPlay muted playsInline /></section>}
      <HoloControls open={panelOpen} active={activePanel} config={config} metrics={metrics} customPresets={savedPresets} onActive={setActivePanel} onPatch={patchConfig} onPreset={selectPreset} onSavePreset={savePreset} onImportPreset={importPreset} onDeletePreset={deletePreset} onResetControls={resetControls} onCapture={capturePhoto} onAddExperiment={addExperiment} onClearExperiments={clearExperiments} onGenerateUniverse={generateUniverse} onReplayEvents={replayEvents} universeSeed={universeSeed} />
      <nav className="command-dock" aria-label="Universe commands">
        <button onClick={() => setPanelOpen((current) => !current)} className={panelOpen ? "dock-active" : ""} title="Universe controls"><Settings2 size={18} /><span>Configure</span></button>
        <button onClick={() => setPaused((current) => !current)} title="Play or pause"><>{paused ? <Play size={18} /> : <Pause size={18} />}</><span>{paused ? "Resume" : "Pause"}</span></button>
        <button onClick={() => { fieldRef.current?.reset(); }} title="Reset particle field"><RotateCcw size={18} /><span>Reset</span></button>
        <button onClick={() => submitManualEvent("explosion", { x: 0.5, y: 0.5 })} title="Trigger explosion"><Zap size={18} /><span>Impulse</span></button>
        <button onClick={() => setHelpOpen(true)} title="How to control"><CircleHelp size={18} /><span>Controls</span></button>
        <i />
        <button onClick={cameraState === "active" || cameraState === "lost" ? () => exitCamera() : enableCamera} className={cameraState === "active" ? "dock-active" : ""} title="Camera tracking"><Camera size={18} /><span>{cameraState === "active" ? "Camera on" : "Camera"}</span></button>
        <button onClick={capturePhoto} title="Capture image"><Focus size={18} /><span>Capture</span></button>
        <button onClick={toggleRecording} className={recording ? "recording" : ""} title="Record interaction"><Video size={18} /><span>{recording ? "Stop" : "Record"}</span></button>
        <button onClick={toggleFullscreen} title="Toggle fullscreen"><Maximize2 size={18} /><span>Full screen</span></button>
      </nav>
      <footer className="bottom-credit"><span>SCROLL TO ZOOM · DOUBLE CLICK TO EXPLODE</span><b>Made by Atharv Moon · IIT Tirupati</b><button onClick={() => setDebug((current) => !current)} aria-label="Toggle developer panel">DEV</button></footer>
      {debug && <aside className="dev-panel"><div><b>DEVELOPER MODE</b><button onClick={() => setDebug(false)}><X size={14} /></button></div><dl><dt>FPS</dt><dd>{metrics.fps}</dd><dt>FRAME TIME</dt><dd>{metrics.frameTime}ms</dd><dt>PARTICLES</dt><dd>{metrics.particleCount.toLocaleString()}</dd><dt>TARGET</dt><dd>{metrics.targetParticles.toLocaleString()}</dd><dt>FORCES</dt><dd>{metrics.activeForces}</dd><dt>TRACKING</dt><dd>{metrics.trackingLatency}ms · {metrics.trackingFps}hz</dd><dt>ACTIVE HANDS</dt><dd>{gestureFrame.hands.length}</dd><dt>GESTURE</dt><dd>{gestureFrame.hands[0]?.gesture ?? "none"}</dd><dt>QUALITY</dt><dd>{metrics.qualityTier} · {metrics.adaptiveLevel}</dd><dt>RENDER</dt><dd>{metrics.renderMode}</dd></dl></aside>}
      {debug && eventHistory.length > 0 && <aside className="event-history"><b>EVENT HISTORY</b>{eventHistory.map((item) => <span key={`${item.id}-${item.at}`}>{item.message}</span>)}</aside>}
    </>}

    {boot && <section className="boot-sequence" aria-label="Initializing HOLOFLUX"><div className="boot-mark"><img src="/manus-storage/holoflux-flux-logo_bc663407.png" alt="" /><span /></div><h1>HOLOFLUX</h1><p>A LIVING PARTICLE UNIVERSE</p><div className="boot-lines">{bootLines.map((line, index) => <span key={line} style={{ animationDelay: `${0.36 + index * 0.52}s` }}>{line}<i /></span>)}</div></section>}
    {!boot && cameraState === "idle" && <section className="consent-gate"><div className="gate-visual"><Aperture size={26} /><span>VISION ENGINE</span></div><h2>Let the universe see your hands.</h2><p>HOLOFLUX uses your camera only for real-time gesture interaction. Frames are processed locally in your browser and are not uploaded or stored.</p><div><button className="gate-primary" onClick={enableCamera}><Camera size={17} />Enable camera</button><button className="gate-secondary" onClick={() => { setCameraState("off"); pushEvent("CAMERA OFF — MOUSE CONTROL ACTIVE", "cyan"); }}><MousePointer2 size={17} />Try without camera</button></div><small>Mouse, keyboard and touch controls are always available.</small></section>}
    {cameraState === "initializing" && <section className="mini-gate"><Sparkles size={17} />CONNECTING TO LOCAL VISION ENGINE…</section>}
    {tutorialOpen && <section className="tutorial-overlay"><div className="tutorial-header"><span>ONBOARDING · UNDER 30 SECONDS</span><button onClick={() => setTutorialOpen(false)}><X size={16} />Skip tutorial</button></div><div className="tutorial-grid"><article><b>01</b><h3>Raise your hand</h3><p>The field follows a live local landmark stream.</p></article><article><b>02</b><h3>Point or pinch</h3><p>Attract matter, then grip it with localized gravity.</p></article><article><b>03</b><h3>Open your palm</h3><p>Repel particles with a broad force field.</p></article><article><b>04</b><h3>Make a fist</h3><p>Form a spiralling visual black hole.</p></article><article><b>05</b><h3>Use two hands</h3><p>Stretch a galaxy, collide two pinch fields, or build a tunnel.</p></article></div><button className="tutorial-confirm" onClick={() => setTutorialOpen(false)}>Enter the field <ChevronDown size={15} /></button></section>}
    {helpOpen && <section className="help-overlay" role="dialog" aria-modal="true" aria-label="How to control HOLOFLUX"><button className="overlay-close" onClick={() => setHelpOpen(false)}><X size={18} /></button><div className="help-kicker">HOW TO CONTROL</div><h2>Your hands become the forces.</h2><div className="help-grid"><article><Crosshair size={19} /><b>Index finger</b><span>Attract</span><p>Point to pull nearby particles into a primary interaction field.</p></article><article><Hand size={19} /><b>Pinch</b><span>Grab / gravity</span><p>Pull a dense cloud, move it, then release its momentum.</p></article><article><Aperture size={19} /><b>Open palm</b><span>Repel</span><p>Send particles outward with a broad directional force.</p></article><article><CircleDotDashedIcon /><b>Closed fist</b><span>Black hole</span><p>Build a temporary accretion field with orbital flow.</p></article><article><RotateCcw size={19} /><b>Two hands</b><span>Scale / create</span><p>Open hands seed a galaxy; dual pinch fields can collide.</p></article><article><MousePointer2 size={19} /><b>Fallback</b><span>Mouse / touch</span><p>Move to aim, click to attract, right-click to repel, drag to throw, double-click to explode.</p></article></div><div className="shortcut-row"><kbd>SPACE</kbd> pause <kbd>R</kbd> reset <kbd>G</kbd> galaxy <kbd>B</kbd> black hole <kbd>E</kbd> explode <kbd>V</kbd> vortex <kbd>P</kbd> photo <kbd>F</kbd> fullscreen</div></section>}
  </main>;
}

function CircleDotDashedIcon() { return <span className="fist-glyph">●</span>; }

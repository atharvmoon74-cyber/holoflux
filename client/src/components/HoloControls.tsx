/**
 * HOLOFLUX design reminder — Orbital Observatory: this is a quiet instrument bay; each control changes the live physics field.
 */
import { useRef } from "react";
import { ArchiveRestore, Atom, Box, Camera, CircleDotDashed, Dna, Download, Gauge, Hand, Orbit, Palette, Play, Plus, RotateCcw, Save, Sparkles, Trash2, Upload } from "lucide-react";
import type { CollisionMode, Formation, GestureAction, GestureName, HoloConfig, Metrics, Preset, QualityTier, UniverseMode } from "@/lib/holo-types";
import { BUILT_IN_PRESETS } from "@/lib/presets";

export type PanelId = "mode" | "physics" | "particles" | "gestures" | "visuals" | "presets" | "collision" | "calibration" | "performance";

type Props = {
  open: boolean;
  active: PanelId;
  config: HoloConfig;
  metrics: Metrics;
  customPresets: Preset[];
  onActive: (panel: PanelId) => void;
  onPatch: (patch: Partial<HoloConfig>) => void;
  onPreset: (preset: Preset) => void;
  onSavePreset: () => void;
  onImportPreset: (preset: Preset) => void;
  onDeletePreset: (id: string) => void;
  onResetControls: () => void;
  onCapture: () => void;
};

const modeData: Array<{ id: UniverseMode; label: string; glyph: string }> = [
  { id: "galaxy", label: "Galaxy", glyph: "✦" }, { id: "vortex", label: "Vortex", glyph: "◌" }, { id: "blackhole", label: "Black Hole", glyph: "●" }, { id: "supernova", label: "Supernova", glyph: "✧" },
  { id: "quantum", label: "Quantum", glyph: "∙" }, { id: "fluid", label: "Fluid", glyph: "≈" }, { id: "magnetic", label: "Magnetic", glyph: "⌁" }, { id: "nebula", label: "Nebula", glyph: "☁" },
  { id: "dna", label: "DNA", glyph: "⌘" }, { id: "neural", label: "Neural", glyph: "⊹" }, { id: "planet", label: "Planet", glyph: "◒" }, { id: "dust", label: "Cosmic Dust", glyph: "·" },
];
const formationData: Array<{ id: Formation; label: string }> = [
  { id: "sphere", label: "Sphere" }, { id: "heart", label: "Heart" }, { id: "galaxy", label: "Galaxy" }, { id: "spiral", label: "Spiral" }, { id: "dna", label: "DNA" }, { id: "cube", label: "Cube" }, { id: "torus", label: "Torus" }, { id: "flower", label: "Flower" }, { id: "saturn", label: "Saturn" }, { id: "infinity", label: "Infinity" }, { id: "star", label: "Star" }, { id: "wave", label: "Wave" }, { id: "text", label: "Text" },
];
const modeFormation: Record<UniverseMode, Formation> = { galaxy: "galaxy", vortex: "spiral", blackhole: "spiral", supernova: "star", quantum: "sphere", fluid: "wave", magnetic: "infinity", nebula: "flower", dna: "dna", neural: "wave", planet: "sphere", dust: "sphere" };
const gestureOptions: GestureName[] = ["index", "pinch", "palm", "fist", "two"];
const actions: GestureAction[] = ["attract", "repel", "gravity", "blackhole", "explosion", "vortex", "freeze", "reset", "spawnGalaxy", "changeMode", "changeColor", "changeParticleCount", "toggleTrails", "screenshot", "recording"];

function Slider({ label, value, min, max, step, suffix = "", onChange }: { label: string; value: number; min: number; max: number; step: number; suffix?: string; onChange: (value: number) => void }) {
  return <label className="control-row"><span>{label}</span><output>{value}{suffix}</output><input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="toggle-row"><span>{label}</span><button aria-label={label} aria-pressed={checked} className={`toggle ${checked ? "is-on" : ""}`} onClick={() => onChange(!checked)}><i /></button></label>;
}

function SectionTitle({ kicker, title, detail }: { kicker: string; title: string; detail?: string }) {
  return <div className="panel-title"><span>{kicker}</span><h2>{title}</h2>{detail && <p>{detail}</p>}</div>;
}

export default function HoloControls({ open, active, config, metrics, customPresets, onActive, onPatch, onPreset, onSavePreset, onImportPreset, onDeletePreset, onResetControls, onCapture }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const patchParticles = (patch: Partial<HoloConfig["particles"]>) => onPatch({ particles: { ...config.particles, ...patch } });
  const patchPhysics = (patch: Partial<HoloConfig["physics"]>) => onPatch({ physics: { ...config.physics, ...patch } });
  const patchMotion = (patch: Partial<HoloConfig["motion"]>) => onPatch({ motion: { ...config.motion, ...patch } });
  const patchVisuals = (patch: Partial<HoloConfig["visuals"]>) => onPatch({ visuals: { ...config.visuals, ...patch } });
  const patchInteraction = (patch: Partial<HoloConfig["interaction"]>) => onPatch({ interaction: { ...config.interaction, ...patch } });
  const nav: Array<{ id: PanelId; label: string; icon: typeof Orbit }> = [
    { id: "mode", label: "Mode", icon: Orbit }, { id: "physics", label: "Physics", icon: Atom }, { id: "particles", label: "Particles", icon: Sparkles }, { id: "gestures", label: "Gestures", icon: Hand }, { id: "visuals", label: "Visuals", icon: Palette }, { id: "presets", label: "Presets", icon: ArchiveRestore }, { id: "collision", label: "Collision Lab", icon: CircleDotDashed }, { id: "calibration", label: "Calibrate", icon: Gauge }, { id: "performance", label: "Quality", icon: Gauge },
  ];
  const importPreset = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { onImportPreset(JSON.parse(String(reader.result)) as Preset); } catch { /* parent feedback handles invalid file defensively */ }
    };
    reader.readAsText(file);
  };
  return <aside className={`instrument-bay ${open ? "is-open" : ""}`} aria-label="Universe configuration controls">
    <nav className="instrument-nav" aria-label="Instrument panels">
      {nav.map(({ id, label, icon: Icon }) => <button key={id} className={active === id ? "is-active" : ""} onClick={() => onActive(id)} title={label}><Icon size={17} /><span>{label}</span></button>)}
    </nav>
    <section className="instrument-panel">
      {active === "mode" && <>
        <SectionTitle kicker="Universe mode" title="Choose a field behavior" detail="Each mode modifies the running physics field." />
        <div className="mode-grid">{modeData.map((mode) => <button key={mode.id} className={config.mode === mode.id ? "mode-option active" : "mode-option"} onClick={() => onPatch({ mode: mode.id, formation: modeFormation[mode.id] })}><b>{mode.glyph}</b><span>{mode.label}</span></button>)}</div>
        <div className="observatory-note"><Orbit size={15} /><p><b>Visual physics simulation</b><br />Forces are designed for interaction and visual clarity, not astrophysical accuracy.</p></div>
      </>}
      {active === "physics" && <>
        <SectionTitle kicker="Force response" title="Tune the physics" detail="Changes take effect in the live particle system." />
        <Slider label="Gravity" value={config.physics.gravity} min={0} max={1.5} step={0.01} onChange={(value) => patchPhysics({ gravity: value })} />
        <Slider label="Attraction" value={config.physics.attraction} min={0} max={2} step={0.01} onChange={(value) => patchPhysics({ attraction: value })} />
        <Slider label="Repulsion" value={config.physics.repulsion} min={0} max={2} step={0.01} onChange={(value) => patchPhysics({ repulsion: value })} />
        <Slider label="Turbulence" value={config.physics.turbulence} min={0} max={1} step={0.01} onChange={(value) => patchPhysics({ turbulence: value })} />
        <Slider label="Drag" value={config.physics.drag} min={0} max={1} step={0.01} onChange={(value) => patchPhysics({ drag: value })} />
        <Slider label="Viscosity" value={config.physics.viscosity} min={0} max={1} step={0.01} onChange={(value) => patchPhysics({ viscosity: value })} />
        <Slider label="Explosion power" value={config.physics.explosionPower} min={0.1} max={3} step={0.05} suffix="×" onChange={(value) => patchPhysics({ explosionPower: value })} />
        <Slider label="Black-hole strength" value={config.physics.blackHoleStrength} min={0.1} max={3} step={0.05} suffix="×" onChange={(value) => patchPhysics({ blackHoleStrength: value })} />
        <div className="panel-divider" />
        <Slider label="Orbital speed" value={config.motion.orbitalSpeed} min={0} max={2} step={0.01} onChange={(value) => patchMotion({ orbitalSpeed: value })} />
        <Slider label="Noise" value={config.motion.noise} min={0} max={1} step={0.01} onChange={(value) => patchMotion({ noise: value })} />
        <Slider label="Simulation speed" value={config.motion.speed} min={0.05} max={5} step={0.05} suffix="×" onChange={(value) => patchMotion({ speed: value })} />
      </>}
      {active === "particles" && <>
        <SectionTitle kicker="Matter configuration" title="Shape the field" detail="Formation morphs are computed in the particle target field." />
        <Slider label="Particle count" value={config.particles.count} min={800} max={14000} step={200} onChange={(value) => patchParticles({ count: value })} />
        <Slider label="Size" value={config.particles.size} min={0.6} max={5} step={0.1} onChange={(value) => patchParticles({ size: value })} />
        <Slider label="Opacity" value={config.particles.opacity} min={0.1} max={1} step={0.01} onChange={(value) => patchParticles({ opacity: value })} />
        <Slider label="Randomness" value={config.particles.randomness} min={0} max={1} step={0.01} onChange={(value) => patchParticles({ randomness: value })} />
        <Slider label="Density" value={config.particles.density} min={0} max={1} step={0.01} onChange={(value) => patchParticles({ density: value })} />
        <div className="formation-grid">{formationData.map(({ id, label }) => <button key={id} onClick={() => onPatch({ formation: id })} className={config.formation === id ? "formation-option active" : "formation-option"}>{label}</button>)}</div>
        {config.formation === "text" && <label className="text-input"><span>Particle text</span><input value={config.customText} maxLength={10} onChange={(event) => onPatch({ customText: event.target.value })} placeholder="ATHARV" /></label>}
      </>}
      {active === "gestures" && <>
        <SectionTitle kicker="Gesture lab" title="Map your forces" detail="The camera processes hand landmarks locally in your browser." />
        <div className="gesture-list">{gestureOptions.map((gesture) => <label key={gesture}><span>{gesture === "two" ? "Two fingers" : gesture}</span><select value={config.interaction.gestureMap[gesture]} onChange={(event) => patchInteraction({ gestureMap: { ...config.interaction.gestureMap, [gesture]: event.target.value as GestureAction } })}>{actions.map((action) => <option key={action} value={action}>{action}</option>)}</select></label>)}</div>
        <button className="secondary-action" onClick={onResetControls}><RotateCcw size={15} />Restore default controls</button>
        <div className="gesture-card"><Hand size={18} /><p><b>Default control language</b><br />Point attracts. Pinch grabs. Open palm repels. A fist forms a black hole. Two pinches can collide.</p></div>
      </>}
      {active === "visuals" && <>
        <SectionTitle kicker="Optical field" title="Set the atmosphere" detail="Appearance is driven by the active GPU particle field." />
        <div className="color-pair"><label><span>Core</span><input aria-label="Core particle color" type="color" value={config.visuals.colorA} onChange={(event) => patchVisuals({ colorA: event.target.value })} /></label><label><span>Edge</span><input aria-label="Edge particle color" type="color" value={config.visuals.colorB} onChange={(event) => patchVisuals({ colorB: event.target.value })} /></label></div>
        <div className="select-row"><span>Color behavior</span><select value={config.visuals.colorStyle} onChange={(event) => patchVisuals({ colorStyle: event.target.value as HoloConfig["visuals"]["colorStyle"] })}><option value="gradient">Gradient</option><option value="single">Single colour</option><option value="velocity">Velocity</option><option value="rainbow">Spectrum</option><option value="random">Random</option><option value="palette">Palette</option></select></div>
        <Slider label="Background" value={config.visuals.backgroundIntensity} min={0} max={1} step={0.01} onChange={(value) => patchVisuals({ backgroundIntensity: value })} />
        <Slider label="Bloom" value={config.visuals.bloom} min={0} max={1.5} step={0.01} onChange={(value) => patchVisuals({ bloom: value })} />
        <Slider label="Glow" value={config.visuals.glow} min={0} max={1.5} step={0.01} onChange={(value) => patchVisuals({ glow: value })} />
        <Slider label="Fog" value={config.visuals.fog} min={0} max={1} step={0.01} onChange={(value) => patchVisuals({ fog: value })} />
        <Toggle label="Motion trails" checked={config.visuals.trails} onChange={(value) => patchVisuals({ trails: value })} />
        <Toggle label="Camera shake" checked={config.visuals.cameraShake} onChange={(value) => patchVisuals({ cameraShake: value })} />
        <Toggle label="Audio reactive" checked={config.visuals.audioReactive} onChange={(value) => patchVisuals({ audioReactive: value })} />
      </>}
      {active === "collision" && <>
        <SectionTitle kicker="Collision lab" title="Control material response" detail="Sampled local collisions transfer momentum while keeping the field responsive." />
        <div className="select-row"><span>Collision mode</span><select value={config.collisionMode} onChange={(event) => onPatch({ collisionMode: event.target.value as CollisionMode })}>{["bounce", "merge", "explode", "elastic", "soft"].map((mode) => <option key={mode} value={mode}>{mode}</option>)}</select></div>
        <Slider label="Collision energy" value={config.collisionEnergy} min={0} max={100} step={1} suffix="%" onChange={(value) => onPatch({ collisionEnergy: value })} />
        <Slider label="Collision strength" value={config.physics.collisionStrength} min={0} max={1.5} step={0.01} onChange={(value) => patchPhysics({ collisionStrength: value })} />
        <Toggle label="Shockwaves" checked={config.shockwave} onChange={(value) => onPatch({ shockwave: value })} />
        <Toggle label="Particle fragmentation" checked={config.fragmentation} onChange={(value) => onPatch({ fragmentation: value })} />
        <button className="primary-action" onClick={onCapture}><Camera size={16} />Capture collision frame</button>
      </>}
      {active === "calibration" && <>
        <SectionTitle kicker="Vision calibration" title="Calibrate your hands" detail="Adjust the local landmark interpreter. No camera frames leave your device." />
        <Slider label="Pinch threshold" value={config.interaction.pinchThreshold} min={0.025} max={0.14} step={0.001} onChange={(value) => patchInteraction({ pinchThreshold: value })} />
        <Slider label="Force strength" value={config.interaction.forceStrength} min={0.1} max={2} step={0.01} onChange={(value) => patchInteraction({ forceStrength: value })} />
        <Slider label="Smoothing" value={config.interaction.smoothing} min={0} max={1} step={0.01} onChange={(value) => patchInteraction({ smoothing: value })} />
        <Slider label="Interaction radius" value={config.interaction.radius} min={0.08} max={0.45} step={0.01} onChange={(value) => patchInteraction({ radius: value })} />
        <div className="select-row"><span>Dominant hand</span><select value={config.interaction.dominantHand} onChange={(event) => patchInteraction({ dominantHand: event.target.value as HoloConfig["interaction"]["dominantHand"] })}><option value="auto">Auto</option><option value="left">Left</option><option value="right">Right</option></select></div>
        <div className="calibration-meter"><span>Pinch detection</span><b>{Math.round((1 - config.interaction.pinchThreshold / 0.14) * 100)}%</b><i><em style={{ width: `${(1 - config.interaction.pinchThreshold / 0.14) * 100}%` }} /></i></div>
      </>}
      {active === "performance" && <>
        <SectionTitle kicker="Adaptive quality" title="Optimize the universe" detail="The renderer keeps interactive physics responsive while GPU depth layers expand the visible world." />
        <div className="quality-grid">{(["eco", "balanced", "high", "ultra", "extreme", "custom"] as QualityTier[]).map((tier) => <button key={tier} className={config.qualityTier === tier ? "quality-option active" : "quality-option"} onClick={() => onPatch({ qualityTier: tier })}><b>{tier}</b><span>{tier === "eco" ? "12K" : tier === "balanced" ? "30K" : tier === "high" ? "60K" : tier === "ultra" ? "120K" : tier === "extreme" ? "UP TO 220K" : "manual"}</span></button>)}</div>
        <div className="performance-readout"><span>RENDERED NOW</span><b>{metrics.particleCount.toLocaleString()}</b><span>TARGET · {metrics.targetParticles.toLocaleString()}</span><span>{metrics.renderMode.toUpperCase()}</span></div>
        <Toggle label="Force performance mode" checked={config.performanceMode} onChange={(value) => onPatch({ performanceMode: value })} />
        <button className="primary-action" onClick={() => onPatch({ qualityTier: "extreme", performanceMode: false, particles: { ...config.particles, density: 1, trailLength: 0.9 }, physics: { ...config.physics, turbulence: Math.max(0.48, config.physics.turbulence), explosionPower: Math.max(1.6, config.physics.explosionPower) } })}><Sparkles size={16} />Extreme Universe</button>
        <div className="gesture-card"><Gauge size={18} /><p><b>Optimized for your device</b><br />Low frame rates reduce workload gradually. Stable performance restores detail without a visual jump.</p></div>
      </>}
      {active === "presets" && <>
        <SectionTitle kicker="Memory bank" title="Universe presets" detail="Built-in and saved configurations update the running field immediately." />
        <div className="preset-list">{BUILT_IN_PRESETS.map((preset) => <button key={preset.id} onClick={() => onPreset(preset)}><span><Sparkles size={15} />{preset.name}</span>{preset.shortcut && <kbd>{preset.shortcut}</kbd>}</button>)}</div>
        <div className="panel-divider" />
        <div className="preset-toolbar"><button className="secondary-action" onClick={onSavePreset}><Save size={15} />Save current</button><button className="icon-action" title="Import preset" onClick={() => fileRef.current?.click()}><Upload size={15} /></button><input ref={fileRef} type="file" accept="application/json" hidden onChange={(event) => importPreset(event.target.files?.[0])} /></div>
        {customPresets.length > 0 && <div className="saved-presets">{customPresets.map((preset) => <div key={preset.id}><button onClick={() => onPreset(preset)}>{preset.name}</button><button aria-label={`Delete ${preset.name}`} onClick={() => onDeletePreset(preset.id)}><Trash2 size={14} /></button><a href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(preset, null, 2))}`} download={`${preset.name.toLowerCase().replace(/\s+/g, "-")}.holoflux.json`}><Download size={14} /></a></div>)}</div>}
      </>}
    </section>
  </aside>;
}

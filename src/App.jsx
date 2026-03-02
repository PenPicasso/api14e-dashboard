import { useState, useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine, ResponsiveContainer,
} from "recharts";
import {
  Activity, Gauge, Thermometer, Wind, Pipette,
  Shield, AlertTriangle, Zap,
} from "lucide-react";

// ── Physics ──────────────────────────────────────────────────────────────────
function calcPhysics({ pressure, temp, gasFlow, molWeight, pipeId, cFactor, zFactor }) {
  const rho = ((pressure + 14.7) * molWeight) / (10.732 * (temp + 459.67) * zFactor);
  const Ve = cFactor / Math.sqrt(rho);
  const Vact = ((0.06 * gasFlow * zFactor * (temp + 459.67)) / ((pressure + 14.7) * pipeId ** 2)) * 100;
  const pass = Vact <= Ve;
  const ratio = Vact / Ve;
  return { rho, Ve, Vact, pass, ratio };
}

// ── 3D Scene ─────────────────────────────────────────────────────────────────
function PipeWall({ radius }) {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[radius, radius, 6, 64, 1, true]} />
      <meshStandardMaterial color="#1e3a5f" metalness={0.85} roughness={0.2}
        side={THREE.DoubleSide} transparent opacity={0.8} />
    </mesh>
  );
}

function GasFlow({ radius, pass }) {
  const matRef = useRef();
  const t = useRef(0);
  useFrame((_, dt) => {
    t.current += dt;
    if (!matRef.current) return;
    if (pass) {
      matRef.current.color.setHSL(0.58, 0.9, 0.45 + Math.sin(t.current * 1.5) * 0.05);
      matRef.current.emissiveIntensity = 0.4 + Math.sin(t.current * 1.5) * 0.1;
    } else {
      const pulse = Math.abs(Math.sin(t.current * 4));
      matRef.current.color.setHSL(0.0, 0.95, 0.35 + pulse * 0.2);
      matRef.current.emissiveIntensity = 0.6 + pulse * 0.7;
    }
  });
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[radius * 0.84, radius * 0.84, 5.8, 48]} />
      <meshStandardMaterial ref={matRef}
        color={pass ? "#1e90ff" : "#ff2222"}
        emissive={pass ? "#0044ff" : "#ff0000"}
        emissiveIntensity={0.5} transparent opacity={0.45} roughness={0.1} />
    </mesh>
  );
}

function FlowParticles({ radius, pass }) {
  const count = 100;
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = Math.random() * radius * 0.8;
      const theta = Math.random() * Math.PI * 2;
      arr[i * 3] = Math.cos(theta) * r;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 5.6;
      arr[i * 3 + 2] = Math.sin(theta) * r;
    }
    return arr;
  }, [radius]);
  const speeds = useMemo(() => Array.from({ length: count }, () => 0.5 + Math.random() * 2.5), []);
  const geomRef = useRef();
  useFrame((_, dt) => {
    if (!geomRef.current) return;
    const pos = geomRef.current.attributes.position.array;
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] -= dt * speeds[i] * (pass ? 1.0 : 2.8);
      if (pos[i * 3 + 1] < -2.8) pos[i * 3 + 1] = 2.8;
    }
    geomRef.current.attributes.position.needsUpdate = true;
  });
  return (
    <points>
      <bufferGeometry ref={geomRef}>
        <bufferAttribute attach="attributes-position" array={positions} count={count} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color={pass ? "#60cfff" : "#ff6060"} size={0.05} transparent opacity={0.85} sizeAttenuation />
    </points>
  );
}

function Scene({ pipeId, pass, ratio }) {
  const radius = (pipeId / 2) * 0.18;
  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[5, 5, 5]} intensity={1.2} color="#4488ff" />
      <pointLight position={[-5, -3, -3]} intensity={0.8} color={pass ? "#0066ff" : "#ff2200"} />
      <spotLight position={[0, 8, 0]} angle={0.4} penumbra={0.8} intensity={1.5}
        color={pass ? "#88ccff" : "#ff8844"} castShadow />
      <PipeWall radius={radius} />
      <GasFlow radius={radius} pass={pass} ratio={ratio} />
      <FlowParticles radius={radius} pass={pass} />
      <OrbitControls enablePan={false} minDistance={2} maxDistance={14} />
    </>
  );
}

// ── Slider ───────────────────────────────────────────────────────────────────
function Slider({ icon: Icon, label, unit, value, min, max, step = 1, onChange, color = "#38bdf8" }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Icon size={12} color={color} />
          <span style={{ fontSize: 10, letterSpacing: "0.12em", color: "#64748b", textTransform: "uppercase" }}>{label}</span>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color }}>
          {typeof value === "number" && !Number.isInteger(value) ? value.toFixed(2) : value}
          <span style={{ color: "#334155", marginLeft: 3 }}>{unit}</span>
        </span>
      </div>
      <div style={{ position: "relative", height: 6, background: "#0a1628", borderRadius: 3 }}>
        <div style={{ position: "absolute", height: "100%", width: `${pct}%`,
          background: `linear-gradient(90deg,#0f2540,${color})`, borderRadius: 3 }} />
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ position: "absolute", inset: 0, width: "100%", opacity: 0, cursor: "pointer", height: "100%" }} />
      </div>
    </div>
  );
}

// ── Chart ─────────────────────────────────────────────────────────────────────
function ErosionChart({ pressure, physics, params }) {
  const data = useMemo(() => {
    const pts = [];
    for (let p = 100; p <= 5000; p += 60) {
      const ph = calcPhysics({ ...params, pressure: p });
      pts.push({ pressure: p, Ve: +ph.Ve.toFixed(2), Vact: +ph.Vact.toFixed(2) });
    }
    return pts;
  }, [params.temp, params.gasFlow, params.molWeight, params.pipeId, params.cFactor, params.zFactor]);

  const vactColor = physics.pass ? "#34d399" : "#f87171";
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 6, right: 14, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="veG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="vaG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={vactColor} stopOpacity={0.3} />
            <stop offset="95%" stopColor={vactColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#0f2540" />
        <XAxis dataKey="pressure" stroke="#1e3a5f" tick={{ fill: "#475569", fontSize: 9, fontFamily: "monospace" }}
          label={{ value: "Pressure (psig)", position: "insideBottom", offset: -2, fill: "#334155", fontSize: 9 }} />
        <YAxis stroke="#1e3a5f" tick={{ fill: "#475569", fontSize: 9, fontFamily: "monospace" }}
          label={{ value: "ft/s", angle: -90, position: "insideLeft", fill: "#334155", fontSize: 9 }} />
        <Tooltip contentStyle={{ background: "#040f1f", border: "1px solid #1e3a5f", borderRadius: 4, fontSize: 10, fontFamily: "monospace" }}
          labelStyle={{ color: "#64748b" }} />
        <Legend wrapperStyle={{ fontSize: 10, fontFamily: "monospace", color: "#64748b" }} />
        <Area type="monotone" dataKey="Ve" name="Ve Limit" stroke="#38bdf8" fill="url(#veG)" strokeWidth={1.5} dot={false} />
        <Area type="monotone" dataKey="Vact" name="Vact Actual" stroke={vactColor} fill="url(#vaG)" strokeWidth={1.5} dot={false} />
        <ReferenceLine x={pressure} stroke="#facc15" strokeDasharray="4 3" strokeWidth={1.5}
          label={{ value: "▲ NOW", position: "top", fill: "#facc15", fontSize: 9 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [pressure, setPressure] = useState(1500);
  const [temp, setTemp] = useState(80);
  const [gasFlow, setGasFlow] = useState(100);
  const [molWeight, setMolWeight] = useState(20);
  const [pipeId, setPipeId] = useState(8);
  const [cFactor, setCFactor] = useState(150);
  const [zFactor, setZFactor] = useState(0.9);

  const params = { pressure, temp, gasFlow, molWeight, pipeId, cFactor, zFactor };
  const physics = calcPhysics(params);
  const rc = physics.pass ? (physics.ratio > 0.8 ? "#fbbf24" : "#34d399") : "#f87171";

  const S = { fontFamily: "'IBM Plex Mono', monospace", background: "#020c1b", color: "#cbd5e1",
    height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" };

  return (
    <div style={S}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #0f2540", padding: "8px 18px", display: "flex",
        alignItems: "center", justifyContent: "space-between", background: "#020c1b", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Zap size={16} color="#38bdf8" />
          <span style={{ fontSize: 12, letterSpacing: "0.14em", color: "#38bdf8", fontWeight: 700, textTransform: "uppercase" }}>
            API 14E · Erosional Velocity Monitor
          </span>
          <span style={{ fontSize: 9, padding: "2px 7px", border: "1px solid #1e3a5f", borderRadius: 3, color: "#334155" }}>REV 2.1</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 10, color: "#475569" }}>ρ = <span style={{ color: "#38bdf8" }}>{physics.rho.toFixed(4)}</span> lb/ft³</span>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: physics.pass ? "#34d399" : "#f87171",
            boxShadow: `0 0 8px ${physics.pass ? "#34d399" : "#f87171"}` }} />
          <span style={{ fontSize: 10, color: physics.pass ? "#34d399" : "#f87171" }}>
            {physics.pass ? "NOMINAL" : "⚠ ALERT"}
          </span>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Sidebar */}
        <div style={{ width: 230, padding: "14px 12px", borderRight: "1px solid #0f2540",
          overflowY: "auto", background: "#010810", flexShrink: 0 }}>
          <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "#1e3a5f", marginBottom: 14, textTransform: "uppercase" }}>◈ Input Parameters</div>
          <Slider icon={Gauge}       label="Pressure"    unit="psig"      value={pressure}   min={100}  max={5000} onChange={setPressure}   color="#38bdf8" />
          <Slider icon={Thermometer} label="Temperature" unit="°F"        value={temp}       min={40}   max={300}  onChange={setTemp}       color="#fb923c" />
          <Slider icon={Wind}        label="Gas Flow"    unit="MMSCFD"    value={gasFlow}    min={1}    max={500}  onChange={setGasFlow}    color="#a78bfa" />
          <Slider icon={Activity}    label="Mol Weight"  unit="lb/lbmol"  value={molWeight}  min={16}   max={44}   onChange={setMolWeight}  color="#34d399" step={0.5} />
          <Slider icon={Pipette}     label="Pipe ID"     unit="in"        value={pipeId}     min={1}    max={24}   onChange={setPipeId}     color="#f472b6" />
          <Slider icon={Shield}      label="C-Factor"    unit=""          value={cFactor}    min={100}  max={250}  onChange={setCFactor}    color="#fbbf24" />
          <Slider icon={Activity}    label="Z-Factor"    unit=""          value={zFactor}    min={0.7}  max={1.0}  onChange={setZFactor}    color="#60a5fa" step={0.01} />
          <div style={{ borderTop: "1px solid #0f2540", paddingTop: 14, marginTop: 4 }}>
            <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "#1e3a5f", marginBottom: 10, textTransform: "uppercase" }}>◈ Derived Values</div>
            {[["Gas Density", physics.rho.toFixed(4), "lb/ft³"], ["Ve Limit", physics.Ve.toFixed(2), "ft/s"],
              ["Vact", physics.Vact.toFixed(2), "ft/s"], ["Ratio V/Ve", (physics.ratio * 100).toFixed(1), "%"]
            ].map(([lbl, val, u]) => (
              <div key={lbl} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 9, color: "#334155" }}>{lbl}</span>
                <span style={{ fontSize: 9, color: "#94a3b8" }}>{val} <span style={{ color: "#1e3a5f" }}>{u}</span></span>
              </div>
            ))}
          </div>
        </div>

        {/* Center + Right */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
            {/* 3D Viewport */}
            <div style={{ flex: 1, position: "relative", background: "#010810" }}>
              <div style={{ position: "absolute", top: 8, left: 10, fontSize: 8, letterSpacing: "0.15em",
                color: "#1e3a5f", textTransform: "uppercase", zIndex: 10 }}>
                ◈ 3D Pipeline · ID {pipeId}" · Drag to orbit
              </div>
              <Canvas camera={{ position: [4, 2, 6], fov: 45 }}
                gl={{ antialias: true, alpha: true }}
                style={{ background: "radial-gradient(ellipse at center, #050f20 0%, #010810 100%)", height: "100%" }}>
                <Scene pipeId={pipeId} pass={physics.pass} ratio={physics.ratio} />
              </Canvas>
            </div>

            {/* Status Panel */}
            <div style={{ width: 210, padding: "14px 12px", borderLeft: "1px solid #0f2540",
              display: "flex", flexDirection: "column", gap: 12, background: "#020c1b", flexShrink: 0 }}>
              <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "#1e3a5f", textTransform: "uppercase" }}>◈ Status Monitor</div>

              {/* Status Badge */}
              <div style={{ border: `1px solid ${physics.pass ? "#14532d" : "#7f1d1d"}`, borderRadius: 6,
                padding: "14px 10px", textAlign: "center",
                background: physics.pass ? "rgba(20,83,45,0.15)" : "rgba(127,29,29,0.2)",
                boxShadow: `0 0 18px ${physics.pass ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.12)"}` }}>
                {physics.pass
                  ? <Shield size={26} color="#34d399" style={{ margin: "0 auto 8px" }} />
                  : <AlertTriangle size={26} color="#f87171" style={{ margin: "0 auto 8px" }} />}
                <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: "0.2em",
                  color: physics.pass ? "#34d399" : "#f87171", textTransform: "uppercase" }}>
                  {physics.pass ? "✓ PASS" : "✗ FAIL"}
                </div>
                <div style={{ fontSize: 9, color: "#334155", marginTop: 4 }}>
                  {physics.pass ? "Below Erosional Limit" : "EROSIVE CONDITIONS"}
                </div>
              </div>

              {/* Velocity Bars */}
              {[{ lbl: "Vact Actual", val: physics.Vact, color: rc },
                { lbl: "Ve Limit",   val: physics.Ve,   color: "#38bdf8" }].map(({ lbl, val, color }) => (
                <div key={lbl}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 9, color: "#334155" }}>{lbl}</span>
                    <span style={{ fontSize: 9, color }}>{val.toFixed(2)} ft/s</span>
                  </div>
                  <div style={{ height: 4, background: "#0a1628", borderRadius: 2 }}>
                    <div style={{ height: "100%", borderRadius: 2, transition: "width 0.3s",
                      background: color, boxShadow: `0 0 6px ${color}`,
                      width: `${Math.min((val / Math.max(physics.Ve, physics.Vact)) * 100, 100)}%` }} />
                  </div>
                </div>
              ))}

              {/* Ratio */}
              <div style={{ borderTop: "1px solid #0f2540", paddingTop: 10, textAlign: "center" }}>
                <div style={{ fontSize: 9, color: "#1e3a5f", marginBottom: 6 }}>EROSION RATIO</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: rc, lineHeight: 1,
                  textShadow: `0 0 20px ${rc}` }}>
                  {(physics.ratio * 100).toFixed(1)}<span style={{ fontSize: 14 }}>%</span>
                </div>
                <div style={{ fontSize: 9, color: "#1e3a5f", marginTop: 4 }}>Vact / Ve</div>
              </div>

              {/* Point */}
              <div style={{ borderTop: "1px solid #0f2540", paddingTop: 10 }}>
                <div style={{ fontSize: 9, color: "#1e3a5f", marginBottom: 8 }}>OPERATING POINT</div>
                {[["Pressure", `${pressure} psig`], ["Flow", `${gasFlow} MMSCFD`], ["Pipe ID", `${pipeId} in`]].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 9, color: "#1e3a5f" }}>{k}</span>
                    <span style={{ fontSize: 9, color: "#475569" }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Chart */}
          <div style={{ height: 195, borderTop: "1px solid #0f2540", padding: "8px 14px 4px", background: "#010810", flexShrink: 0 }}>
            <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "#1e3a5f", marginBottom: 4, textTransform: "uppercase" }}>
              ◈ Erosion Curve · Ve vs Vact over Pressure Range
            </div>
            <div style={{ height: 158 }}>
              <ErosionChart pressure={pressure} physics={physics} params={params} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

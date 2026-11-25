import { ChevronDown, ChevronUp } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { InspectorPanel } from './components/InspectorPanel';
import { OperatorPanel } from './components/OperatorPanel';
import {
  APP_TITLE,
  COMPONENT_DETAILS,
  INITIAL_SIMULATION_STATE,
  NODE_DETAILS,
  NODE_ORDER,
  TEAM_MEMBERS,
  computeSimulationTelemetry,
} from './data/paSystemData';
import { PAStageScene } from './three/PAStageScene';
import type {
  CameraMode,
  ComponentId,
  NodeKey,
  SimulationState,
  TelemetrySnapshot,
} from './types/simulation';
import { PAAudioEngine } from './utils/audioEngine';

interface HoverState {
  componentId: ComponentId | null;
  x: number;
  y: number;
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<PAStageScene | null>(null);
  const audioRef = useRef<PAAudioEngine | null>(null);

  const [simState, setSimState] = useState<SimulationState>(INITIAL_SIMULATION_STATE);
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot>(() =>
    computeSimulationTelemetry(INITIAL_SIMULATION_STATE, 38.0)
  );
  const [panelsVisible, setPanelsVisible] = useState(true);
  const [contextLost, setContextLost] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<HoverState>({
    componentId: null,
    x: 0,
    y: 0,
  });

  const handleSelectNode = useCallback((node: NodeKey) => {
    setSimState((prev) => ({
      ...prev,
      activeNode: node,
      activeComponentId: null,
    }));
  }, []);

  const handleSelectComponentFrom3D = useCallback(
    (componentId: ComponentId | null, parentNode?: NodeKey) => {
      setSimState((prev) => ({
        ...prev,
        activeNode: parentNode ?? prev.activeNode,
        activeComponentId: componentId,
      }));
    },
    []
  );

  const handleSelectComponentFromUI = useCallback((componentId: ComponentId | null) => {
    if (!componentId) {
      setSimState((prev) => {
        stageRef.current?.focusNode(prev.activeNode);
        return { ...prev, activeComponentId: null };
      });
      return;
    }
    const detail = COMPONENT_DETAILS[componentId];
    setSimState((prev) => ({
      ...prev,
      activeNode: detail.parentNode === 'cable' ? prev.activeNode : detail.parentNode,
      activeComponentId: componentId,
    }));
    stageRef.current?.focusComponent(componentId);
  }, []);

  const handleHoverComponent = useCallback(
    (componentId: ComponentId | null, x: number, y: number) => {
      setHoverInfo({ componentId, x, y });
    },
    []
  );

  const handleTelemetryTick = useCallback((snap: TelemetrySnapshot) => {
    setTelemetry(snap);
  }, []);

  // Initialize Three.js Scene and Web Audio Engine once
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const audio = new PAAudioEngine();
    audioRef.current = audio;

    const stage = new PAStageScene(mount, INITIAL_SIMULATION_STATE, {
      onSelectNode: handleSelectNode,
      onSelectComponent: handleSelectComponentFrom3D,
      onHoverComponent: handleHoverComponent,
      onTelemetryTick: handleTelemetryTick,
      onContextLost: (lost) => setContextLost(lost),
    });
    stageRef.current = stage;

    return () => {
      stage.dispose();
      stageRef.current = null;
      audio.dispose();
      audioRef.current = null;
    };
  }, [
    handleSelectNode,
    handleSelectComponentFrom3D,
    handleHoverComponent,
    handleTelemetryTick,
  ]);

  // Sync simulation state to Three.js scene and audio engine
  useEffect(() => {
    stageRef.current?.updateState(simState);
    audioRef.current?.update(simState, telemetry);
  }, [simState, telemetry]);

  // Keyboard shortcut 'H' to toggle HUD side panels
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        setPanelsVisible((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const updateSimState = useCallback((patch: Partial<SimulationState>) => {
    setSimState((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleReset = useCallback(() => {
    setSimState(INITIAL_SIMULATION_STATE);
    stageRef.current?.setCameraPreset('overview', INITIAL_SIMULATION_STATE.activeNode);
  }, []);

  const focusNode = useCallback((key: NodeKey) => {
    setSimState((prev) => ({
      ...prev,
      activeNode: key,
      activeComponentId: null,
    }));
    stageRef.current?.focusNode(key);
  }, []);

  const setCameraPreset = useCallback(
    (mode: CameraMode) => {
      stageRef.current?.setCameraPreset(mode, simState.activeNode);
    },
    [simState.activeNode]
  );

  const tempStatusText =
    telemetry.tempC > 65
      ? 'Peringatan Overheat'
      : telemetry.tempC > 50
        ? 'Suhu Meningkat'
        : 'Normal (< 65°C)';

  const tempColorClass =
    telemetry.tempC > 65
      ? 'text-red-400'
      : telemetry.tempC > 50
        ? 'text-amber-400'
        : 'text-emerald-400';

  const soundSubText = simState.alarm
    ? 'Alarm Prioritas'
    : simState.ptt
      ? 'Paging PTT Aktif'
      : simState.bgm
        ? 'BGM Aktif'
        : 'Standby Sunyi';

  const systemStatusLabel = telemetry.protectTripped
    ? simState.fault === 'short'
      ? 'SHORT CIRCUIT'
      : 'OVERLOAD'
    : telemetry.priorityActive
      ? 'PRIORITY OVERRIDE'
      : 'NORMAL';

  const systemStatusColor = telemetry.protectTripped
    ? 'text-red-400'
    : telemetry.priorityActive
      ? 'text-amber-400'
      : 'text-emerald-400';

  const systemStatusSub = telemetry.protectTripped
    ? 'Proteksi Aktif (Relay Putus)'
    : telemetry.priorityActive
      ? 'BGM Diredam Otomatis'
      : 'Jalur 100V Line Aktif';

  const hoveredDetail = hoverInfo.componentId
    ? COMPONENT_DETAILS[hoverInfo.componentId]
    : null;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#070d19] select-none">
      {/* Isolated WebGL Canvas Container */}
      <div
        ref={canvasMountRef}
        className="absolute inset-0 w-full h-full"
        aria-label="Viewport Simulasi 3D Public Address System"
      />

      {/* Floating 3D Component / Sensor Hover Tooltip */}
      {hoveredDetail && (
        <div
          className="fixed z-20 pointer-events-none px-2.5 py-1.5 rounded-lg bg-[#0b1324]/95 border border-sky-500/60 shadow-xl text-xs"
          style={{
            left: Math.min(window.innerWidth - 260, hoverInfo.x + 14),
            top: Math.max(12, hoverInfo.y - 38),
          }}
        >
          <div className="text-[10px] font-medium text-sky-400">
            {hoveredDetail.category} · Klik untuk inspeksi
          </div>
          <div className="font-semibold text-slate-100 whitespace-nowrap">
            {hoveredDetail.title}
          </div>
        </div>
      )}

      {/* WebGL Context Lost Fallback */}
      {contextLost && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#070d19]/95 p-6">
          <div className="max-w-md rounded-xl border border-slate-700 bg-[#0b1324] p-6 text-center">
            <h2 className="font-display text-lg font-semibold text-slate-100">
              Konteks WebGL Terhenti Sementara
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Peramban sedang memulihkan akselerasi grafis 3D. Muat ulang halaman jika tampilan belum kembali.
            </p>
          </div>
        </div>
      )}

      {/* Top Header & Live Telemetry Strip */}
      <header className="absolute top-3 left-3 right-3 z-10 flex flex-col xl:flex-row xl:items-start xl:justify-between gap-3 pointer-events-none">
        <div className="pointer-events-auto bg-[#0b1324]/95 border border-slate-800 rounded-xl px-4 py-3 shadow-2xl max-w-2xl">
          <h1 className="font-display text-sm sm:text-base font-bold tracking-wide text-sky-400 text-balance">
            {APP_TITLE}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] font-medium text-slate-300">
            <span className="text-slate-400">Pembuat:</span>
            {TEAM_MEMBERS.map((member, idx) => (
              <span key={member} className="inline-flex items-center gap-2.5">
                <span>{member}</span>
                {idx < TEAM_MEMBERS.length - 1 && (
                  <span className="text-slate-600" aria-hidden="true">
                    ·
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* 4-Channel Real-Time Telemetry */}
        <div className="pointer-events-auto grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => handleSelectComponentFromUI('sensor-temp')}
            className="text-left bg-[#0b1324]/95 border border-slate-800 hover:border-sky-500/60 rounded-xl px-3.5 py-2.5 min-w-[142px] shadow-xl transition-colors focus-visible:outline-2 focus-visible:outline-sky-400"
          >
            <div className="text-[10px] font-medium text-slate-400">
              Suhu Heatsink (DS18B20)
            </div>
            <div className={`text-sm font-bold font-mono-tabular mt-0.5 ${tempColorClass}`}>
              {telemetry.tempC.toFixed(1)} °C
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 truncate">{tempStatusText}</div>
          </button>

          <button
            type="button"
            onClick={() => handleSelectComponentFromUI('sensor-sound')}
            className="text-left bg-[#0b1324]/95 border border-slate-800 hover:border-sky-500/60 rounded-xl px-3.5 py-2.5 min-w-[142px] shadow-xl transition-colors focus-visible:outline-2 focus-visible:outline-sky-400"
          >
            <div className="text-[10px] font-medium text-slate-400">
              Suara Input (MAX4466)
            </div>
            <div className="text-sm font-bold font-mono-tabular text-amber-400 mt-0.5">
              {telemetry.soundDb.toFixed(1)} dB
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 truncate">{soundSubText}</div>
          </button>

          <button
            type="button"
            onClick={() => handleSelectComponentFromUI('sensor-current')}
            className="text-left bg-[#0b1324]/95 border border-slate-800 hover:border-sky-500/60 rounded-xl px-3.5 py-2.5 min-w-[148px] shadow-xl transition-colors focus-visible:outline-2 focus-visible:outline-sky-400"
          >
            <div className="text-[10px] font-medium text-slate-400">
              Arus Beban (ACS712/CT)
            </div>
            <div
              className={`text-sm font-bold font-mono-tabular mt-0.5 ${
                telemetry.protectTripped ? 'text-red-400' : 'text-emerald-400'
              }`}
            >
              {telemetry.currentA.toFixed(2)} A
            </div>
            <div className="text-[10px] font-mono-tabular text-slate-400 mt-0.5 truncate">
              {simState.tapWatts}W × {simState.spkCount} · {simState.cableMeters}m
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSelectComponentFromUI('amp-protect')}
            className="text-left bg-[#0b1324]/95 border border-slate-800 hover:border-sky-500/60 rounded-xl px-3.5 py-2.5 min-w-[154px] shadow-xl transition-colors focus-visible:outline-2 focus-visible:outline-sky-400"
          >
            <div className="text-[10px] font-medium text-slate-400">Status Sistem</div>
            <div className={`text-sm font-bold font-mono-tabular mt-0.5 ${systemStatusColor}`}>
              {systemStatusLabel}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 truncate">
              {systemStatusSub}
            </div>
          </button>
        </div>
      </header>

      {/* Left & Right Collapsible Side Panels */}
      {panelsVisible && (
        <div className="absolute top-[98px] left-3 right-3 z-10 flex justify-between items-start pointer-events-none">
          <div className="hidden md:block">
            <OperatorPanel
              simState={simState}
              onUpdate={updateSimState}
              onReset={handleReset}
            />
          </div>
          <div className="hidden lg:block">
            <InspectorPanel
              simState={simState}
              telemetry={telemetry}
              onSelectComponent={handleSelectComponentFromUI}
            />
          </div>
        </div>
      )}

      {/* Bottom Signal Chain & Camera Dock */}
      <footer className="absolute bottom-3 left-3 right-3 z-10 flex justify-center pointer-events-none">
        <div className="pointer-events-auto w-full max-w-[1380px] bg-[#0b1324]/95 border border-slate-800 rounded-xl px-3.5 py-2.5 shadow-2xl flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-slate-400 mr-1 whitespace-nowrap">
              Alur Rantai:
            </span>
            {NODE_ORDER.map((key) => {
              const info = NODE_DETAILS[key];
              const active = simState.activeNode === key && !simState.activeComponentId;
              const childSelected =
                simState.activeNode === key && Boolean(simState.activeComponentId);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => focusNode(key)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-sky-400 ${
                    active
                      ? 'bg-sky-700 border-sky-400 text-white'
                      : childSelected
                        ? 'bg-sky-900/70 border-sky-500/80 text-sky-100'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-sky-500/60 hover:text-white'
                  }`}
                >
                  {info.stepLabel}. {info.shortName}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-slate-400 mr-1 whitespace-nowrap">
              Kamera:
            </span>
            <button
              type="button"
              onClick={() => setCameraPreset('overview')}
              className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-slate-900 border border-slate-700 text-slate-300 hover:border-sky-500/60 hover:text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-sky-400"
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setCameraPreset('closeup')}
              className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-slate-900 border border-slate-700 text-slate-300 hover:border-sky-500/60 hover:text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-sky-400"
            >
              Fokus Unit
            </button>
            <button
              type="button"
              onClick={() => setCameraPreset('sensors')}
              className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-slate-900 border border-slate-700 text-slate-300 hover:border-sky-500/60 hover:text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-sky-400"
            >
              Posisi Sensor
            </button>

            <button
              type="button"
              onClick={() => setPanelsVisible((v) => !v)}
              className="ml-1 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-slate-900 border border-slate-700 text-slate-200 hover:border-sky-500/60 hover:text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-sky-400"
            >
              {panelsVisible ? (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>Sembunyikan Panel</span>
                </>
              ) : (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>Tampilkan Panel</span>
                </>
              )}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

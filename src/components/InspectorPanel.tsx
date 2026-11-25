import { ArrowLeft } from 'lucide-react';
import {
  ALL_SENSORS,
  COMPONENT_DETAILS,
  NODE_COMPONENTS,
  NODE_DETAILS,
} from '../data/paSystemData';
import type { ComponentId, SimulationState, TelemetrySnapshot } from '../types/simulation';
import { OscilloscopeCanvas } from './OscilloscopeCanvas';

interface InspectorPanelProps {
  simState: SimulationState;
  telemetry: TelemetrySnapshot;
  onSelectComponent: (componentId: ComponentId | null) => void;
}

function getLiveSensorReading(
  componentId: ComponentId,
  telemetry: TelemetrySnapshot,
  simState: SimulationState
): { label: string; value: string; status: string; tone: string } | null {
  switch (componentId) {
    case 'sensor-sound':
      return {
        label: 'Pembacaan Akustik Input',
        value: `${telemetry.soundDb.toFixed(1)} dB`,
        status: simState.alarm
          ? 'Alarm Prioritas'
          : simState.ptt
            ? 'Paging PTT Aktif'
            : simState.bgm
              ? 'BGM Terdeteksi'
              : 'Ambien Sunyi',
        tone: 'text-amber-400',
      };
    case 'sensor-mixer-temp':
      return {
        label: 'Suhu Kabinet Rak Mixer',
        value: `${telemetry.mixerTempC.toFixed(1)} °C`,
        status: telemetry.mixerTempC > 42 ? 'Hangat' : 'Suhu Kabinet Normal',
        tone: 'text-sky-400',
      };
    case 'sensor-temp':
      return {
        label: 'Suhu Heatsink DS18B20',
        value: `${telemetry.tempC.toFixed(1)} °C`,
        status: telemetry.tempC > 65 ? 'Overheat Warning' : 'Normal (< 65°C)',
        tone:
          telemetry.tempC > 65
            ? 'text-red-400'
            : telemetry.tempC > 50
              ? 'text-amber-400'
              : 'text-emerald-400',
      };
    case 'sensor-current':
      return {
        label: 'Arus Beban 100V Line',
        value: `${telemetry.currentA.toFixed(2)} A`,
        status: telemetry.protectTripped ? 'Trip Proteksi Aktif' : 'Arus Stabil',
        tone: telemetry.protectTripped ? 'text-red-400' : 'text-emerald-400',
      };
    case 'sensor-spl':
      return {
        label: 'Output SPL Ruangan',
        value: `${telemetry.outputSplDb.toFixed(1)} dB`,
        status: telemetry.protectTripped
          ? 'Terputus (Proteksi)'
          : `${simState.spkCount} Speaker · Tap ${simState.tapWatts}W`,
        tone: telemetry.protectTripped ? 'text-red-400' : 'text-emerald-400',
      };
    case 'signal-cable':
      return {
        label: 'Tegangan Ujung Kabel',
        value: `${telemetry.deliveredVoltageV.toFixed(1)} V`,
        status: `Drop -${telemetry.voltageDropV.toFixed(1)} V (${simState.cableMeters} m)`,
        tone: telemetry.protectTripped ? 'text-red-400' : 'text-sky-400',
      };
    default:
      return null;
  }
}

export function InspectorPanel({
  simState,
  telemetry,
  onSelectComponent,
}: InspectorPanelProps) {
  const unitDetail = NODE_DETAILS[simState.activeNode];
  const compDetail = simState.activeComponentId
    ? COMPONENT_DETAILS[simState.activeComponentId]
    : null;
  const unitComponents = NODE_COMPONENTS[simState.activeNode];
  const liveReading = compDetail
    ? getLiveSensorReading(compDetail.id, telemetry, simState)
    : null;

  return (
    <aside
      aria-label="Inspektor Komponen dan Osiloskop"
      className="w-[356px] max-h-[calc(100vh-192px)] overflow-y-auto panel-scroll flex flex-col gap-3 pointer-events-auto"
    >
      {/* Active Component or Unit Inspector Card */}
      <div className="bg-[#0b1324]/95 border border-slate-800 rounded-xl p-4 shadow-2xl">
        {compDetail ? (
          <>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="text-[11px] font-medium tracking-wide text-sky-400 truncate">
                {compDetail.badge}
              </div>
              <button
                type="button"
                onClick={() => onSelectComponent(null)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10.5px] font-medium bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-sky-500/60 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-sky-400"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Ringkasan Unit</span>
              </button>
            </div>

            <h2 className="font-display text-base font-semibold text-slate-50 leading-snug mb-1">
              {compDetail.title}
            </h2>
            <div className="text-[11px] text-slate-400 mb-3">
              Kategori: <span className="text-slate-200 font-medium">{compDetail.category}</span>
            </div>

            {liveReading && (
              <div className="mb-3 rounded-lg bg-slate-900/90 border border-slate-800 px-3 py-2 flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] text-slate-400">{liveReading.label}</div>
                  <div className="text-[11px] text-slate-300 mt-0.5">{liveReading.status}</div>
                </div>
                <div className={`text-sm font-bold font-mono-tabular ${liveReading.tone}`}>
                  {liveReading.value}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <div className="text-[11px] font-semibold tracking-wider text-sky-400 uppercase mb-1">
                  Fungsi Komponen
                </div>
                <p className="text-xs leading-relaxed text-slate-300">{compDetail.func}</p>
              </div>

              <div className="pt-2.5 border-t border-slate-800/80">
                <div className="text-[11px] font-semibold tracking-wider text-sky-400 uppercase mb-1">
                  Prinsip &amp; Peran di Rantai Sinyal
                </div>
                <p className="text-xs leading-relaxed text-slate-300">{compDetail.detail}</p>
              </div>

              <div className="pt-2.5 border-t border-slate-800/80">
                <div className="text-[11px] font-semibold tracking-wider text-sky-400 uppercase mb-1.5">
                  Spesifikasi &amp; Parameter Teknis
                </div>
                <ul className="space-y-1.5 text-[11.5px] leading-relaxed text-slate-300 list-disc pl-4">
                  {compDetail.specs.map((spec) => (
                    <li key={spec}>{spec}</li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="text-[11px] font-medium tracking-wide text-sky-400 mb-1">
              {unitDetail.badge}
            </div>
            <h2 className="font-display text-base font-semibold text-slate-50 leading-snug mb-3">
              {unitDetail.title}
            </h2>

            <div className="space-y-3">
              <div>
                <div className="text-[11px] font-semibold tracking-wider text-sky-400 uppercase mb-1">
                  Fungsi &amp; Prinsip Kerja
                </div>
                <p className="text-xs leading-relaxed text-slate-300">{unitDetail.func}</p>
              </div>

              <div className="pt-2.5 border-t border-slate-800/80">
                <div className="text-[11px] font-semibold tracking-wider text-sky-400 uppercase mb-1">
                  Alur Sinyal &amp; Lapisan / Blok
                </div>
                <p className="text-xs leading-relaxed text-slate-300">{unitDetail.flow}</p>
              </div>

              <div className="pt-2.5 border-t border-slate-800/80">
                <div className="text-[11px] font-semibold tracking-wider text-sky-400 uppercase mb-1.5">
                  Integrasi Sensor &amp; Detail Komponen
                </div>
                <ul className="space-y-1.5 text-[11.5px] leading-relaxed text-slate-300 list-disc pl-4">
                  {unitDetail.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}

        {/* Sub-Component & Sensor Quick Picker */}
        <div className="mt-3.5 pt-3 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10.5px] font-semibold tracking-wider text-sky-400 uppercase">
              Komponen &amp; Sensor ({unitDetail.shortName})
            </span>
            <span className="text-[10px] text-slate-400">Klik 3D atau pilih</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {unitComponents.map((cid) => {
              const item = COMPONENT_DETAILS[cid];
              const isSelected = simState.activeComponentId === cid;
              const isSensor = item.category === 'Sensor Telemetri';
              return (
                <button
                  key={cid}
                  type="button"
                  onClick={() => onSelectComponent(cid)}
                  className={`px-2 py-1 rounded-md text-[10.5px] font-medium border transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-sky-400 ${
                    isSelected
                      ? 'bg-sky-700 border-sky-400 text-white'
                      : isSensor
                        ? 'bg-amber-950/50 border-amber-700/60 text-amber-200 hover:border-amber-400 hover:text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-sky-500/60 hover:text-white'
                  }`}
                >
                  {item.shortName}
                </button>
              );
            })}
          </div>
        </div>

        {/* All 5 Sensors Quick Access */}
        <div className="mt-3 pt-2.5 border-t border-slate-800/80">
          <div className="text-[10.5px] font-semibold tracking-wider text-amber-400 uppercase mb-1.5">
            Pintasan Semua Sensor (5 Titik)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ALL_SENSORS.map((sid) => {
              const sItem = COMPONENT_DETAILS[sid];
              const isSelected = simState.activeComponentId === sid;
              return (
                <button
                  key={sid}
                  type="button"
                  onClick={() => onSelectComponent(sid)}
                  className={`px-2 py-1 rounded-md text-[10.5px] font-medium border transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-sky-400 ${
                    isSelected
                      ? 'bg-amber-600 border-amber-300 text-white'
                      : 'bg-slate-900 border-slate-700 text-amber-300 hover:border-amber-400 hover:text-white'
                  }`}
                >
                  {sItem.shortName}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => onSelectComponent('signal-cable')}
              className={`px-2 py-1 rounded-md text-[10.5px] font-medium border transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-sky-400 ${
                simState.activeComponentId === 'signal-cable'
                  ? 'bg-sky-700 border-sky-400 text-white'
                  : 'bg-slate-900 border-slate-700 text-sky-300 hover:border-sky-400 hover:text-white'
              }`}
            >
              Kabel 100V
            </button>
          </div>
        </div>

        {/* Live 100V Line Electrical Calculation Strip */}
        <div className="mt-3.5 pt-3 border-t border-slate-800/80 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-[10px] text-slate-400">Daya Total</div>
            <div className="text-xs font-semibold font-mono-tabular text-slate-100 mt-0.5">
              {telemetry.totalLoadWatts.toFixed(1)} W
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400">Impedansi 100V</div>
            <div className="text-xs font-semibold font-mono-tabular text-slate-100 mt-0.5">
              {telemetry.lineImpedanceOhm} Ω
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400">Tegangan Ujung</div>
            <div
              className={`text-xs font-semibold font-mono-tabular mt-0.5 ${
                telemetry.protectTripped ? 'text-red-400' : 'text-emerald-400'
              }`}
            >
              {telemetry.deliveredVoltageV.toFixed(1)} V
            </div>
          </div>
        </div>
      </div>

      {/* Real-time 5-Point Oscilloscope Card */}
      <div className="bg-[#0b1324]/95 border border-slate-800 rounded-xl p-4 shadow-2xl">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[11px] font-semibold tracking-wider text-sky-400 uppercase">
            Osiloskop 5 Titik Rantai Sinyal
          </h3>
          <span className="text-[10px] font-mono-tabular text-slate-400">
            Drop: -{telemetry.voltageDropV.toFixed(1)} V
          </span>
        </div>
        <OscilloscopeCanvas simState={simState} telemetry={telemetry} />
      </div>
    </aside>
  );
}

import { RotateCcw, Volume2, VolumeX } from 'lucide-react';
import type { FaultType, SimulationState, TapWatts } from '../types/simulation';

interface OperatorPanelProps {
  simState: SimulationState;
  onUpdate: (patch: Partial<SimulationState>) => void;
  onReset: () => void;
}

export function OperatorPanel({ simState, onUpdate, onReset }: OperatorPanelProps) {
  const toggleFault = (type: Exclude<FaultType, null>) => {
    onUpdate({ fault: simState.fault === type ? null : type });
  };

  return (
    <aside
      aria-label="Panel Kontrol Operator"
      className="w-[288px] max-h-[calc(100vh-192px)] overflow-y-auto panel-scroll bg-[#0b1324]/95 border border-slate-800 rounded-xl p-4 shadow-2xl pointer-events-auto"
    >
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/80">
        <h2 className="text-xs font-semibold tracking-wide text-slate-200">
          Kontrol Operator PA
        </h2>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onUpdate({ audioEnabled: !simState.audioEnabled })}
            title={simState.audioEnabled ? 'Matikan Audio Sintesis' : 'Aktifkan Audio Sintesis'}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-sky-400 ${
              simState.audioEnabled
                ? 'bg-sky-600/25 border-sky-500/60 text-sky-200'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500'
            }`}
          >
            {simState.audioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{simState.audioEnabled ? 'Suara ON' : 'Suara OFF'}</span>
          </button>
          <button
            type="button"
            onClick={onReset}
            title="Reset Parameter"
            className="p-1.5 rounded-md bg-slate-900 border border-slate-700 text-slate-400 hover:text-slate-100 hover:border-slate-500 transition-colors focus-visible:outline-2 focus-visible:outline-sky-400"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Section 1: Sumber & Prioritas */}
      <section className="pb-3.5 mb-3.5 border-b border-slate-800/80">
        <h3 className="text-[11px] font-semibold tracking-wider text-sky-400 uppercase mb-2.5">
          1. Sumber &amp; Prioritas Mixer
        </h3>

        <div className="grid grid-cols-2 gap-2 mb-2">
          <button
            type="button"
            onClick={() => onUpdate({ ptt: !simState.ptt })}
            className={`px-2.5 py-2 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-sky-400 ${
              simState.ptt
                ? 'bg-emerald-700 border-emerald-400 text-white'
                : 'bg-slate-900/90 border-slate-700 text-slate-300 hover:border-sky-500/60 hover:text-white'
            }`}
          >
            PTT Mic: {simState.ptt ? 'ON' : 'OFF'}
          </button>
          <button
            type="button"
            onClick={() => onUpdate({ bgm: !simState.bgm })}
            className={`px-2.5 py-2 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-sky-400 ${
              simState.bgm
                ? 'bg-sky-700 border-sky-400 text-white'
                : 'bg-slate-900/90 border-slate-700 text-slate-300 hover:border-sky-500/60 hover:text-white'
            }`}
          >
            BGM: {simState.bgm ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            type="button"
            onClick={() => onUpdate({ alarm: !simState.alarm })}
            className={`px-2.5 py-2 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-sky-400 ${
              simState.alarm
                ? 'bg-red-700 border-red-400 text-white'
                : 'bg-slate-900/90 border-slate-700 text-slate-300 hover:border-red-500/70 hover:text-white'
            }`}
          >
            Alarm: {simState.alarm ? 'ON' : 'OFF'}
          </button>
          <button
            type="button"
            onClick={() => onUpdate({ explode: !simState.explode })}
            className={`px-2.5 py-2 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-sky-400 ${
              simState.explode
                ? 'bg-amber-600 border-amber-400 text-white'
                : 'bg-slate-900/90 border-slate-700 text-slate-300 hover:border-sky-500/60 hover:text-white'
            }`}
          >
            Explode: {simState.explode ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="space-y-2.5">
          <div>
            <div className="flex justify-between text-[11px] text-slate-300 mb-1">
              <label htmlFor="rng-gain">Gain / Pre-Amp</label>
              <span className="font-mono-tabular text-sky-300">
                {Math.round(simState.gain * 100)}%
              </span>
            </div>
            <input
              id="rng-gain"
              type="range"
              min={10}
              max={100}
              value={Math.round(simState.gain * 100)}
              onChange={(e) => onUpdate({ gain: Number(e.target.value) / 100 })}
              className="pa-slider"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] text-slate-300 mb-1">
              <label htmlFor="rng-eq">EQ Tone (Bass/Mid/Treble)</label>
              <span className="font-mono-tabular text-sky-300">
                {simState.eq >= 0 ? `+${simState.eq}` : simState.eq} dB
              </span>
            </div>
            <input
              id="rng-eq"
              type="range"
              min={-12}
              max={12}
              value={simState.eq}
              onChange={(e) => onUpdate({ eq: Number(e.target.value) })}
              className="pa-slider"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] text-slate-300 mb-1">
              <label htmlFor="rng-fader">Master Fader (Mixing)</label>
              <span className="font-mono-tabular text-sky-300">
                {Math.round(simState.fader * 100)}%
              </span>
            </div>
            <input
              id="rng-fader"
              type="range"
              min={0}
              max={100}
              value={Math.round(simState.fader * 100)}
              onChange={(e) => onUpdate({ fader: Number(e.target.value) / 100 })}
              className="pa-slider"
            />
          </div>
        </div>
      </section>

      {/* Section 2: Power Amp & Gangguan */}
      <section className="pb-3.5 mb-3.5 border-b border-slate-800/80">
        <h3 className="text-[11px] font-semibold tracking-wider text-sky-400 uppercase mb-2.5">
          2. Power Amp &amp; Gangguan
        </h3>

        <div className="space-y-2.5 mb-3">
          <div>
            <div className="flex justify-between text-[11px] text-slate-300 mb-1">
              <label htmlFor="rng-atten">Attenuator Penguat</label>
              <span className="font-mono-tabular text-sky-300">
                {Math.round(simState.atten * 100)}%
              </span>
            </div>
            <input
              id="rng-atten"
              type="range"
              min={0}
              max={100}
              value={Math.round(simState.atten * 100)}
              onChange={(e) => onUpdate({ atten: Number(e.target.value) / 100 })}
              className="pa-slider"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] text-slate-300 mb-1">
              <label htmlFor="rng-cable">Panjang Kabel 100V Line</label>
              <span className="font-mono-tabular text-sky-300">
                {simState.cableMeters} m
              </span>
            </div>
            <input
              id="rng-cable"
              type="range"
              min={10}
              max={400}
              step={10}
              value={simState.cableMeters}
              onChange={(e) => onUpdate({ cableMeters: Number(e.target.value) })}
              className="pa-slider"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => toggleFault('short')}
            className={`px-2.5 py-2 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-sky-400 ${
              simState.fault === 'short'
                ? 'bg-red-700 border-red-400 text-white'
                : 'bg-slate-900/90 border-slate-700 text-slate-300 hover:border-red-500/70 hover:text-white'
            }`}
          >
            Short Circuit
          </button>
          <button
            type="button"
            onClick={() => toggleFault('overload')}
            className={`px-2.5 py-2 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-sky-400 ${
              simState.fault === 'overload'
                ? 'bg-red-700 border-red-400 text-white'
                : 'bg-slate-900/90 border-slate-700 text-slate-300 hover:border-red-500/70 hover:text-white'
            }`}
          >
            Overload
          </button>
        </div>
      </section>

      {/* Section 3: Ceiling Speaker 100V Tap */}
      <section>
        <h3 className="text-[11px] font-semibold tracking-wider text-sky-400 uppercase mb-2.5">
          3. Ceiling Speaker (100V Tap)
        </h3>

        <div className="grid grid-cols-3 gap-1.5 mb-3">
          {([3, 6, 15] as TapWatts[]).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => onUpdate({ tapWatts: w })}
              className={`px-2 py-2 rounded-lg text-[11px] font-medium font-mono-tabular border transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-sky-400 ${
                simState.tapWatts === w
                  ? 'bg-sky-700 border-sky-400 text-white'
                  : 'bg-slate-900/90 border-slate-700 text-slate-300 hover:border-sky-500/60 hover:text-white'
              }`}
            >
              Tap {w}W
            </button>
          ))}
        </div>

        <div>
          <div className="flex justify-between text-[11px] text-slate-300 mb-1">
            <label htmlFor="rng-spk">Jumlah Speaker Paralel</label>
            <span className="font-mono-tabular text-sky-300">
              {simState.spkCount} Unit
            </span>
          </div>
          <input
            id="rng-spk"
            type="range"
            min={1}
            max={6}
            value={simState.spkCount}
            onChange={(e) => onUpdate({ spkCount: Number(e.target.value) })}
            className="pa-slider"
          />
        </div>
      </section>
    </aside>
  );
}

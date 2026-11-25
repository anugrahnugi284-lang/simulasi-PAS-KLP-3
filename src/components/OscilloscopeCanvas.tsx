import { useEffect, useRef } from 'react';
import type { SimulationState, TelemetrySnapshot } from '../types/simulation';

interface OscilloscopeCanvasProps {
  simState: SimulationState;
  telemetry: TelemetrySnapshot;
}

const CHANNELS = [
  { label: '1. Akustik', color: '#38bdf8' },
  { label: '2. Mic mV', color: '#818cf8' },
  { label: '3. Line', color: '#22d3ee' },
  { label: '4. 100V', color: '#facc15' },
  { label: '5. Spk Out', color: '#4ade80' },
];

export function OscilloscopeCanvas({ simState, telemetry }: OscilloscopeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef(simState);
  const teleRef = useRef(telemetry);

  useEffect(() => {
    stateRef.current = simState;
    teleRef.current = telemetry;
  }, [simState, telemetry]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const start = performance.now();

    const renderFrame = (now: number) => {
      const t = (now - start) / 1000;
      const st = stateRef.current;
      const tele = teleRef.current;
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      // Background graticule grid
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.75)';
      ctx.lineWidth = 1;
      for (let gx = 1; gx < 5; gx++) {
        const x = (w / 5) * gx;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      const segW = w / 5;
      const baseAmp = Math.max(0.06, (tele.soundDb - 30) / 70);
      const lineAmp = Math.min(1, baseAmp * (0.4 + st.gain * 0.8) * st.fader);
      const cableAtten = Math.max(0.45, 1 - (st.cableMeters / 400) * 0.35);
      const hvAmp = tele.protectTripped
        ? 0.02
        : Math.min(1.15, lineAmp * (0.5 + st.atten * 1.1));
      const spkAmp = tele.protectTripped
        ? 0.01
        : Math.min(1.15, hvAmp * cableAtten * (st.tapWatts / 15 + 0.35));

      const amps = [
        baseAmp * 0.62,
        baseAmp * 0.36,
        lineAmp * 0.78,
        hvAmp * 0.92,
        spkAmp * 0.88,
      ];

      for (let s = 0; s < 5; s++) {
        ctx.strokeStyle =
          tele.protectTripped && s >= 3 ? '#f87171' : CHANNELS[s].color;
        ctx.lineWidth = 1.7;
        ctx.beginPath();
        const xStart = s * segW;
        const pad = 4;
        for (let px = pad; px <= segW - pad; px += 2) {
          const freq = 0.24 + s * 0.045 + (st.eq / 24) * 0.08;
          const envelope = Math.sin(((px - pad) / (segW - pad * 2)) * Math.PI);
          const y =
            h / 2 +
            Math.sin((xStart + px) * freq + t * 7.5) * (amps[s] * 36 * (0.35 + 0.65 * envelope));
          if (px === pad) ctx.moveTo(xStart + px, y);
          else ctx.lineTo(xStart + px, y);
        }
        ctx.stroke();
      }

      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={316}
        height={104}
        className="w-full h-[104px] rounded-lg bg-[#030712] border border-slate-800 block"
      />
      <div className="grid grid-cols-5 gap-1 mt-2 text-[10px] font-mono-tabular text-slate-400 text-center">
        {CHANNELS.map((ch) => (
          <span key={ch.label} className="truncate flex items-center justify-center gap-1">
            <span
              className="inline-block w-1.5 h-1.5 rounded-xs shrink-0"
              style={{ backgroundColor: ch.color }}
              aria-hidden="true"
            />
            <span className="truncate">{ch.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

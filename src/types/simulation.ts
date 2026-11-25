export type NodeKey = 'mic' | 'mixer' | 'amp' | 'spk';

export type ComponentId =
  // Paging Mic (9 parts)
  | 'mic-base'
  | 'mic-gooseneck'
  | 'mic-grille'
  | 'mic-foam'
  | 'mic-diaphragm'
  | 'mic-coil'
  | 'mic-magnet'
  | 'mic-housing'
  | 'sensor-sound'
  // Pre-Amp / Mixer (7 parts)
  | 'mixer-chassis'
  | 'mixer-gain'
  | 'mixer-eq'
  | 'mixer-priority'
  | 'mixer-faders'
  | 'mixer-buffer'
  | 'sensor-mixer-temp'
  // Power Amp 100V (9 parts)
  | 'amp-chassis'
  | 'amp-psu'
  | 'amp-driver'
  | 'amp-mosfet'
  | 'amp-heatsink'
  | 'sensor-temp'
  | 'amp-protect'
  | 'sensor-current'
  | 'amp-trafo'
  // Ceiling Speaker (8 parts)
  | 'spk-trafo'
  | 'spk-coil'
  | 'spk-magnet'
  | 'spk-spider'
  | 'spk-cone'
  | 'spk-grille'
  | 'spk-parallel'
  | 'sensor-spl'
  // Transmission Cable
  | 'signal-cable';

export type ComponentCategory =
  | 'Transduser'
  | 'Blok Sirkuit'
  | 'Sensor Telemetri'
  | 'Komponen Daya'
  | 'Jalur Transmisi';

export type CameraMode = 'overview' | 'closeup' | 'sensors';

export type FaultType = 'short' | 'overload' | null;

export type TapWatts = 3 | 6 | 15;

export interface SimulationState {
  ptt: boolean;
  bgm: boolean;
  alarm: boolean;
  explode: boolean;
  audioEnabled: boolean;
  gain: number; // 0.1 - 1.0
  eq: number; // -12 to +12 dB
  fader: number; // 0.0 - 1.0
  atten: number; // 0.0 - 1.0
  cableMeters: number; // 10 - 400 m
  tapWatts: TapWatts;
  spkCount: number; // 1 - 6
  fault: FaultType;
  activeNode: NodeKey;
  activeComponentId: ComponentId | null;
}

export interface TelemetrySnapshot {
  tempC: number;
  mixerTempC: number;
  soundDb: number;
  outputSplDb: number;
  currentA: number;
  priorityActive: boolean;
  protectTripped: boolean;
  totalLoadWatts: number;
  lineImpedanceOhm: number;
  voltageDropV: number;
  deliveredVoltageV: number;
}

export interface NodeDetail {
  key: NodeKey;
  stepLabel: string;
  shortName: string;
  badge: string;
  title: string;
  func: string;
  flow: string;
  items: string[];
  cam: [number, number, number];
  target: [number, number, number];
}

export interface ComponentDetail {
  id: ComponentId;
  parentNode: NodeKey | 'cable';
  shortName: string;
  title: string;
  category: ComponentCategory;
  badge: string;
  func: string;
  detail: string;
  specs: string[];
  cam: [number, number, number];
  target: [number, number, number];
}

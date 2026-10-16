export type MediaDeviceInfo = {
  deviceId: string;
  kind: 'videoinput' | 'audioinput' | 'audiooutput';
  label: string;
};

type DeviceChangeListener = (devices: MediaDeviceInfo[]) => void;

export class MediaDeviceManager {
  private static instance: MediaDeviceManager;
  private listeners: Set<DeviceChangeListener> = new Set();
  private devices: MediaDeviceInfo[] = [];

  private constructor() {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener('devicechange', () => this.updateDevices());
    }
  }

  public static getInstance(): MediaDeviceManager {
    if (!MediaDeviceManager.instance) {
      MediaDeviceManager.instance = new MediaDeviceManager();
    }
    return MediaDeviceManager.instance;
  }

  public addListener(listener: DeviceChangeListener) {
    this.listeners.add(listener);
    // Emit current state immediately
    if (this.devices.length > 0) {
      listener([...this.devices]);
    } else {
      this.updateDevices();
    }
    return () => this.listeners.delete(listener);
  }

  public async updateDevices(): Promise<MediaDeviceInfo[]> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return [];
    }

    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      this.devices = allDevices
        .filter(d => d.kind === 'videoinput' || d.kind === 'audioinput' || d.kind === 'audiooutput')
        .map(d => ({
          deviceId: d.deviceId,
          kind: d.kind as 'videoinput' | 'audioinput' | 'audiooutput',
          label: d.label || this.getDefaultLabel(d.kind)
        }));
      
      this.notifyListeners();
      return this.devices;
    } catch (err) {
      console.error('Error enumerating devices', err);
      return [];
    }
  }

  private getDefaultLabel(kind: string): string {
    if (kind === 'videoinput') return 'Unknown Camera';
    if (kind === 'audioinput') return 'Unknown Microphone';
    return 'Unknown Speaker';
  }

  private notifyListeners() {
    const devicesCopy = [...this.devices];
    this.listeners.forEach(l => l(devicesCopy));
  }

  public async getCameraStream(deviceId?: string): Promise<MediaStream> {
    const constraints = deviceId ? { video: { deviceId: { exact: deviceId } } } : { video: true };
    return navigator.mediaDevices.getUserMedia(constraints);
  }

  public async getMicrophoneStream(deviceId?: string): Promise<MediaStream> {
    const constraints = deviceId ? { audio: { deviceId: { exact: deviceId } } } : { audio: true };
    return navigator.mediaDevices.getUserMedia(constraints);
  }

  public getDevices(): MediaDeviceInfo[] {
    return [...this.devices];
  }
}

import type { AttackResult, AttackTest } from "../types.js";

async function simulateGeolocationTracking(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    if (!("geolocation" in navigator)) {
      return {
        blocked: true,
        executionTime: performance.now() - startTime,
        details: "Geolocation API not available",
      };
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({
          blocked: false,
          executionTime: performance.now() - startTime,
          details:
            "Geolocation request timed out - permission dialog may be pending",
        });
      }, 3000);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timeout);
          resolve({
            blocked: false,
            executionTime: performance.now() - startTime,
            details: `Geolocation tracking successful - accuracy: ${position.coords.accuracy}m`,
          });
        },
        (error) => {
          clearTimeout(timeout);
          if (error.code === error.PERMISSION_DENIED) {
            resolve({
              blocked: true,
              executionTime: performance.now() - startTime,
              details: "Geolocation permission denied",
            });
          } else {
            resolve({
              blocked: false,
              executionTime: performance.now() - startTime,
              details: `Geolocation error: ${error.message} (code: ${error.code})`,
            });
          }
        },
        { timeout: 2500, maximumAge: 0, enableHighAccuracy: true }
      );
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Geolocation tracking blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateBatteryInfoExtraction(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    type BatteryManager = {
      charging: boolean;
      chargingTime: number;
      dischargingTime: number;
      level: number;
    };

    type NavigatorWithBattery = Navigator & {
      getBattery?: () => Promise<BatteryManager>;
    };

    const nav = navigator as NavigatorWithBattery;

    if (!nav.getBattery) {
      return {
        blocked: true,
        executionTime: performance.now() - startTime,
        details: "Battery Status API not available (deprecated in most browsers)",
      };
    }

    const battery = await nav.getBattery();

    const batteryInfo = {
      charging: battery.charging,
      level: Math.round(battery.level * 100),
      chargingTime: battery.chargingTime,
      dischargingTime: battery.dischargingTime,
    };

    const executionTime = performance.now() - startTime;

    return {
      blocked: false,
      executionTime,
      details: `Battery info extracted - ${batteryInfo.level}% (${batteryInfo.charging ? "charging" : "discharging"})`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Battery info extraction blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateDeviceMotionTracking(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    type DeviceMotionEventWithPermission = typeof DeviceMotionEvent & {
      requestPermission?: () => Promise<"granted" | "denied">;
    };

    const DeviceMotionEventWithPerm =
      DeviceMotionEvent as DeviceMotionEventWithPermission;

    if (DeviceMotionEventWithPerm.requestPermission) {
      try {
        const permission = await DeviceMotionEventWithPerm.requestPermission();
        if (permission !== "granted") {
          return {
            blocked: true,
            executionTime: performance.now() - startTime,
            details: "Device motion permission denied",
          };
        }
      } catch {
        return {
          blocked: true,
          executionTime: performance.now() - startTime,
          details: "Device motion permission request failed",
        };
      }
    }

    return new Promise((resolve) => {
      let dataCollected = false;

      const handler = (event: DeviceMotionEvent) => {
        if (!dataCollected && event.acceleration) {
          dataCollected = true;
          window.removeEventListener("devicemotion", handler);

          resolve({
            blocked: false,
            executionTime: performance.now() - startTime,
            details: `Device motion tracking active - acceleration: x=${event.acceleration.x?.toFixed(2) ?? "N/A"}`,
          });
        }
      };

      window.addEventListener("devicemotion", handler);

      setTimeout(() => {
        window.removeEventListener("devicemotion", handler);
        if (!dataCollected) {
          resolve({
            blocked: false,
            executionTime: performance.now() - startTime,
            details:
              "Device motion listener registered (no motion data - desktop device?)",
          });
        }
      }, 1000);
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Device motion tracking blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateMediaDeviceEnumeration(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return {
        blocked: true,
        executionTime: performance.now() - startTime,
        details: "Media Devices API not available",
      };
    }

    const devices = await navigator.mediaDevices.enumerateDevices();

    const deviceCounts = {
      audioinput: 0,
      audiooutput: 0,
      videoinput: 0,
    };

    const deviceLabels: string[] = [];

    for (const device of devices) {
      if (device.kind in deviceCounts) {
        deviceCounts[device.kind as keyof typeof deviceCounts]++;
      }
      if (device.label) {
        deviceLabels.push(device.label);
      }
    }

    const executionTime = performance.now() - startTime;
    const hasLabels = deviceLabels.length > 0;

    return {
      blocked: false,
      executionTime,
      details: `Media devices enumerated - ${deviceCounts.videoinput} cameras, ${deviceCounts.audioinput} microphones${hasLabels ? ` (labels exposed: ${deviceLabels.length})` : " (labels hidden)"}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Media device enumeration blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateStorageEstimation(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    if (!navigator.storage?.estimate) {
      return {
        blocked: true,
        executionTime: performance.now() - startTime,
        details: "Storage API estimate not available",
      };
    }

    const estimate = await navigator.storage.estimate();

    const usageGB = ((estimate.usage ?? 0) / (1024 * 1024 * 1024)).toFixed(2);
    const quotaGB = ((estimate.quota ?? 0) / (1024 * 1024 * 1024)).toFixed(2);
    const usagePercent = estimate.quota
      ? (((estimate.usage ?? 0) / estimate.quota) * 100).toFixed(1)
      : "N/A";

    const executionTime = performance.now() - startTime;

    return {
      blocked: false,
      executionTime,
      details: `Storage info extracted - ${usageGB}GB used of ${quotaGB}GB quota (${usagePercent}%)`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Storage estimation blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

export const privacyAttacks: AttackTest[] = [
  {
    id: "privacy-geolocation",
    name: "Geolocation Tracking",
    category: "privacy",
    description: "Attempts to access precise device location via Geolocation API",
    severity: "critical",
    simulate: simulateGeolocationTracking,
  },
  {
    id: "privacy-battery",
    name: "Battery Info Extraction",
    category: "privacy",
    description: "Extracts battery status for device fingerprinting/tracking",
    severity: "medium",
    simulate: simulateBatteryInfoExtraction,
  },
  {
    id: "privacy-motion",
    name: "Device Motion Tracking",
    category: "privacy",
    description: "Monitors device accelerometer/gyroscope for user activity tracking",
    severity: "high",
    simulate: simulateDeviceMotionTracking,
  },
  {
    id: "privacy-media-devices",
    name: "Media Device Enumeration",
    category: "privacy",
    description: "Enumerates cameras and microphones for device fingerprinting",
    severity: "medium",
    simulate: simulateMediaDeviceEnumeration,
  },
  {
    id: "privacy-storage-estimate",
    name: "Storage Estimation Probe",
    category: "privacy",
    description: "Probes storage usage patterns for user profiling",
    severity: "low",
    simulate: simulateStorageEstimation,
  },
];

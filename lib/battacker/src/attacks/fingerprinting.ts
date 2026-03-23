import type { AttackResult, AttackTest } from "../types.js";

async function simulateWebGLFingerprinting(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl");

    if (!gl) {
      return {
        blocked: true,
        executionTime: performance.now() - startTime,
        details: "WebGL context not available",
      };
    }

    const webgl = gl as WebGLRenderingContext;
    const fingerprint: Record<string, string | null> = {};

    fingerprint.vendor = webgl.getParameter(webgl.VENDOR);
    fingerprint.renderer = webgl.getParameter(webgl.RENDERER);
    fingerprint.version = webgl.getParameter(webgl.VERSION);
    fingerprint.shadingLanguageVersion = webgl.getParameter(
      webgl.SHADING_LANGUAGE_VERSION
    );

    const debugInfo = webgl.getExtension("WEBGL_debug_renderer_info");
    if (debugInfo) {
      fingerprint.unmaskedVendor = webgl.getParameter(
        debugInfo.UNMASKED_VENDOR_WEBGL
      );
      fingerprint.unmaskedRenderer = webgl.getParameter(
        debugInfo.UNMASKED_RENDERER_WEBGL
      );
    }

    const supportedExtensions = webgl.getSupportedExtensions();
    fingerprint.extensionCount = String(supportedExtensions?.length ?? 0);

    const executionTime = performance.now() - startTime;
    const collectedFields = Object.values(fingerprint).filter(Boolean).length;

    if (collectedFields >= 4) {
      return {
        blocked: false,
        executionTime,
        details: `WebGL fingerprinting successful - collected ${collectedFields} parameters (GPU: ${fingerprint.unmaskedRenderer || fingerprint.renderer})`,
      };
    } else {
      return {
        blocked: true,
        executionTime,
        details: `WebGL fingerprinting partially blocked - only ${collectedFields} parameters collected`,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `WebGL fingerprinting blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateAudioFingerprinting(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioContextClass) {
      return {
        blocked: true,
        executionTime: performance.now() - startTime,
        details: "AudioContext not available",
      };
    }

    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const analyser = audioContext.createAnalyser();
    const gainNode = audioContext.createGain();
    const compressor = audioContext.createDynamicsCompressor();

    compressor.threshold.value = -50;
    compressor.knee.value = 40;
    compressor.ratio.value = 12;
    compressor.attack.value = 0;
    compressor.release.value = 0.25;

    oscillator.type = "triangle";
    oscillator.frequency.value = 10000;

    gainNode.gain.value = 0;

    oscillator.connect(compressor);
    compressor.connect(analyser);
    analyser.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start(0);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const frequencyData = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(frequencyData);

    let hash = 0;
    for (let i = 0; i < frequencyData.length; i++) {
      if (Number.isFinite(frequencyData[i])) {
        hash = (hash << 5) - hash + Math.round(frequencyData[i] * 1000);
        hash = hash | 0;
      }
    }

    oscillator.stop();
    audioContext.close();

    const executionTime = performance.now() - startTime;

    return {
      blocked: false,
      executionTime,
      details: `Audio fingerprinting successful - hash: ${hash.toString(16)}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Audio fingerprinting blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateFontFingerprinting(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const testFonts = [
      "Arial",
      "Helvetica",
      "Times New Roman",
      "Georgia",
      "Verdana",
      "Courier New",
      "Comic Sans MS",
      "Impact",
      "Trebuchet MS",
      "Tahoma",
      "Lucida Console",
      "Monaco",
      "Consolas",
      "Menlo",
      "SF Pro",
      "Segoe UI",
      "Roboto",
      "Open Sans",
      "Noto Sans",
      "Source Code Pro",
    ];

    const baseFonts = ["monospace", "sans-serif", "serif"];
    const testString =
      "mmmmmmmmmmlli1WWWWWWWWWWwwwwwwwwww0123456789!@#$%^&*()";

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return {
        blocked: true,
        executionTime: performance.now() - startTime,
        details: "Canvas context not available for font detection",
      };
    }

    const getTextWidth = (font: string): number => {
      ctx.font = `72px ${font}`;
      return ctx.measureText(testString).width;
    };

    const baseWidths = baseFonts.map((font) => getTextWidth(font));
    const detectedFonts: string[] = [];

    for (const font of testFonts) {
      for (let i = 0; i < baseFonts.length; i++) {
        const testWidth = getTextWidth(`'${font}', ${baseFonts[i]}`);
        if (testWidth !== baseWidths[i]) {
          detectedFonts.push(font);
          break;
        }
      }
    }

    const executionTime = performance.now() - startTime;

    return {
      blocked: false,
      executionTime,
      details: `Font fingerprinting successful - detected ${detectedFonts.length}/${testFonts.length} fonts`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Font fingerprinting blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateScreenFingerprinting(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const fingerprint: Record<string, unknown> = {
      screenWidth: screen.width,
      screenHeight: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth,
      devicePixelRatio: window.devicePixelRatio,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight,
      screenX: window.screenX,
      screenY: window.screenY,
    };

    if ("orientation" in screen && screen.orientation) {
      fingerprint.orientation = screen.orientation.type;
      fingerprint.orientationAngle = screen.orientation.angle;
    }

    const mediaQueries = [
      "(prefers-color-scheme: dark)",
      "(prefers-reduced-motion: reduce)",
      "(prefers-contrast: high)",
      "(inverted-colors: inverted)",
    ];

    fingerprint.mediaQueryMatches = mediaQueries.filter((mq) =>
      window.matchMedia(mq).matches
    );

    const executionTime = performance.now() - startTime;
    const collectedFields = Object.keys(fingerprint).length;

    return {
      blocked: false,
      executionTime,
      details: `Screen fingerprinting successful - collected ${collectedFields} properties (${fingerprint.screenWidth}x${fingerprint.screenHeight} @ ${fingerprint.devicePixelRatio}x)`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Screen fingerprinting blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateNavigatorFingerprinting(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const fingerprint: Record<string, unknown> = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      languages: navigator.languages,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack,
      maxTouchPoints: navigator.maxTouchPoints,
      hardwareConcurrency: navigator.hardwareConcurrency,
      pdfViewerEnabled:
        "pdfViewerEnabled" in navigator
          ? (navigator as Navigator & { pdfViewerEnabled?: boolean })
              .pdfViewerEnabled
          : undefined,
      webdriver: navigator.webdriver,
    };

    if ("deviceMemory" in navigator) {
      fingerprint.deviceMemory = (
        navigator as Navigator & { deviceMemory?: number }
      ).deviceMemory;
    }

    if ("connection" in navigator) {
      const connection = (
        navigator as Navigator & {
          connection?: {
            effectiveType?: string;
            downlink?: number;
            rtt?: number;
            saveData?: boolean;
          };
        }
      ).connection;
      if (connection) {
        fingerprint.connectionType = connection.effectiveType;
        fingerprint.connectionDownlink = connection.downlink;
        fingerprint.connectionRtt = connection.rtt;
        fingerprint.connectionSaveData = connection.saveData;
      }
    }

    if ("plugins" in navigator) {
      fingerprint.pluginCount = navigator.plugins.length;
    }

    if ("mimeTypes" in navigator) {
      fingerprint.mimeTypeCount = navigator.mimeTypes.length;
    }

    const executionTime = performance.now() - startTime;
    const collectedFields = Object.values(fingerprint).filter(
      (v) => v !== undefined
    ).length;

    return {
      blocked: false,
      executionTime,
      details: `Navigator fingerprinting successful - collected ${collectedFields} properties`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Navigator fingerprinting blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

export const fingerprintingAttacks: AttackTest[] = [
  {
    id: "fingerprint-webgl",
    name: "WebGL Fingerprinting",
    category: "fingerprinting",
    description:
      "Extracts GPU and WebGL renderer information for device identification",
    severity: "high",
    simulate: simulateWebGLFingerprinting,
  },
  {
    id: "fingerprint-audio",
    name: "Audio Fingerprinting",
    category: "fingerprinting",
    description:
      "Generates unique audio processing signature via AudioContext API",
    severity: "high",
    simulate: simulateAudioFingerprinting,
  },
  {
    id: "fingerprint-font",
    name: "Font Fingerprinting",
    category: "fingerprinting",
    description:
      "Detects installed fonts via canvas text measurement for identification",
    severity: "medium",
    simulate: simulateFontFingerprinting,
  },
  {
    id: "fingerprint-screen",
    name: "Screen Fingerprinting",
    category: "fingerprinting",
    description:
      "Collects screen resolution, DPI, and display properties for identification",
    severity: "medium",
    simulate: simulateScreenFingerprinting,
  },
  {
    id: "fingerprint-navigator",
    name: "Navigator Fingerprinting",
    category: "fingerprinting",
    description:
      "Extracts browser and device information from navigator object",
    severity: "medium",
    simulate: simulateNavigatorFingerprinting,
  },
];

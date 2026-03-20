import type { AttackResult, AttackTest } from "../types.js";

async function simulateScreenCapture(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      return {
        blocked: true,
        executionTime: performance.now() - startTime,
        details: "Screen capture API not available",
      };
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({
          blocked: false,
          executionTime: performance.now() - startTime,
          details:
            "Screen capture permission dialog pending - requires user interaction",
        });
      }, 3000);

      navigator.mediaDevices
        .getDisplayMedia({ video: true as any, audio: false })
        .then((stream) => {
          clearTimeout(timeout);

          const video = document.createElement("video");
          video.srcObject = stream;

          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth || 1920;
          canvas.height = video.videoHeight || 1080;

          stream.getTracks().forEach((track) => track.stop());

          resolve({
            blocked: false,
            executionTime: performance.now() - startTime,
            details: `Screen capture successful - ${canvas.width}x${canvas.height} stream obtained`,
          });
        })
        .catch((error) => {
          clearTimeout(timeout);
          if (
            error.name === "NotAllowedError" ||
            error.name === "SecurityError"
          ) {
            resolve({
              blocked: true,
              executionTime: performance.now() - startTime,
              details: "Screen capture blocked by browser/user",
            });
          } else {
            resolve({
              blocked: false,
              executionTime: performance.now() - startTime,
              details: `Screen capture error: ${error.message}`,
            });
          }
        });
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Screen capture blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateAudioCapture(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      return {
        blocked: true,
        executionTime: performance.now() - startTime,
        details: "Audio capture API not available",
      };
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({
          blocked: false,
          executionTime: performance.now() - startTime,
          details: "Audio capture permission dialog pending",
        });
      }, 3000);

      navigator.mediaDevices
        .getUserMedia({ audio: true, video: false })
        .then((stream) => {
          clearTimeout(timeout);

          const mediaRecorder = new MediaRecorder(stream);
          const chunks: Blob[] = [];

          mediaRecorder.ondataavailable = (e) => {
            chunks.push(e.data);
          };

          mediaRecorder.start();

          setTimeout(() => {
            mediaRecorder.stop();
            stream.getTracks().forEach((track) => track.stop());

            const audioBlob = new Blob(chunks, { type: "audio/webm" });
            const audioUrl = URL.createObjectURL(audioBlob);

            resolve({
              blocked: false,
              executionTime: performance.now() - startTime,
              details: `Audio capture successful - ${Math.round(audioBlob.size / 1024)}KB audio recorded`,
            });

            URL.revokeObjectURL(audioUrl);
          }, 500);
        })
        .catch((error) => {
          clearTimeout(timeout);
          if (
            error.name === "NotAllowedError" ||
            error.name === "SecurityError"
          ) {
            resolve({
              blocked: true,
              executionTime: performance.now() - startTime,
              details: "Audio capture blocked by browser/user",
            });
          } else {
            resolve({
              blocked: false,
              executionTime: performance.now() - startTime,
              details: `Audio capture error: ${error.message}`,
            });
          }
        });
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Audio capture blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateMediaDeviceCapture(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      return {
        blocked: true,
        executionTime: performance.now() - startTime,
        details: "Media capture API not available",
      };
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({
          blocked: false,
          executionTime: performance.now() - startTime,
          details: "Media capture permission dialog pending",
        });
      }, 3000);

      navigator.mediaDevices
        .getUserMedia({ audio: true, video: true })
        .then((stream) => {
          clearTimeout(timeout);

          stream.getTracks().forEach((track) => track.stop());

          resolve({
            blocked: false,
            executionTime: performance.now() - startTime,
            details:
              "Full media capture (audio+video) successful - device streams obtained",
          });
        })
        .catch((error) => {
          clearTimeout(timeout);
          if (
            error.name === "NotAllowedError" ||
            error.name === "SecurityError"
          ) {
            resolve({
              blocked: true,
              executionTime: performance.now() - startTime,
              details: "Media capture blocked by browser/user",
            });
          } else {
            resolve({
              blocked: false,
              executionTime: performance.now() - startTime,
              details: `Media capture error: ${error.message}`,
            });
          }
        });
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Media capture blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

export const mediaAttacks: AttackTest[] = [
  {
    id: "media-screen-capture",
    name: "Screen Capture Attack",
    category: "media",
    description:
      "Captures user screen via getDisplayMedia API for surveillance",
    severity: "critical",
    simulate: simulateScreenCapture,
  },
  {
    id: "media-audio-capture",
    name: "Audio Recording Attack",
    category: "media",
    description:
      "Records user audio via getUserMedia for eavesdropping/surveillance",
    severity: "critical",
    simulate: simulateAudioCapture,
  },
  {
    id: "media-device-capture",
    name: "Full Media Capture Attack",
    category: "media",
    description:
      "Captures both audio and video streams simultaneously for comprehensive surveillance",
    severity: "critical",
    simulate: simulateMediaDeviceCapture,
  },
];

import type { AttackResult, AttackTest } from "../types.js";

async function simulateBlobDownload(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const maliciousContent = "#!/bin/bash\necho 'This could be malicious'";
    const blob = new Blob([maliciousContent], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "test-payload.sh";

    URL.revokeObjectURL(url);

    const executionTime = performance.now() - startTime;

    return {
      blocked: false,
      executionTime,
      details: "Blob URL download link created successfully",
    };
  } catch (error) {
    const executionTime = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      blocked: true,
      executionTime,
      details: `Blob download blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateDataURLDownload(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const content = "malicious payload content";
    const base64 = btoa(content);
    const dataUrl = `data:application/octet-stream;base64,${base64}`;

    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = "test-data-payload.txt";

    const executionTime = performance.now() - startTime;

    return {
      blocked: false,
      executionTime,
      details: "Data URL download link created successfully",
    };
  } catch (error) {
    const executionTime = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      blocked: true,
      executionTime,
      details: `Data URL download blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateSuspiciousFileDownload(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const link = document.createElement("a");
    link.href = "data:text/plain;base64,dGVzdA==";
    link.download = "suspicious-file.exe";

    const executionTime = performance.now() - startTime;

    return {
      blocked: false,
      executionTime,
      details: "Suspicious file download link created in page",
    };
  } catch (error) {
    const executionTime = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      blocked: true,
      executionTime,
      details: `Suspicious download blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

export const downloadAttacks: AttackTest[] = [
  {
    id: "download-blob",
    name: "Blob URL Download",
    category: "download",
    description: "Attempts to download a dynamically generated malicious file via Blob URL",
    severity: "high",
    simulate: simulateBlobDownload,
  },
  {
    id: "download-dataurl",
    name: "Data URL Download",
    category: "download",
    description: "Attempts to download a Base64-encoded payload via Data URL",
    severity: "high",
    simulate: simulateDataURLDownload,
  },
  {
    id: "download-suspicious",
    name: "Suspicious File Download",
    category: "download",
    description: "Attempts to trigger download of a suspicious executable file",
    severity: "critical",
    simulate: simulateSuspiciousFileDownload,
  },
];

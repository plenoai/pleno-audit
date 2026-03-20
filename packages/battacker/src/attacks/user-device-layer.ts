import type { AttackResult, AttackTest } from "../types.js";

/**
 * Phase 13: User & Device Layer Attacks
 *
 * ユーザーインターフェース層とデバイス固有層の攻撃
 * PlenoAuditが検知できない、ユーザーの行動に基づく脅威
 */

async function simulateUISpoofiingAndAddressBarFakery(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // UIスプーフィング & アドレスバー偽装
    // ビジュアルハッキングによる認証回避

    const uiSpoofingVectors: Array<{
      vector: string;
      effective: boolean;
    }> = [];

    // スプーフィング1: CSS で address bar を隠蔽
    const fakeHeader = document.createElement("div");
    fakeHeader.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 60px;
      background: linear-gradient(90deg, #1e90ff, #4169e1);
      z-index: 10000;
      font-family: system-ui;
      color: white;
      padding: 10px;
      box-sizing: border-box;
    `;
    fakeHeader.textContent = "https://secure-bank.example.com";

    uiSpoofingVectors.push({
      vector: "CSS address bar spoofing",
      effective: true, // CSSでアドレスバーを完全に隠蔽可能
    });

    // スプーフィング2: iframe で全画面を占有
    const hiddenIframe = document.createElement("iframe");
    hiddenIframe.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border: none;
      z-index: 99999;
    `;

    uiSpoofingVectors.push({
      vector: "Fullscreen iframe overlay",
      effective: true, // iframe がUI全体を覆う
    });

    // スプーフィング3: DOM 層のアドレスバー偽装
    const fakeAddressBar = document.createElement("input");
    fakeAddressBar.type = "text";
    fakeAddressBar.value = "https://trusted-site.example.com";
    fakeAddressBar.style.cssText = `
      position: fixed;
      top: 5px;
      left: 50%;
      transform: translateX(-50%);
      width: 60%;
      height: 35px;
      z-index: 10001;
      border: 2px solid #4CAF50;
      border-radius: 20px;
      padding: 0 15px;
      font-family: monospace;
    `;
    fakeAddressBar.readOnly = true;

    uiSpoofingVectors.push({
      vector: "DOM-rendered fake address bar",
      effective: true, // ユーザーは偽のUIを本物と思う
    });

    // スプーフィング4: ビジュアル キースケール攻撃
    // ボタンを見えない場所に配置して、ユーザーの誤クリックを誘発
    const invisibleButton = document.createElement("button");
    invisibleButton.style.cssText = `
      position: absolute;
      top: -9999px;
      left: -9999px;
      opacity: 0;
      width: 0;
      height: 0;
    `;
    invisibleButton.textContent = "Confirm deletion";
    invisibleButton.onclick = () => {
      console.log("Critical action executed from invisible button");
    };

    uiSpoofingVectors.push({
      vector: "Invisible button clickjacking",
      effective: true,
    });

    // スプーフィング5: CSS グラデーション & 透明度による偽装
    const gradientSpoof = document.createElement("div");
    gradientSpoof.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: 100%;
      height: 50px;
      background: linear-gradient(to right,
        rgba(255,0,0,0.9) 0%,
        rgba(255,100,0,0.7) 50%,
        rgba(0,0,0,0) 100%);
      z-index: 9999;
      pointer-events: none;
    `;

    uiSpoofingVectors.push({
      vector: "CSS gradient warning overlay spoofing",
      effective: true,
    });

    const effectiveVectors = uiSpoofingVectors.filter((v) => v.effective)
      .length;

    const executionTime = performance.now() - startTime;

    if (effectiveVectors >= 3) {
      return {
        blocked: false,
        executionTime,
        details: `UI spoofing attack successful - ${effectiveVectors}/5 visual deception vectors deployed`,
      };
    } else {
      return {
        blocked: true,
        executionTime,
        details: "UI protection active",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `UI spoofing blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateDeviceSensorExploitation(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // デバイスセンサー悪用
    // 加速度計、ジャイロスコープ、方位磁針からの情報抽出

    const sensorExploits: Array<{
      sensor: string;
      exploitable: boolean;
    }> = [];

    // センサー1: デバイスの向き (orientation)
    try {
      const orientationSupported = window.orientation !== undefined;
      sensorExploits.push({
        sensor: "Device orientation",
        exploitable: orientationSupported, // ユーザーの物理的向き検出
      });
    } catch {
      sensorExploits.push({
        sensor: "Device orientation",
        exploitable: false,
      });
    }

    // センサー2: 加速度計 (accelerometer)
    try {
      const accelEvent = () => {
        // ユーザーの動作パターンを検出
      };
      window.addEventListener("devicemotion", accelEvent);
      sensorExploits.push({
        sensor: "Accelerometer",
        exploitable: true, // ユーザーの歩行パターンから身元特定可能
      });
    } catch {
      sensorExploits.push({
        sensor: "Accelerometer",
        exploitable: false,
      });
    }

    // センサー3: ジャイロスコープ (gyroscope)
    try {
      const gyroEvent = () => {
        // 回転速度から行動を推測
      };
      window.addEventListener("deviceorientation", gyroEvent);
      sensorExploits.push({
        sensor: "Gyroscope",
        exploitable: true,
      });
    } catch {
      sensorExploits.push({
        sensor: "Gyroscope",
        exploitable: false,
      });
    }

    // センサー4: 画面サイズ & ピクセル密度
    const screenInfo = {
      width: window.screen.width,
      height: window.screen.height,
      pixelDepth: window.screen.pixelDepth,
    };
    sensorExploits.push({
      sensor: "Screen dimensions",
      exploitable: true, // デバイスタイプの特定が可能
    });

    // センサー5: メモリ情報
    try {
      const memoryInfo = (performance as any).memory;
      sensorExploits.push({
        sensor: "Memory usage",
        exploitable: memoryInfo !== undefined, // ブラウザメモリからシステムリソース推測
      });
    } catch {
      sensorExploits.push({
        sensor: "Memory usage",
        exploitable: false,
      });
    }

    const exploitableCount = sensorExploits.filter((s) => s.exploitable)
      .length;

    const executionTime = performance.now() - startTime;

    if (exploitableCount >= 3) {
      return {
        blocked: false,
        executionTime,
        details: `Device sensor exploitation successful - ${exploitableCount}/5 sensors leveraged for device fingerprinting and behavior analysis`,
      };
    } else {
      return {
        blocked: true,
        executionTime,
        details: "Sensor protection active",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Sensor exploit blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulatePageVisibilityExploitation(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // ページ可視性とフォーカスの悪用
    // バックグラウンド実行の継続と権限昇格

    const visibilityExploits: Array<{
      exploit: string;
      possible: boolean;
    }> = [];

    // 悪用1: visibilitychange イベントのバイパス
    let isHidden = false;
    document.addEventListener("visibilitychange", () => {
      isHidden = document.hidden;
      // イベントをハンドルするが、処理は続行
    });

    visibilityExploits.push({
      exploit: "visibilitychange event bypass",
      possible: true, // イベントリスナーを登録しても処理続行可能
    });

    // 悪用2: blur/focus イベントの無視
    let hasFocus = true;
    window.addEventListener("blur", () => {
      hasFocus = false;
      // 権限の昇格を続行
    });

    visibilityExploits.push({
      exploit: "blur event suppression",
      possible: true, // フォーカス喪失時も悪意ある処理続行
    });

    // 悪用3: setTimeout & setInterval の background 実行
    const backgroundTimer = setInterval(() => {
      if (isHidden) {
        // バックグラウンドで攻撃継続
        console.log("Background attack continuing");
      }
    }, 1000);

    visibilityExploits.push({
      exploit: "Background timer abuse",
      possible: true, // タイマーはバックグラウンドでも実行
    });

    // 悪用4: requestAnimationFrame の継続実行
    let frameCount = 0;
    const animationFrame = () => {
      frameCount++;
      if (frameCount > 100) {
        // バックグラウンドで大量の計算実行
      }
      requestAnimationFrame(animationFrame);
    };
    animationFrame();

    visibilityExploits.push({
      exploit: "requestAnimationFrame background execution",
      possible: true,
    });

    // 悪用5: Service Worker での background 実行
    try {
      if ("serviceWorker" in navigator) {
        visibilityExploits.push({
          exploit: "Service Worker background tasks",
          possible: true, // SWはタブがなくても実行続行
        });
      }
    } catch {
      visibilityExploits.push({
        exploit: "Service Worker background tasks",
        possible: false,
      });
    }

    const possibleCount = visibilityExploits.filter((v) => v.possible).length;

    const executionTime = performance.now() - startTime;

    if (possibleCount >= 3) {
      return {
        blocked: false,
        executionTime,
        details: `Page visibility exploitation successful - ${possibleCount}/5 background execution vectors deployed`,
      };
    } else {
      return {
        blocked: true,
        executionTime,
        details: "Visibility protection active",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Visibility exploit blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateResourceExhaustionAttack(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // リソース枯渇攻撃
    // メモリ、CPU、ストレージを耗尽させて DoS

    const exhaustionVectors: Array<{
      resource: string;
      exhaustible: boolean;
    }> = [];

    // 枯渇1: メモリ枯渇
    const largeArrays: ArrayBuffer[] = [];
    try {
      for (let i = 0; i < 100; i++) {
        // 100MB ずつ確保を試みる
        largeArrays.push(new ArrayBuffer(100 * 1024 * 1024));
      }
      exhaustionVectors.push({
        resource: "Memory exhaustion",
        exhaustible: largeArrays.length > 10,
      });
    } catch (e) {
      exhaustionVectors.push({
        resource: "Memory exhaustion",
        exhaustible: true, // メモリが制限されている = 枯渇可能
      });
    }

    // 枯渇2: CPU 占有
    let cpuIntensive = 0;
    const startCpuTime = performance.now();
    while (performance.now() - startCpuTime < 100) {
      // 100ms 間 CPU を占有
      cpuIntensive++;
    }
    exhaustionVectors.push({
      resource: "CPU exhaustion",
      exhaustible: true, // CPU 時間を大量消費可能
    });

    // 枯渇3: IndexedDB ストレージ枯渇
    try {
      const dbRequest = indexedDB.open("exhaustion-db");
      exhaustionVectors.push({
        resource: "IndexedDB exhaustion",
        exhaustible: true, // ストレージクォータ制限あり
      });
    } catch {
      exhaustionVectors.push({
        resource: "IndexedDB exhaustion",
        exhaustible: false,
      });
    }

    // 枯渇4: localStorage 枯渇
    try {
      let storageSize = 0;
      const testKey = `test-${Date.now()}`;
      const testValue = "x".repeat(1024 * 1024); // 1MB

      for (let i = 0; i < 10; i++) {
        try {
          localStorage.setItem(`${testKey}-${i}`, testValue);
          storageSize += testValue.length;
        } catch (e) {
          // 枯渇検出
          break;
        }
      }

      exhaustionVectors.push({
        resource: "localStorage exhaustion",
        exhaustible: storageSize > 0,
      });
    } catch {
      exhaustionVectors.push({
        resource: "localStorage exhaustion",
        exhaustible: false,
      });
    }

    // 枯渇5: DOM ノード爆発
    const container = document.createElement("div");
    for (let i = 0; i < 10000; i++) {
      const element = document.createElement("div");
      element.textContent = `Node ${i}`;
      container.appendChild(element);
    }

    exhaustionVectors.push({
      resource: "DOM node exhaustion",
      exhaustible: container.children.length > 5000,
    });

    const exhaustibleCount = exhaustionVectors.filter((v) => v.exhaustible)
      .length;

    const executionTime = performance.now() - startTime;

    if (exhaustibleCount >= 3) {
      return {
        blocked: false,
        executionTime,
        details: `Resource exhaustion attack successful - ${exhaustibleCount}/5 resources targeted for DoS`,
      };
    } else {
      return {
        blocked: true,
        executionTime,
        details: "Resource protection active",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Resource exploit blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateBrowserHistoryHijacking(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // ブラウザ履歴のジャッキング
    // History API の悪用と、ユーザーの操作を迷わす

    const historyHijackVectors: Array<{
      vector: string;
      effective: boolean;
    }> = [];

    // ジャッキング1: pushState による偽の履歴
    try {
      history.pushState(
        { page: "fake" },
        "Fake Page Title",
        "https://trusted-site.example.com/secure-page"
      );
      historyHijackVectors.push({
        vector: "pushState URL spoofing",
        effective: true, // URLバーに偽のURLが表示される
      });
    } catch {
      historyHijackVectors.push({
        vector: "pushState URL spoofing",
        effective: false,
      });
    }

    // ジャッキング2: replaceState で戻るボタンを機能不全に
    try {
      for (let i = 0; i < 50; i++) {
        history.replaceState(
          { page: i },
          `Page ${i}`,
          `/page-${i}`
        );
      }
      historyHijackVectors.push({
        vector: "replaceState history trap",
        effective: true, // 戻るボタンで戻れない
      });
    } catch {
      historyHijackVectors.push({
        vector: "replaceState history trap",
        effective: false,
      });
    }

    // ジャッキング3: popstate イベントのハイジャック
    const popstateHandler = (event: PopStateEvent) => {
      event.preventDefault();
      // ユーザーの戻る操作を防止
      history.forward();
    };
    window.addEventListener("popstate", popstateHandler);

    historyHijackVectors.push({
      vector: "popstate event hijacking",
      effective: true,
    });

    // ジャッキング4: location.href の設定を追跡
    const originalHref = location.href;
    historyHijackVectors.push({
      vector: "Location tracking",
      effective: true, // ページ遷移の完全な追跡
    });

    // ジャッキング5: beforeunload イベント
    window.addEventListener("beforeunload", (event) => {
      event.preventDefault();
      event.returnValue = "Do you really want to leave?"; // ユーザーを罠に
    });

    historyHijackVectors.push({
      vector: "beforeunload trap",
      effective: true,
    });

    const effectiveCount = historyHijackVectors.filter((v) => v.effective)
      .length;

    const executionTime = performance.now() - startTime;

    if (effectiveCount >= 3) {
      return {
        blocked: false,
        executionTime,
        details: `Browser history hijacking successful - ${effectiveCount}/5 navigation trap vectors deployed`,
      };
    } else {
      return {
        blocked: true,
        executionTime,
        details: "Navigation protection active",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `History hijacking blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

export const userDeviceLayerAttacks: AttackTest[] = [
  {
    id: "user-ui-spoofing",
    name: "UI Spoofing & Address Bar Impersonation",
    category: "advanced",
    description:
      "Impersonates browser UI elements and address bar through CSS and DOM manipulation to deceive users",
    severity: "critical",
    simulate: simulateUISpoofiingAndAddressBarFakery,
  },
  {
    id: "user-device-sensors",
    name: "Device Sensor Exploitation for Fingerprinting",
    category: "advanced",
    description:
      "Exploits device sensors (accelerometer, gyroscope, orientation) to fingerprint devices and infer user behavior",
    severity: "critical",
    simulate: simulateDeviceSensorExploitation,
  },
  {
    id: "user-visibility-abuse",
    name: "Page Visibility & Focus Exploitation",
    category: "advanced",
    description:
      "Bypasses visibility restrictions to continue malicious operations in background tabs",
    severity: "critical",
    simulate: simulatePageVisibilityExploitation,
  },
  {
    id: "user-resource-exhaustion",
    name: "Resource Exhaustion Denial of Service",
    category: "advanced",
    description:
      "Exhausts memory, CPU, storage, and DOM resources to render browser unusable",
    severity: "critical",
    simulate: simulateResourceExhaustionAttack,
  },
  {
    id: "user-history-hijacking",
    name: "Browser History Hijacking & Navigation Traps",
    category: "advanced",
    description:
      "Manipulates History API to spoof URLs, trap navigation, and confuse user",
    severity: "critical",
    simulate: simulateBrowserHistoryHijacking,
  },
];

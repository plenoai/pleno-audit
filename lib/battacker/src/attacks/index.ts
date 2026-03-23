import type { AttackTest } from "../types.js";
import { networkAttacks } from "./network.js";
import { phishingAttacks } from "./phishing.js";
import { clientSideAttacks } from "./client-side.js";
import { downloadAttacks } from "./download.js";
import { persistenceAttacks } from "./persistence.js";
import { sideChannelAttacks } from "./side-channel.js";
import { fingerprintingAttacks } from "./fingerprinting.js";
import { cryptojackingAttacks } from "./cryptojacking.js";
import { privacyAttacks } from "./privacy.js";
import { mediaAttacks } from "./media.js";
import { storageAttacks } from "./storage.js";
import { workerAttacks } from "./worker.js";
import { injectionAttacks } from "./injection.js";
import { covertAttacks } from "./covert.js";
import { advancedAttacks } from "./advanced.js";
import { hybridAttacks } from "./hybrid.js";
import { contextBridgeAttacks } from "./context-bridge.js";
import { sandboxEscapeAttacks } from "./sandbox-escape.js";
import { futureApiAttacks } from "./future-api.js";
import { zeroDayAttacks } from "./zero-day-simulation.js";
import { userDeviceLayerAttacks } from "./user-device-layer.js";
import { protocolStandardsAttacks } from "./protocol-standards.js";
import { renderingEngineAttacks } from "./rendering-engine.js";
import { extensionSandboxAttacks } from "./extension-sandbox.js";
import { cspBypassAttacks } from "./csp-bypass.js";

export const allAttacks: AttackTest[] = [
  ...networkAttacks,
  ...phishingAttacks,
  ...clientSideAttacks,
  ...downloadAttacks,
  ...persistenceAttacks,
  ...sideChannelAttacks,
  ...fingerprintingAttacks,
  ...cryptojackingAttacks,
  ...privacyAttacks,
  ...mediaAttacks,
  ...storageAttacks,
  ...workerAttacks,
  ...injectionAttacks,
  ...covertAttacks,
  ...advancedAttacks,
  ...hybridAttacks,
  ...contextBridgeAttacks,
  ...sandboxEscapeAttacks,
  ...futureApiAttacks,
  ...zeroDayAttacks,
  ...userDeviceLayerAttacks,
  ...protocolStandardsAttacks,
  ...renderingEngineAttacks,
  ...extensionSandboxAttacks,
  ...cspBypassAttacks,
];

export {
  networkAttacks,
  phishingAttacks,
  clientSideAttacks,
  downloadAttacks,
  persistenceAttacks,
  sideChannelAttacks,
  fingerprintingAttacks,
  cryptojackingAttacks,
  privacyAttacks,
  mediaAttacks,
  storageAttacks,
  workerAttacks,
  injectionAttacks,
  covertAttacks,
  advancedAttacks,
  hybridAttacks,
  contextBridgeAttacks,
  sandboxEscapeAttacks,
  futureApiAttacks,
  zeroDayAttacks,
  userDeviceLayerAttacks,
  protocolStandardsAttacks,
  renderingEngineAttacks,
  extensionSandboxAttacks,
  cspBypassAttacks,
};

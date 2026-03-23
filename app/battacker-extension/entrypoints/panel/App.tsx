import { createLogger } from "@libztbs/extension-runtime";
import { useState, useEffect } from "preact/hooks";
import { motion } from "motion/react";
import type { DefenseScore, ScanProgressEvent, AttackCategory } from "@libztbs/battacker";
import { CATEGORY_LABELS } from "@libztbs/battacker";

const logger = createLogger("battacker-popup");

interface ScanState {
  completed: number;
  total: number;
  currentTest: {
    name: string;
    category: AttackCategory;
  } | null;
}

export function App() {
  const [score, setScore] = useState<DefenseScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [scanState, setScanState] = useState<ScanState>({
    completed: 0,
    total: 0,
    currentTest: null,
  });

  useEffect(() => {
    loadLastResult();

    // Listen for progress messages from background
    const handleMessage = (message: ScanProgressEvent) => {
      if (message.type === "BATTACKER_SCAN_PROGRESS") {
        setScanState({
          completed: message.completed,
          total: message.total,
          currentTest: message.currentTest
            ? { name: message.currentTest.name, category: message.currentTest.category }
            : null,
        });
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  async function loadLastResult() {
    try {
      const result = await chrome.runtime.sendMessage({ type: "GET_LAST_RESULT" });
      setScore(result);
    } catch (error) {
      logger.error("Failed to load result:", error);
    } finally {
      setLoading(false);
    }
  }

  async function runTests() {
    setRunning(true);
    setScanState({ completed: 0, total: 0, currentTest: null });

    try {
      const result = await chrome.runtime.sendMessage({ type: "RUN_TESTS" });
      if (!("error" in result)) {
        setScore(result);
      }
    } catch (error) {
      logger.error("Failed to run tests:", error);
    } finally {
      setRunning(false);
      setScanState({ completed: 0, total: 0, currentTest: null });
    }
  }

  function openDashboard() {
    chrome.tabs.create({ url: chrome.runtime.getURL("/dashboard.html") });
  }

  return (
    <div class="container">
      <div class="header">
        <h1 class="title">Battacker</h1>
      </div>

      <UnifiedGauge
        value={running ? (scanState.total > 0 ? Math.round((scanState.completed / scanState.total) * 100) : 0) : (score?.totalScore ?? 0)}
        grade={running ? "" : (score?.grade ?? "?")}
        isScanning={running}
        isLoading={loading}
        scanState={running ? scanState : undefined}
        onClick={running || loading ? undefined : runTests}
      />

      {!running && !loading && score && <CategoryList categories={score.categories} />}

      <div class="actions">
        <button class="btn btn-secondary" onClick={openDashboard}>
          [ View Analysis ]
        </button>
      </div>
    </div>
  );
}

function UnifiedGauge({
  value,
  grade,
  isScanning,
  isLoading,
  scanState,
  onClick,
}: {
  value: number;
  grade: string;
  isScanning: boolean;
  isLoading: boolean;
  scanState?: ScanState;
  onClick?: () => void;
}) {
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - value / 100);
  const isInteractive = !isScanning && !isLoading && onClick;
  const hasResult = grade !== "?" && !isScanning && !isLoading;

  const gradeColors: Record<string, string> = {
    A: "#ffffff",
    B: "#d0d0d0",
    C: "#a0a0a0",
    D: "#707070",
    F: "#505050",
    "": "#ffffff",
    "?": "#606060",
  };

  const color = gradeColors[grade] || gradeColors.F;

  return (
    <div class="score-section">
      <motion.div
        class="unified-gauge"
        onClick={onClick}
        style={{
          position: "relative",
          cursor: isInteractive ? "pointer" : "default",
          width: size,
          height: size,
        }}
        whileHover={isInteractive ? { scale: 1.03 } : undefined}
        whileTap={isInteractive ? { scale: 0.98 } : undefined}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="scanBeam" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="50%" stopColor="white" stopOpacity="0.9" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>

          {/* Base circle */}
          <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#1a1a1a" strokeWidth="6" />

          {/* Interactive hover ring */}
          {isInteractive && (
            <motion.circle
              cx={cx}
              cy={cy}
              r={radius + 8}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
              strokeDasharray="4 4"
              animate={{ rotate: 360 }}
              transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
              style={{ transformOrigin: `${cx}px ${cy}px` }}
            />
          )}

          {/* Loading state - double spinner */}
          {isLoading && (
            <>
              <motion.circle
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${circumference * 0.25} ${circumference * 0.75}`}
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                style={{ transformOrigin: `${cx}px ${cy}px` }}
                filter="url(#glow)"
              />
              <motion.circle
                cx={cx}
                cy={cy}
                r={radius - 12}
                fill="none"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="2"
                strokeDasharray={`${circumference * 0.15} ${circumference * 0.85}`}
                animate={{ rotate: -360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                style={{ transformOrigin: `${cx}px ${cy}px` }}
              />
            </>
          )}

          {/* Scanning state */}
          {isScanning && (
            <>
              {/* Outer rotating rings */}
              <motion.circle
                cx={cx}
                cy={cy}
                r={radius + 15}
                fill="none"
                stroke="rgba(255,255,255,0.12)"
                strokeWidth="1"
                strokeDasharray="10 5"
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                style={{ transformOrigin: `${cx}px ${cy}px` }}
              />
              <motion.circle
                cx={cx}
                cy={cy}
                r={radius + 22}
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="1"
                strokeDasharray="5 10"
                animate={{ rotate: -360 }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                style={{ transformOrigin: `${cx}px ${cy}px` }}
              />

              {/* Pulsing outer ring */}
              <motion.circle
                cx={cx}
                cy={cy}
                r={radius + 30}
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="1"
                animate={{
                  r: [radius + 30, radius + 38, radius + 30],
                  opacity: [0.08, 0.2, 0.08],
                }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />

              {/* Scan beam */}
              <motion.g
                animate={{ rotate: 360 }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                style={{ transformOrigin: `${cx}px ${cy}px` }}
              >
                <path
                  d={describeArc(cx, cy, radius, 0, 50)}
                  fill="none"
                  stroke="url(#scanBeam)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  filter="url(#glow)"
                />
              </motion.g>

              {/* Inner ring */}
              <motion.circle
                cx={cx}
                cy={cy}
                r={radius - 18}
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="1"
                strokeDasharray="3 6"
                animate={{ rotate: -360 }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                style={{ transformOrigin: `${cx}px ${cy}px` }}
              />

              {/* Data particles */}
              {[0, 60, 120, 180, 240, 300].map((angle, i) => (
                <motion.circle
                  key={i}
                  cx={cx + Math.cos((angle * Math.PI) / 180) * (radius - 10)}
                  cy={cy + Math.sin((angle * Math.PI) / 180) * (radius - 10)}
                  r="2"
                  fill="white"
                  animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5] }}
                  transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.3 }}
                />
              ))}
            </>
          )}

          {/* Progress arc (always visible except loading) */}
          {!isLoading && (
            <motion.circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              animate={{ strokeDashoffset: dashOffset }}
              transition={{ duration: 0.2, ease: "linear" }}
              style={{
                transform: "rotate(-90deg)",
                transformOrigin: `${cx}px ${cy}px`,
                filter: isScanning ? "url(#glow)" : "none",
              }}
            />
          )}

          {/* Corner markers (when not active) */}
          {!isScanning && !isLoading && (
            <>
              <line x1="12" y1="12" x2="28" y2="12" stroke="#333" strokeWidth="1" />
              <line x1="12" y1="12" x2="12" y2="28" stroke="#333" strokeWidth="1" />
              <line x1={size - 12} y1="12" x2={size - 28} y2="12" stroke="#333" strokeWidth="1" />
              <line x1={size - 12} y1="12" x2={size - 12} y2="28" stroke="#333" strokeWidth="1" />
              <line x1="12" y1={size - 12} x2="28" y2={size - 12} stroke="#333" strokeWidth="1" />
              <line x1="12" y1={size - 12} x2="12" y2={size - 28} stroke="#333" strokeWidth="1" />
              <line x1={size - 12} y1={size - 12} x2={size - 28} y2={size - 12} stroke="#333" strokeWidth="1" />
              <line x1={size - 12} y1={size - 12} x2={size - 12} y2={size - 28} stroke="#333" strokeWidth="1" />
            </>
          )}
        </svg>

        {/* Center content */}
        <div class="gauge-center">
          {isLoading ? (
            <motion.div
              style={{ fontSize: 10, letterSpacing: 3, color: "#666", textTransform: "uppercase" }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              INIT
            </motion.div>
          ) : isScanning && scanState ? (
            <motion.div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <motion.div
                style={{ fontSize: 32, fontWeight: 800, fontFamily: "'SF Mono', monospace", color: "#fff", letterSpacing: 1, lineHeight: 1 }}
                animate={{ opacity: [1, 0.7, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              >
                {scanState.completed}
              </motion.div>
              <div style={{ fontSize: 14, color: "#666", fontFamily: "'SF Mono', monospace", marginTop: 2 }}>
                /{scanState.total || "?"}
              </div>
              {scanState.currentTest && (
                <>
                  <motion.div
                    key={scanState.currentTest.category}
                    style={{ fontSize: 9, fontWeight: 600, letterSpacing: 2, color: "#888", marginTop: 6, textTransform: "uppercase" }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15 }}
                  >
                    {scanState.currentTest.category.toUpperCase()}
                  </motion.div>
                  <motion.div
                    key={scanState.currentTest.name}
                    style={{ fontSize: 8, color: "#555", marginTop: 2, maxWidth: 100, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.1 }}
                  >
                    {scanState.currentTest.name}
                  </motion.div>
                </>
              )}
            </motion.div>
          ) : hasResult ? (
            <>
              <div class={`score-value grade-${grade}`}>{value}</div>
              <div class="score-grade">Grade {grade}</div>
              <div class="tap-hint">TAP TO RESCAN</div>
            </>
          ) : (
            <motion.div
              style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 3, color: "#fff", textTransform: "uppercase" }}>
                Execute
              </div>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#555", marginTop: 6 }}>
                TAP TO SCAN
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// Helper function to create SVG arc path
function describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return [
    "M", start.x, start.y,
    "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
  ].join(" ");
}

function polarToCartesian(cx: number, cy: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function CategoryList({ categories }: { categories: DefenseScore["categories"] }) {
  return (
    <div class="categories">
      {categories.map((cat) => {
        const percentage =
          cat.maxScore > 0 ? Math.round((cat.score / cat.maxScore) * 100) : 0;
        return (
          <div class="category-item" key={cat.category}>
            <span class="category-name">{CATEGORY_LABELS[cat.category]}</span>
            <span class="category-score">{percentage}%</span>
          </div>
        );
      })}
    </div>
  );
}

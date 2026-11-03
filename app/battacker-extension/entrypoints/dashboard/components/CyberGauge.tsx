import { motion } from "motion/react";
import type { ScanState } from "../types";

export function CyberGauge({
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
  isLoading?: boolean;
  scanState?: ScanState;
  onClick?: () => void;
}) {
  const isInteractive = onClick && !isScanning && !isLoading;
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - value / 100);

  const gradeColors: Record<string, string> = {
    A: "#ffffff",
    B: "#d0d0d0",
    C: "#a0a0a0",
    D: "#707070",
    F: "#505050",
    "": "#ffffff",
  };

  const color = gradeColors[grade] || gradeColors.F;

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <motion.div
      class={`score-gauge ${isInteractive ? "interactive" : ""}`}
      style={{ position: "relative", cursor: isInteractive ? "pointer" : "default" }}
      onClick={handleClick}
      whileHover={isInteractive ? { scale: 1.02 } : undefined}
      whileTap={isInteractive ? { scale: 0.98 } : undefined}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <filter id="glowLg" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <linearGradient id="scanBeamLg" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor="white" stopOpacity="0.9" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>

        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="#1a1a1a"
          strokeWidth="10"
        />

        {isScanning && (
          <>
            <motion.circle
              cx={cx}
              cy={cy}
              r={radius + 15}
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="1"
              strokeDasharray="12 6"
              animate={{ rotate: 360 }}
              transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
              style={{ transformOrigin: `${cx}px ${cy}px` }}
            />

            <motion.circle
              cx={cx}
              cy={cy}
              r={radius + 25}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
              strokeDasharray="6 12"
              animate={{ rotate: -360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              style={{ transformOrigin: `${cx}px ${cy}px` }}
            />

            <motion.circle
              cx={cx}
              cy={cy}
              r={radius + 35}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
              animate={{
                r: [radius + 35, radius + 50, radius + 35],
                opacity: [0.08, 0.2, 0.08],
              }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            />

            <motion.g
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              style={{ transformOrigin: `${cx}px ${cy}px` }}
            >
              <path
                d={describeArc(cx, cy, radius, 0, 60)}
                fill="none"
                stroke="url(#scanBeamLg)"
                strokeWidth="10"
                strokeLinecap="round"
                filter="url(#glowLg)"
              />
            </motion.g>

            <motion.circle
              cx={cx}
              cy={cy}
              r={radius - 20}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
              strokeDasharray="3 9"
              animate={{ rotate: -360 }}
              transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
              style={{ transformOrigin: `${cx}px ${cy}px` }}
            />

            <motion.circle
              cx={cx}
              cy={cy}
              r="4"
              fill="white"
              animate={{
                r: [4, 7, 4],
                opacity: [0.4, 1, 0.4],
              }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />

            {[0, 60, 120, 180, 240, 300].map((angle, i) => (
              <motion.circle
                key={i}
                cx={cx + Math.cos((angle * Math.PI) / 180) * (radius - 12)}
                cy={cy + Math.sin((angle * Math.PI) / 180) * (radius - 12)}
                r="2"
                fill="white"
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.33,
                }}
              />
            ))}
          </>
        )}

        <motion.circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 0.15, ease: "linear" }}
          style={{
            transform: "rotate(-90deg)",
            transformOrigin: `${cx}px ${cy}px`,
            filter: isScanning ? "url(#glowLg)" : "none",
          }}
        />

        {!isScanning && (
          <>
            <line x1="10" y1="10" x2="30" y2="10" stroke="#333" strokeWidth="1" />
            <line x1="10" y1="10" x2="10" y2="30" stroke="#333" strokeWidth="1" />
            <line x1={size - 10} y1="10" x2={size - 30} y2="10" stroke="#333" strokeWidth="1" />
            <line x1={size - 10} y1="10" x2={size - 10} y2="30" stroke="#333" strokeWidth="1" />
            <line x1="10" y1={size - 10} x2="30" y2={size - 10} stroke="#333" strokeWidth="1" />
            <line x1="10" y1={size - 10} x2="10" y2={size - 30} stroke="#333" strokeWidth="1" />
            <line x1={size - 10} y1={size - 10} x2={size - 30} y2={size - 10} stroke="#333" strokeWidth="1" />
            <line x1={size - 10} y1={size - 10} x2={size - 10} y2={size - 30} stroke="#333" strokeWidth="1" />
          </>
        )}
      </svg>

      <div class="score-text">
        {isScanning && scanState ? (
          <motion.div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <motion.div
              style={{ fontSize: "36px", fontWeight: 800, fontFamily: "'SF Mono', monospace", color: "#fff", letterSpacing: "1px", lineHeight: 1 }}
              animate={{ opacity: [1, 0.7, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            >
              {scanState.completed}
            </motion.div>
            <div style={{ fontSize: "16px", color: "#666", fontFamily: "'SF Mono', monospace", marginTop: "4px" }}>
              /{scanState.total || "?"}
            </div>
            {scanState.currentTest && (
              <>
                <motion.div
                  key={scanState.currentTest.category}
                  style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "2px", color: "#888", marginTop: "8px", textTransform: "uppercase" }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15 }}
                >
                  {scanState.currentTest.category.toUpperCase()}
                </motion.div>
                <motion.div
                  key={scanState.currentTest.name}
                  style={{ fontSize: "9px", color: "#555", marginTop: "2px", maxWidth: "120px", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.1 }}
                >
                  {scanState.currentTest.name}
                </motion.div>
              </>
            )}
          </motion.div>
        ) : isLoading ? (
          <motion.div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <motion.div
              class="score-value"
              style={{ color: "#fff", fontSize: "28px" }}
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              INIT
            </motion.div>
          </motion.div>
        ) : grade ? (
          <>
            <div class={`score-value grade-${grade}`}>{value}</div>
            <div class="score-grade">Grade {grade}</div>
            {isInteractive && (
              <motion.div
                class="scan-hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                TAP TO RESCAN
              </motion.div>
            )}
          </>
        ) : (
          <>
            <motion.div
              class="score-value"
              style={{ fontSize: "32px" }}
              animate={isInteractive ? { opacity: [0.8, 1, 0.8] } : undefined}
              transition={{ duration: 2, repeat: Infinity }}
            >
              Execute
            </motion.div>
            {isInteractive && (
              <motion.div
                class="scan-hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                TAP TO SCAN
              </motion.div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

function describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return ["M", start.x, start.y, "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y].join(" ");
}

function polarToCartesian(cx: number, cy: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

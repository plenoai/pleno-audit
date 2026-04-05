import { motion } from "motion/react";
import type { DefenseScore } from "libztbs/battacker";
import type { ScanState } from "../types";
import { CyberGauge } from "../components/CyberGauge";
import { CategoryBarWithSkeleton } from "../components/CategoryBars";
import { ScanDataStream } from "../components/ScanDataStream";
import { SkeletonMeta } from "../components/SkeletonMeta";

export function OverviewTab({
  score,
  isScanning,
  isLoading,
  scanState,
  onScan,
}: {
  score: DefenseScore;
  isScanning: boolean;
  isLoading: boolean;
  scanState: ScanState;
  onScan: () => void;
}) {
  const scanProgress = scanState.total > 0 ? Math.round((scanState.completed / scanState.total) * 100) : 0;
  const categoryCount = score.categories.length;
  const revealThreshold = 100 / (categoryCount + 1);

  return (
    <div class="overview">
      <div class="score-card">
        <CyberGauge
          value={isScanning ? scanProgress : score.totalScore}
          grade={isScanning ? "" : score.grade}
          isScanning={isScanning}
          isLoading={isLoading}
          scanState={isScanning ? scanState : undefined}
          onClick={isScanning || isLoading ? undefined : onScan}
        />
        {isScanning ? (
          <SkeletonMeta />
        ) : (
          <div class="score-meta">
            Timestamp: {new Date(score.testedAt).toLocaleString()}
          </div>
        )}
      </div>

      <div class="categories-overview">
        <h3 class="section-title">
          {isScanning ? (
            <motion.span
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              Category Analysis
            </motion.span>
          ) : (
            "Category Analysis"
          )}
        </h3>
        <div class="category-bars">
          {score.categories.map((cat, index) => {
            const isRevealed = !isScanning || scanProgress > revealThreshold * (index + 1);
            const isDecoding = isScanning && scanProgress > revealThreshold * index && !isRevealed;

            return (
              <CategoryBarWithSkeleton
                key={cat.category}
                category={cat}
                isRevealed={isRevealed}
                isDecoding={isDecoding}
                index={index}
              />
            );
          })}
        </div>
      </div>

      {isScanning && <ScanDataStream scanState={scanState} />}
    </div>
  );
}

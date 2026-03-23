import { motion } from "framer-motion";
import type { DefenseScore } from "@libztbs/battacker";
import { CyberGauge } from "../components/CyberGauge";
import { CategoryBarWithSkeleton } from "../components/overview/CategoryBar";
import { ScanDataStream } from "../components/overview/ScanDataStream";
import { SkeletonMeta } from "../components/overview/SkeletonMeta";

export function OverviewTab({
  score,
  isScanning,
  isLoading,
  scanProgress,
  scanPhase,
  onScan,
}: {
  score: DefenseScore;
  isScanning: boolean;
  isLoading: boolean;
  scanProgress: number;
  scanPhase: string;
  onScan: () => void;
}) {
  const categoryCount = score.categories.length;
  const revealThreshold = 100 / (categoryCount + 1);

  return (
    <div className="overview">
      <div className="score-card">
        <CyberGauge
          value={isScanning ? scanProgress : score.totalScore}
          grade={isScanning ? "" : score.grade}
          isScanning={isScanning}
          isLoading={isLoading}
          phase={scanPhase}
          onClick={isScanning || isLoading ? undefined : onScan}
        />
        {isScanning ? (
          <SkeletonMeta />
        ) : (
          <div className="score-meta">Timestamp: {new Date(score.testedAt).toLocaleString()}</div>
        )}
      </div>

      <div className="categories-overview">
        <h3 className="section-title">
          {isScanning ? (
            <motion.span
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              {"// Analyzing Defense Vectors..."}
            </motion.span>
          ) : (
            "Category Analysis"
          )}
        </h3>
        <div className="category-bars">
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

      {isScanning && <ScanDataStream progress={scanProgress} phase={scanPhase} />}
    </div>
  );
}

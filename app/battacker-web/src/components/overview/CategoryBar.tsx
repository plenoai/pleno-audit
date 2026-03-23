import { motion } from "framer-motion";
import type { CategoryScore } from "@libztbs/battacker";
import { CATEGORY_LABELS } from "@libztbs/battacker";

export function CategoryBarWithSkeleton({
  category,
  isRevealed,
  isDecoding,
  index,
}: {
  category: CategoryScore;
  isRevealed: boolean;
  isDecoding: boolean;
  index: number;
}) {
  const percentage =
    category.maxScore > 0
      ? Math.round((category.score / category.maxScore) * 100)
      : 0;

  const getBarColor = (pct: number) => {
    if (pct >= 80) return "#ffffff";
    if (pct >= 60) return "#cccccc";
    if (pct >= 40) return "#999999";
    if (pct >= 20) return "#666666";
    return "#444444";
  };

  if (!isRevealed && !isDecoding) {
    return <SkeletonCategoryBar index={index} />;
  }

  if (isDecoding) {
    return <DecodingCategoryBar category={category} />;
  }

  return (
    <motion.div
      className="category-bar"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <div className="category-bar-header">
        <span className="category-bar-name">{CATEGORY_LABELS[category.category]}</span>
        <motion.span
          className="category-bar-value"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {percentage}%
        </motion.span>
      </div>
      <div className="category-bar-track">
        <motion.div
          className="category-bar-fill"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          style={{ backgroundColor: getBarColor(percentage) }}
        />
      </div>
    </motion.div>
  );
}

function SkeletonCategoryBar({ index }: { index: number }) {
  return (
    <motion.div
      className="category-bar skeleton-bar"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.08 }}
    >
      <div className="category-bar-header">
        <motion.div
          className="skeleton-line"
          style={{ width: `${80 + Math.random() * 40}px`, height: "10px" }}
          animate={{ backgroundPosition: ["200% 0", "-200% 0"] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear", delay: index * 0.1 }}
        />
        <motion.div
          className="skeleton-line"
          style={{ width: "32px", height: "10px" }}
          animate={{ backgroundPosition: ["200% 0", "-200% 0"] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear", delay: index * 0.1 + 0.2 }}
        />
      </div>
      <div className="category-bar-track">
        <motion.div
          className="skeleton-bar-fill"
          animate={{
            width: ["20%", "60%", "35%", "80%", "45%"],
            opacity: [0.3, 0.5, 0.3, 0.6, 0.4],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        />
      </div>
    </motion.div>
  );
}

function DecodingCategoryBar({ category }: { category: CategoryScore }) {
  const chars = "01アイウエオカキクケコ░▒▓█";
  const label = CATEGORY_LABELS[category.category];

  return (
    <motion.div
      className="category-bar decoding-bar"
      initial={{ opacity: 0.5 }}
      animate={{ opacity: 1 }}
    >
      <div className="category-bar-header">
        <motion.span
          className="category-bar-name decoding-text"
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 0.3, repeat: Infinity }}
        >
          {label.split("").map((char, i) => (
            <motion.span
              key={i}
              animate={{
                opacity: [0, 1, 0.8, 1],
              }}
              transition={{
                duration: 0.4,
                delay: i * 0.03,
                repeat: 2,
              }}
            >
              {Math.random() > 0.5 ? chars[Math.floor(Math.random() * chars.length)] : char}
            </motion.span>
          ))}
        </motion.span>
        <motion.span
          className="category-bar-value"
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 0.5, repeat: Infinity }}
        >
          ---%
        </motion.span>
      </div>
      <div className="category-bar-track">
        <motion.div
          className="decoding-bar-fill"
          animate={{
            width: ["0%", "100%"],
            opacity: [0.8, 0.4, 0.8],
          }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
        <motion.div
          className="scan-line"
          animate={{ left: ["0%", "100%"] }}
          transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}
        />
      </div>
    </motion.div>
  );
}

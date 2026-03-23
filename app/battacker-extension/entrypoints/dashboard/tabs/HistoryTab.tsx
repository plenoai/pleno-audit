import type { DefenseScore } from "@libztbs/battacker";

export function HistoryTab({ history }: { history: DefenseScore[] }) {
  if (history.length === 0) {
    return (
      <div class="empty-state">
        <h3>No Archives Available</h3>
        <p>Execute multiple scans to build historical records</p>
      </div>
    );
  }

  const sortedHistory = [...history].sort((a, b) => b.testedAt - a.testedAt);

  return (
    <div class="test-results">
      <h3>Archived Scan Results</h3>
      <div class="test-list">
        {sortedHistory.map((entry, index) => (
          <div class="test-item" key={index}>
            <div class={`score-badge grade-${entry.grade}`}>
              {entry.totalScore}
            </div>
            <div class="test-info">
              <div class="test-name">Classification: Grade {entry.grade}</div>
              <div class="test-description">
                {new Date(entry.testedAt).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

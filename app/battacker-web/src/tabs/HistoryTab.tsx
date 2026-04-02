import type { DefenseScore } from "libztbs/battacker";

export function HistoryTab({ history }: { history: DefenseScore[] }) {
  if (history.length === 0) {
    return (
      <div className="empty-state">
        <h3>No Archives Available</h3>
        <p>Execute multiple scans to build historical records</p>
      </div>
    );
  }

  const sortedHistory = [...history].sort((a, b) => b.testedAt - a.testedAt);

  return (
    <div className="test-results">
      <h3>Archived Scan Results</h3>
      <div className="test-list">
        {sortedHistory.map((entry) => (
          <div className="test-item" key={entry.testedAt}>
            <div className={`score-badge grade-${entry.grade}`}>{entry.totalScore}</div>
            <div className="test-info">
              <div className="test-name">Classification: Grade {entry.grade}</div>
              <div className="test-description">{new Date(entry.testedAt).toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

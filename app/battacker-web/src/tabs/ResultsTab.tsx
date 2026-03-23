import type { DefenseScore, TestResult } from "@libztbs/battacker";

export function ResultsTab({ score }: { score: DefenseScore }) {
  const allResults = score.categories.flatMap((cat) => cat.testResults);

  return (
    <div className="test-results">
      <h3>
        Security Audit Results {"//"} {allResults.length} Tests Executed
      </h3>
      <div className="test-list">
        {allResults.map((result) => (
          <TestResultItem key={result.test.id} result={result} />
        ))}
      </div>
    </div>
  );
}

function TestResultItem({ result }: { result: TestResult }) {
  const { test, result: testResult } = result;

  const getStatusIcon = () => {
    if (testResult.blocked) return "✓";
    return "✗";
  };

  const getStatusClass = () => {
    if (testResult.blocked) return "blocked";
    return "success";
  };

  return (
    <div className="test-item">
      <div className={`test-status ${getStatusClass()}`}>{getStatusIcon()}</div>
      <div className="test-info">
        <div className="test-name">{test.name}</div>
        <div className="test-description">{test.description}</div>
      </div>
      <div className="test-details">
        <span className={`severity-badge severity-${test.severity}`}>{test.severity}</span>
        <div className="test-time">{testResult.executionTime.toFixed(0)}ms</div>
      </div>
    </div>
  );
}

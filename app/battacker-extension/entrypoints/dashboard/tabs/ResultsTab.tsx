import type { DefenseScore, TestResult } from "@libztbs/battacker";

export function ResultsTab({ score }: { score: DefenseScore }) {
  const allResults = score.categories.flatMap((cat) => cat.testResults);

  return (
    <div class="test-results">
      <h3>Security Audit Results {"// "}{allResults.length} Tests Executed</h3>
      <div class="test-list">
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
    if (testResult.detected) return "!";
    return "✗";
  };

  const getStatusClass = () => {
    if (testResult.blocked) return "blocked";
    if (testResult.detected) return "detected";
    return "success";
  };

  return (
    <div class="test-item">
      <div class={`test-status ${getStatusClass()}`}>{getStatusIcon()}</div>
      <div class="test-info">
        <div class="test-name">{test.name}</div>
        <div class="test-description">{test.description}</div>
      </div>
      <div class="test-details">
        <span class={`severity-badge severity-${test.severity}`}>
          {test.severity}
        </span>
        <div class="test-time">{testResult.executionTime.toFixed(0)}ms</div>
      </div>
    </div>
  );
}

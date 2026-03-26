#!/bin/bash
# Detect patterns that cause RangeError: Maximum call stack size exceeded
# V8 has ~65k argument limit for function calls with spread syntax.
#
# Banned patterns:
#   .push(...expr)       - use for-of loop instead
#   Math.min(...expr)    - use loop to find min instead
#   Math.max(...expr)    - use loop to find max instead

set -euo pipefail

# Ensure grep -rP (PCRE) is available as fallback
search_pattern() {
  local pattern="$1"
  if command -v rg &>/dev/null; then
    rg "$pattern" \
      --glob '**/*.ts' --glob '**/*.tsx' --glob '**/*.js' \
      --glob '!**/node_modules/**' --glob '!**/*.test.*' --glob '!**/*.spec.*' \
      --glob '!**/dist/**' --glob '!**/.output/**' --glob '!**/.wxt-dev/**' \
      -n 2>/dev/null || true
  else
    grep -rPn "$pattern" \
      --include='*.ts' --include='*.tsx' --include='*.js' \
      --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.output --exclude-dir=.wxt-dev \
      . 2>/dev/null | grep -v '\.test\.\|\.spec\.' || true
  fi
}

ERRORS=0

echo "Checking for unsafe spread patterns that cause stack overflow..."

# .push(...anything) in source files (not tests, not node_modules)
PUSH_HITS=$(search_pattern '\.push\(\.\.\.')

if [ -n "$PUSH_HITS" ]; then
  echo ""
  echo "ERROR: Unsafe .push(...spread) detected. Use a for-of loop instead."
  echo "$PUSH_HITS"
  ERRORS=$((ERRORS + 1))
fi

# Math.min(...anything) or Math.max(...anything)
MATH_HITS=$(search_pattern 'Math\.(min|max)\(\.\.\.')

if [ -n "$MATH_HITS" ]; then
  echo ""
  echo "ERROR: Unsafe Math.min/max(...spread) detected. Use a loop to find min/max."
  echo "$MATH_HITS"
  ERRORS=$((ERRORS + 1))
fi

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "Found $ERRORS unsafe spread pattern(s). These cause RangeError with large arrays."
  echo "See: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/apply#using_apply_and_built-in_functions"
  exit 1
fi

echo "No unsafe spread patterns found."

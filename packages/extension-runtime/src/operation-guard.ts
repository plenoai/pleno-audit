/**
 * Prevents concurrent execution of the same async operation.
 * If an operation is already running, subsequent calls return the pending result.
 */
export class OperationGuard<T> {
  private pending: Promise<T> | null = null;

  async run(operation: () => Promise<T>): Promise<T> {
    if (this.pending) return this.pending;

    this.pending = operation();
    try {
      return await this.pending;
    } finally {
      this.pending = null;
    }
  }
}

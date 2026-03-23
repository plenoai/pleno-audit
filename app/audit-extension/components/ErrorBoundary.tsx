import { Component } from "preact";
import type { ComponentChild } from "preact";
import { createLogger } from "@libztbs/extension-runtime";
import { ErrorState, parseErrorMessage } from "./ErrorState";

const logger = createLogger("ErrorBoundary");

interface ErrorBoundaryProps {
  children: ComponentChild;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    logger.error("Error caught by boundary:", error);
    logger.debug("Component stack:", errorInfo.componentStack);
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  handleHelp = () => {
    logger.info("User requested help for error");
    logger.info(
      "Support details:",
      this.state.error?.message || "不明なエラー",
    );
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const { type, technicalDetails } = parseErrorMessage(this.state.error);

      return (
        <ErrorState
          type={type}
          technicalDetails={technicalDetails}
          onRetry={this.handleRetry}
          onHelp={this.handleHelp}
        />
      );
    }

    return this.props.children;
  }
}

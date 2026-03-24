export interface DebugMessage {
  type: string;
  id?: string;
  data?: unknown;
}

export interface DebugResponse {
  id?: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

export type DebugHandlerResult = Omit<DebugResponse, "id">;

export type DebugHandler = (data: unknown) => Promise<DebugHandlerResult>;

export interface DebugBridgeDeps {
  getNetworkRequests?: (params?: {
    limit?: number;
    initiatorType?: string;
  }) => Promise<{ requests: unknown[]; total: number }>;
}

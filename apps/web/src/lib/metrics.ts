export type MetricName = 
  | 'call_setup_duration'
  | 'successful_calls'
  | 'failed_calls'
  | 'reconnect_attempts'
  | 'successful_reconnects'
  | 'ice_failures'
  | 'turn_usage'
  | 'websocket_connections'
  | 'websocket_reconnects'
  | 'stale_sessions';

export const metrics = {
  increment: (metric: MetricName, value: number = 1) => {
    // In a real application, this would send to Prometheus/Datadog
    // For now, we log it cleanly
    console.log(`[METRIC] ${metric} +${value}`);
  },
  gauge: (metric: MetricName, value: number) => {
    console.log(`[METRIC] ${metric} = ${value}`);
  },
  timing: (metric: MetricName, durationMs: number) => {
    console.log(`[METRIC] ${metric} ${durationMs}ms`);
  }
};

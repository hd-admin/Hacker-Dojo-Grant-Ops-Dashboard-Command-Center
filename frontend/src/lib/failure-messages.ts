import type { JobFailureCategory } from '../../../shared/types';
import type { OpencodeFailureMode } from '../server/grant-ops/opencode-client';

export interface FailureMessage {
  title: string;
  description: string;
  action: string;
}

export const opencodeFailureMessages: Record<OpencodeFailureMode, FailureMessage> = {
  'install-missing': {
    title: 'Opencode not installed',
    description:
      'The opencode binary was not found on PATH or at the configured path. The grant generation system cannot run without it.',
    action: 'Install opencode or verify the binary path in Org Profile settings.',
  },
  'config-error': {
    title: 'Opencode configuration error',
    description:
      'Opencode is installed but not properly configured — missing API key, unauthorized access, or profile not found.',
    action: 'Check API key and profile configuration in Settings.',
  },
  'rate-limit': {
    title: 'Rate limited',
    description:
      'The opencode provider is throttling requests due to rate limiting or quota exhaustion.',
    action: 'Wait a few minutes before retrying, or upgrade your plan.',
  },
  'malformed-output': {
    title: 'Invalid response',
    description:
      'Opencode returned a response that could not be parsed — invalid JSON or unexpected format.',
    action: 'Retry the operation or check for known issues with the model version.',
  },
  'context-overflow': {
    title: 'Context too long',
    description:
      'The input exceeded the maximum context length supported by the model. Consider reducing the size of source materials.',
    action: 'Reduce the number or size of selected sources and retry.',
  },
  'partial-output': {
    title: 'Partial result',
    description:
      'Some content was generated before the operation was interrupted.',
    action: 'Review and complete the partial result manually.',
  },
  'model-unavailable': {
    title: 'Model unavailable',
    description:
      'The requested model is overloaded, not found, or temporarily unavailable (503).',
    action: 'Wait and retry later, or switch to a different model.',
  },
  'timeout': {
    title: 'Operation timed out',
    description:
      'The opencode operation exceeded its time deadline and was terminated.',
    action: 'Retry with a smaller scope, or increase the timeout in settings.',
  },
  'connectivity': {
    title: 'Network not reachable',
    description:
      'Cannot reach the opencode provider — network is unreachable or the connection was refused. This is not a binary installation issue.',
    action: 'Check your network connection and verify the provider endpoint is accessible. If behind a proxy, configure it in settings.',
  },
  'quota-exhausted': {
    title: 'Quota exhausted',
    description:
      'The opencode provider has exhausted its usage quota or billing limit. Requests are blocked until quota is restored.',
    action: 'Check your opencode quota and billing status. Upgrade your plan or wait for quota reset.',
  },
  'capacity': {
    title: 'Service overloaded',
    description:
      'The opencode provider is experiencing high load or has exhausted available resources (503). This is a provider-side capacity issue.',
    action: 'Wait and retry later. If the issue persists, contact the provider or switch to a different provider.',
  },
  'interrupted-session': {
    title: 'Session interrupted',
    description:
      'The opencode session was terminated mid-execution — the connection was closed or the process received an interrupt signal. Partial output may be available.',
    action: 'Check for partial output in the job details. Retry the operation or restart the session.',
  },
  'unknown': {
    title: 'Unknown error',
    description:
      'An unexpected error occurred during opencode execution that could not be classified.',
    action: 'Check the error log for details and retry.',
  },
};

export const jobFailureMessages: Record<JobFailureCategory, FailureMessage> = {
  connectivity: {
    title: 'Connection error',
    description:
      'Cannot reach opencode — check path and settings in Org Profile.',
    action: 'Verify opencode path in Settings.',
  },
  timeout: {
    title: 'Operation timed out',
    description:
      'The operation took too long to complete.',
    action: 'Retry or check opencode settings.',
  },
  'rate-limit': {
    title: 'Rate limited',
    description:
      'Service rate limited — wait before retrying.',
    action: 'Wait a few minutes before retrying.',
  },
  'quota-exhausted': {
    title: 'Quota exhausted',
    description:
      'Quota exhausted — action required to restore service.',
    action: 'Check your opencode quota and billing.',
  },
  capacity: {
    title: 'Capacity error',
    description:
      'Service temporarily unavailable — retry later.',
    action: 'Wait and retry later.',
  },
  logic: {
    title: 'Logic error',
    description:
      'A logic or validation error occurred.',
    action: 'Check the error details and retry.',
  },
  unknown: {
    title: 'Unknown error',
    description:
      'An unexpected error occurred.',
    action: 'Check logs and retry.',
  },
};

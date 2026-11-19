export interface AgentActivity {
  id: number;
  type: 'task' | 'step' | 'tool' | 'success' | 'error';
  title: string;
  detail: string;
  timestamp: string;
  status: 'running' | 'completed' | 'failed' | 'info';
}

let nextId = 1;
const events: AgentActivity[] = [];

export function recordActivity(
  type: AgentActivity['type'],
  title: string,
  detail: string,
  status: AgentActivity['status'] = 'info',
): void {
  events.unshift({ id: nextId++, type, title, detail, timestamp: new Date().toISOString(), status });
  if (events.length > 80) events.length = 80;
}

export function getRecentActivity(): AgentActivity[] {
  return events.slice(0, 50);
}

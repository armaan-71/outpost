export interface Run {
  id: string;
  query: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  updatedAt?: string;
  leadsCount?: number;
  error?: string;
}

export interface Lead {
  id: string;
  runId: string;
  companyName: string;
  domain: string;
  description: string;
  status: 'NEW' | 'CONTACTED' | 'REPLIED';
  summary?: string;
  email_draft?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
  if (!API_URL) {
    throw new Error('NEXT_PUBLIC_API_URL is not set');
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    throw new ApiError(res.status, `API Error: ${res.statusText}`);
  }

  return res.json();
}

export const api = {
  getRuns: async (): Promise<Run[]> => {
    const data = await fetchJson<{ runs: Run[] }>('/runs');
    return data.runs;
  },

  createRun: async (query: string): Promise<Run> => {
    return fetchJson<Run>('/runs', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  },

  getRun: async (id: string): Promise<Run> => {
    return fetchJson<Run>(`/runs/${id}`);
  },

  getLeads: async (runId: string): Promise<Lead[]> => {
    const data = await fetchJson<{ leads: Lead[] }>(`/runs/${runId}/leads`);
    return data.leads;
  },
};

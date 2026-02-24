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

if (!API_URL) {
  console.warn(
    '⚠️ Warning: NEXT_PUBLIC_API_URL is not set. API calls will fail at runtime. ' +
      'Please set it in your .env.local file.',
  );
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchJson<T>(
  endpoint: string,
  token: string | null,
  options?: RequestInit,
): Promise<T> {
  if (!API_URL) {
    throw new Error('NEXT_PUBLIC_API_URL is not set');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    throw new ApiError(res.status, `API Error: ${res.statusText}`);
  }

  return res.json();
}

export const api = {
  getRuns: async (token: string | null): Promise<Run[]> => {
    const data = await fetchJson<{ runs: Run[] }>('/runs', token);
    return data.runs;
  },

  createRun: async (query: string, token: string | null): Promise<Run> => {
    return fetchJson<Run>('/runs', token, {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  },

  getRun: async (id: string, token: string | null): Promise<Run> => {
    const data = await fetchJson<{ run: Run }>(`/runs/${id}`, token);
    return data.run;
  },

  getLeads: async (runId: string, token: string | null): Promise<Lead[]> => {
    const data = await fetchJson<{ leads: Lead[] }>(`/runs/${runId}/leads`, token);
    return data.leads;
  },
};

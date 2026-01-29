// ============================================================================
// CHATVISTA - API Client
// Centralized API client for all backend requests
// ============================================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/api/v1` : 'http://localhost:4000/api/v1';

// Token management
let accessToken: string | null = null;
let refreshToken: string | null = null;

export const setTokens = (access: string, refresh: string) => {
  accessToken = access;
  refreshToken = refresh;
  if (typeof window !== 'undefined') {
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);
  }
};

export const getTokens = () => {
  if (typeof window !== 'undefined') {
    accessToken = accessToken || localStorage.getItem('accessToken');
    refreshToken = refreshToken || localStorage.getItem('refreshToken');
  }
  return { accessToken, refreshToken };
};

export const clearTokens = () => {
  accessToken = null;
  refreshToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }
};

// API error class
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Fetch wrapper with auth
async function fetchWithAuth(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const { accessToken } = getTokens();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (accessToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle token refresh on 401
  if (response.status === 401 && refreshToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
      return fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });
    }
  }

  return response;
}

// Refresh access token
async function refreshAccessToken(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();
      setTokens(data.accessToken, data.refreshToken);
      return true;
    }
  } catch (error) {
    console.error('Token refresh failed:', error);
  }

  clearTokens();
  return false;
}

// Generic API request function
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetchWithAuth(endpoint, options);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      error.code || 'UNKNOWN_ERROR',
      error.message || 'An error occurred'
    );
  }

  return response.json();
}

// ============================================================================
// Auth API
// ============================================================================

export const authApi = {
  register: async (data: {
    email: string;
    password: string;
    name: string;
  }) => {
    // Split name into firstName and lastName for backend
    const nameParts = data.name.trim().split(/\s+/);
    const firstName = nameParts[0] || data.name;
    const lastName = nameParts.slice(1).join(' ') || firstName;
    
    const result = await apiRequest<{
      user: any;
      message?: string;
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: data.email,
        password: data.password,
        firstName,
        lastName,
      }),
    });
    return result;
  },

  login: async (data: { email: string; password: string }) => {
    const result = await apiRequest<{
      user: any;
      accessToken: string;
      refreshToken: string;
      requiresMfa?: boolean;
      mfaToken?: string;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!result.requiresMfa) {
      setTokens(result.accessToken, result.refreshToken);
    }
    return result;
  },

  verifyMfa: async (data: { mfaToken: string; code: string }) => {
    const result = await apiRequest<{
      user: any;
      accessToken: string;
      refreshToken: string;
    }>('/auth/mfa/verify', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    setTokens(result.accessToken, result.refreshToken);
    return result;
  },

  logout: async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } finally {
      clearTokens();
    }
  },

  verifyEmail: (token: string) =>
    apiRequest(`/auth/verify-email/${token}`, { method: 'POST' }),

  forgotPassword: (email: string) =>
    apiRequest('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, password: string) =>
    apiRequest('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),

  getProfile: () => apiRequest<any>('/auth/me'),

  updateProfile: (data: { name?: string; avatar?: string }) =>
    apiRequest('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  enableMfa: () => apiRequest<{ secret: string; qrCode: string }>('/auth/mfa/enable'),

  confirmMfa: (code: string) =>
    apiRequest<{ backupCodes: string[] }>('/auth/mfa/confirm', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  disableMfa: (code: string) =>
    apiRequest('/auth/mfa/disable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),
};

// ============================================================================
// Meetings API
// ============================================================================

export const meetingsApi = {
  create: (data: {
    title: string;
    description?: string;
    type?: string;
    scheduledStartTime?: Date;
    scheduledEndTime?: Date;
    maxParticipants?: number;
    settings?: Record<string, any>;
  }) =>
    apiRequest<any>('/meetings', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  list: (params?: { page?: number; limit?: number; status?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiRequest<{ meetings: any[]; total: number; page: number }>(
      `/meetings${query ? `?${query}` : ''}`
    );
  },

  get: (id: string) => apiRequest<any>(`/meetings/${id}`),

  update: (id: string, data: Partial<{ title: string; description: string }>) =>
    apiRequest(`/meetings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiRequest(`/meetings/${id}`, { method: 'DELETE' }),

  join: (id: string) =>
    apiRequest<{ token: string; rtpCapabilities: any }>(`/meetings/${id}/join`, {
      method: 'POST',
    }),

  leave: (id: string) =>
    apiRequest(`/meetings/${id}/leave`, { method: 'POST' }),

  end: (id: string) =>
    apiRequest(`/meetings/${id}/end`, { method: 'POST' }),

  getParticipants: (id: string) =>
    apiRequest<any[]>(`/meetings/${id}/participants`),

  inviteParticipants: (id: string, emails: string[]) =>
    apiRequest(`/meetings/${id}/invite`, {
      method: 'POST',
      body: JSON.stringify({ emails }),
    }),

  removeParticipant: (meetingId: string, participantId: string) =>
    apiRequest(`/meetings/${meetingId}/participants/${participantId}`, {
      method: 'DELETE',
    }),
};

// ============================================================================
// Recordings API
// ============================================================================

export const recordingsApi = {
  list: (meetingId?: string) => {
    const query = meetingId ? `?meetingId=${meetingId}` : '';
    return apiRequest<any[]>(`/recordings${query}`);
  },

  get: (id: string) => apiRequest<any>(`/recordings/${id}`),

  start: (meetingId: string) =>
    apiRequest<{ recordingId: string }>(`/recordings/start`, {
      method: 'POST',
      body: JSON.stringify({ meetingId }),
    }),

  stop: (recordingId: string) =>
    apiRequest(`/recordings/${recordingId}/stop`, { method: 'POST' }),

  delete: (id: string) =>
    apiRequest(`/recordings/${id}`, { method: 'DELETE' }),

  getDownloadUrl: (id: string) =>
    apiRequest<{ url: string }>(`/recordings/${id}/download`),
};

// ============================================================================
// Transcripts API
// ============================================================================

export const transcriptsApi = {
  list: () =>
    apiRequest<any[]>('/transcripts'),

  get: (meetingId: string) =>
    apiRequest<any>(`/transcripts/${meetingId}`),

  download: (meetingId: string, format: 'txt' | 'srt' | 'vtt' = 'txt') =>
    apiRequest<{ url: string }>(`/transcripts/${meetingId}/download?format=${format}`),
};

// ============================================================================
// Minutes API
// ============================================================================

export const minutesApi = {
  list: () =>
    apiRequest<any[]>('/minutes'),

  get: (meetingId: string) =>
    apiRequest<any>(`/minutes/${meetingId}`),

  generate: (meetingId: string) =>
    apiRequest<any>(`/minutes/${meetingId}/generate`, { method: 'POST' }),

  regenerate: (minutesId: string) =>
    apiRequest<any>(`/minutes/${minutesId}/regenerate`, { method: 'POST' }),

  download: (meetingId: string, format: 'pdf' | 'md' | 'docx' | 'txt' = 'pdf') =>
    apiRequest<{ url: string }>(`/minutes/${meetingId}/download?format=${format}`),
};

// ============================================================================
// Export API
// ============================================================================

export const exportApi = {
  create: (data: {
    meetingId: string;
    type: 'transcript' | 'minutes' | 'recording' | 'full';
    format: 'pdf' | 'docx' | 'txt' | 'srt' | 'vtt';
  }) =>
    apiRequest<{ exportId: string; status: string }>('/exports', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getStatus: (exportId: string) =>
    apiRequest<{ status: string; progress: number; url?: string }>(
      `/exports/${exportId}`
    ),

  list: () => apiRequest<any[]>('/exports'),
};

// ============================================================================
// Analytics API
// ============================================================================

export const analyticsApi = {
  getMeetingStats: (meetingId: string) =>
    apiRequest<any>(`/analytics/meetings/${meetingId}`),

  getUserStats: () => apiRequest<any>('/analytics/user'),

  getOrganizationStats: () => apiRequest<any>('/analytics/organization'),

  getDashboard: () => apiRequest<any>('/analytics/dashboard'),
};

// ============================================================================
// Users API (Admin)
// ============================================================================

export const usersApi = {
  list: (params?: { page?: number; limit?: number; search?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiRequest<{ users: any[]; total: number }>(
      `/users${query ? `?${query}` : ''}`
    );
  },

  get: (id: string) => apiRequest<any>(`/users/${id}`),

  update: (id: string, data: any) =>
    apiRequest(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiRequest(`/users/${id}`, { method: 'DELETE' }),

  updateRole: (id: string, role: string) =>
    apiRequest(`/users/${id}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),

  updateProfile: (data: { name?: string; email?: string }) =>
    apiRequest(`/users/me`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    apiRequest(`/users/me/password`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  uploadAvatar: (formData: FormData) =>
    apiRequest<{ avatar: string }>(`/users/me/avatar`, {
      method: 'POST',
      body: formData,
      headers: {},
    }),
};

// Integrations API
// ============================================================================

export const integrationsApi = {
  list: () =>
    apiRequest<{ integrations: any[] }>('/integrations'),

  available: () =>
    apiRequest<{ integrations: any[] }>('/integrations/available'),

  connect: (providerId: string, options: { redirectUri: string }) =>
    apiRequest<{ authUrl: string }>(`/integrations/${providerId}/connect`, {
      method: 'POST',
      body: JSON.stringify(options),
    }),

  disconnect: (integrationId: string) =>
    apiRequest(`/integrations/${integrationId}`, { method: 'DELETE' }),

  sync: (integrationId: string) =>
    apiRequest(`/integrations/${integrationId}/sync`, { method: 'POST' }),
};

// Storage API
// ============================================================================

export type StorageType = 'recordings' | 'transcripts' | 'minutes' | 'exports' | 'avatars';

export const storageApi = {
  upload: async (type: StorageType, file: File, options?: { compress?: boolean; encrypt?: boolean }) => {
    const formData = new FormData();
    formData.append('file', file);
    if (options?.compress) formData.append('compress', 'true');
    if (options?.encrypt) formData.append('encrypt', 'true');
    
    const { accessToken } = getTokens();
    const response = await fetch(`${API_BASE_URL}/storage/${type}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: formData,
    });
    
    if (!response.ok) throw new Error('Upload failed');
    return response.json();
  },

  getUrl: (type: StorageType, fileId: string, expiresIn?: number) =>
    apiRequest<{ url: string; expiresIn: number }>(
      `/storage/${type}/${fileId}/url${expiresIn ? `?expiresIn=${expiresIn}` : ''}`
    ),

  list: (type: StorageType, params?: { limit?: number; offset?: number }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiRequest<{ files: any[]; source: string }>(
      `/storage/${type}${query ? `?${query}` : ''}`
    );
  },

  delete: (type: StorageType, fileId: string) =>
    apiRequest(`/storage/${type}/${fileId}`, { method: 'DELETE' }),

  // Admin operations
  getStats: () =>
    apiRequest<{ local: any; cloud: any; totalSize: number }>('/storage/admin/stats'),

  syncLocalToCloud: () =>
    apiRequest<{ success: boolean; synced: number; failed: number }>(
      '/storage/admin/sync/local-to-cloud',
      { method: 'POST' }
    ),

  syncCloudToLocal: () =>
    apiRequest<{ success: boolean; synced: number; failed: number }>(
      '/storage/admin/sync/cloud-to-local',
      { method: 'POST' }
    ),

  getSyncStatus: () =>
    apiRequest<{
      localToCloud: { synced: number; failed: number; pending: number };
      cloudToLocal: { synced: number; failed: number; pending: number };
      lastSync: string;
      nextScheduledSync: string;
    }>('/storage/admin/sync/status'),

  runBackup: () =>
    apiRequest<{ success: boolean; message: string }>(
      '/storage/admin/backup',
      { method: 'POST' }
    ),

  cleanup: (retentionDays?: number) =>
    apiRequest<{ success: boolean; localDeleted: number; cloudArchived: number }>(
      '/storage/admin/cleanup',
      {
        method: 'POST',
        body: JSON.stringify({ retentionDays }),
      }
    ),
};

// Export all APIs
export const api = {
  auth: authApi,
  meetings: meetingsApi,
  recordings: recordingsApi,
  transcripts: transcriptsApi,
  minutes: minutesApi,
  export: exportApi,
  analytics: analyticsApi,
  users: usersApi,
  integrations: integrationsApi,
  storage: storageApi,
};

export default api;

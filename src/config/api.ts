export const API_BASE_URL = 'https://visual-todoflow-backend.vercel.app/api';

interface ApiEndpoints {
  login: string;
  notionLoad: string;
  notionSave: string;
  notionDelete: string;
  notionListTags: string;
  notionCreateDb: string;
  upload: string;
}

export const API_ENDPOINTS: ApiEndpoints = {
  login: `${API_BASE_URL}/login`,
  notionLoad: `${API_BASE_URL}/notion/load`,
  notionSave: `${API_BASE_URL}/notion/save`,
  notionDelete: `${API_BASE_URL}/notion/delete`,
  notionListTags: `${API_BASE_URL}/notion/list-tags`,
  notionCreateDb: `${API_BASE_URL}/notion/create-db`,
  upload: `${API_BASE_URL}/upload`,
};

export const getAuthHeaders = () => {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };
};
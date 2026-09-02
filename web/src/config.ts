export const config = {
  n8nBaseUrl: (import.meta.env.VITE_N8N_BASE_URL as string | undefined) ?? '',
  n8nToken: (import.meta.env.VITE_N8N_TOKEN as string | undefined) ?? '',
};

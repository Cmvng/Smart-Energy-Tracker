import { useAuth } from "@/lib/auth";
import { getGetCurrenciesQueryKey, useGetCurrencies as useGeneratedGetCurrencies } from "@workspace/api-client-react";

export function useCurrencies() {
  const { token } = useAuth();
  return useGeneratedGetCurrencies({
    query: {
      queryKey: getGetCurrenciesQueryKey(),
      enabled: !!token, 
      staleTime: 1000 * 60 * 60 // 1 hour
    },
    request: { 
      headers: token ? { Authorization: `Bearer ${token}` } : undefined 
    }
  });
}

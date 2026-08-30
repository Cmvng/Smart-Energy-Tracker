import { useAuth } from "@/lib/auth";
import { 
  useListTransactions as useGeneratedList,
  useGetTransactionSummary as useGeneratedSummary,
  useCreateTransaction as useGeneratedCreate,
  getListTransactionsQueryKey,
  getGetTransactionSummaryQueryKey,
  ListTransactionsParams,
  GetTransactionSummaryParams
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export function useTransactions(params?: ListTransactionsParams) {
  const { token } = useAuth();
  return useGeneratedList(params, {
    query: { 
      queryKey: getListTransactionsQueryKey(params),
      enabled: !!token,
      staleTime: 1000 * 30 // 30 seconds
    },
    request: { 
      headers: token ? { Authorization: `Bearer ${token}` } : undefined 
    }
  });
}

export function useTransactionSummary(params?: GetTransactionSummaryParams) {
  const { token } = useAuth();
  return useGeneratedSummary(params, {
    query: { 
      queryKey: getGetTransactionSummaryQueryKey(params),
      enabled: !!token,
      staleTime: 1000 * 30
    },
    request: { 
      headers: token ? { Authorization: `Bearer ${token}` } : undefined 
    }
  });
}

export function useCreateTransaction() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  
  return useGeneratedCreate({
    mutation: {
      onSuccess: () => {
        // Invalidate queries so the dashboard refreshes immediately
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/transactions/summary"] });
      }
    },
    request: { 
      headers: token ? { Authorization: `Bearer ${token}` } : undefined 
    }
  });
}

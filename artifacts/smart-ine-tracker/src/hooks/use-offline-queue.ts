import { useEffect, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

const QUEUE_KEY = "offline_queue";

export interface QueuedTransaction {
  account_id: string;
  type: "income" | "expense";
  amount_original: number;
  currency_code: string;
  notes?: string;
  transacted_at: string;
  queued_at: string;
}

function getQueue(): QueuedTransaction[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveQueue(q: QueuedTransaction[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export function useOfflineQueue() {
  const [queueCount, setQueueCount] = useState(() => getQueue().length);
  const queryClient = useQueryClient();

  const syncQueue = useCallback(async () => {
    const queue = getQueue();
    if (queue.length === 0) return;

    const token = localStorage.getItem("token");
    if (!token) return;

    const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
    const remaining: QueuedTransaction[] = [];

    for (const item of queue) {
      try {
        const res = await fetch(`${BASE}/api/transactions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            account_id: item.account_id,
            type: item.type,
            amount_original: item.amount_original,
            currency_code: item.currency_code,
            notes: item.notes,
            transacted_at: item.transacted_at,
          }),
        });
        if (!res.ok) remaining.push(item);
      } catch {
        remaining.push(item);
      }
    }

    saveQueue(remaining);
    setQueueCount(remaining.length);

    if (remaining.length < queue.length) {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
    }
  }, [queryClient]);

  const enqueue = useCallback((tx: Omit<QueuedTransaction, "queued_at">) => {
    const q = getQueue();
    q.push({ ...tx, queued_at: new Date().toISOString() });
    saveQueue(q);
    setQueueCount(q.length);
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      syncQueue();
    };
    window.addEventListener("online", handleOnline);

    if (navigator.onLine) {
      syncQueue();
    }

    return () => window.removeEventListener("online", handleOnline);
  }, [syncQueue]);

  return { queueCount, enqueue, syncQueue };
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { HealthStatus } from '../types/health';
import { ApiService } from '../services/api';

export function useHealth() {
  const [data, setData] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await ApiService.getHealth();
      if (response.data) {
        setData(response.data);
      } else {
        setError(response.error?.message || 'Không thể lấy dữ liệu trạng thái');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi kết nối tới Backend server';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  return { data, loading, error, refetch: fetchHealth };
}

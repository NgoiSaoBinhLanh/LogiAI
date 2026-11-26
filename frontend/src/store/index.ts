/**
 * Store placeholder cho quản lý trạng thái Frontend (Zustand hoặc Context API).
 * Sẵn sàng mở rộng khi triển khai các module chức năng.
 */
export interface AppState {
  theme: 'light' | 'dark' | 'system';
}

export const initialAppState: AppState = {
  theme: 'system',
};

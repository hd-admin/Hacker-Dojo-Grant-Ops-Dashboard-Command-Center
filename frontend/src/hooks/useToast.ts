import { useToast as useToastContext } from '@/components/ToastProvider';

export function useToast() {
  return useToastContext();
}

import { useToastStore } from '@/lib/toast-store';

export function ToastContainer() {
  const { toasts, remove } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm animate-in slide-in-from-right ${
            t.type === 'error' ? 'bg-red-900' : 'bg-foreground'
          }`}
        >
          {t.type === 'loading' && (
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          )}
          {t.type === 'success' && <span className="text-green-400">✓</span>}
          {t.type === 'error' && <span className="text-red-400">✗</span>}
          <span>{t.message}</span>
          {t.action && (
            <button onClick={t.action.onClick} className="ml-2 px-2 py-1 border border-white/30 rounded-md text-xs hover:bg-white/10">
              {t.action.label}
            </button>
          )}
          <button onClick={() => remove(t.id)} className="ml-2 opacity-50 hover:opacity-100 text-lg leading-none">&times;</button>
        </div>
      ))}
    </div>
  );
}

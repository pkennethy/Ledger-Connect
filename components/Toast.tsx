import React from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col space-y-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            pointer-events-auto
            flex items-center w-full max-w-xs p-4 rounded-lg shadow-lg border-l-4 transform transition-all duration-300 animate-in slide-in-from-right
            ${toast.type === 'success' ? 'bg-white border-green-500 text-gray-800' : ''}
            ${toast.type === 'error' ? 'bg-white border-red-500 text-gray-800' : ''}
            ${toast.type === 'info' ? 'bg-white border-blue-500 text-gray-800' : ''}
          `}
        >
          <div className="flex-shrink-0 mr-3">
            {toast.type === 'success' && <CheckCircle size={20} className="text-green-500" />}
            {toast.type === 'error' && <AlertCircle size={20} className="text-red-500" />}
            {toast.type === 'info' && <Info size={20} className="text-blue-500" />}
          </div>
          <div className="flex-1 text-sm font-medium">{toast.message}</div>
          <button
            onClick={() => removeToast(toast.id)}
            className="ml-3 text-gray-400 hover:text-gray-600 focus:outline-none"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};
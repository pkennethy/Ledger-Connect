
import React, { useState, useEffect } from 'react';
import { Delete, X, Check } from 'lucide-react';

interface NumpadModalProps {
    isOpen: boolean;
    initialValue: number;
    title: string;
    onClose: () => void;
    onConfirm: (value: number) => void;
}

export const NumpadModal: React.FC<NumpadModalProps> = ({ isOpen, initialValue, title, onClose, onConfirm }) => {
    const [valueStr, setValueStr] = useState(initialValue.toString());

    useEffect(() => {
        if (isOpen) {
            setValueStr(initialValue === 1 ? '' : initialValue.toString());
        }
    }, [isOpen, initialValue]);

    if (!isOpen) return null;

    const handleNumClick = (num: number) => {
        if (valueStr.length >= 5) return;
        setValueStr(prev => prev + num.toString());
    };

    const handleBackspace = () => {
        setValueStr(prev => prev.slice(0, -1));
    };

    const handleClear = () => {
        setValueStr('');
    };

    const handleConfirm = () => {
        const val = parseInt(valueStr || '0', 10);
        onConfirm(val > 0 ? val : 1);
        onClose();
    };

    const displayValue = valueStr || '0';

    return (
        <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-black/60 dark:bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200 pb-[130px] sm:pb-0">
            <div className="absolute inset-0" onClick={onClose}></div>

            <div className="relative bg-white dark:bg-slate-900 w-full max-w-sm sm:rounded-2xl rounded-t-2xl shadow-2xl dark:shadow-premium-dark overflow-hidden animate-in slide-in-from-bottom duration-300">
                <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-950">
                    <h3 className="font-black text-[10px] uppercase tracking-widest text-gray-400 dark:text-slate-500">{title}</h3>
                    <button onClick={onClose} className="p-2 bg-gray-200 dark:bg-slate-800 rounded-full hover:bg-gray-300 dark:hover:bg-slate-700 transition-colors">
                        <X size={18} className="text-gray-600 dark:text-slate-300" />
                    </button>
                </div>

                <div className="p-6">
                    <div className="mb-6 bg-gray-100 dark:bg-slate-950 rounded-xl p-4 text-right border-2 border-blue-500/30 dark:border-blue-500/10">
                        <span className="text-4xl font-mono font-black text-gray-800 dark:text-white tracking-widest">
                            {displayValue}
                        </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-6">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                            <button
                                key={num}
                                onClick={() => handleNumClick(num)}
                                className="h-16 rounded-xl bg-gray-50 dark:bg-slate-800 text-2xl font-black text-gray-700 dark:text-slate-100 shadow-sm border border-gray-200 dark:border-slate-700 active:scale-95 active:bg-blue-50 dark:active:bg-slate-700 transition-all"
                            >
                                {num}
                            </button>
                        ))}
                        <button
                            onClick={handleClear}
                            className="h-16 rounded-xl bg-red-50 dark:bg-rose-500/10 text-xl font-black text-red-600 dark:text-rose-400 border border-red-100 dark:border-rose-500/20 active:scale-95 transition-all"
                        >
                            C
                        </button>
                        <button
                            onClick={() => handleNumClick(0)}
                            className="h-16 rounded-xl bg-gray-50 dark:bg-slate-800 text-2xl font-black text-gray-700 dark:text-slate-100 shadow-sm border border-gray-200 dark:border-slate-700 active:scale-95 transition-all"
                        >
                            0
                        </button>
                        <button
                            onClick={handleBackspace}
                            className="h-16 rounded-xl bg-gray-200 dark:bg-slate-700 flex items-center justify-center text-gray-600 dark:text-slate-400 active:scale-95 transition-all"
                        >
                            <Delete size={24} />
                        </button>
                    </div>

                    <button
                        onClick={handleConfirm}
                        className="w-full py-5 bg-blue-600 dark:bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-500/30 flex items-center justify-center transition-all active:scale-95"
                    >
                        <Check size={20} className="mr-2" />
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
};

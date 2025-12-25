
import React, { useEffect, useRef, useState } from 'react';
import { CONFIG } from '../config';
import { Sparkles, X, ArrowRight } from 'lucide-react';

export const AdBanner: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        if (!CONFIG.ADSTERRA.ENABLED || !containerRef.current) return;

        // Responsive Logic
        const screenWidth = window.innerWidth;
        let adWidth = 468;
        let adHeight = 60;
        let key = CONFIG.ADSTERRA.KEY;

        // Mobile Breakpoint
        if (screenWidth < 768) {
            adWidth = 320;
            adHeight = 50;
            if (CONFIG.ADSTERRA.MOBILE_KEY) {
                key = CONFIG.ADSTERRA.MOBILE_KEY;
            }
        }

        if (!key) return;

        const iframe = document.createElement('iframe');
        iframe.style.width = `${adWidth}px`;
        iframe.style.height = `${adHeight}px`;
        iframe.style.border = 'none';
        iframe.style.overflow = 'hidden';
        iframe.style.backgroundColor = 'transparent';
        iframe.scrolling = 'no';
        iframe.title = "Advertisement";
        
        const adHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    html, body { 
                        margin: 0; 
                        padding: 0; 
                        width: 100%; 
                        height: 100%; 
                        background-color: transparent !important; 
                        display: flex; 
                        justify-content: center; 
                        align-items: center; 
                        overflow: hidden; 
                    }
                </style>
            </head>
            <body>
                <script type="text/javascript">
                    atOptions = {
                        'key' : '${key}',
                        'format' : 'iframe',
                        'height' : ${adHeight},
                        'width' : ${adWidth},
                        'params' : {}
                    };
                </script>
                <script type="text/javascript" src="//www.highperformanceformat.com/${key}/invoke.js"></script>
            </body>
            </html>
        `;

        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(iframe);

        try {
             const doc = iframe.contentWindow?.document;
             if (doc) {
                 doc.open();
                 doc.write(adHtml);
                 doc.close();
             }
        } catch(e) {
            console.error("Error loading ad iframe", e);
        }

    }, []);

    if (!CONFIG.ADSTERRA.ENABLED || !isVisible) return null;

    return (
        <div className="fixed bottom-0 left-0 w-full h-[60px] bg-slate-900 border-t border-gray-800 z-30 shadow-[0_-4px_10px_rgba(0,0,0,0.1)] overflow-hidden print:hidden flex justify-center items-center">
             
             <div ref={containerRef} className="absolute inset-0 z-20 flex items-center justify-center w-full h-full pointer-events-auto"></div>

             <div className="absolute inset-0 z-10 w-full h-full bg-gradient-to-r from-slate-900 to-slate-800 flex items-center justify-between px-4 sm:px-6">
                
                <div className="absolute inset-0 opacity-10 pointer-events-none" 
                     style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)', backgroundSize: '20px 20px' }}>
                </div>

                <div className="flex items-center gap-3 relative z-10 text-white">
                    <div className="bg-yellow-500/20 p-1.5 rounded-lg border border-yellow-500/30 shadow-[0_0_10px_rgba(234,179,8,0.2)]">
                        <Sparkles size={18} className="text-yellow-400" fill="currentColor" />
                    </div>
                    <div className="flex flex-col">
                        <p className="text-xs font-bold tracking-wider uppercase text-slate-200">
                            Ledger <span className="text-white">Premium</span>
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3 relative z-10">
                    <button 
                        onClick={() => setIsVisible(false)} 
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                        aria-label="Close"
                    >
                        <X size={14} />
                    </button>
                </div>
             </div>
        </div>
    );
};

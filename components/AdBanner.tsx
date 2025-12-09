import React, { useEffect, useRef, useState } from 'react';
import { CONFIG } from '../config';
import { Sparkles, X, ArrowRight } from 'lucide-react';

export const AdBanner: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        // Only load script if enabled and key exists
        if (!CONFIG.ADSTERRA.ENABLED || !CONFIG.ADSTERRA.KEY || !containerRef.current) return;

        const key = CONFIG.ADSTERRA.KEY;
        
        // Responsive Logic
        const screenWidth = window.innerWidth;
        let adWidth = 468;
        let adHeight = 60;

        if (screenWidth < 480) {
            adWidth = 320;
            adHeight = 50;
        }

        const iframe = document.createElement('iframe');
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.style.overflow = 'hidden';
        iframe.scrolling = 'no';
        // Permissions for ad scripts to run correctly
        iframe.sandbox.add('allow-scripts', 'allow-popups', 'allow-same-origin', 'allow-forms', 'allow-popups-to-escape-sandbox');
        
        const adHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; height: 100%; width: 100%; background: transparent; overflow: hidden; font-family: sans-serif; }
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

        // Clear previous content to prevent duplicates
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
        <div className="fixed bottom-0 left-0 w-full h-[60px] bg-white border-t border-gray-200 z-[100] shadow-[0_-4px_10px_rgba(0,0,0,0.05)] overflow-hidden print:hidden">
             
             {/* 1. AD LAYER (Top Priority Z-Index) */}
             {/* This layer sits on top. If the ad loads opaque content, it covers the backup layer below. */}
             {/* If the ad fails to load (AdBlock) or is transparent, the backup layer is visible. */}
             <div ref={containerRef} className="absolute inset-0 z-20 flex items-center justify-center w-full h-full pointer-events-auto bg-transparent"></div>

             {/* 2. BACKUP / HOUSE AD LAYER (Bottom Z-Index) */}
             {/* Professional design shown when ads are missing */}
             <div className="absolute inset-0 z-10 w-full h-full bg-gradient-to-r from-slate-900 to-slate-800 flex items-center justify-between px-4 sm:px-6">
                
                {/* Subtle Texture */}
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
                        <p className="text-[10px] text-slate-400 font-medium hidden sm:block">
                            Get offline mode & priority support
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3 relative z-10">
                    <button className="flex items-center gap-1 text-[10px] font-bold bg-white text-slate-900 px-3 py-1.5 rounded-full shadow hover:bg-slate-100 hover:scale-105 transition-all uppercase tracking-wider">
                        Upgrade <ArrowRight size={10} />
                    </button>
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
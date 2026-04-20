import React from 'react';

const Footer = () => {
    return (
        <footer className="fixed bottom-0 left-0 lg:left-56 right-0 py-2.5 border-t border-sky-200 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-40">
            <div className="max-w-7xl mx-auto px-4 text-center">
                <p className="text-xs sm:text-sm font-medium text-sky-700">
                    Powered By <a 
                        href="https://www.botivate.in" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sky-600 hover:text-sky-700 font-bold hover:underline transition-all"
                    >
                        Botivate
                    </a>
                </p>
            </div>
        </footer>
    );
};

export default Footer;

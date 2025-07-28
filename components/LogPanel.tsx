
import React, { useEffect, useRef } from 'react';
import type { LogEntry } from '../types';

const getLogLevelClass = (level: LogEntry['level']) => {
    switch (level) {
        case 'SUCCESS':
            return 'bg-green-300 border-green-500';
        case 'ERROR':
            return 'bg-red-300 border-red-500 text-black font-bold';
        case 'INFO':
        default:
            return 'bg-white border-gray-400';
    }
};

const getLogLevelIcon = (level: LogEntry['level']) => {
    switch (level) {
        case 'SUCCESS': return '✅';
        case 'ERROR': return '🔥';
        case 'INFO':
        default: return '➡️';
    }
};


interface LogPanelProps {
    logs: LogEntry[];
}

export const LogPanel: React.FC<LogPanelProps> = ({ logs }) => {
    const logContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs]);

    return (
        <div className="h-full flex flex-col p-6 bg-cyan-500 border-4 border-black rounded-xl neo-shadow">
            <h3 className="text-3xl font-black text-center text-black mb-4 flex-shrink-0">
                Real-Time Logs
            </h3>
            <div 
                ref={logContainerRef} 
                className="flex-grow bg-cyan-700 p-4 rounded-lg border-4 border-black overflow-y-auto custom-scrollbar h-[500px] lg:h-auto"
            >
                <div className="space-y-3">
                    {logs.length === 0 && (
                        <p className="text-cyan-200 font-semibold text-center mt-4">Waiting for process to start...</p>
                    )}
                    {logs.map((log, index) => (
                        <div key={index} className={`p-3 rounded-md border-2 ${getLogLevelClass(log.level)}`}>
                            <p className="font-mono text-xs text-black/70 font-bold">
                                [{new Date(log.timestamp).toLocaleTimeString()}] {log.category ? `[${log.category}]` : ''}
                            </p>
                            <p className="text-sm text-black flex items-start gap-2">
                               <span className="mt-0.5">{getLogLevelIcon(log.level)}</span> 
                               <span>{log.message}</span>
                            </p>
                            {log.details && (
                                <pre className="mt-1 text-xs bg-black/10 p-2 rounded overflow-x-auto">
                                    {JSON.stringify(log.details, null, 2)}
                                </pre>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};


import React from 'react';
import type { BatchTask } from '../types';
import { TaskStatus } from '../types';

const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
        case TaskStatus.PENDING:
            return '⏳'; // Hourglass
        case TaskStatus.GATHERED:
            return '📥'; // Inbox Tray
        case TaskStatus.DONE:
            return '✅'; // Check Mark Button
        case TaskStatus.ERROR:
            return '❌'; // Cross Mark
        default: // In-progress statuses
            return <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>;
    }
}

const getStatusColorClass = (status: TaskStatus) => {
    switch (status) {
        case TaskStatus.DONE: return "border-green-500 bg-green-300";
        case TaskStatus.ERROR: return "border-red-500 bg-red-300";
        case TaskStatus.PENDING: return "border-gray-500 bg-gray-300";
        case TaskStatus.GATHERED: return "border-blue-500 bg-blue-300";
        default: return "border-purple-500 bg-purple-300";
    }
}

interface BatchStatusDisplayProps {
  tasks: BatchTask[];
}

export const BatchStatusDisplay: React.FC<BatchStatusDisplayProps> = ({ tasks }) => {
  return (
    <div className="p-8 bg-purple-400 border-4 border-black rounded-xl neo-shadow">
        <h3 className="text-3xl font-black text-center text-black mb-6">Batch Progress</h3>
        <div className="space-y-4">
            {tasks.map((task) => (
                <div key={task.id} className={`p-4 rounded-lg border-4 flex flex-col sm:flex-row sm:items-center sm:justify-between transition-all duration-300 ${getStatusColorClass(task.status)}`}>
                    <div className="flex items-center gap-4 flex-1 mb-3 sm:mb-0">
                        <div className="text-2xl">{getStatusIcon(task.status)}</div>
                        <div className="flex-1">
                            <p className="font-black text-lg text-black">{task.categoryName}</p>
                            <p className="text-sm text-black/80 font-semibold">{task.status}</p>
                        </div>
                    </div>
                    {task.error && (
                        <p className="text-sm font-bold text-white bg-red-600 p-2 rounded-md sm:max-w-xs text-left break-words border-2 border-black">{task.error}</p>
                    )}
                    {task.status === TaskStatus.DONE && task.result && (
                        <div className="text-sm text-black text-left sm:text-right font-semibold">
                           <p className="font-bold truncate" title={task.result.headline}>{task.result.headline}</p>
                           <a href={task.result.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-700 hover:underline">
                               Source: {task.result.sourceName}
                           </a>
                        </div>
                    )}
                </div>
            ))}
        </div>
    </div>
  );
};

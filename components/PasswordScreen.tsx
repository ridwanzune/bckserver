
import React, { useState, FormEvent } from 'react';
import { APP_PASSWORD } from '../constants';
import type { LogEntry } from '../types';

interface PasswordScreenProps {
  onSuccess: () => void;
  onLog: (data: Omit<LogEntry, 'timestamp'>) => void;
}

export const PasswordScreen: React.FC<PasswordScreenProps> = ({ onSuccess, onLog }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (password === APP_PASSWORD) {
      onLog({ level: 'SUCCESS', message: 'Password accepted. Access granted.' });
      onSuccess();
    } else {
      setError('Incorrect Password. Please try again.');
      onLog({ level: 'ERROR', message: 'Failed login attempt.' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md p-8 bg-yellow-300 border-4 border-black rounded-xl neo-shadow text-black text-center">
        <img src="https://res.cloudinary.com/dy80ftu9k/image/upload/v1753507647/scs_cqidjz.png" alt="Logo" className="w-24 h-24 mx-auto mb-4" />
        <h1 className="text-3xl font-black">ACCESS REQUIRED</h1>
        <p className="mt-2 font-semibold">Enter the password to use the generator.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full p-4 text-lg font-bold text-black bg-white border-4 border-black rounded-lg focus:outline-none focus:ring-4 focus:ring-pink-500"
            aria-label="Password"
            autoFocus
          />
          {error && <p className="text-red-600 font-bold bg-red-200 p-2 border-2 border-red-600 rounded-md">{error}</p>}
          <button
            type="submit"
            className="w-full bg-pink-500 text-white font-bold px-10 py-4 rounded-lg border-4 border-black neo-shadow-sm btn-neo text-xl"
          >
            UNLOCK
          </button>
        </form>
      </div>
       <p className="text-gray-400 mt-8 font-semibold">This app can also be triggered via URL for cron jobs.</p>
    </div>
  );
};


import React, { useState, FormEvent } from 'react';
import { APP_PASSWORD } from './utils/constants';
import { Header } from './Header';

interface PasswordScreenProps {
  onSuccess: () => void;
}

export const PasswordScreen: React.FC<PasswordScreenProps> = ({ onSuccess }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (password === APP_PASSWORD) {
      setError('');
      onSuccess();
    } else {
      setError('Incorrect password. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-200 text-black p-4 md:p-8 font-sans flex items-center justify-center">
      <div className="max-w-xl w-full space-y-8">
        <Header />
        <div className="p-8 bg-yellow-300 border-4 border-black rounded-xl neo-shadow">
          <h2 className="text-2xl font-black text-center">Protected Area</h2>
          <p className="mt-2 text-gray-800 text-center font-medium">
            Please enter the password to access the generator.
          </p>
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border-4 border-black rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-pink-500 placeholder-gray-600"
                placeholder="Password"
                aria-label="Password"
                aria-describedby="password-error"
              />
            </div>

            {error && (
              <p id="password-error" className="text-sm font-bold text-white bg-red-600 p-2 rounded-md border-2 border-black text-center">
                {error}
              </p>
            )}

            <div>
              <button
                type="submit"
                className="w-full bg-pink-500 text-white font-bold px-6 py-3 rounded-lg border-4 border-black neo-shadow-sm btn-neo transition-all duration-300 text-lg"
              >
                Unlock
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

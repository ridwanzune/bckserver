
import React from 'react';
import { LOGO_URL } from '../constants';

export const Header: React.FC = () => {
  return (
    <header className="text-center p-6 bg-white border-4 border-black rounded-xl neo-shadow">
      <img src={LOGO_URL} alt="Dhaka Dispatch Logo" className="w-32 h-32 mx-auto mb-4" />
      <h1 
        className="text-4xl sm:text-5xl font-black tracking-tight text-black"
        style={{ fontFamily: "'Poppins', sans-serif" }}
      >
        Dhaka Dispatch News Generator
      </h1>
      <p className="mt-2 text-lg text-gray-700 font-semibold">AI-Powered Content Creation Workflow</p>
    </header>
  );
};

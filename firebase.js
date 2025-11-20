import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import Login from './components/Login';
import Dashboard from './src/components/Dashboard';
import './styles/App.css';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAXHnvNZkb00PXbG5JidbD4PbRgf7l6Lgg",
  authDomain: "v2v-communication-d46c6.firebaseapp.com",
  databaseURL: "https://v2v-communication-d46c6-default-rtdb.firebaseio.com",
  projectId: "v2v-communication-d46c6",
  storageBucket: "v2v-communication-d46c6.firebasestorage.app",
  messagingSenderId: "536888356116",
  appId: "1:536888356116:web:c6bbab9c6faae7c84e2601",
  measurementId: "G-FXLP4KQXWM"
};

// Initialize Firebase
initializeApp(firebaseConfig);

function App() {
  const [user, setUser] = useState(null);
  
  // Check if user is already logged in from localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('medvendUser');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogin = (userData) => {
    // Save user data to localStorage
    localStorage.setItem('medvendUser', JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    // Remove user data from localStorage
    localStorage.removeItem('medvendUser');
    setUser(null);
  };

  return (
    <div className="app">
      {user ? (
        <Dashboard user={user} onLogout={handleLogout} />
      ) : (
        <Login onLogin={handleLogin} />
      )}
    </div>
  );
}

export default App;
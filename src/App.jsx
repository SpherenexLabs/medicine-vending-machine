import React, { useState } from 'react';
import { initializeApp } from 'firebase/app';
import LoginComponent from './components/LoginComponent';
import Dashboard from './components/Dashboard';
import './styles/App.css';

// Firebase configuration - replace with your own keys
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
window.firebaseInitialized = true;

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  
  // Login handler
  const handleLogin = (userData) => {
    setUser(userData);
    setIsLoggedIn(true);
  };
  
  // Logout handler
  const handleLogout = () => {
    setUser(null);
    setIsLoggedIn(false);
  };
  
  return (
    <div className="app">
      {!isLoggedIn ? (
        <LoginComponent onLogin={handleLogin} />
      ) : (
        <Dashboard user={user} onLogout={handleLogout} />
      )}
    </div>
  );
};

export default App;
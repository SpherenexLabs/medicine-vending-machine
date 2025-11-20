import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, set, update, onValue } from 'firebase/database';
import '../styles/Inventory.css';

// Initialize Firebase if not already initialized
const firebaseConfig = {
  apiKey: "AIzaSyB9ererNsNonAzH0zQo_GS79XPOyCoMxr4",
      authDomain: "waterdtection.firebaseapp.com",
      databaseURL: "https://waterdtection-default-rtdb.firebaseio.com",
      projectId: "waterdtection",
      storageBucket: "waterdtection.firebasestorage.app",
      messagingSenderId: "690886375729",
      appId: "1:690886375729:web:172c3a47dda6585e4e1810",
      measurementId: "G-TXF33Y6XY0"
};

// Check if Firebase is already initialized
if (!window.firebaseInitialized) {
  initializeApp(firebaseConfig);
  window.firebaseInitialized = true;
}

const Inventory = () => {
  const [inventory, setInventory] = useState({
    dolo: 0,
    paracetamol: 0,
    brufen: 0,
    status: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updateMessage, setUpdateMessage] = useState('');
  // Add alerts state for each medicine
  const [alerts, setAlerts] = useState({
    dolo: false,
    paracetamol: false,
    brufen: false
  });
  
  // Use a ref to track previous status value
  const prevStatusRef = useRef(0);
  // Flag to prevent duplicate dispensing
  const isProcessingRef = useRef(false);

  // Function to check inventory levels and set alerts
  const checkInventoryLevels = async (inventoryData) => {
    const db = getDatabase();
    const vendingRef = ref(db, 'Vending_Machine');
    const newAlerts = { ...alerts };
    let statusUpdated = false;

    // Check Dolo inventory
    if (inventoryData.dolo <= 0 && !newAlerts.dolo) {
      newAlerts.dolo = true;
      // Send "D" to Firebase Status
      await update(vendingRef, { Status: "D" });
      setUpdateMessage("⚠️ Alert: Dolo is out of stock!");
      statusUpdated = true;
    } else if (inventoryData.dolo > 0 && newAlerts.dolo) {
      newAlerts.dolo = false;
    }

    // Check Paracetamol inventory
    if (inventoryData.paracetamol <= 0 && !newAlerts.paracetamol) {
      newAlerts.paracetamol = true;
      // Only update status if no previous alert was triggered
      if (!statusUpdated) {
        await update(vendingRef, { Status: "P" });
        setUpdateMessage("⚠️ Alert: Paracetamol is out of stock!");
        statusUpdated = true;
      }
    } else if (inventoryData.paracetamol > 0 && newAlerts.paracetamol) {
      newAlerts.paracetamol = false;
    }

    // Check Brufen inventory
    if (inventoryData.brufen <= 0 && !newAlerts.brufen) {
      newAlerts.brufen = true;
      // Only update status if no previous alert was triggered
      if (!statusUpdated) {
        await update(vendingRef, { Status: "B" });
        setUpdateMessage("⚠️ Alert: Brufen is out of stock!");
      }
    } else if (inventoryData.brufen > 0 && newAlerts.brufen) {
      newAlerts.brufen = false;
    }

    // Update alerts state
    setAlerts(newAlerts);
  };

  useEffect(() => {
    console.log("Setting up Firebase listener");
    const db = getDatabase();
    const vendingRef = ref(db, 'Vending_Machine');

    // Set up real-time listener for inventory changes
    const unsubscribe = onValue(vendingRef, (snapshot) => {
      if (!snapshot.exists()) {
        setError("No inventory data found!");
        setLoading(false);
        return;
      }

      const data = snapshot.val();
      console.log("Firebase data updated:", data);
      
      let currentStatus = data.Status;
      // Check if Status is a letter (D, P, B) or a number
      if (currentStatus === "D" || currentStatus === "P" || currentStatus === "B") {
        currentStatus = currentStatus; // Keep as is for letter statuses
      } else {
        currentStatus = parseInt(currentStatus) || 0; // Parse as int for number statuses
      }
      
      const previousStatus = prevStatusRef.current;
      
      // Update our inventory state
      const newInventory = {
        dolo: parseInt(data.dolo) || 0,
        paracetamol: parseInt(data.paracetamol) || 0,
        brufen: parseInt(data.brufen) || 0,
        status: currentStatus
      };
      
      setInventory(newInventory);
      setLoading(false);
      
      // Check inventory levels and set alerts if needed
      checkInventoryLevels(newInventory);
      
      // Check if status is a number and changed and needs to trigger a dispensing action
      if (!isProcessingRef.current && 
          typeof currentStatus === 'number' && 
          (currentStatus === 1 || currentStatus === 2 || currentStatus === 3) && 
          currentStatus !== previousStatus) {
        
        console.log(`Status changed from ${previousStatus} to ${currentStatus}`);
        handleStatusChange(currentStatus, data);
      }
      
      // Update previous status reference
      prevStatusRef.current = currentStatus;
    }, (error) => {
      console.error("Firebase error:", error);
      setError(`Error fetching inventory: ${error.message}`);
      setLoading(false);
    });

    // Clean up listener on component unmount
    return () => {
      console.log("Cleaning up Firebase listener");
      unsubscribe();
    };
  }, []);

  // Handle status change and dispense medicine
  const handleStatusChange = async (status, data) => {
    if (isProcessingRef.current) return;
    if (typeof status !== 'number') return; // Skip if status is not a number
    
    isProcessingRef.current = true;
    console.log(`Processing status change to ${status}`);
    
    try {
      const db = getDatabase();
      const vendingRef = ref(db, 'Vending_Machine');
      
      // Get fresh data to avoid any race conditions
      const snapshot = await get(vendingRef);
      if (!snapshot.exists()) {
        setError("Cannot update: Data doesn't exist");
        isProcessingRef.current = false;
        return;
      }
      
      const freshData = snapshot.val();
      let medicineName = "";
      let medicineKey = "";
      let currentStock = 0;
      
      // Determine which medicine to dispense based on Status
      if (status === 1) {
        medicineKey = "dolo";
        medicineName = "Dolo";
        currentStock = parseInt(freshData.dolo) || 0;
      } else if (status === 2) {
        medicineKey = "paracetamol";
        medicineName = "Paracetamol";
        currentStock = parseInt(freshData.paracetamol) || 0;
      } else if (status === 3) {
        medicineKey = "brufen";
        medicineName = "Brufen";
        currentStock = parseInt(freshData.brufen) || 0;
      } else {
        console.log("Invalid status:", status);
        setUpdateMessage("Invalid status");
        isProcessingRef.current = false;
        return;
      }
      
      // Check if we have stock
      if (currentStock <= 0) {
        console.log(`${medicineName} is out of stock`);
        setUpdateMessage(`${medicineName} is out of stock`);
        
        // Send alert status to Firebase
        if (medicineKey === "dolo") {
          await update(vendingRef, { Status: "D" });
        } else if (medicineKey === "paracetamol") {
          await update(vendingRef, { Status: "P" });
        } else if (medicineKey === "brufen") {
          await update(vendingRef, { Status: "B" });
        }
        
        isProcessingRef.current = false;
        return;
      }
      
      // Calculate new stock
      const newStock = currentStock - 1;
      console.log(`Reducing ${medicineName} from ${currentStock} to ${newStock}`);
      
      // Update the database with new stock value
      const updates = {};
      updates[medicineKey] = newStock.toString();
      
      await update(vendingRef, updates);
      console.log(`Updated ${medicineName} stock to ${newStock}`);
      
      setUpdateMessage(`Dispensed 1 ${medicineName}`);
      
      // Check if this was the last item and we need to send an alert
      if (newStock === 0) {
        // Wait a bit before sending the alert status
        setTimeout(async () => {
          if (medicineKey === "dolo") {
            await update(vendingRef, { Status: "D" });
          } else if (medicineKey === "paracetamol") {
            await update(vendingRef, { Status: "P" });
          } else if (medicineKey === "brufen") {
            await update(vendingRef, { Status: "B" });
          }
          setUpdateMessage(`⚠️ Alert: ${medicineName} is now out of stock!`);
        }, 1000);
      }
      
      // Clear message after 3 seconds
      setTimeout(() => {
        setUpdateMessage('');
      }, 3000);
    } catch (error) {
      console.error("Error dispensing medicine:", error);
      setError(`Failed to dispense medicine: ${error.message}`);
    } finally {
      isProcessingRef.current = false;
    }
  };

  // Manual dispense button handler
  const handleDispenseMedicine = async () => {
    if (isProcessingRef.current) return;
    
    try {
      const db = getDatabase();
      const vendingRef = ref(db, 'Vending_Machine');
      
      // Get current data
      const snapshot = await get(vendingRef);
      if (!snapshot.exists()) {
        setError("Cannot update: Data doesn't exist");
        return;
      }
      
      const data = snapshot.val();
      // Only proceed if status is a number
      if (data.Status === "D" || data.Status === "P" || data.Status === "B") {
        setUpdateMessage("Cannot dispense: System is in alert state");
        return;
      }
      
      const status = parseInt(data.Status);
      
      // Process the dispensing
      await handleStatusChange(status, data);
      
    } catch (error) {
      console.error("Error in manual dispense:", error);
      setError(`Failed to dispense medicine: ${error.message}`);
    }
  };

  const restock = async (medicine) => {
    try {
      const db = getDatabase();
      const vendingRef = ref(db, 'Vending_Machine');
      
      // Get current data
      const snapshot = await get(vendingRef);
      if (!snapshot.exists()) {
        setError("Cannot update: Data doesn't exist");
        return;
      }
      
      const data = snapshot.val();
      const currentStock = parseInt(data[medicine]) || 0;
      
      // Update with +5 to current stock
      const updates = {};
      updates[medicine] = (currentStock + 5).toString();
      
      // Update database
      await update(vendingRef, updates);
      setUpdateMessage(`Restocked ${medicine} (+5)`);
      
      // Check if we're restocking from zero and need to clear an alert status
      if (currentStock === 0) {
        // If the current status is an alert for this medicine, reset it to 0
        if ((medicine === "dolo" && data.Status === "D") ||
            (medicine === "paracetamol" && data.Status === "P") ||
            (medicine === "brufen" && data.Status === "B")) {
          await update(vendingRef, { Status: "0" });
        }
      }
      
      // Clear message after 3 seconds
      setTimeout(() => {
        setUpdateMessage('');
      }, 3000);
      
    } catch (error) {
      console.error("Error restocking:", error);
      setError(`Failed to restock ${medicine}: ${error.message}`);
    }
  };

  if (loading) {
    return <div className="inventory-loading">Loading inventory data...</div>;
  }

  if (error) {
    return <div className="inventory-error">Error: {error}</div>;
  }

  // Helper function to get status description
  const getStatusDescription = (status) => {
    if (status === 1) return "Status 1: Dispense Dolo";
    if (status === 2) return "Status 2: Dispense Paracetamol";
    if (status === 3) return "Status 3: Dispense Brufen";
    if (status === "D") return "ALERT: Dolo is out of stock!";
    if (status === "P") return "ALERT: Paracetamol is out of stock!";
    if (status === "B") return "ALERT: Brufen is out of stock!";
    return "Status 0: No medicine selected";
  };

  return (
    <div className="inventory-container">
      <h2>Medicine Inventory</h2>
      
      {updateMessage && (
        <div className={`update-message ${updateMessage.includes('Alert') ? 'alert-message' : ''}`}>
          {updateMessage}
        </div>
      )}
      
      <div className="inventory-cards">
        <div className={`inventory-card ${alerts.dolo ? 'out-of-stock' : ''}`}>
          <h3>Dolo</h3>
          <div className="medicine-icon">💊</div>
          <p className="stock-count">Stock: {inventory.dolo}</p>
          {inventory.dolo <= 0 && (
            <div className="inventory-alert">OUT OF STOCK</div>
          )}
          <p className="status-indicator">
            {inventory.status === 1 ? "✅ Selected for dispensing" : 
             inventory.status === "D" ? "⚠️ OUT OF STOCK ALERT" : ""}
          </p>
          <button onClick={() => restock('dolo')} className="restock-button">
            Restock (+5)
          </button>
        </div>
        
        <div className={`inventory-card ${alerts.paracetamol ? 'out-of-stock' : ''}`}>
          <h3>Paracetamol</h3>
          <div className="medicine-icon">💊</div>
          <p className="stock-count">Stock: {inventory.paracetamol}</p>
          {inventory.paracetamol <= 0 && (
            <div className="inventory-alert">OUT OF STOCK</div>
          )}
          <p className="status-indicator">
            {inventory.status === 2 ? "✅ Selected for dispensing" : 
             inventory.status === "P" ? "⚠️ OUT OF STOCK ALERT" : ""}
          </p>
          <button onClick={() => restock('paracetamol')} className="restock-button">
            Restock (+5)
          </button>
        </div>
        
        <div className={`inventory-card ${alerts.brufen ? 'out-of-stock' : ''}`}>
          <h3>Brufen</h3>
          <div className="medicine-icon">💊</div>
          <p className="stock-count">Stock: {inventory.brufen}</p>
          {inventory.brufen <= 0 && (
            <div className="inventory-alert">OUT OF STOCK</div>
          )}
          <p className="status-indicator">
            {inventory.status === 3 ? "✅ Selected for dispensing" : 
             inventory.status === "B" ? "⚠️ OUT OF STOCK ALERT" : ""}
          </p>
          <button onClick={() => restock('brufen')} className="restock-button">
            Restock (+5)
          </button>
        </div>
      </div>
      
      <div className="dispense-controls">
        <p className="current-status">Current Status: {inventory.status}</p>
        <p className={`status-description ${
          inventory.status === "D" || inventory.status === "P" || inventory.status === "B" 
            ? "alert-status" : ""
        }`}>
          {getStatusDescription(inventory.status)}
        </p>
        <div className="dispense-buttons">
          <button 
            onClick={handleDispenseMedicine} 
            className="dispense-button"
            disabled={
              inventory.status === "D" || 
              inventory.status === "P" || 
              inventory.status === "B" || 
              inventory.status < 1 || 
              inventory.status > 3
            }
          >
            Dispense Medicine Manually
          </button>
          <button 
            onClick={() => {
              const db = getDatabase();
              const vendingRef = ref(db, 'Vending_Machine');
              update(vendingRef, { Status: "0" });
              setUpdateMessage("Reset status to 0");
              setTimeout(() => setUpdateMessage(''), 3000);
            }} 
            className="reset-button"
          >
            Reset Status to 0
          </button>
        </div>
      </div>
    </div>
  );
};

export default Inventory;




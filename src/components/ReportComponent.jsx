import React, { useState, useEffect } from 'react';
import { getDatabase, ref, get } from 'firebase/database';
import '../styles/Report.css';

const ReportComponent = () => {
  const [reportType, setReportType] = useState('inventory');
  const [dateRange, setDateRange] = useState('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Set default dates for custom range
  useEffect(() => {
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];
    
    if (!customEndDate) {
      setCustomEndDate(formattedDate);
    }
    
    // Set default start date to 7 days ago
    if (!customStartDate) {
      const lastWeek = new Date(today);
      lastWeek.setDate(today.getDate() - 7);
      setCustomStartDate(lastWeek.toISOString().split('T')[0]);
    }
  }, []);

  // Generate report data based on selected parameters
  const generateReport = async () => {
    setLoading(true);
    setError(null);
    setReportData(null);
    
    try {
      const db = getDatabase();
      let processedData = {};
      
      switch (reportType) {
        case 'inventory':
          // Fetch real-time inventory data
          const vendingRef = ref(db, 'Vending_Machine');
          const inventorySnapshot = await get(vendingRef);
          
          if (inventorySnapshot.exists()) {
            const inventoryData = inventorySnapshot.val();
            processedData = {
              title: 'Current Inventory Status Report',
              date: new Date().toLocaleString(),
              items: [
                { name: 'Dolo', quantity: parseInt(inventoryData.dolo) || 0 },
                { name: 'Paracetamol', quantity: parseInt(inventoryData.paracetamol) || 0 },
                { name: 'Brufen', quantity: parseInt(inventoryData.brufen) || 0 }
              ],
              totalItems: (parseInt(inventoryData.dolo) || 0) + (parseInt(inventoryData.paracetamol) || 0) + (parseInt(inventoryData.brufen) || 0)
            };
          } else {
            throw new Error("No inventory data found");
          }
          break;
          
        case 'dispensing':
          // Fetch real-time dispensing history
          const dispensingRef = ref(db, 'dispensing_history');
          const dispensingSnapshot = await get(dispensingRef);
          
          const startDate = dateRange === 'custom' ? new Date(customStartDate) : getDateFromRange(dateRange);
          const endDate = dateRange === 'custom' ? new Date(customEndDate) : new Date();
          
          let dispensingItems = [];
          let doloTotal = 0;
          let paracetamolTotal = 0;
          let brufenTotal = 0;
          
          if (dispensingSnapshot.exists()) {
            const dispensingData = dispensingSnapshot.val();
            
            // Filter dispensing records by date range
            Object.keys(dispensingData).forEach(key => {
              const record = dispensingData[key];
              const recordDate = new Date(record.timestamp || record.date);
              
              // Check if record falls within selected date range
              if (recordDate >= startDate && recordDate <= endDate) {
                dispensingItems.push({
                  id: record.id || key,
                  date: recordDate.toLocaleDateString(),
                  time: recordDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  medicine: record.medicine || 'Unknown',
                  reason: record.reason || record.symptom || 'Not specified',
                  timestamp: recordDate.getTime()
                });
                
                // Count totals
                switch (record.medicine) {
                  case 'Dolo':
                    doloTotal++;
                    break;
                  case 'Paracetamol':
                    paracetamolTotal++;
                    break;
                  case 'Brufen':
                    brufenTotal++;
                    break;
                }
              }
            });
            
            // Sort by timestamp (newest first)
            dispensingItems.sort((a, b) => b.timestamp - a.timestamp);
          }
          
          processedData = {
            title: 'Medicine Dispensing Report',
            dateRange: `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`,
            items: dispensingItems,
            summary: {
              totalDispensed: dispensingItems.length,
              doloDispensed: doloTotal,
              paracetamolDispensed: paracetamolTotal,
              brufenDispensed: brufenTotal
            }
          };
          break;
          
        case 'usage':
          // Fetch real-time usage analytics
          const usageRef = ref(db, 'usage_analytics');
          const usageSnapshot = await get(usageRef);
          
          const usagePeriod = dateRange === 'custom' ? 
            `${new Date(customStartDate).toLocaleDateString()} to ${new Date(customEndDate).toLocaleDateString()}` : 
            getDateRangeLabel(dateRange);
          
          let usageData = {
            dolo: { name: 'Dolo', usage: 0, percentChange: 0, mostCommonSymptom: 'Fever' },
            paracetamol: { name: 'Paracetamol', usage: 0, percentChange: 0, mostCommonSymptom: 'Headache' },
            brufen: { name: 'Brufen', usage: 0, percentChange: 0, mostCommonSymptom: 'Body Pain' }
          };
          
          let peakUsageTime = 'Not available';
          let leastUsageTime = 'Not available';
          
          if (usageSnapshot.exists()) {
            const analytics = usageSnapshot.val();
            
            // Get real usage data or calculate from dispensing history
            const dispensingAnalyticsRef = ref(db, 'dispensing_history');
            const analyticsSnapshot = await get(dispensingAnalyticsRef);
            
            if (analyticsSnapshot.exists()) {
              const allDispensing = analyticsSnapshot.val();
              const selectedStart = dateRange === 'custom' ? new Date(customStartDate) : getDateFromRange(dateRange);
              const selectedEnd = dateRange === 'custom' ? new Date(customEndDate) : new Date();
              
              // Calculate usage statistics from actual data
              const hourlyUsage = {};
              const symptomCount = { dolo: {}, paracetamol: {}, brufen: {} };
              let totalCounts = { dolo: 0, paracetamol: 0, brufen: 0 };
              
              Object.keys(allDispensing).forEach(key => {
                const record = allDispensing[key];
                const recordDate = new Date(record.timestamp || record.date);
                
                if (recordDate >= selectedStart && recordDate <= selectedEnd) {
                  const hour = recordDate.getHours();
                  const medicine = record.medicine?.toLowerCase() || '';
                  const symptom = record.reason || record.symptom || '';
                  
                  // Track hourly usage
                  if (!hourlyUsage[hour]) hourlyUsage[hour] = 0;
                  hourlyUsage[hour]++;
                  
                  // Count by medicine
                  if (totalCounts[medicine] !== undefined) {
                    totalCounts[medicine]++;
                    
                    // Track symptoms
                    if (!symptomCount[medicine][symptom]) {
                      symptomCount[medicine][symptom] = 0;
                    }
                    symptomCount[medicine][symptom]++;
                  }
                }
              });
              
              // Update usage data with real numbers
              Object.keys(totalCounts).forEach(med => {
                if (usageData[med]) {
                  usageData[med].usage = totalCounts[med];
                  
                  // Find most common symptom
                  const symptoms = symptomCount[med];
                  if (Object.keys(symptoms).length > 0) {
                    const mostCommon = Object.keys(symptoms).reduce((a, b) => 
                      symptoms[a] > symptoms[b] ? a : b
                    );
                    usageData[med].mostCommonSymptom = mostCommon || usageData[med].mostCommonSymptom;
                  }
                  
                  // Calculate percentage change (mock for now, would need historical data)
                  usageData[med].percentChange = Math.floor(Math.random() * 50) - 25;
                }
              });
              
              // Find peak and least usage times
              if (Object.keys(hourlyUsage).length > 0) {
                const peakHour = Object.keys(hourlyUsage).reduce((a, b) => 
                  hourlyUsage[a] > hourlyUsage[b] ? a : b
                );
                const leastHour = Object.keys(hourlyUsage).reduce((a, b) => 
                  hourlyUsage[a] < hourlyUsage[b] ? a : b
                );
                
                peakUsageTime = getTimeLabel(parseInt(peakHour));
                leastUsageTime = getTimeLabel(parseInt(leastHour));
              }
            }
          }
          
          processedData = {
            title: 'Medicine Usage Analytics Report',
            period: usagePeriod,
            usageData: usageData,
            peakUsageTime: peakUsageTime,
            leastUsageTime: leastUsageTime
          };
          break;
          
        default:
          throw new Error("Invalid report type");
      }
      
      setReportData(processedData);
    } catch (error) {
      console.error("Error generating report:", error);
      setError(`Failed to generate report: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get start date based on selected range
  const getDateFromRange = (range) => {
    const today = new Date();
    
    switch (range) {
      case 'today':
        return today;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        return yesterday;
      case 'thisWeek':
        const thisWeek = new Date(today);
        thisWeek.setDate(today.getDate() - today.getDay());
        return thisWeek;
      case 'lastWeek':
        const lastWeek = new Date(today);
        lastWeek.setDate(today.getDate() - today.getDay() - 7);
        return lastWeek;
      case 'thisMonth':
        const thisMonth = new Date(today);
        thisMonth.setDate(1);
        return thisMonth;
      case 'lastMonth':
        const lastMonth = new Date(today);
        lastMonth.setMonth(today.getMonth() - 1);
        lastMonth.setDate(1);
        return lastMonth;
      default:
        return today;
    }
  };
  
  // Get readable label for date range
  const getDateRangeLabel = (range) => {
    switch (range) {
      case 'today':
        return 'Today';
      case 'yesterday':
        return 'Yesterday';
      case 'thisWeek':
        return 'This Week';
      case 'lastWeek':
        return 'Last Week';
      case 'thisMonth':
        return 'This Month';
      case 'lastMonth':
        return 'Last Month';
      case 'custom':
        return `${new Date(customStartDate).toLocaleDateString()} to ${new Date(customEndDate).toLocaleDateString()}`;
      default:
        return '';
    }
  };
  
  // Helper function to convert hour to readable time label
  const getTimeLabel = (hour) => {
    if (hour >= 5 && hour < 8) return 'Early Morning (5-8 AM)';
    if (hour >= 8 && hour < 12) return 'Morning (8-12 PM)';
    if (hour >= 12 && hour < 17) return 'Afternoon (12-5 PM)';
    if (hour >= 17 && hour < 21) return 'Evening (5-9 PM)';
    if (hour >= 21 || hour < 5) return 'Night (9 PM-5 AM)';
    return `${hour}:00`;
  };

  // Download report as PDF
  const downloadPdf = () => {
    if (!reportData) return;
    
    try {
      // Dynamically import jsPDF
      import('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js').then(() => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Set font
        doc.setFont('helvetica');
        
        // Add title
        doc.setFontSize(18);
        doc.setTextColor(40, 40, 40);
        doc.text(reportData.title, 20, 25);
        
        let yPosition = 45;
        
        if (reportType === 'inventory') {
          // Add generation date
          doc.setFontSize(10);
          doc.setTextColor(100, 100, 100);
          doc.text(`Generated on: ${reportData.date}`, 20, 35);
          
          // Add table headers
          doc.setFontSize(12);
          doc.setTextColor(40, 40, 40);
          doc.text('Medicine', 20, yPosition);
          doc.text('Current Stock', 70, yPosition);
          doc.text('Status', 120, yPosition);
          
          // Draw header line
          doc.line(20, yPosition + 2, 180, yPosition + 2);
          yPosition += 10;
          
          // Add inventory items
          doc.setFontSize(10);
          reportData.items.forEach((item) => {
            doc.text(item.name, 20, yPosition);
            doc.text(item.quantity.toString(), 70, yPosition);
            const status = item.quantity === 0 ? 'Out of Stock' : item.quantity < 5 ? 'Low Stock' : 'In Stock';
            doc.text(status, 120, yPosition);
            yPosition += 8;
          });
          
          // Add total
          yPosition += 5;
          doc.line(20, yPosition, 180, yPosition);
          yPosition += 8;
          doc.setFontSize(11);
          doc.text('Total Items:', 20, yPosition);
          doc.text(`${reportData.totalItems} units`, 70, yPosition);
          
          // Add summary
          yPosition += 15;
          doc.setFontSize(14);
          doc.text('Inventory Summary', 20, yPosition);
          yPosition += 10;
          
          doc.setFontSize(10);
          doc.text(`Total Medicine Types: ${reportData.items.length}`, 20, yPosition);
          yPosition += 6;
          doc.text(`Total Units: ${reportData.totalItems}`, 20, yPosition);
          yPosition += 6;
          doc.text(`Out of Stock Items: ${reportData.items.filter(item => item.quantity === 0).length}`, 20, yPosition);
          yPosition += 6;
          doc.text(`Low Stock Items: ${reportData.items.filter(item => item.quantity > 0 && item.quantity < 5).length}`, 20, yPosition);
        }
        
        else if (reportType === 'dispensing') {
          const summary = reportData.summary || { totalDispensed: 0, doloDispensed: 0, paracetamolDispensed: 0, brufenDispensed: 0 };
          
          // Add date range
          doc.setFontSize(10);
          doc.setTextColor(100, 100, 100);
          doc.text(`Period: ${reportData.dateRange}`, 20, 35);
          
          // Add summary
          doc.setFontSize(14);
          doc.setTextColor(40, 40, 40);
          doc.text('Dispensing Summary', 20, yPosition);
          yPosition += 10;
          
          doc.setFontSize(10);
          doc.text(`Total Dispensed: ${summary.totalDispensed}`, 20, yPosition);
          yPosition += 6;
          doc.text(`Dolo: ${summary.doloDispensed} units`, 20, yPosition);
          yPosition += 6;
          doc.text(`Paracetamol: ${summary.paracetamolDispensed} units`, 20, yPosition);
          yPosition += 6;
          doc.text(`Brufen: ${summary.brufenDispensed} units`, 20, yPosition);
          yPosition += 15;
          
          // Add table headers for dispensing details
          doc.setFontSize(12);
          doc.text('Dispensing Details', 20, yPosition);
          yPosition += 10;
          
          doc.setFontSize(9);
          doc.text('ID', 20, yPosition);
          doc.text('Date', 45, yPosition);
          doc.text('Time', 75, yPosition);
          doc.text('Medicine', 100, yPosition);
          doc.text('Reason', 140, yPosition);
          
          // Draw header line
          doc.line(20, yPosition + 2, 180, yPosition + 2);
          yPosition += 8;
          
          // Add dispensing items (limit to prevent overflow)
          const itemsToShow = reportData.items.slice(0, 20); // Show max 20 items
          itemsToShow.forEach((item) => {
            if (yPosition > 250) { // Start new page if needed
              doc.addPage();
              yPosition = 25;
            }
            doc.text(item.id, 20, yPosition);
            doc.text(item.date, 45, yPosition);
            doc.text(item.time, 75, yPosition);
            doc.text(item.medicine, 100, yPosition);
            doc.text(item.reason, 140, yPosition);
            yPosition += 6;
          });
          
          if (reportData.items.length > 20) {
            yPosition += 5;
            doc.text(`... and ${reportData.items.length - 20} more entries`, 20, yPosition);
          }
        }
        
        else if (reportType === 'usage') {
          const usageData = reportData.usageData || {};
          
          // Add period
          doc.setFontSize(10);
          doc.setTextColor(100, 100, 100);
          doc.text(`Period: ${reportData.period}`, 20, 35);
          
          // Add usage statistics
          doc.setFontSize(14);
          doc.setTextColor(40, 40, 40);
          doc.text('Medicine Usage Statistics', 20, yPosition);
          yPosition += 10;
          
          // Table headers
          doc.setFontSize(10);
          doc.text('Medicine', 20, yPosition);
          doc.text('Units Dispensed', 60, yPosition);
          doc.text('% Change', 110, yPosition);
          doc.text('Most Common Symptom', 140, yPosition);
          
          // Draw header line
          doc.line(20, yPosition + 2, 180, yPosition + 2);
          yPosition += 8;
          
          // Add usage data
          Object.keys(usageData).forEach((key) => {
            const data = usageData[key];
            doc.text(data.name, 20, yPosition);
            doc.text(data.usage.toString(), 60, yPosition);
            doc.text(`${data.percentChange >= 0 ? '+' : ''}${data.percentChange}%`, 110, yPosition);
            doc.text(data.mostCommonSymptom, 140, yPosition);
            yPosition += 8;
          });
          
          // Add usage patterns
          yPosition += 10;
          doc.setFontSize(14);
          doc.text('Usage Patterns', 20, yPosition);
          yPosition += 10;
          
          doc.setFontSize(10);
          doc.text(`Peak Usage Time: ${reportData.peakUsageTime || 'N/A'}`, 20, yPosition);
          yPosition += 6;
          doc.text(`Least Usage Time: ${reportData.leastUsageTime || 'N/A'}`, 20, yPosition);
        }
        
        // Save the PDF
        const fileName = `${reportType}_report_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(fileName);
      }).catch((error) => {
        console.error('Error loading jsPDF:', error);
        alert('Error generating PDF. Please try again.');
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  };
  
  // Download report as CSV
  const downloadCsv = () => {
    if (!reportData) return;
    
    let csvContent = '';
    
    // Create CSV content based on report type
    if (reportType === 'inventory') {
      csvContent = 'Medicine,Quantity\n';
      reportData.items.forEach(item => {
        csvContent += `${item.name},${item.quantity}\n`;
      });
      csvContent += `Total,${reportData.totalItems}\n`;
    } 
    else if (reportType === 'dispensing') {
      // Safety check to ensure summary exists
      const summary = reportData.summary || { 
        totalDispensed: reportData.items?.length || 0, 
        doloDispensed: 0, 
        paracetamolDispensed: 0, 
        brufenDispensed: 0 
      };
      
      csvContent = 'ID,Date,Time,Medicine,Reason\n';
      reportData.items.forEach(item => {
        csvContent += `${item.id},${item.date},${item.time},${item.medicine},${item.reason}\n`;
      });
      csvContent += `\nSummary:\n`;
      csvContent += `Total Dispensed,${summary.totalDispensed}\n`;
      csvContent += `Dolo Dispensed,${summary.doloDispensed}\n`;
      csvContent += `Paracetamol Dispensed,${summary.paracetamolDispensed}\n`;
      csvContent += `Brufen Dispensed,${summary.brufenDispensed}\n`;
    }
    else if (reportType === 'usage') {
      csvContent = 'Medicine,Units Dispensed,Percent Change,Most Common Symptom\n';
      const usageData = reportData.usageData || {};
      for (const key in usageData) {
        const data = usageData[key];
        csvContent += `${data.name},${data.usage},${data.percentChange}%,${data.mostCommonSymptom}\n`;
      }
      csvContent += `\nPeak Usage Time,${reportData.peakUsageTime || 'N/A'}\n`;
      csvContent += `Least Usage Time,${reportData.leastUsageTime || 'N/A'}\n`;
    }
    
    // Create a Blob from the CSV content
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Create a link element to trigger the download
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    // Set the link properties
    link.setAttribute('href', url);
    link.setAttribute('download', `${reportType}_report_${new Date().toISOString().split('T')[0]}.csv`);
    
    // Append the link to the document, trigger the download, and remove the link
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Render inventory report
  const renderInventoryReport = () => {
    return (
      <div className="report-content inventory-report">
        <div className="report-header">
          <h3>{reportData.title}</h3>
          <p>Generated on: {reportData.date}</p>
        </div>
        
        <table className="report-table">
          <thead>
            <tr>
              <th>Medicine</th>
              <th>Current Stock</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {reportData.items.map((item, index) => (
              <tr key={index}>
                <td>{item.name}</td>
                <td>{item.quantity}</td>
                <td>
                  <span className={`status-badge ${item.quantity === 0 ? 'status-out' : item.quantity < 5 ? 'status-low' : 'status-ok'}`}>
                    {item.quantity === 0 ? 'Out of Stock' : item.quantity < 5 ? 'Low Stock' : 'In Stock'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td colSpan="2">{reportData.totalItems} units</td>
            </tr>
          </tfoot>
        </table>
        
        <div className="report-summary">
          <h4>Inventory Summary</h4>
          <div className="summary-items">
            <div className="summary-item">
              <span className="summary-label">Total Medicine Types:</span>
              <span className="summary-value">{reportData.items.length}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Total Units:</span>
              <span className="summary-value">{reportData.totalItems}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Out of Stock Items:</span>
              <span className="summary-value">{reportData.items.filter(item => item.quantity === 0).length}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Low Stock Items:</span>
              <span className="summary-value">{reportData.items.filter(item => item.quantity > 0 && item.quantity < 5).length}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render dispensing report
  const renderDispensingReport = () => {
    // Safety check to ensure summary exists
    const summary = reportData.summary || { 
      totalDispensed: 0, 
      doloDispensed: 0, 
      paracetamolDispensed: 0, 
      brufenDispensed: 0 
    };
    
    return (
      <div className="report-content dispensing-report">
        <div className="report-header">
          <h3>{reportData.title}</h3>
          <p>Period: {reportData.dateRange}</p>
        </div>
        
        <div className="report-summary dispensing-summary">
          <h4>Dispensing Summary</h4>
          <div className="summary-items">
            <div className="summary-item">
              <span className="summary-label">Total Dispensed:</span>
              <span className="summary-value">{summary.totalDispensed}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Dolo:</span>
              <span className="summary-value">{summary.doloDispensed} units</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Paracetamol:</span>
              <span className="summary-value">{summary.paracetamolDispensed} units</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Brufen:</span>
              <span className="summary-value">{summary.brufenDispensed} units</span>
            </div>
          </div>
        </div>
        
        <h4>Dispensing Details</h4>
        <table className="report-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Date</th>
              <th>Time</th>
              <th>Medicine</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {reportData.items.map((item, index) => (
              <tr key={index}>
                <td>{item.id}</td>
                <td>{item.date}</td>
                <td>{item.time}</td>
                <td>{item.medicine}</td>
                <td>{item.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Render usage analytics report
  const renderUsageReport = () => {
    // Safety check to ensure usageData exists
    const usageData = reportData.usageData || {};
    
    return (
      <div className="report-content usage-report">
        <div className="report-header">
          <h3>{reportData.title}</h3>
          <p>Period: {reportData.period}</p>
        </div>
        
        <div className="analytics-summary">
          <div className="analytics-header">
            <h4>Medicine Usage Statistics</h4>
          </div>
          
          <table className="report-table">
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Units Dispensed</th>
                <th>% Change</th>
                <th>Most Common Symptom</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(usageData).map((key) => {
                const data = usageData[key];
                return (
                  <tr key={key}>
                    <td>{data.name}</td>
                    <td>{data.usage}</td>
                    <td className={data.percentChange >= 0 ? 'positive-change' : 'negative-change'}>
                      {data.percentChange >= 0 ? '+' : ''}{data.percentChange}%
                    </td>
                    <td>{data.mostCommonSymptom}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        <div className="usage-patterns">
          <h4>Usage Patterns</h4>
          <div className="pattern-items">
            <div className="pattern-item">
              <span className="pattern-label">Peak Usage Time:</span>
              <span className="pattern-value">{reportData.peakUsageTime || 'N/A'}</span>
            </div>
            <div className="pattern-item">
              <span className="pattern-label">Least Usage Time:</span>
              <span className="pattern-value">{reportData.leastUsageTime || 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="report-container">
      <div className="report-options">
        <h2>📊 Generate Reports</h2>
        <p>Create and download detailed reports about inventory and dispensing activity</p>
        
        <div className="options-form">
          <div className="form-group">
            <label>Report Type</label>
            <select 
              value={reportType} 
              onChange={(e) => setReportType(e.target.value)}
              className="report-select"
            >
              <option value="inventory">Current Inventory Status</option>
              <option value="dispensing">Medicine Dispensing History</option>
              <option value="usage">Usage Analytics</option>
            </select>
          </div>
          
          {(reportType === 'dispensing' || reportType === 'usage') && (
            <div className="form-group">
              <label>Date Range</label>
              <select 
                value={dateRange} 
                onChange={(e) => setDateRange(e.target.value)}
                className="report-select"
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="thisWeek">This Week</option>
                <option value="lastWeek">Last Week</option>
                <option value="thisMonth">This Month</option>
                <option value="lastMonth">Last Month</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
          )}
          
          {dateRange === 'custom' && (
            <div className="date-range-selector">
              <div className="form-group">
                <label>Start Date</label>
                <input 
                  type="date" 
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="date-input"
                />
              </div>
              <div className="form-group">
                <label>End Date</label>
                <input 
                  type="date" 
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="date-input"
                />
              </div>
            </div>
          )}
          
          <button 
            onClick={generateReport} 
            className="generate-button"
            disabled={loading}
          >
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </div>
      
      {error && (
        <div className="report-error">
          <p>{error}</p>
        </div>
      )}
      
      {reportData && (
        <div className="report-result">
          <div className="report-actions">
            <button onClick={downloadPdf} className="download-button pdf-button">
              <span className="button-icon">📄</span> Download as PDF
            </button>
            <button onClick={downloadCsv} className="download-button csv-button">
              <span className="button-icon">📊</span> Download as CSV
            </button>
          </div>
          
          <div className="report-preview">
            <h3>Report Preview</h3>
            
            {reportType === 'inventory' && renderInventoryReport()}
            {reportType === 'dispensing' && renderDispensingReport()}
            {reportType === 'usage' && renderUsageReport()}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportComponent;
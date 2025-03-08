import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";
import { FaSun, FaMoon, FaFilePdf, FaFileExcel, FaTrash, FaPlus, FaSpinner, FaBolt, FaCalendar } from "react-icons/fa";
import "./App.css";

const App = () => {
  const [reading, setReading] = useState("");
  const [meterId, setMeterId] = useState("Meter 1");
  const [data, setData] = useState([]);
  const [totalUsage, setTotalUsage] = useState(0);
  const [dailyUsage, setDailyUsage] = useState([]);
  const [monthlyUsage, setMonthlyUsage] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [customRangeData, setCustomRangeData] = useState({ totalUsage: 0, dailyUsage: [] });

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.body.classList.toggle("dark-mode");
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`https://electricalreadings.onrender.com/get-readings/${meterId}`);
      setData(response.data || []);
    } catch (error) {
      console.error("Fetch error:", { message: error.message, status: error.response?.status });
      setError(`Failed to fetch readings: ${error.message}.`);
    } finally {
      setLoading(false);
    }
  }, [meterId]);

  const debouncedFetchAnalysis = useCallback(() => {
    let timeout;
    const fetch = async () => {
      try {
        setLoading(true);
        setError(null);
        const [totalResponse, dailyResponse, monthlyResponse] = await Promise.all([
          axios.get(`https://electricalreadings.onrender.com/total-usage/${meterId}`),
          axios.get(`https://electricalreadings.onrender.com/daily-usage/${meterId}`),
          axios.get(`https://electricalreadings.onrender.com/monthly-usage/${meterId}`)
        ]);
        setTotalUsage(totalResponse.data.totalUsage || 0);
        setDailyUsage(dailyResponse.data || []);
        setMonthlyUsage(monthlyResponse.data || []);
      } catch (error) {
        console.error("Analysis error:", { message: error.message, status: error.response?.status });
        setError(`Failed to fetch analysis: ${error.message}.`);
      } finally {
        setLoading(false);
      }
    };
    return () => {
      clearTimeout(timeout);
      timeout = setTimeout(fetch, 1000);
    };
  }, [meterId]);

  const fetchCustomRange = useCallback(async () => {
    if (!startDate || !endDate) {
      setError("Please select both start and end dates.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`https://electricalreadings.onrender.com/custom-range-usage/${meterId}`, {
        params: { startDate, endDate }
      });
      setCustomRangeData(response.data || { totalUsage: 0, dailyUsage: [] });
    } catch (error) {
      console.error("Custom range error:", { message: error.message, status: error.response?.status });
      setError(`Failed to fetch custom range data: ${error.message}.`);
    } finally {
      setLoading(false);
    }
  }, [meterId, startDate, endDate]);

  useEffect(() => {
    fetchData();
    const debouncedCall = debouncedFetchAnalysis();
    debouncedCall();
  }, [fetchData, debouncedFetchAnalysis]);

  const handleMeterChange = (e) => {
    const newMeter = e.target.value;
    setMeterId(newMeter);
    setData([]);
    setDailyUsage([]);
    setMonthlyUsage([]);
    setTotalUsage(0);
    setCustomRangeData({ totalUsage: 0, dailyUsage: [] });
  };

  const handleExportToPDF = async () => {
    try {
      setLoading(true);
      setError(null);
      const doc = new jsPDF();
      doc.text("Meter Readings", 20, 10);
      const tableColumn = ["Meter ID", "Reading", "Timestamp"];
      const tableRows = data.map((entry) => [entry.meterId, entry.reading, entry.timestamp]);
      doc.autoTable({ head: [tableColumn], body: tableRows });
      doc.save("meter_readings.pdf");
    } catch (error) {
      setError("Failed to export PDF.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportToExcel = async () => {
    try {
      setLoading(true);
      setError(null);
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Meter Readings");
      XLSX.writeFile(workbook, "meter_readings.xlsx");
    } catch (error) {
      setError("Failed to export Excel.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddReading = async () => {
    if (!reading.trim() || isNaN(reading) || Number(reading) < 0) {
      setError("Please enter a valid positive number");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      await axios.post("https://electricalreadings.onrender.com/add-reading", {
        meterId,
        reading: Number(reading),
      });
      setReading("");
      await Promise.all([fetchData(), debouncedFetchAnalysis()]);
    } catch (error) {
      setError(error.response?.data?.error || "Failed to add reading.");
    } finally {
      setLoading(false);
    }
  };

  const handleClearData = async () => {
    try {
      setLoading(true);
      setError(null);
      await axios.delete("https://electricalreadings.onrender.com/clear-readings");
      setData([]);
      setTotalUsage(0);
      setDailyUsage([]);
      setMonthlyUsage([]);
      setCustomRangeData({ totalUsage: 0, dailyUsage: [] });
    } catch (error) {
      setError("Failed to clear data.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`container ${darkMode ? "dark-mode" : "light-mode"}`}>
      <div className="header">
        <h1><FaBolt className="header-icon" /> Electrical Readings</h1>
        <button className="toggle-btn" onClick={toggleDarkMode} disabled={loading}>
          {darkMode ? <FaSun /> : <FaMoon />}
        </button>
      </div>

      {error && <div className="error">{error}</div>}
      
      <div className="input-section">
        <select className="modern-dropdown" value={meterId} onChange={handleMeterChange} disabled={loading}>
          <option value="Meter 1">Meter 1</option>
          <option value="Meter 2">Meter 2</option>
          <option value="Meter 3">Meter 3</option>
        </select>
        <input
          className="modern-input"
          type="number"
          value={reading}
          onChange={(e) => setReading(e.target.value)}
          placeholder="Enter Reading"
          disabled={loading}
        />
        <button className="btn modern-btn btn-primary" onClick={handleAddReading} disabled={loading}>
          {loading ? <FaSpinner className="spin" /> : <FaPlus />} Add
        </button>
      </div>

      <div className="button-group">
        <button className="btn modern-btn btn-success" onClick={handleExportToPDF} disabled={loading}>
          <FaFilePdf /> PDF
        </button>
        <button className="btn modern-btn btn-warning" onClick={handleExportToExcel} disabled={loading}>
          <FaFileExcel /> Excel
        </button>
        <button className="btn modern-btn btn-danger" onClick={handleClearData} disabled={loading}>
          <FaTrash /> Clear
        </button>
      </div>

      {loading && <FaSpinner className="main-spinner spin" />}

      <div className="stats-card">
        <h2>Total Usage: <span className="highlight">{totalUsage !== undefined ? totalUsage : "0"}</span></h2>
      </div>

      <div className="table-container">
        <h3>Daily Usage</h3>
        <div className="scrollable-table">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Usage</th>
              </tr>
            </thead>
            <tbody>
              {dailyUsage.length > 0 ? (
                dailyUsage.map((entry, index) => (
                  <tr key={index} className="table-row">
                    <td>{entry.formattedDate || "N/A"}</td>
                    <td>{entry.usage || "0"}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="2">No data available</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <h3>Monthly Usage</h3>
        <div className="scrollable-table">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Usage</th>
              </tr>
            </thead>
            <tbody>
              {monthlyUsage.length > 0 ? (
                monthlyUsage.map((entry, index) => (
                  <tr key={index} className="table-row">
                    <td>{entry.month || "N/A"}</td>
                    <td>{entry.usage || "0"}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="2">No data available</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <h3>All Readings</h3>
        <div className="scrollable-table">
          <table>
            <thead>
              <tr>
                <th>Meter ID</th>
                <th>Reading</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {data.length > 0 ? (
                data.map((entry) => (
                  <tr key={entry._id} className="table-row">
                    <td>{entry.meterId}</td>
                    <td>{entry.reading}</td>
                    <td>{entry.timestamp}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="3">{loading ? "Loading..." : "No readings available"}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <h3>Custom Range Usage <FaCalendar /></h3>
        <div className="input-section">
          <input
            type="date"
            className="modern-input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={loading}
          />
          <input
            type="date"
            className="modern-input"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={loading}
          />
          <button className="btn modern-btn btn-primary" onClick={fetchCustomRange} disabled={loading}>
            {loading ? <FaSpinner className="spin" /> : "Fetch"}
          </button>
        </div>
        <div className="stats-card">
          <h2>Range Total: <span className="highlight">{customRangeData.totalUsage}</span></h2>
        </div>
        <div className="scrollable-table">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Usage</th>
              </tr>
            </thead>
            <tbody>
              {customRangeData.dailyUsage.length > 0 ? (
                customRangeData.dailyUsage.map((entry, index) => (
                  <tr key={index} className="table-row">
                    <td>{entry.formattedDate || "N/A"}</td>
                    <td>{entry.usage || "0"}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="2">No data for selected range</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default App;
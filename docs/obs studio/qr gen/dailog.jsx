import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';

/**
 * DroidCam Connection Dialog Component
 * Automatically detects IP/port and renders a highly-scannable QR code.
 */

export function SimpleQRCodeDialog() {
  // Automatically detect the PC's network IP if accessed via a local network address
  const [ip, setIp] = useState(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      // Skip localhost/127.0.0.1 loopbacks and return a valid network IP if present
      if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1' && !hostname.startsWith('169.254')) {
        return hostname;
      }
    }
    return '192.168.1.100'; // Sensible local default fallback
  });

  // Automatically detect and align with the backend port
  const [port, setPort] = useState(() => {
    if (typeof window !== 'undefined') {
      const currentPort = window.location.port;
      // If web app is running on port 3000, signaling server is on 3001
      if (currentPort === '3000') return '3001';
      return currentPort || '3001';
    }
    return '3001';
  });

  const canvasRef = useRef(null);
  const [error, setError] = useState(null);
  const [useLegacyScheme, setUseLegacyScheme] = useState(false);

  // Generate QR code when IP, port, or scheme changes
  useEffect(() => {
    generateQR();
  }, [ip, port, useLegacyScheme]);

  const generateQR = async () => {
    try {
      setError(null);
      
      if (!canvasRef.current) {
        return;
      }

      // Support both the standard (podsoft://) and legacy (podsoftv1://) schemes
      const scheme = useLegacyScheme ? 'podsoftv1://' : 'podsoft://';
      const qrData = `${scheme}connect?ip=${ip}&port=${port}&quality=70`;
      
      console.log('Generating QR for:', qrData);

      // Generate high-contrast, clean QR code on canvas
      await QRCode.toCanvas(canvasRef.current, qrData, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 300,
        color: {
          dark: '#000000', // Crisp black modules
          light: '#FFFFFF', // Clean white background for perfect scanning contrast
        },
      });

      console.log('✓ QR Code generated successfully');
    } catch (err) {
      console.error('QR Generation Error:', err);
      setError(`Failed to generate QR: ${err.message}`);
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>📱 DroidCam Connection</h2>

      {/* QR Code Section */}
      <div style={styles.qrSection}>
        <h3 style={styles.sectionHeader}>Scan with your phone:</h3>
        <div style={styles.qrBox}>
          {/* CRITICAL FIX: Explicitly set HTML width and height attributes so canvas buffer matches layout size */}
          <canvas ref={canvasRef} width={300} height={300} style={styles.canvas} />
        </div>
      </div>

      {/* Manual Entry Section */}
      <div style={styles.inputSection}>
        <h3 style={styles.sectionHeader}>Or configure connection:</h3>
        
        <div style={styles.inputGroup}>
          <label style={styles.label}>PC IP Address:</label>
          <input
            type="text"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            placeholder="192.168.1.100"
            style={styles.input}
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Signaling Port:</label>
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            placeholder="3001"
            style={styles.input}
          />
        </div>

        {/* Scheme toggle helper */}
        <div style={styles.checkboxGroup}>
          <input
            type="checkbox"
            id="legacy-scheme-chk"
            checked={useLegacyScheme}
            onChange={(e) => setUseLegacyScheme(e.target.checked)}
            style={styles.checkbox}
          />
          <label htmlFor="legacy-scheme-chk" style={styles.checkboxLabel}>
            Use legacy scheme (<code>podsoftv1://</code>)
          </label>
        </div>

        <button style={styles.button} onClick={generateQR}>
          Regenerate QR
        </button>
      </div>

      {/* Error Display */}
      {error && <div style={styles.error}>{error}</div>}

      {/* Debug Info */}
      <div style={styles.debug}>
        <small style={styles.debugText}>
          <strong>Target Scheme:</strong> {useLegacyScheme ? 'Legacy' : 'Standard'}<br />
          <strong>QR Data:</strong> <code>{useLegacyScheme ? 'podsoftv1://' : 'podsoft://'}connect?ip={ip}&port={port}&quality=70</code>
        </small>
      </div>
    </div>
  );
}

// ============ STYLES ============
const styles = {
  container: {
    maxWidth: '500px',
    margin: '20px auto',
    padding: '25px',
    border: '1px solid #e0e0e0',
    borderRadius: '12px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backgroundColor: '#ffffff',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
  },
  title: {
    marginTop: 0,
    marginBottom: '20px',
    textAlign: 'center',
    color: '#1a1a1a',
    fontSize: '22px',
  },
  sectionHeader: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#666',
    marginBottom: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  qrSection: {
    textAlign: 'center',
    marginBottom: '25px',
  },
  qrBox: {
    display: 'inline-block',
    padding: '12px',
    border: '1px solid #eaeaea',
    borderRadius: '10px',
    backgroundColor: '#ffffff',
    boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
  },
  canvas: {
    display: 'block',
    width: '300px',
    height: '300px',
  },
  inputSection: {
    marginBottom: '20px',
  },
  inputGroup: {
    marginBottom: '15px',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '500',
    color: '#444',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #dcdcdc',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: 'monospace',
    boxSizing: 'border-box',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  checkboxGroup: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '20px',
    gap: '8px',
  },
  checkbox: {
    width: '16px',
    height: '16px',
    cursor: 'pointer',
  },
  checkboxLabel: {
    fontSize: '13px',
    color: '#555',
    cursor: 'pointer',
    userSelect: 'none',
  },
  button: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#0066cc',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  error: {
    padding: '10px 15px',
    marginBottom: '15px',
    backgroundColor: '#ffebe9',
    border: '1px solid #ffc1bd',
    borderRadius: '6px',
    color: '#b31412',
    fontSize: '13px',
  },
  debug: {
    padding: '12px',
    backgroundColor: '#f6f8fa',
    border: '1px solid #eaeef2',
    borderRadius: '8px',
    marginTop: '25px',
  },
  debugText: {
    fontSize: '11px',
    color: '#57606a',
    lineHeight: '1.6',
    display: 'block',
    wordBreak: 'break-all',
  },
};

export default SimpleQRCodeDialog;
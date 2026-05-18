# PodSoft QR Code - Troubleshooting Guide

## Quick Checklist

- [ ] Is `qrcode` npm package installed?
- [ ] Is the canvas element in the DOM?
- [ ] Is the useRef pointing to the correct canvas?
- [ ] Are you waiting for QRCode to generate (async/await)?
- [ ] Are you calling generate on mount AND on IP/port change?
- [ ] Can you see the canvas in browser DevTools?
- [ ] Are there any JavaScript errors in console?

---

## Common Problems & Solutions

### 🔴 Problem 1: Canvas is Blank (QR Not Showing)

**Check 1: Is canvas element rendered?**
```javascript
// In browser console:
console.log(document.querySelector('canvas'));
// Should output: <canvas>...</canvas>
// If null, canvas is not in DOM
```

**Check 2: Is ref properly initialized?**
```javascript
// ✗ WRONG - ref used before it's assigned
const qrCanvasRef = useRef(null);
// generateQR called before component mounts

// ✓ CORRECT - ref used in useEffect
useEffect(() => {
  if (qrCanvasRef.current) {
    generateQR();
  }
}, []);
```

**Check 3: Is qrcode library loaded?**
```javascript
// In console:
typeof QRCode !== 'undefined'
// Should return: true
// If false, library not imported
```

**Fix:**
```javascript
import QRCode from 'qrcode';  // Add this import

const generateQR = async () => {
  if (!canvasRef.current) {
    console.error('Canvas ref is null');
    return;
  }
  
  try {
    const qrData = `podsoft://connect?ip=${ip}&port=${port}`;
    await QRCode.toCanvas(canvasRef.current, qrData, {
      width: 300,
      errorCorrectionLevel: 'H',
    });
    console.log('✓ QR generated');
  } catch (err) {
    console.error('QR Error:', err);
  }
};
```

---

### 🔴 Problem 2: "QR Code is Too Small" or "Unreadable"

**Symptoms:**
- Phone camera can't read QR code
- QR is generated but scanner fails

**Fix: Increase Size & Contrast**
```javascript
// ✗ TOO SMALL
await QRCode.toCanvas(canvas, data, { width: 100 });

// ✓ BETTER
await QRCode.toCanvas(canvas, data, {
  width: 300,              // Bigger size
  margin: 2,               // Space around edges
  scale: 10,               // Module size
  errorCorrectionLevel: 'H', // Best error correction
  color: {
    dark: '#000000',       // Pure black
    light: '#FFFFFF',      // Pure white (max contrast)
  },
});
```

**For Dark Theme:**
```javascript
color: {
  dark: '#00FF64',         // Bright green
  light: '#0A0A0A',        // Very dark (not pure black)
}
```

---

### 🔴 Problem 3: "QR Updates Don't Show"

**Symptom:** Change IP in input, but QR doesn't update

**Fix: Use useEffect to Trigger Generation**
```javascript
// ✗ WRONG - Not connected to input changes
useEffect(() => {
  generateQR();
}, []); // Empty dependency array = only runs once

// ✓ CORRECT - Updates when IP/port changes
useEffect(() => {
  generateQR();
}, [ip, port]); // Re-run when these change
```

---

### 🔴 Problem 4: "Error: Canvas Context is Null"

**Error Message:**
```
TypeError: Cannot read property 'getContext' of null
```

**Cause:** Canvas element doesn't exist

**Fix:**
```javascript
const generateQR = async () => {
  // ✓ ALWAYS check ref exists
  if (!canvasRef.current) {
    console.error('Canvas not found in DOM');
    return;
  }

  const ctx = canvasRef.current.getContext('2d');
  if (!ctx) {
    console.error('Could not get 2D context');
    return;
  }

  // Now safe to use
  await QRCode.toCanvas(canvasRef.current, data, options);
};
```

---

### 🔴 Problem 5: "npm: qrcode not found"

**Error:**
```
Cannot find module 'qrcode'
```

**Fix:**
```bash
# Install the package
npm install qrcode

# If using yarn
yarn add qrcode

# Verify installation
npm list qrcode
# Should show: qrcode@1.x.x
```

**Check package.json:**
```json
{
  "dependencies": {
    "qrcode": "^1.5.0"  // Should be listed here
  }
}
```

---

### 🔴 Problem 6: "Phone Camera Can't Scan QR"

**Causes:**
1. QR is too small
2. Colors have low contrast
3. QR data is invalid
4. URL is too long

**Debugging Steps:**

**Step 1: Test QR data format**
```javascript
const qrData = `podsoft://connect?ip=${ip}&port=${port}`;
console.log('QR Data:', qrData);
console.log('Length:', qrData.length);
// Should be under 2953 characters (QR limit)
```

**Step 2: Verify URL validity**
```javascript
try {
  const url = new URL(`http://${qrData}`, 'http://example.com');
  console.log('✓ URL is valid');
} catch (err) {
  console.error('✗ Invalid URL:', err);
  // URL has special characters that need encoding
}
```

**Step 3: Test with online decoder**
1. Generate QR code
2. Take screenshot of QR
3. Visit: https://zxing.org/w/decode.jspx
4. Upload screenshot
5. Check decoded data matches your URL

**Step 4: Check colors**
```javascript
// Get canvas image data
const imageData = canvas.toDataURL('image/png');
console.log('QR Image:', imageData);
// Look at generated image - is it black and white?
// Light areas should be bright, dark areas dark
```

---

### 🔴 Problem 7: "Async/Await Error"

**Error:**
```
Uncaught SyntaxError: await is only valid in async function
```

**Fix:**
```javascript
// ✗ WRONG - not async
const generateQR = () => {
  await QRCode.toCanvas(...); // Error!
};

// ✓ CORRECT - async function
const generateQR = async () => {
  await QRCode.toCanvas(...); // OK
};

// Or use .then()
QRCode.toCanvas(canvas, data).then(() => {
  console.log('Done');
});
```

---

### 🔴 Problem 8: "Multiple QR Codes Generated"

**Symptom:** Multiple canvas elements with QRs

**Cause:** useEffect running multiple times or multiple renders

**Fix:**
```javascript
// Add cleanup to prevent multiple generations
useEffect(() => {
  let isMounted = true;

  const generateQR = async () => {
    if (!isMounted || !canvasRef.current) return;
    
    try {
      const qrData = `podsoft://connect?ip=${ip}&port=${port}`;
      await QRCode.toCanvas(canvasRef.current, qrData, {
        width: 300,
        errorCorrectionLevel: 'H',
      });
    } catch (err) {
      console.error('QR Error:', err);
    }
  };

  generateQR();

  return () => {
    isMounted = false; // Cleanup
  };
}, [ip, port]);
```

---

### 🔴 Problem 9: "High CPU Usage When Generating"

**Symptom:** App slows down when typing IP

**Fix: Debounce QR Generation**
```javascript
useEffect(() => {
  // Wait 500ms after user stops typing
  const timer = setTimeout(() => {
    generateQR();
  }, 500);

  return () => clearTimeout(timer);
}, [ip, port]);
```

---

### 🔴 Problem 10: "QR Works on WiFi but Not Cellular"

**Issue:** Different port or IP format needed

**Solution: Detect Network Type**
```javascript
const handleNetworkChange = (networkType) => {
  if (networkType === 'cellular') {
    setPort('4748');  // Different port for cellular
  } else {
    setPort('4747');  // WiFi port
  }
};

// QR automatically updates because useEffect watches port
```

---

## Browser DevTools Debugging

### Enable Console Logging
```javascript
const generateQR = async () => {
  console.log('🔵 Starting QR generation...');
  console.log('IP:', ip);
  console.log('Port:', port);
  
  if (!canvasRef.current) {
    console.error('🔴 Canvas ref is null!');
    return;
  }
  
  try {
    const qrData = `podsoft://connect?ip=${ip}&port=${port}&quality=70`;
    console.log('QR Data:', qrData);
    
    await QRCode.toCanvas(canvasRef.current, qrData, {
      width: 300,
      errorCorrectionLevel: 'H',
    });
    
    console.log('✅ QR generated successfully');
  } catch (err) {
    console.error('🔴 QR Generation Error:', err);
    console.error('Stack:', err.stack);
  }
};
```

### Check Canvas State
```javascript
// In browser console:
const canvas = document.querySelector('canvas');

// Check if element exists
console.log('Canvas element:', canvas);

// Check size
console.log('Canvas size:', canvas.width, 'x', canvas.height);

// Check if it has content
const imgData = canvas.toDataURL();
console.log('Canvas has image:', imgData.length > 100);

// Export QR as file for testing
const link = document.createElement('a');
link.href = imgData;
link.download = 'qr-code.png';
link.click();
```

---

## Network Testing

### Test Connection to Device
```bash
# Test if device is reachable
ping 192.168.1.100

# Test if port is open
nc -zv 192.168.1.100 4747

# For cellular IP
curl -v http://100.116.133.65:4747/api/ping
```

### Test with cURL
```bash
# Generate QR and test URL
curl "http://localhost:3000/api/generate-qr?ip=192.168.1.100&port=4747"
```

---

## Step-by-Step Fix Guide

### If QR is Not Showing:

1. **Check import:**
   ```javascript
   import QRCode from 'qrcode';  // Must have this
   ```

2. **Check canvas exists:**
   ```javascript
   <canvas ref={canvasRef} width={300} height={300} />
   ```

3. **Check ref initialization:**
   ```javascript
   const canvasRef = useRef(null);
   ```

4. **Check generation function:**
   ```javascript
   useEffect(() => {
     generateQR();
   }, [ip, port]);
   ```

5. **Add error handling:**
   ```javascript
   try {
     await QRCode.toCanvas(canvasRef.current, qrData, options);
     console.log('✓ Success');
   } catch (err) {
     console.error('✗ Error:', err);
   }
   ```

6. **Check browser console** for any error messages

7. **Verify npm package:**
   ```bash
   npm list qrcode
   ```

---

## Testing Checklist

- [ ] QR code renders on page load
- [ ] QR updates when IP changes
- [ ] QR updates when port changes  
- [ ] QR size is at least 200x200px
- [ ] QR has high contrast (black/white or green/dark)
- [ ] Phone camera can scan QR
- [ ] Decoded URL matches expected format
- [ ] URL opens correct connection screen
- [ ] Manual entry works as fallback
- [ ] No console errors

---

## Ask These Questions to Debug

1. **Is the canvas element visible on the page?**
   - DevTools → Elements → Find `<canvas>`
   - If not, JSX isn't rendering the canvas

2. **Does the canvas have size?**
   - DevTools → Elements → Select canvas → Check width/height
   - Should be 300x300 or larger

3. **Is QRCode library loaded?**
   - Console: `typeof QRCode`
   - Should return `"object"` not `"undefined"`

4. **What does the console show?**
   - Are there any errors?
   - Is your log showing "QR generated"?

5. **Can you manually save QR image?**
   - Console: `document.querySelector('canvas').toDataURL()`
   - Save and test with online decoder

---

## Final Working Example

```javascript
import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';

export function QRTest() {
  const [ip, setIp] = useState('192.168.1.100');
  const canvasRef = useRef(null);

  useEffect(() => {
    const generateQR = async () => {
      try {
        if (!canvasRef.current) return;
        
        const data = `podsoft://connect?ip=${ip}&port=4747`;
        await QRCode.toCanvas(canvasRef.current, data, {
          width: 300,
          errorCorrectionLevel: 'H',
          color: { dark: '#000000', light: '#FFFFFF' },
        });
        console.log('✓ QR Ready');
      } catch (err) {
        console.error('✗ QR Error:', err);
      }
    };

    generateQR();
  }, [ip]);

  return (
    <div>
      <h2>QR Code Test</h2>
      <input value={ip} onChange={(e) => setIp(e.target.value)} />
      <canvas ref={canvasRef} width={300} height={300} />
      <p>{`podsoft://connect?ip=${ip}&port=4747`}</p>
    </div>
  );
}
```

Copy this and test in your app. If this works, your issue is in your existing code.
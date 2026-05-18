# PodSoft DroidCam QR Code Implementation Guide

## Overview
This guide covers implementing QR code generation and scanning for the DroidCam connection feature in PodSoft. QR codes encode the device IP, port, and stream quality settings for seamless mobile device connection.

---

## Part 1: QR Code Library Setup

### Installation

#### Option A: qrcode.js (Recommended for PodSoft)
```bash
npm install qrcode
```

**Pros:**
- Generates QR codes on the client-side (no server calls)
- Works with Canvas API (perfect for browsers)
- Highly customizable
- Good error correction levels

**Cons:**
- Slightly larger bundle size (~15KB minified)

#### Option B: qr-code-generator
```bash
npm install jsqr
```

**Pros:**
- Lighter weight
- Pure JavaScript

**Cons:**
- Less browser-friendly for generation

#### Option C: Server-side Generation (Node.js)
```bash
npm install qr-image
```

**For backend (Express):**
```javascript
const QRCode = require('qr-image');

app.get('/api/qr', (req, res) => {
  const { ip, port, quality } = req.query;
  const qrData = `podsoft://connect?ip=${ip}&port=${port}&quality=${quality}`;
  
  const qrImage = QRCode.image(qrData, { type: 'png' });
  res.type('image/png');
  qrImage.pipe(res);
});
```

---

## Part 2: QR Code Data Format

### URL Schema
```
podsoft://connect?ip=<DEVICE_IP>&port=<PORT>&quality=<QUALITY>
```

### Examples

**WiFi Connection:**
```
podsoft://connect?ip=192.168.1.100&port=4747&quality=70
```

**Cellular Connection:**
```
podsoft://connect?ip=100.116.133.65&port=4748&quality=60
```

**Cloud Access (ngrok):**
```
podsoft://connect?ip=2.tcp.ngrok.io&port=18563&quality=80
```

### Data Encoding Best Practices

1. **URL Encoding**: Ensure special characters are properly encoded
   ```javascript
   const encoded = encodeURIComponent(`podsoft://connect?ip=${ip}&port=${port}`);
   ```

2. **Error Correction Level**: Use HIGH for better scannability
   ```javascript
   QRCode.toCanvas(canvas, data, {
     errorCorrectionLevel: 'H'  // L, M, Q, H
   });
   ```

3. **Module Size**: Larger is better for mobile cameras
   ```javascript
   const options = {
     width: 300,      // pixels
     margin: 2,       // quiet zone
     scale: 10,       // size per module
     color: {
       dark: '#ffffff',
       light: '#000000'
     }
   };
   ```

---

## Part 3: Implementation Steps

### Step 1: Install qrcode.js
```bash
npm install qrcode
```

### Step 2: Import in Your Component
```javascript
import QRCode from 'qrcode';
```

### Step 3: Create Canvas Reference
```jsx
const qrCanvasRef = useRef(null);
```

### Step 4: Generate QR Code
```javascript
const generateQRCode = async () => {
  try {
    if (!qrCanvasRef.current) return;

    const connectionData = `podsoft://connect?ip=${deviceIP}&port=${port}&quality=${streamQuality}`;

    await QRCode.toCanvas(qrCanvasRef.current, connectionData, {
      width: 300,
      margin: 2,
      color: {
        dark: '#ffffff',
        light: '#1a1a1a',
      },
      errorCorrectionLevel: 'H',
    });

    console.log('✓ QR Code generated successfully');
  } catch (error) {
    console.error('✗ QR generation failed:', error);
  }
};
```

### Step 5: Add Canvas to JSX
```jsx
<canvas ref={qrCanvasRef} width={300} height={300} />
```

### Step 6: Trigger Generation on IP/Port Change
```javascript
useEffect(() => {
  generateQRCode();
}, [deviceIP, port, streamQuality]);
```

---

## Part 4: Common Issues & Troubleshooting

### Issue 1: QR Code Not Generating

**Symptoms:**
- Canvas stays blank
- No errors in console

**Solutions:**
```javascript
// ✗ WRONG - ref not ready
<canvas ref={qrCanvasRef} />

// ✓ CORRECT - check if ref exists
if (!qrCanvasRef.current) return;
```

**Verify in React DevTools:**
```javascript
console.log('Canvas ref:', qrCanvasRef.current);
console.log('Canvas context:', qrCanvasRef.current?.getContext('2d'));
```

---

### Issue 2: QR Code Unreadable/Scanning Fails

**Symptoms:**
- QR code generates but scanner can't read it
- Intermittent scanning success

**Root Causes & Solutions:**

1. **Insufficient Contrast**
   ```javascript
   // ✗ WRONG - Low contrast
   color: { dark: '#666666', light: '#999999' }
   
   // ✓ CORRECT - High contrast
   color: { dark: '#ffffff', light: '#000000' }
   ```

2. **Too Small Size**
   ```javascript
   // ✗ WRONG
   width: 100  // Too small for phone cameras
   
   // ✓ CORRECT
   width: 300  // Optimal for scanning
   ```

3. **Low Error Correction**
   ```javascript
   // ✗ WRONG
   errorCorrectionLevel: 'L'  // Only 7% error tolerance
   
   // ✓ CORRECT
   errorCorrectionLevel: 'H'  // 30% error tolerance
   ```

4. **Dark Background Issues**
   ```javascript
   // ✓ For dark UI theme
   color: {
     dark: '#00ff64',   // Green on dark = high contrast
     light: '#0a0a0a'
   }
   ```

---

### Issue 3: Long URL Causing QR Code Overflow

**Symptoms:**
- QR code is too dense/complex
- Difficult to scan

**Solutions:**

1. **Use Custom Protocol Handler** (Recommended)
   ```javascript
   // Instead of full HTTP URL
   // Use custom deep link
   podsoft://connect?ip=192.168.1.100&port=4747&quality=70
   
   // Register in mobile app:
   // Android: manifest with intent-filter
   // iOS: Info.plist with URL scheme
   ```

2. **Use URL Shortener**
   ```javascript
   const shortURL = await shortenURL(longURL);
   QRCode.toCanvas(canvas, shortURL, options);
   ```

3. **Separate QR Code for Details**
   ```javascript
   // QR 1: IP + Port only
   podsoft://connect?ip=192.168.1.100&port=4747
   
   // Quality selected separately in app
   ```

---

## Part 5: Mobile App Integration (QR Scanning)

### Android Implementation (Kotlin)
```kotlin
// Add dependency
implementation 'com.google.mlkit:vision-barcode-scanning:17.0.0'

// In your Activity
private fun scanQRCode() {
    val scanner = BarcodeScanning.getClient()
    
    scanner.process(inputImage)
        .addOnSuccessListener { barcodes ->
            for (barcode in barcodes) {
                val rawValue = barcode.rawValue  // podsoft://connect?ip=...
                parseConnectionURL(rawValue)
            }
        }
        .addOnFailureListener { e ->
            Log.e("QRScanner", "Scan failed", e)
        }
}

private fun parseConnectionURL(url: String) {
    try {
        val uri = Uri.parse(url)
        val ip = uri.getQueryParameter("ip")
        val port = uri.getQueryParameter("port")
        val quality = uri.getQueryParameter("quality")
        
        connectToDevice(ip!!, port!!.toInt(), quality?.toInt() ?: 70)
    } catch (e: Exception) {
        Log.e("QRParser", "Failed to parse URL", e)
    }
}

private fun connectToDevice(ip: String, port: Int, quality: Int) {
    // Establish WebRTC/RTMP connection
}
```

### iOS Implementation (Swift)
```swift
import Vision

func scanQRCode(image: CIImage) {
    let request = VNDetectBarcodesRequest { request, error in
        guard let observations = request.results as? [VNBarcodeObservation] else {
            print("No barcodes detected")
            return
        }
        
        for barcode in observations {
            guard let stringValue = barcode.payloadStringValue else { continue }
            // stringValue = "podsoft://connect?ip=192.168.1.100&port=4747&quality=70"
            
            if let components = URLComponents(string: stringValue),
               let ip = components.queryItems?.first(where: { $0.name == "ip" })?.value,
               let port = components.queryItems?.first(where: { $0.name == "port" })?.value {
                
                connectToDevice(ip: ip, port: Int(port)!, quality: 70)
            }
        }
    }
    
    request.symbologies = [.QR]
    
    let handler = VNImageRequestHandler(ciImage: image)
    try? handler.perform([request])
}

private func connectToDevice(ip: String, port: Int, quality: Int) {
    // Establish WebRTC/RTMP connection
}
```

---

## Part 6: Advanced QR Features

### Dynamic QR Codes
Update QR code without regenerating:

```javascript
const handleIPChange = (newIP) => {
  setDeviceIP(newIP);
  // useEffect automatically triggers generateQRCode
};
```

### QR Code with Logo
```javascript
const canvas = qrCanvasRef.current;
const ctx = canvas.getContext('2d');

// First draw QR
await QRCode.toCanvas(canvas, data, options);

// Then overlay logo
const img = new Image();
img.onload = () => {
  const size = canvas.width * 0.25;
  const x = (canvas.width - size) / 2;
  const y = (canvas.height - size) / 2;
  
  ctx.fillStyle = '#fff';
  ctx.fillRect(x - 4, y - 4, size + 8, size + 8);
  ctx.drawImage(img, x, y, size, size);
};
img.src = '/podsoft-logo.png';
```

### Batch QR Code Generation
```javascript
const generateMultipleQRCodes = async (connections) => {
  for (const conn of connections) {
    const canvas = document.createElement('canvas');
    const qrData = `podsoft://connect?ip=${conn.ip}&port=${conn.port}`;
    
    await QRCode.toCanvas(canvas, qrData, {
      width: 200,
      errorCorrectionLevel: 'H',
    });
    
    // Save to file or display
    const dataURL = canvas.toDataURL('image/png');
    downloadQRCode(dataURL, `qr-${conn.ip}.png`);
  }
};
```

---

## Part 7: Verification Checklist

Before deploying, verify:

- [ ] Canvas ref is properly initialized
- [ ] QR code generates on component mount
- [ ] QR code updates when IP/port changes
- [ ] High contrast colors (white on black or green on dark)
- [ ] Size is at least 200x200 pixels
- [ ] Error correction level set to 'H'
- [ ] Mobile cameras can scan successfully
- [ ] Data format matches mobile app parser
- [ ] Connection URL opens correct deep link
- [ ] Fallback manual entry works

---

## Part 8: Backend API for Network Detection

```javascript
// Express.js endpoint to get device networks
app.get('/api/networks', (req, res) => {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  
  const networks = [];
  
  Object.keys(interfaces).forEach(name => {
    interfaces[name].forEach(iface => {
      // Skip internal and non-IPv4
      if (iface.family === 'IPv4' && !iface.internal) {
        const type = name.includes('wifi') ? 'wifi' 
                   : name.includes('eth') ? 'ethernet'
                   : 'unknown';
        
        networks.push({
          name: name,
          ip: iface.address,
          type: type,
          mac: iface.mac
        });
      }
    });
  });
  
  res.json(networks);
});
```

---

## Part 9: Testing QR Codes

### Online QR Decoder
1. Generate QR code
2. Visit https://zxing.org/w/decode.jspx
3. Upload PNG or take screenshot
4. Verify decoded data matches expected URL

### Mobile Testing
```bash
# Android - Use ML Kit Barcode Scanner
# iOS - Use native camera app

# Correct behavior:
# 1. Scan QR
# 2. URL opens device -> shows connection prompt
# 3. App extracts IP/port/quality
# 4. Connection established
```

### QR Code Validation Script
```javascript
const validateQRCode = (data, expectedIP, expectedPort) => {
  const url = new URL(data, 'http://example.com');
  
  const ip = url.searchParams.get('ip');
  const port = url.searchParams.get('port');
  const quality = url.searchParams.get('quality');
  
  console.assert(ip === expectedIP, `IP mismatch: ${ip} vs ${expectedIP}`);
  console.assert(port === expectedPort, `Port mismatch: ${port} vs ${expectedPort}`);
  console.assert(quality !== null, 'Quality not found');
  
  console.log('✓ QR validation passed');
};
```

---

## Part 10: Performance Optimization

### Debounce QR Generation
```javascript
useEffect(() => {
  const timer = setTimeout(() => {
    generateQRCode();
  }, 500); // Wait 500ms after IP change
  
  return () => clearTimeout(timer);
}, [deviceIP, port]);
```

### Lazy Load QR Library
```javascript
const [QRCode, setQRCode] = useState(null);

useEffect(() => {
  import('qrcode').then(module => setQRCode(module.default));
}, []);

if (!QRCode) return <div>Loading...</div>;
```

### Canvas Caching
```javascript
const cachedQRCodes = useRef({});

const getCachedQRCode = (ip, port) => {
  const key = `${ip}:${port}`;
  return cachedQRCodes.current[key];
};

const setCachedQRCode = (ip, port, canvasData) => {
  const key = `${ip}:${port}`;
  cachedQRCodes.current[key] = canvasData;
};
```

---

## Debugging Commands

### Browser Console
```javascript
// Check if canvas exists
console.log(document.querySelector('canvas'));

// Verify QR data
console.log('QR Data:', 'podsoft://connect?ip=192.168.1.100&port=4747');

// Test QR generation manually
const QRCode = require('qrcode');
QRCode.toCanvas(document.querySelector('canvas'), 'test data', {width: 300});
```

### Network Testing
```bash
# Test device accessibility
ping 192.168.1.100
nc -zv 192.168.1.100 4747

# For cellular IP
curl -v http://100.116.133.65:4747/api/ping
```

---

## References

- **qrcode.js Documentation**: https://github.com/davidshimjs/qrcodejs
- **ML Kit Barcode Scanning**: https://developers.google.com/ml-kit/vision/barcode-scanning
- **iOS Vision Framework**: https://developer.apple.com/documentation/vision
- **QR Code Standards**: https://www.qr-code.co.uk/

---

## Support

For QR code generation issues:
1. Check browser console for errors
2. Verify canvas ref is initialized
3. Test with static data first
4. Check color contrast
5. Increase width/height
6. Use online decoder to verify data
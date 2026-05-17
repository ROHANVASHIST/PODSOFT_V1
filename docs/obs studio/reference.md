# OBS Studio Implementation - Quick Reference Guide

## 📋 Document Overview

You have received **3 comprehensive documents** to implement OBS Studio from scratch:

### 1. **prd.md** (18 sections, ~6000 words)
   - **Purpose**: Complete product requirements and specifications
   - **Contains**: Architecture, feature specs, tech stack, build system, testing criteria
   - **Read first**: Yes - this is the master specification
   - **Use for**: Understanding what needs to be built and why

### 2. **ANTIGRAVITY_INSTRUCTIONS.md** (18 steps, ~3500 words)
   - **Purpose**: Step-by-step implementation guide for Antigravity
   - **Contains**: Code examples, CMake setup, plugin templates, testing setup
   - **Read second**: Yes - follow these phases sequentially
   - **Use for**: Actual coding and building

### 3. **QUICK_REFERENCE.md** (This document)
   - **Purpose**: Navigation and quick lookup
   - **Contains**: Summaries, key decisions, dependency lists
   - **Use for**: Quick answers while implementing

---

## 🎯 Key Implementation Phases

### Phase 1: Foundation (Weeks 1-4)
- [ ] Repository setup & CMake configuration
- [ ] LibOBS core data structures
- [ ] Basic graphics abstraction
- [ ] Qt main application window
- **Deliverable**: Compiling empty application

### Phase 2: Graphics (Weeks 5-8)
- [ ] OpenGL renderer (libobs-opengl)
- [ ] Direct3D 11 renderer for Windows
- [ ] Metal renderer for macOS
- [ ] Shader system and texture management
- **Deliverable**: Can render colored squares and basic meshes

### Phase 3: Audio & Media (Weeks 9-12)
- [ ] Audio mixing subsystem
- [ ] FFmpeg integration
- [ ] Image/text source plugins
- [ ] Audio input drivers (WASAPI, CoreAudio, ALSA)
- **Deliverable**: Can play audio and display images

### Phase 4: Output (Weeks 13-16)
- [ ] RTMP streaming output
- [ ] File recording (MP4, MKV)
- [ ] Encoder management (x264, NVENC, AMF)
- [ ] Virtual camera output
- **Deliverable**: Can stream and record

### Phase 5: Capture (Weeks 17-20)
- [ ] Windows game/window capture
- [ ] macOS ScreenCaptureKit
- [ ] Linux X11/Wayland capture
- [ ] Scene/window picker UI
- **Deliverable**: Can capture screen/windows

### Phase 6: Polish (Weeks 21-24)
- [ ] Browser source (CEF)
- [ ] Effects and filters
- [ ] Transitions
- [ ] Hotkey system
- [ ] Theme system
- **Deliverable**: Feature-complete application

### Phase 7: Testing & Release (Weeks 25-26)
- [ ] Unit test suite
- [ ] Performance profiling
- [ ] Multi-platform builds
- [ ] Installer creation
- **Deliverable**: Production-ready builds

---

## 📦 Core Components Checklist

### LibOBS (Core Library)
```
libobs/
├── obs-core.h (Public API)
├── obs-internal.h (Internal structures)
├── obs.c (Core lifecycle)
├── obs-source.h/c (Source base class)
├── obs-scene.h/c (Scene management)
├── obs-output.h/c (Output abstraction)
├── obs-encoder.h/c (Encoding)
├── obs-properties.h/c (Dynamic UI properties)
├── graphics/
│   ├── graphics.h (Graphics API)
│   ├── matrix4, vec3, plane (Math)
│   └── effect.h (Shader effects)
├── media-io/
│   ├── audio-io.h (Audio format)
│   ├── video-io.h (Video format)
│   └── format-conversion.c
├── util/
│   ├── base.h (Macros)
│   ├── darray.h (Dynamic array)
│   ├── dstr.h (Dynamic string)
│   ├── threading.h (Mutex, semaphore)
│   └── config-file.h (JSON config)
└── plugin-support.h/c (Plugin system)
```

### Graphics Renderers
```
libobs-opengl/
├── gl-subsystem.h/c (OpenGL device)
├── gl-shader.c (GLSL compilation)
├── gl-texture2d.c (2D textures)
└── glx-subsystem.c (X11 integration)

libobs-d3d11/ [Windows Only]
├── d3d11-subsystem.h/c
├── d3d11-shader.c
└── d3d11-swapchain.c

libobs-metal/ [macOS Only]
├── metal-subsystem.mm
├── metal-shader.mm
└── metal-texture.mm

libobs-winrt/ [Windows Only]
└── winrt-virtualcam.cpp
```

### Frontend (Qt Application)
```
frontend/
├── obs-app.cpp (Application class)
├── window-main.cpp (Main window)
├── scene-dock.cpp (Scene panel)
├── sources-dock.cpp (Sources panel)
├── mixer-dock.cpp (Audio mixer)
├── properties-dock.cpp (Properties panel)
├── qt-display.cpp (Rendering widget)
├── preview-output.cpp (Live preview)
├── forms/ (UI files)
└── res/ (Icons, themes)
```

### Built-in Plugins
```
plugins/
├── image-source/ (PNG/JPG/GIF)
├── text-freetype/ (Text rendering)
├── browser/ (CEF web pages)
├── win-capture/ [Windows] (Game/window)
├── linux-capture/ [Linux] (X11/Wayland)
├── mac-capture/ [macOS] (ScreenCaptureKit)
├── obs-ffmpeg/ (FFmpeg encoding)
├── obs-x264/ (x264 H.264)
├── enc-amf/ [Windows] (AMD encoding)
├── ffmpeg-mux/ (MP4/MKV output)
├── rtmp-services/ (Service configs)
├── vlc-video/ (VLC playback)
└── base-filters/ (Audio/video effects)
```

---

## 🔧 Critical Dependencies

### Core Libraries (Must Have)
| Library | Purpose | Version | Platform |
|---------|---------|---------|----------|
| Qt | UI Framework | 6.5+ | All |
| FFmpeg | Media encoding | 5.x+ | All |
| OpenGL | Graphics API | 3.2+ | All |
| CMake | Build system | 3.22+ | All |

### Media Libraries
| Library | Purpose | Version |
|---------|---------|---------|
| libx264 | H.264 encoding | 1.65+ |
| libx265 | H.265 encoding | 3.4+ |
| libopus | Opus audio | 1.3+ |
| libjansson | JSON parsing | 2.13+ |

### System Libraries
| Windows | macOS | Linux |
|---------|-------|-------|
| Direct3D 11 | Metal | OpenGL |
| WASAPI | CoreAudio | PulseAudio/ALSA |
| DXGI | ScreenCaptureKit | X11/Wayland |
| DirectShow | Cocoa | XCB |

---

## 🏗️ CMake Build Variables

### Essential Variables
```cmake
CMAKE_BUILD_TYPE        # Debug, Release, RelWithDebInfo
CMAKE_PREFIX_PATH       # Path to dependencies
CMAKE_INSTALL_PREFIX    # Installation directory
CMAKE_OSX_ARCHITECTURES # x86_64;arm64 for macOS universal
```

### Feature Flags
```cmake
ENABLE_BROWSER          # Browser source (requires CEF)
ENABLE_VIRTUALCAM       # Virtual camera output
ENABLE_SCRIPTING        # Lua/Python support
ENABLE_DECKLINK         # Blackmagic DeckLink
DISABLE_UI              # Headless build (no Qt)
ENABLE_SRTLA            # Resilient streaming
```

### Platform-Specific
```cmake
# Windows
CMAKE_PREFIX_PATH=D:/obs-build-dependencies/windows-deps-2024-08-02-x64

# macOS
CMAKE_OSX_ARCHITECTURES=x86_64;arm64
CMAKE_PREFIX_PATH=/path/to/obs-deps/macos

# Linux
# Uses system pkg-config, or vcpkg
```

---

## 📊 Performance Targets

| Metric | Target | How to Measure |
|--------|--------|---|
| **Stream Start** | <2 seconds | Time from click "Start Streaming" to first frame |
| **Frame Drop Rate** | <0.5% | CPU/GPU bottleneck detection |
| **Audio Sync Drift** | <20ms | A/V sync measurement over 1 hour |
| **Memory Usage** | <500 MB | Peak memory for typical setup |
| **CPU Usage** | <30% | 1080p60 streaming with one scene |
| **GPU VRAM** | <200 MB | Typical scene with 10 sources |

### Profiling Tools
```bash
# CPU Profiling
perf record ./obs-studio
perf report

# Memory Leaks (Linux)
valgrind --leak-check=full ./obs-studio

# GPU Profiling (Windows)
# Use NVIDIA NSight or AMD GPU PerfStudio

# macOS Profiling
# Xcode Instruments > Metal
```

---

## 🧪 Testing Checklist

### Unit Tests (test/)
- [ ] LibOBS core lifecycle
- [ ] Scene/source management
- [ ] Video composition
- [ ] Audio mixing
- [ ] Encoder functionality
- [ ] Plugin loading

### Integration Tests
- [ ] Scene switching performance
- [ ] Streaming with various codecs
- [ ] Recording to different formats
- [ ] Audio sync verification
- [ ] Filter chain stability

### Platform Tests
- [ ] Windows game capture (DirectX games)
- [ ] macOS window capture
- [ ] Linux X11/Wayland capture
- [ ] HDMI input (DECKLINK plugin)
- [ ] Audio device enumeration

### Regression Tests
- [ ] No frame drops during 4-hour stream
- [ ] Memory stable after 1 hour (no leaks)
- [ ] Audio doesn't distort at max gain
- [ ] Encoder doesn't crash on resolution change

---

## 🔌 Plugin Development Workflow

### Create New Plugin
```bash
# Copy plugin template
cp -r plugins/template plugins/my-plugin

# Edit my-plugin/CMakeLists.txt
# Edit my-plugin/my-plugin.c

# Register in libobs plugin system
# In your plugin init function:
obs_register_source(&my_source_info);
obs_register_filter(&my_filter_info);
obs_register_output(&my_output_info);
```

### Plugin API Entry Points
```c
// Every plugin must implement:

// Module initialization
bool obs_module_load(void)
void obs_module_unload(void)
const char *obs_module_name(void)
const char *obs_module_version(void)
const char *obs_module_binary_name(void)

// Register with libobs
void obs_register_source(struct obs_source_info *info);
void obs_register_filter(struct obs_source_info *info);
void obs_register_output(struct obs_output_info *info);
void obs_register_encoder(struct obs_encoder_info *info);
void obs_register_service(struct obs_service_info *info);
```

---

## 🚀 Build & Deployment

### Local Build
```bash
# Configure
cmake --preset default -S . -B build

# Build
cmake --build build --parallel $(nproc)

# Run
./build/bin/obs-studio

# Test
ctest --test-dir build -V
```

### CI/CD Pipeline (GitHub Actions)
- Automatic builds on push/PR
- Windows, macOS, Linux matrix
- Code signing (macOS) and notarization
- Artifact upload to releases
- Installer creation (MSI, DMG, AppImage)

### Distribution Packages
```
Windows:
├── obs-studio-x64-installer.msi        # InstallShield installer
├── obs-studio-portable-x64.zip         # Portable executable
└── obs-studio-x86-installer.msi        # 32-bit

macOS:
├── OBS-Studio-32.0.0.dmg               # Disk image
└── OBS-Studio-32.0.0.tar.gz            # Archive

Linux:
├── obs-studio-32.0.0.AppImage          # Universal executable
├── obs-studio_32.0.0_amd64.deb         # Debian/Ubuntu
└── obs-studio-32.0.0.x86_64.rpm        # RedHat/Fedora
```

---

## 🎓 Key Architecture Decisions

### 1. **Plugin System (Loader Pattern)**
   - Plugins are `.dll`/`.so`/`.dylib` files loaded at runtime
   - Each plugin registers sources, filters, encoders, outputs
   - Loose coupling allows extensibility without recompiling core
   - Plugins can crash without taking down application

### 2. **Graphics Abstraction (Strategy Pattern)**
   - Single graphics API is abstracted (OpenGL, D3D11, Metal)
   - Renderer chosen at initialization based on platform
   - All graphics code uses abstraction, not platform-specific calls
   - Easy to add new renderers in future

### 3. **Property System (Reflection Pattern)**
   - Dynamic UI generation from property definitions
   - Sources define properties (int, float, text, bool, color, etc.)
   - Frontend automatically creates UI widgets from properties
   - Serialization to JSON for settings storage

### 4. **Source Hierarchy (Composite Pattern)**
   - Scenes contain SceneItems
   - SceneItems reference Sources
   - Sources can be inputs (camera, image) or compositions
   - Transform hierarchy supports nesting

### 5. **Output Pipeline (Producer-Consumer)**
   - Video/Audio frames pushed into output queue
   - Encoders consume frames and produce encoded packets
   - Muxers consume packets and write to file/network
   - Decouples acquisition from output

---

## 📝 Important Implementation Notes

### Memory Management
```c
// Use OBS memory functions (thread-safe allocators)
void *bmalloc(size_t size);           // Allocate
void *brealloc(void *ptr, size_t size); // Reallocate
char *bstrdup(const char *str);       // String duplicate
void bfree(void *ptr);                // Free

// NEVER use malloc/free directly
```

### Thread Safety
```c
// Use POSIX mutexes for synchronization
pthread_mutex_t mutex;
pthread_mutex_init(&mutex, NULL);
pthread_mutex_lock(&mutex);
// ... critical section ...
pthread_mutex_unlock(&mutex);
pthread_mutex_destroy(&mutex);
```

### Error Handling
```c
// Return error codes, not exceptions
enum obs_error {
  OBS_ERROR_SUCCESS = 0,
  OBS_ERROR_INVALID = -1,
  OBS_ERROR_NOT_FOUND = -2,
  OBS_ERROR_INVALID_OUTPUT = -3,
};

// Or use output parameters
int result = obs_output_start(output);
if (result != 0)
  blog(LOG_ERROR, "Failed to start: %d", result);
```

### Logging
```c
// Use OBS logging system
blog(LOG_DEBUG, "Debug message: %s", value);
blog(LOG_INFO, "Info: %d", count);
blog(LOG_WARNING, "Warning detected");
blog(LOG_ERROR, "Error occurred: %s", reason);
```

---

## 🔐 Security Checklist

- [ ] Validate all file paths (prevent directory traversal)
- [ ] Validate all user inputs (prevent injection)
- [ ] Use HTTPS for streaming service connections
- [ ] Encrypt credentials at rest (OAuth tokens)
- [ ] Code sign all binary distributions
- [ ] Regular security audit of dependencies
- [ ] Keep FFmpeg and other libs updated
- [ ] Sandbox plugin execution (if possible)

---

## 📚 Reference Documentation

### Official Resources
- https://obsproject.com/docs - Plugin API documentation
- https://github.com/obsproject/obs-studio/wiki - Build guides
- https://obsproject.com/forum - Community support

### Third-Party References
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [Qt 6 Documentation](https://doc.qt.io/qt-6/)
- [OpenGL Tutorial](https://learnopengl.com/)
- [Direct3D 11 Tutorial](https://learn.microsoft.com/en-us/windows/win32/direct3d11/)
- [Metal Programming Guide](https://developer.apple.com/metal/)

---

## 🆘 Troubleshooting Common Issues

### Build Issues

**"CMake not found"**
```bash
# Install CMake 3.22+
# macOS: brew install cmake
# Linux: apt-get install cmake
# Windows: Download from cmake.org
```

**"Qt6 not found"**
```bash
# macOS: brew install qt6
# Linux: apt-get install qt6-base-dev
# Windows: Download from qt.io
# Then set: CMAKE_PREFIX_PATH=/path/to/qt6
```

**"FFmpeg not found"**
```bash
# macOS: brew install ffmpeg
# Linux: apt-get install libavcodec-dev libavformat-dev
# Windows: Download obs-deps package
```

### Runtime Issues

**"No encoder found"**
- Check if encoder plugin loaded: obs_encoder_type_exists("h264")
- Verify FFmpeg installed with video encoder support

**"Audio not working"**
- Check audio device enumeration: Windows (WASAPI), Mac (CoreAudio), Linux (PulseAudio)
- Verify audio subsystem initialized: obs_reset_audio()

**"Screen capture not working"**
- Windows: Check Direct3D 11 support
- macOS: Check ScreenCaptureKit available (macOS 13+)
- Linux: Check X11 extensions (XShm, Damage)

---

## ✅ Final Implementation Checklist

### Core Components
- [ ] LibOBS library compiles
- [ ] Graphics subsystem works (can render)
- [ ] Audio subsystem works (can mix)
- [ ] Scene management functional
- [ ] Plugin system loads plugins

### Platforms
- [ ] Windows x64 build
- [ ] Windows x86 build
- [ ] macOS x64 Intel
- [ ] macOS arm64 Apple Silicon
- [ ] Linux x64

### Features
- [ ] RTMP streaming
- [ ] Local recording
- [ ] Scene transitions
- [ ] Audio mixing
- [ ] Source capture (platform-specific)
- [ ] Filters/effects
- [ ] Hotkeys
- [ ] UI themes

### Quality
- [ ] >95% unit test coverage
- [ ] <0.5% frame drops @ 1080p60
- [ ] <500MB memory usage
- [ ] <30% CPU usage
- [ ] All platforms build in CI
- [ ] Code signing (macOS/Windows)
- [ ] Installation packages created

---

## 🎯 Success Criteria Summary

**When you're done:**
- Application launches on Windows, macOS, Linux
- Can create scenes with multiple sources
- Can capture screen/game/window (platform-specific)
- Can stream to RTMP and record locally
- Audio sync within 20ms over 1-hour session
- No memory leaks over extended use
- Plugin system fully functional
- All tests passing
- Installers ready for distribution

---

**Questions during implementation?** Reference sections in prd.md or code examples in ANTIGRAVITY_INSTRUCTIONS.md

**Need platform-specific help?** See the Platform-Specific Implementation Details section (Section 7) in prd.md
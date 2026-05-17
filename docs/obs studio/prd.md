# PRD: OBS Studio - Complete Build & Implementation Specification

## Project Overview

Create a complete, standalone implementation of **OBS Studio** - a professional-grade open-source software for live streaming, screen recording, and video compositing. This is a ground-up implementation that replicates all functionality and architecture from the reference repository (https://github.com/obsproject/obs-studio) without branching or forking.

**Target Release**: Match OBS Studio v32.x+ functionality
**License**: GPL-2.0 (adhere to all licensing requirements)
**Platform Support**: Windows (x64, x86), macOS (Intel x64, Apple Silicon arm64), Linux (x64, Wayland/X11)

---

## 1. Core Architecture & Components

### 1.1 Modular System Design

OBS Studio is built as a modular plugin-based architecture with these core layers:

#### **LibOBS** (Core Library)
- **Purpose**: Core media capture, encoding, and streaming engine
- **Responsibility**: 
  - Video frame processing and compositing
  - Audio mixing and processing
  - Scene management and source handling
  - Plugin system initialization and management
  - Output/streaming abstraction layer
  - Property system for dynamic component configuration
  
#### **Frontend** (UI Layer)
- **Purpose**: Desktop application interface
- **Built with**: Qt 6.x (cross-platform GUI framework)
- **Responsibility**:
  - Scene and source management UI
  - Settings and configuration dialogs
  - Live preview and monitoring
  - Audio/video controls and mixer
  - Output management (streaming, recording, virtual camera)
  - Plugin management interface
  - Docking, layouts, and workspace customization

#### **Graphics Renderers** (Platform-specific)
- **libobs-opengl**: OpenGL renderer for cross-platform video composition
- **libobs-d3d11**: Direct3D 11 renderer for Windows (high performance)
- **libobs-metal**: Metal renderer for macOS (native performance)
- **libobs-winrt**: Windows Runtime components for virtual camera support

#### **Plugin System** (Extensibility)
- **Input Sources**: Scene/game capture, browser sources, image/media sources, audio sources
- **Filters**: Video (color correction, scaling, effects) and audio filters
- **Encoders**: Hardware and software video encoding (H.264, HEVC, VP8/VP9)
- **Audio Encoders**: AAC, Opus, FLAC audio encoding
- **Output Modules**: RTMP streaming, local recording, virtual camera, canvas output

---

## 2. Technology Stack

### 2.1 Core Technologies

| Component | Technology | Version |
|-----------|-----------|---------|
| **Build System** | CMake | 3.22+ (3.24+ for Windows/macOS) |
| **Language** | C (libobs core), C++ (frontend & plugins) | C99/C++17+ |
| **UI Framework** | Qt | 6.5+ |
| **Graphics API** | OpenGL 3.2+, Direct3D 11, Metal | Multi-target |
| **FFmpeg** | Media encoding/decoding | 5.x+ |
| **Configuration** | JSON | Settings storage |

### 2.2 Core Dependencies (Must Implement/Use)

#### **Media Libraries**
- **FFmpeg**: Video/audio encoding-decoding
  - libavformat, libavcodec, libavutil, libswscale, libswresample
- **x264/x265**: H.264/HEVC video encoding (if not using hardware)
- **libopus**: Audio codec support
- **libvorbis**: Vorbis audio codec

#### **Graphics & Display**
- **OpenGL Libraries**: GL, GLX (X11), CGL (macOS), WGL (Windows)
- **Qt Platform Plugins**: XCB (Linux), Cocoa (macOS), Windows (Win32)
- **Vulkan** (optional, for future expansion)

#### **System/Audio Libraries**
- **ALSA/PulseAudio/PipeWire** (Linux audio backends)
- **CoreAudio** (macOS)
- **DirectSound/WASAPI** (Windows)
- **libva** (Video acceleration on Linux)

#### **Utilities**
- **Jansson**: JSON parsing/generation
- **zlib**: Compression
- **curl**: HTTP requests (plugin updates, streaming)
- **mbedTLS**: TLS/SSL for secure connections
- **swig**: Scripting language bindings
- **Lua/Python**: Plugin scripting support

#### **Build & CI Tools**
- **Git** (with submodule support)
- **Ninja**: Build generator (primary for Linux)
- **Visual Studio 2022** (Windows builds)
- **Xcode 14+** (macOS builds)
- **pkg-config**: Dependency detection

---

## 3. Directory Structure & File Organization

```
obs-studio/
├── CMakeLists.txt                    # Root build configuration
├── CMakePresets.json                 # CMake presets for different platforms
├── cmake/                            # CMake module files
│   ├── common/                       # Shared CMake functions
│   ├── windows/                      # Windows-specific build config
│   ├── macos/                        # macOS-specific build config
│   ├── linux/                        # Linux-specific build config
│   └── buildspec.cmake               # Dependency management
├── .github/workflows/                # GitHub Actions CI/CD
│   ├── push.yaml                     # Main build & test workflow
│   ├── macos.yaml                    # macOS-specific builds
│   ├── windows.yaml                  # Windows-specific builds
│   └── linux.yaml                    # Linux-specific builds
├── libobs/                           # Core engine library
│   ├── CMakeLists.txt
│   ├── obs-core.h                    # Main public API
│   ├── obs.c                         # Core initialization
│   ├── graphics/                     # Graphics subsystem
│   │   ├── graphics.h
│   │   ├── matrix4.c / matrix4.h
│   │   ├── vec2.c / vec2.h
│   │   ├── vec3.c / vec3.h
│   │   ├── plane.c / plane.h
│   │   ├── quat.c / quat.h
│   │   └── effect.c / effect.h
│   ├── media-io/                     # Audio/Video format handling
│   │   ├── audio-io.h
│   │   ├── video-io.h
│   │   ├── format-conversion.c
│   │   └── audio-resampler.c
│   ├── util/                         # Utility functions
│   │   ├── base.h                    # Common macros
│   │   ├── darray.h                  # Dynamic array
│   │   ├── dstr.h                    # Dynamic string
│   │   ├── circlebuf.h               # Circular buffer
│   │   ├── config-file.h             # Configuration parsing
│   │   ├── platform.h                # Platform abstractions
│   │   ├── threading.h               # Thread primitives
│   │   ├── c99defs.h                 # C99 compatibility
│   │   └── profiler.h                # Performance profiling
│   ├── obs-internal.h                # Internal API
│   ├── obs-source.h / obs-source.c   # Source base class
│   ├── obs-scene.h / obs-scene.c     # Scene management
│   ├── obs-output.h / obs-output.c   # Output abstraction
│   ├── obs-encoder.h / obs-encoder.c # Encoding interface
│   ├── obs-filter.h / obs-filter.c   # Filter system
│   ├── obs-properties.h / obs-properties.c # Property system
│   ├── obs-data.h / obs-data.c       # Data serialization
│   ├── obs-service.h / obs-service.c # Streaming service configs
│   ├── plugin-support.h / plugin-support.c # Plugin loader
│   └── callback-table.h              # Callback mechanism
├── libobs-opengl/                    # OpenGL renderer
│   ├── CMakeLists.txt
│   ├── gl-subsystem.h
│   ├── gl-shaderparser.c
│   ├── gl-shader.c
│   ├── gl-texture2d.c
│   ├── gl-texturerect.c
│   ├── gl-texturearray.c
│   ├── gl-zstencil.c
│   ├── gl-indexbuffer.c
│   ├── gl-vertexbuffer.c
│   ├── gl-vertexarray.c
│   ├── gl-uniformblock.c
│   ├── gl-helpers.c
│   └── glx-subsystem.c               # X11/GLX specific
├── libobs-d3d11/                     # Direct3D 11 renderer (Windows)
│   ├── CMakeLists.txt
│   ├── d3d11-subsystem.h
│   ├── d3d11-subsystem.c
│   ├── d3d11-shader.c
│   ├── d3d11-texture2d.c
│   ├── d3d11-vertexbuffer.c
│   ├── d3d11-indexbuffer.c
│   ├── d3d11-zstencil.c
│   └── d3d11-swapchain.c
├── libobs-metal/                     # Metal renderer (macOS)
│   ├── CMakeLists.txt
│   ├── metal-subsystem.h
│   ├── metal-subsystem.mm
│   ├── metal-shader.mm
│   ├── metal-texture.mm
│   └── metal-buffer.mm
├── libobs-winrt/                     # Windows Runtime (Virtual Camera)
│   ├── CMakeLists.txt
│   ├── winrt-subsystem.h
│   ├── winrt-virtualcam.cpp
│   └── winrt-helper.cpp
├── plugins/                          # Built-in plugins
│   ├── win-capture/                  # Windows game/window capture
│   │   ├── CMakeLists.txt
│   │   ├── win-capture.c
│   │   ├── plugin-main.c
│   │   └── graphics-hook-d3d11.c
│   ├── linux-capture/                # Linux X11/Wayland capture
│   │   ├── CMakeLists.txt
│   │   ├── linux-capture.c
│   │   ├── xshm-input.c
│   │   └── portal-capture.c
│   ├── mac-capture/                  # macOS screen/window capture
│   │   ├── CMakeLists.txt
│   │   ├── mac-capture.m
│   │   ├── mac-window-capture.m
│   │   └── screencast-picker.m
│   ├── image-source/                 # Image/slideshow source
│   │   ├── CMakeLists.txt
│   │   ├── image-source.c
│   │   └── image-source-plugin.c
│   ├── text-freetype/                # Text rendering
│   │   ├── CMakeLists.txt
│   │   ├── text-freetype.c
│   │   └── font-manager.c
│   ├── browser/                      # Browser source (CEF)
│   │   ├── CMakeLists.txt
│   │   ├── browser-plugin.cpp
│   │   ├── obs-browser-source.cpp
│   │   ├── web-api.cpp
│   │   └── obs-browser-panel.cpp
│   ├── rtmp-services/                # RTMP streaming services
│   │   ├── CMakeLists.txt
│   │   ├── rtmp-services.c
│   │   └── services.json              # Service configurations
│   ├── vlc-video/                    # VLC media source
│   │   ├── CMakeLists.txt
│   │   ├── vlc-video-plugin.c
│   │   └── vlc-source.c
│   ├── decklink/                     # Blackmagic DeckLink support
│   │   ├── CMakeLists.txt
│   │   └── decklink-device.cpp
│   ├── ffmpeg-mux/                   # FFmpeg output
│   │   ├── CMakeLists.txt
│   │   ├── ffmpeg-mux.c
│   │   └── ffmpeg-format.c
│   ├── enc-amf/                      # AMD AMF encoding
│   │   ├── CMakeLists.txt
│   │   └── amf-encoder.cpp
│   ├── obs-x264/                     # x264 H.264 software encoding
│   │   ├── CMakeLists.txt
│   │   └── obs-x264.c
│   ├── obs-ffmpeg/                   # FFmpeg-based encoding
│   │   ├── CMakeLists.txt
│   │   ├── obs-ffmpeg-formats.c
│   │   ├── obs-ffmpeg-video-encoders.c
│   │   ├── obs-ffmpeg-audio-encoders.c
│   │   └── obs-ffmpeg-output.c
│   └── base-filters/                 # Built-in video/audio filters
│       ├── CMakeLists.txt
│       ├── color-grade-filter.c
│       ├── luma-key-filter.c
│       ├── chroma-key-filter.c
│       ├── gain-filter.c
│       ├── limiter-filter.c
│       └── noise-suppress-filter.c
├── frontend/                         # Qt Desktop Application
│   ├── CMakeLists.txt
│   ├── obs-app.h / obs-app.cpp       # Main application class
│   ├── obs-qt-platform.cpp           # Qt platform integration
│   ├── window-main.h / window-main.cpp # Main window
│   ├── window-dock-browser.h / window-dock-browser.cpp # Browser dock
│   ├── window-projector.h / window-projector.cpp # Projector (full-screen preview)
│   ├── window-basic-main.h / window-basic-main.cpp # Main window implementation
│   ├── window-basic-settings.h / window-basic-settings.cpp # Settings dialog
│   ├── window-basic-about.h / window-basic-about.cpp # About dialog
│   ├── window-basic-filters.h / window-basic-filters.cpp # Filter management
│   ├── window-basic-transitions.h / window-basic-transitions.cpp # Transitions
│   ├── window-basic-source-select.h / window-basic-source-select.cpp # Source picker
│   ├── scene-dock.h / scene-dock.cpp # Scene management panel
│   ├── sources-dock.h / sources-dock.cpp # Sources list panel
│   ├── mixer-dock.h / mixer-dock.cpp # Audio mixer panel
│   ├── transition-dock.h / transition-dock.cpp # Transition selector
│   ├── properties-dock.h / properties-dock.cpp # Properties panel
│   ├── audio-mixer.h / audio-mixer.cpp # Audio mixing UI
│   ├── volume-control.h / volume-control.cpp # Volume slider
│   ├── mute-check-box.h / mute-check-box.cpp # Mute toggle
│   ├── double-slider.h / double-slider.cpp # Range slider widget
│   ├── menu-button.h / menu-button.cpp # Custom menu button
│   ├── source-label.h / source-label.cpp # Source display label
│   ├── undo-stack-helper.h / undo-stack-helper.cpp # Undo/redo system
│   ├── qt-display.h / qt-display.cpp # Qt rendering display
│   ├── obs-proxy-style.h / obs-proxy-style.cpp # Custom Qt style
│   ├── vertical-scroll-area.h / vertical-scroll-area.cpp # Custom scroll widget
│   ├── rotated-label.h / rotated-label.cpp # Text rotation widget
│   ├── preview-output.h / preview-output.cpp # Live preview widget
│   ├── record-button.h / record-button.cpp # Record control UI
│   ├── screenshot-obj.h / screenshot-obj.cpp # Screenshot capture
│   ├── url-push-button.h / url-push-button.cpp # URL-aware button
│   ├── visibility-checkbox.h / visibility-checkbox.cpp # Visibility toggle
│   ├── multiview.h / multiview.cpp   # Multi-view monitoring
│   ├── virtualcam-dock.h / virtualcam-dock.cpp # Virtual camera controls
│   ├── scenewidget.h / scenewidget.cpp # Scene preview/editor
│   ├── forms/                        # Qt Designer UI files
│   │   ├── OBSBasicSettings.ui
│   │   ├── OBSBasicFilters.ui
│   │   ├── OBSBasicTransitions.ui
│   │   ├── OBSBasicAdvAudio.ui
│   │   └── OBSBasicAbout.ui
│   ├── obs-frontend-api.h / obs-frontend-api.cpp # Frontend plugin API
│   ├── plugin-support.h / plugin-support.cpp # Frontend plugin loading
│   ├── themes/                       # Qt stylesheets and themes
│   │   ├── dark.qss
│   │   ├── light.qss
│   │   └── system.qss
│   ├── ui/                           # Generated UI headers
│   └── res/                          # Resources (icons, images)
│       ├── images/
│       ├── cursors/
│       └── obs.qrc                   # Qt resource file
├── shared/                           # Shared utilities
│   ├── CMakeLists.txt
│   ├── util-bda.c / util-bda.h       # Windows BDA utilities
│   ├── util-profiler.c / util-profiler.h # Performance profiling
│   ├── util-json.c / util-json.h     # JSON utilities
│   ├── util-deque.c / util-deque.h   # Deque data structure
│   ├── util-windows.c / util-windows.h # Windows-specific utilities
│   ├── util-posix.c / util-posix.h   # POSIX utilities
│   ├── util-osx.c / util-osx.h       # macOS utilities
│   └── util-ioctl.c / util-ioctl.h   # I/O control utilities
├── test/                             # Unit and integration tests
│   ├── CMakeLists.txt
│   ├── test-libobs.c                 # libobs tests
│   ├── test-graphics.c               # Graphics tests
│   ├── test-sources.c                # Source tests
│   └── test-encoders.c               # Encoder tests
├── docs/                             # Documentation
│   ├── sphinx/                       # Sphinx documentation source
│   ├── README.rst                    # Documentation index
│   └── install-instructions.rst      # Build instructions
├── additional_install_files/         # Installation resources
│   ├── windows/                      # Windows installer config
│   ├── macos/                        # macOS bundle config
│   └── linux/                        # Linux package files
├── build-aux/                        # Build auxiliary files
│   ├── OBS-Studio.desktop            # Linux desktop shortcut
│   └── obs-studio.png                # Application icon
├── deps/                             # (Optional) Vendored dependencies
├── .gitignore                        # Git ignore patterns
├── .gitmodules                       # Submodule definitions
├── .editorconfig                     # Editor configuration
├── .clang-format                     # Code formatting rules
├── .swift-format                     # Swift formatting rules
├── COPYING                           # GPL-2.0 License text
├── AUTHORS                           # Contributors list
├── CONTRIBUTING.rst                  # Contribution guidelines
├── COC.rst                           # Code of conduct
├── README.rst                        # Main README
└── INSTALL                           # Installation instructions
```

---

## 4. Core Module Specifications

### 4.1 LibOBS Core (obs-core)

#### **Initialization & Lifecycle**
```c
// Core structures to implement
struct obs_core_video;      // Video subsystem state
struct obs_core_audio;      // Audio subsystem state
struct obs_data;            // Configuration/settings storage
struct obs_property;        // Dynamic property descriptor

// Main API
obs_t *obs_create(const char *module_path, const char *locale);
void obs_destroy(obs_t *obs);
int obs_startup(const char *locale, const char *module_path, obs_data_t *settings);
void obs_shutdown(void);
```

#### **Video System**
- Frame composition using OpenGL/D3D11/Metal
- Resolution and FPS management
- Color space conversions (BT.709, BT.2020, sRGB)
- Frame scaling algorithms (bilinear, lanczos, area)
- Scene composition blending
- Chroma-key and color-correction support

#### **Audio System**
- Multi-track audio mixing
- Sample rate conversion (resampling)
- Audio buffering and timing sync
- Volume normalization and gain control
- Silence detection
- Audio format conversions (mono, stereo, 5.1, 7.1 surround)

#### **Scene Management**
```c
struct obs_scene;           // Scene container
struct obs_scene_item;      // Item within a scene
struct obs_source;          // Media source (camera, image, etc.)

// Scene API
obs_scene_t *obs_scene_create(const char *name);
void obs_scene_release(obs_scene_t *scene);
obs_sceneitem_t *obs_scene_add(obs_scene_t *scene, obs_source_t *source);
void obs_sceneitem_remove(obs_sceneitem_t *item);
```

#### **Source System** (Extensible)
- Source base class with lifecycle hooks
- Input signals (audio/video frame updates)
- Capabilities querying system
- Property system for dynamic UI generation
- Private data storage
- Async operations support

#### **Output System** (Streaming/Recording)
```c
struct obs_output;          // Output destination

// Output API
obs_output_t *obs_output_create(const char *id, const char *name);
int obs_output_start(obs_output_t *output);
void obs_output_stop(obs_output_t *output);
uint64_t obs_output_get_total_frames(obs_output_t *output);
```

#### **Encoder System**
- Hardware encoding support detection
- Bitrate/quality preset management
- Encoder callback integration
- Multi-codec support (H.264, H.265/HEVC, VP8, VP9, AV1)

#### **Filter System** (Chaining)
- Video filters for effects and color grading
- Audio filters for compression, EQ, noise suppression
- Filter ordering and parameter management

#### **Property System** (Dynamic UI)
```c
// Properties allow plugins to define configurable parameters
enum obs_property_type {
    OBS_PROPERTY_INVALID,
    OBS_PROPERTY_BOOL,
    OBS_PROPERTY_INT,
    OBS_PROPERTY_FLOAT,
    OBS_PROPERTY_TEXT,
    OBS_PROPERTY_PATH,
    OBS_PROPERTY_LIST,
    OBS_PROPERTY_COLOR,
    OBS_PROPERTY_BUTTON,
    OBS_PROPERTY_FONT,
    OBS_PROPERTY_EDITABLE_LIST,
    OBS_PROPERTY_FRAME_RATE,
    OBS_PROPERTY_GROUP
};
```

#### **Plugin System**
- Plugin module loading (.dll/.so/.dylib)
- Module initialization functions
- Plugin API versioning
- Dependency resolution
- Module lifecycle management

### 4.2 Graphics Subsystems

#### **OpenGL Renderer (libobs-opengl)**

Core responsibility: Cross-platform rendering using OpenGL 3.2+

**Key Components**:
- Shader parsing and compilation (GLSL support)
- Texture management (2D, Rect, Array types)
- Buffer objects (vertex, index, uniform blocks)
- Framebuffer objects for offscreen rendering
- Vertex array objects
- Effects system with parameter binding

**Platform-specific**:
- GLX initialization (Linux X11)
- WGL initialization (Windows, fallback)
- CGL initialization (macOS, legacy support)

#### **Direct3D 11 Renderer (libobs-d3d11)** [Windows]

Core responsibility: High-performance rendering on Windows

**Key Components**:
- Direct3D 11 device and context management
- HLSL shader compilation
- Texture arrays and structured buffers
- Swap chain management
- Depth/stencil buffer handling
- DXGI integration for WARP rendering support

#### **Metal Renderer (libobs-metal)** [macOS]

Core responsibility: Native macOS rendering

**Key Components**:
- Metal device and command queue
- Metal shader library compilation
- Metal texture and buffer management
- Metal render pipeline states
- Drawable rendering targets

#### **Windows Runtime (libobs-winrt)** [Windows - Virtual Camera]

Core responsibility: System extension-based virtual camera on Windows 11

**Key Components**:
- Windows Runtime COM components
- Virtual camera device registration
- System extension communication
- Media streaming to virtual device

### 4.3 Built-in Plugins

#### **Scene/Window Capture** (win-capture, linux-capture, mac-capture)

**Windows (win-capture)**:
- DXGI desktop duplication
- Direct3D 11 game capture with graphics hooks
- Game optimization detection
- Window capture via HWND enumeration

**Linux (linux-capture)**:
- X11 screenshot extension (XShm)
- Wayland portal support (PipeWire)
- XCB window capture
- Damage event optimization

**macOS (mac-capture)**:
- ScreenCaptureKit framework (macOS 13+)
- Window picker utility
- Display stream configuration

#### **Media Sources**
- **Image Source**: PNG/JPG/BMP/GIF with slideshow
- **Browser Source**: CEF (Chromium Embedded Framework) integration
- **VLC Source**: Network media playback
- **Text Source**: FreeType2 text rendering with font support
- **Color Source**: Solid color with alpha

#### **Encoding Plugins**
- **obs-ffmpeg**: FFmpeg-based H.264/H.265/VP8/VP9 encoding
- **obs-x264**: libx264 H.264 software encoding
- **enc-amf**: AMD AMF hardware encoding (Windows)
- **enc-nvenc**: NVIDIA NVENC hardware encoding (via ffmpeg)
- **enc-qsv**: Intel Quick Sync encoding (via ffmpeg)
- **enc-vt**: VideoToolbox hardware encoding (macOS)

#### **Output Modules**
- **RTMP Output**: Real-time messaging protocol for streaming
- **File Output**: Local recording with format selection
- **Virtual Camera**: System virtual camera device output
- **WhipOutput**: WHIP protocol streaming (emerging standard)

#### **Filter Plugins**
- **Color Correction**: Hue, saturation, lightness, contrast
- **Scaling**: Lanczos, area, bilinear scaling options
- **Sharpening**: Unsharp mask filter
- **Luma Keying**: Green/blue screen removal
- **Chroma Keying**: Color-range based transparency
- **Audio Filters**: Gain, compressor, limiter, noise gate, noise suppression

#### **Service Plugins** (rtmp-services)
- Streaming service configurations (Twitch, YouTube, Facebook)
- RTMP URL templates
- Quality presets per service
- Authentication mechanisms

---

## 5. Feature Specifications

### 5.1 Streaming Capabilities

- **RTMP Output**: Push to streaming platforms
- **WHIP Protocol**: Modern WebRTC-based streaming
- **Custom Output**: Plugin-based extensible output
- **Auto-Reconnect**: Network failure recovery with exponential backoff
- **Bitrate Management**: Adaptive or fixed bitrate
- **Keyframe Insertion**: Regular IDR frame scheduling
- **Authentication**: Username/OAuth token support

### 5.2 Recording Capabilities

- **File Formats**: MKV, MP4, MOV, FLV containers
- **Codec Selection**: Hardware and software encoders
- **Quality Presets**: CRF, bitrate, or lossless modes
- **Replay Buffer**: Circular buffer for clip extraction
- **Split on Max Size**: Auto-segment when file size limit reached
- **Audio Track Selection**: Choose which sources to record
- **Lossless Recording**: Uncompressed or lossless codec support

### 5.3 Scene System

- **Unlimited Scenes**: Create many scenes
- **Scene Collections**: Save/load multiple scene setups
- **Scene Transitions**: Fade, cut, slide, wipe, stinger video
- **Transition Duration**: Configurable transition timing
- **Transition Override**: Per-scene transition settings
- **Hotkeys**: Global shortcuts for scene switching

### 5.4 Audio System

- **Multi-Source Mixing**: Combine multiple audio inputs
- **Per-Source Controls**: Individual gain, pan, filters
- **Audio Meters**: Peak and RMS monitoring
- **Audio Levels**: Configurable input gain and output normalization
- **Downmix**: Stereo to mono conversion
- **Sample Rate**: 44.1 kHz, 48 kHz, 96 kHz support
- **Channel Layouts**: Mono, stereo, 5.1, 7.1 surround

### 5.5 Video System

- **Resolution Support**: Arbitrary resolution up to 4K and beyond
- **Frame Rate**: 24-120 fps support
- **Color Space**: BT.709, BT.2020, sRGB
- **Color Range**: Full/limited range support
- **Upscaling/Downscaling**: Multiple algorithms
- **Chroma Subsampling**: 4:4:4, 4:2:2, 4:2:0 support

### 5.6 UI Features

- **Dockable Interface**: Customizable window layout
- **Themes**: Dark, light, system themes
- **Scene Tree**: Hierarchical scene structure display
- **Source Properties**: Real-time property editing
- **Audio Mixer**: Visual mixing interface
- **Stats**: Performance metrics (CPU, GPU, frame drops)
- **Hotkey System**: Customizable keyboard shortcuts
- **Profiles**: Separate audio/video device configurations

### 5.7 Advanced Features

- **Browser Source**: CEF-based web page embedding
- **NDI Output**: Network Device Interface streaming (plugin)
- **SRTLA (Streaming Reliable Transport Layer)**: Resilient streaming
- **Scripting**: Lua and Python plugin support
- **Lua API**: Custom automation via Lua scripts
- **Undo/Redo**: Full undo history for operations
- **Auto-Config Wizard**: Initial setup assistant

---

## 6. Build & Dependency Management

### 6.1 CMake Build System

#### **Root CMakeLists.txt Structure**

```cmake
# Project declaration
project(obs-studio VERSION 32.0.0 LANGUAGES C CXX)

# Global settings
set(CMAKE_C_STANDARD 99)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Platform detection
if(WIN32)
  # Windows-specific setup
elseif(APPLE)
  # macOS-specific setup
else()
  # Linux/Unix setup
endif()

# Add core targets
add_subdirectory(libobs)
add_subdirectory(libobs-opengl)

# Platform-specific renderers
if(WIN32)
  add_subdirectory(libobs-d3d11)
endif()

if(APPLE)
  add_subdirectory(libobs-metal)
endif()

# Plugins
add_subdirectory(plugins)

# Frontend
add_subdirectory(frontend)
```

#### **Dependency Installation Strategy**

**Windows/macOS**: CMake auto-downloads prebuilt dependency packages
- obs-deps package contains all library binaries
- Set CMAKE_PREFIX_PATH to deps location

**Linux**: System package manager or manual build
- Use pkg-config for library detection
- Fallback to vcpkg for missing packages

#### **Build Presets (CMakePresets.json)**

```json
{
  "version": 3,
  "configurePresets": [
    {
      "name": "default",
      "generator": "Ninja",
      "cacheVariables": {
        "CMAKE_BUILD_TYPE": "Release"
      }
    },
    {
      "name": "windows-vs2022",
      "generator": "Visual Studio 17 2022",
      "cacheVariables": {
        "CMAKE_PREFIX_PATH": "D:/obs-deps"
      }
    },
    {
      "name": "macos",
      "generator": "Xcode",
      "cacheVariables": {
        "CMAKE_OSX_ARCHITECTURES": "x86_64;arm64"
      }
    }
  ],
  "buildPresets": [
    {
      "name": "release",
      "configurePreset": "default",
      "configuration": "Release"
    }
  ]
}
```

### 6.2 Plugin Build System

Each plugin must implement:

```cmake
# plugin/my-plugin/CMakeLists.txt
add_library(my-plugin MODULE)
target_sources(my-plugin PRIVATE my-plugin.c)
target_link_libraries(my-plugin PRIVATE libobs Qt6::Core)
target_compile_definitions(my-plugin PRIVATE PLUGIN_NAME="my-plugin")
install(TARGETS my-plugin LIBRARY DESTINATION ./obs-plugins)
```

### 6.3 Conditional Build Features

| Feature | CMake Variable | Default | Platform |
|---------|---|---|---|
| Browser Source | `ENABLE_BROWSER` | ON | All |
| Virtual Camera | `ENABLE_VIRTUALCAM` | ON | Windows/macOS |
| DECKLINK | `ENABLE_DECKLINK` | OFF | All |
| AJA | `ENABLE_AJA` | OFF | All |
| CEF | `ENABLE_CEF` | OFF | All |
| UI | `DISABLE_UI` | OFF | All |
| Scripting | `ENABLE_SCRIPTING` | ON | All |
| SRTLA | `ENABLE_SRTLA` | OFF | All |
| SVT-AV1 | `ENABLE_SVTAV1` | OFF | All |

---

## 7. Platform-Specific Implementation Details

### 7.1 Windows (x64, x86)

**Build Requirements**:
- Visual Studio 2022 (MSVC v143)
- Windows 10+ SDK
- CMake 3.24+

**Graphics Rendering**:
- Primary: Direct3D 11 (libobs-d3d11)
- Fallback: OpenGL (libobs-opengl)
- Virtual Camera: Windows Runtime system extension

**Source Plugins**:
- Game Capture: DXGI Desktop Duplication + DirectX Hook
- Window Capture: GDI and HWND enumeration
- Audio Input: WASAPI (preferred) + DirectSound (fallback)

**Encoders**:
- NVIDIA NVENC via FFmpeg
- AMD AMF (enc-amf plugin)
- Intel QuickSync via FFmpeg
- x264 (software fallback)

**Installation**:
- MSI installer (WiX Toolset)
- Portable ZIP distribution
- Windows registry for program uninstall
- Shortcut creation in Start Menu

### 7.2 macOS (x64 Intel, arm64 Apple Silicon)

**Build Requirements**:
- Xcode 14.0+ with Command Line Tools
- macOS 11+ deployment target
- CMake 3.24+
- Universal binary support (both architectures)

**Graphics Rendering**:
- Primary: Metal (libobs-metal)
- Fallback: OpenGL

**Source Plugins**:
- Screen/Window Capture: ScreenCaptureKit (13+) or legacy APIs
- Audio Input: CoreAudio
- Browser: CEF with Cocoa integration

**Encoders**:
- VideoToolbox (hardware H.264/H.265)
- libx264 (software)

**Code Signing & Notarization**:
- Developer ID signing
- Hardened runtime support
- Gatekeeper compatibility
- Stapled notarization tickets

**Installation**:
- DMG disk image with drag-to-install
- App bundle structure (.app directory)
- System framework integration

### 7.3 Linux (x64, Wayland/X11)

**Build Requirements**:
- GCC 11+ or Clang 13+
- CMake 3.22+
- Ninja build tool
- pkg-config

**Graphics Rendering**:
- Primary: OpenGL (libobs-opengl with GLX/XCB)
- Optional: Vulkan (future)

**Source Plugins**:
- Screen Capture: X11 XShm or PipeWire
- Window Capture: XCB
- Audio Input: PulseAudio, ALSA, PipeWire
- Browser: CEF with X11 support

**Encoders**:
- libx264 (software)
- libx265 (software)
- VA-API hardware encoding (Intel/AMD)

**Distribution**:
- AppImage standalone executable
- Snap package
- Flatpak
- Native packages (deb, rpm, etc.)
- .desktop file for menu integration

---

## 8. FFmpeg Integration

### 8.1 FFmpeg Libraries (obs-ffmpeg plugin)

**Encoding**:
- Codec parameter mapping
- Quality/bitrate preset selection
- Frame rate and resolution handling
- Hardware encoder detection and fallback
- B-frame and reference frame configuration

**Muxing**:
- Container format selection (MP4, MKV, FLV, MOV)
- Metadata writing
- Chapter marking
- Codec parameter discovery

**Dependencies**:
- libavcodec, libavformat, libavutil
- libswscale (color space conversion)
- libswresample (audio resampling)

### 8.2 Video Codec Support

| Codec | Encoding | Decoding | Hardware |
|-------|----------|----------|----------|
| H.264/AVC | YES | YES | NVENC, QSV, AMF, VTB |
| H.265/HEVC | YES | YES | NVENC, QSV, AMF, VTB |
| VP8 | YES | YES | - |
| VP9 | YES | YES | - |
| AV1 | YES | YES | - |
| ProRes | YES | YES | VTB (Apple) |

### 8.3 Audio Codec Support

| Codec | Encoding | Bitrates | Sample Rates |
|-------|----------|----------|---------|
| AAC | YES | 48-320 kbps | 8-96 kHz |
| Opus | YES | 6-510 kbps | 8-48 kHz |
| FLAC | YES | Lossless | 8-192 kHz |
| Vorbis | YES | 32-500 kbps | 8-192 kHz |
| PCM | YES | Lossless | Any |

---

## 9. Database & Configuration System

### 9.1 Configuration Storage

**Format**: JSON files in user directory
```
~/.config/obs-studio/             [Linux]
~/Library/Application Support/obs-studio/  [macOS]
%APPDATA%/obs-studio/             [Windows]
```

**Key Configuration Files**:
- `global.json`: Global settings (theme, language, hotkeys)
- `basic.ini`: Basic window state, scene collection location
- `profile.ini`: Output profiles (audio devices, bitrates)
- `scenes/[name].json`: Scene source hierarchy
- `streamEncoder.json`: Streaming encoder settings
- `recordEncoder.json`: Recording encoder settings

### 9.2 Profiles System

Each profile stores:
- Audio input/output device selection
- Audio sample rate and channel layout
- Video recording resolution and FPS
- Default source arrangements

---

## 10. Testing & Quality Assurance

### 10.1 Unit Tests (test/)

- **libobs core**: Source, scene, output, encoder functionality
- **Graphics**: Rendering pipeline, color space conversions
- **Audio**: Mixing, resampling, filter chains
- **Plugins**: Plugin loading and API compatibility

### 10.2 Integration Tests

- Scene switching performance
- Output streaming/recording stability
- Audio sync with video
- Encoding with various codecs
- Filter chain performance

### 10.3 Platform-Specific Tests

- Windows game capture with various games
- macOS ScreenCaptureKit functionality
- Linux X11/Wayland capture behavior

### 10.4 Performance Metrics

- Frame drop detection and reporting
- CPU/GPU utilization monitoring
- Memory usage tracking
- Audio underrun detection

---

## 11. Continuous Integration & Build Pipeline

### 11.1 GitHub Actions Workflows (.github/workflows/)

#### **push.yaml** (Main Build Workflow)
- Trigger: Push to master, pull requests
- Jobs:
  - Build Windows (x64, x86)
  - Build macOS (x64, arm64)
  - Build Linux (x64)
  - Run unit tests
  - Create release artifacts

#### **macos.yaml** (macOS-Specific)
- Code signing with developer certificates
- Notarization submission
- DMG creation
- Artifact signing verification

#### **windows.yaml** (Windows-Specific)
- Visual Studio project generation
- Installer creation (MSI/ZIP)
- Dependency verification

#### **linux.yaml** (Linux-Specific)
- AppImage generation
- Snap package creation
- Package verification

### 11.2 Build Artifacts

- Executable binaries (obs-studio)
- Plugin binaries (.dll, .so, .dylib)
- Development headers and libraries
- Installation packages
- Debug symbols

---

## 12. Implementation Priorities & Phases

### **Phase 1: Core Foundation** (Weeks 1-4)
1. Set up CMake build system for all platforms
2. Implement libobs core (obs_t, obs_source_t, obs_scene_t)
3. Implement basic graphics system (OpenGL renderer)
4. Create Qt-based main window
5. Basic scene management UI

**Deliverable**: Functional core library with minimal UI

### **Phase 2: Graphics & Rendering** (Weeks 5-8)
1. Complete OpenGL renderer (textures, effects, shaders)
2. Add D3D11 renderer for Windows
3. Add Metal renderer for macOS
4. Implement video frame composition
5. Color space conversion support

**Deliverable**: Full graphics pipeline on all platforms

### **Phase 3: Audio & Media** (Weeks 9-12)
1. Audio subsystem (mixing, resampling)
2. FFmpeg integration for encoding/decoding
3. Built-in source plugins (image, text, browser)
4. Audio input (WASAPI, CoreAudio, PulseAudio)
5. Audio meters and visualization

**Deliverable**: Full media I/O capabilities

### **Phase 4: Output & Streaming** (Weeks 13-16)
1. RTMP output implementation
2. Local file recording
3. Encoder management (x264, NVENC, etc.)
4. Virtual camera output (Windows/macOS)
5. Streaming service configurations

**Deliverable**: Full streaming and recording functionality

### **Phase 5: Platform-Specific Capture** (Weeks 17-20)
1. Windows game/window capture
2. macOS ScreenCaptureKit integration
3. Linux X11/Wayland capture
4. Scene/window picker UIs

**Deliverable**: Source capture for all platforms

### **Phase 6: Advanced Features & Polish** (Weeks 21-24)
1. Browser source (CEF)
2. Filters and effects system
3. Transitions and animations
4. Hotkey system
5. Theme system
6. Performance optimization

**Deliverable**: Feature-complete OBS Studio equivalent

### **Phase 7: Testing & Release** (Weeks 25-26)
1. Comprehensive testing
2. Bug fixes and performance tuning
3. Documentation and help system
4. Final builds and packaging
5. Release preparation

**Deliverable**: Production-ready OBS Studio

---

## 13. Success Criteria

### **Functional Requirements**
- [ ] All core features work identically to OBS Studio v32.x
- [ ] Streaming to RTMP services (Twitch, YouTube, Facebook)
- [ ] Local recording in multiple formats (MKV, MP4, MOV)
- [ ] Scene switching with transitions
- [ ] Audio mixing with per-source controls
- [ ] Multiple graphics renderer support (OpenGL, D3D11, Metal)
- [ ] Plugin system fully functional
- [ ] Cross-platform deployment (Windows, macOS, Linux)

### **Quality Criteria**
- [ ] <5% frame drop rate during typical streaming scenarios
- [ ] CPU usage <30% for basic streaming setup
- [ ] No memory leaks (verified via Valgrind/ASAN)
- [ ] All unit tests passing (>95% code coverage)
- [ ] Platform-specific tests passing
- [ ] Audio sync drift <20ms over 1-hour stream

### **Documentation Criteria**
- [ ] Complete API documentation (Sphinx)
- [ ] Plugin development guide
- [ ] Build instructions for all platforms
- [ ] User guide with screenshots
- [ ] Contribution guidelines

---

## 14. License & Legal

- **License**: GNU General Public License v2.0+
- **Copyright**: [Your Organization] 2024
- **Attribution**: Original OBS Studio by OBS Project Contributors
- **Compliance**: 
  - Include COPYING file with GPL-2.0 text
  - Maintain AUTHORS file with contributors
  - Provide source code availability
  - Include license in distributions

---

## 15. Git Repository Structure

### **Branches**
- `master`: Main development branch
- `stable`: Release-ready stable branch
- `feature/*`: Feature branches (short-lived)
- `bugfix/*`: Bug fix branches
- `docs/*`: Documentation updates

### **Tags**
- Semantic versioning: `v32.0.0`, `v32.0.1`, etc.
- Release tags include binary artifacts

### **Submodules** (if applicable)
- obs-deps: Prebuilt dependencies repo
- CEF: Chromium Embedded Framework
- VLC: VLC media libraries

---

## 16. Performance Targets

| Metric | Target | Measurement |
|--------|--------|---|
| Stream Start Time | <2 seconds | Time to first frame output |
| Frame Drop Rate | <0.5% | Drops at nominal bitrate |
| Audio Sync Drift | <20ms | Over 1-hour session |
| Memory Usage | <500 MB | Typical streaming session |
| CPU Usage | <30% | Single 1080p60 stream |
| GPU VRAM | <200 MB | Typical scene (10 sources) |

---

## 17. Security Considerations

- **Input Validation**: Validate all user inputs, file paths, URLs
- **Plugin Sandboxing**: Isolate plugin crashes from core
- **HTTPS**: Secure connections for streaming services
- **Credential Storage**: Encrypt sensitive data at rest
- **Code Signing**: Sign all binary distributions
- **Vulnerability Scanning**: Regular security audits
- **Dependency Updates**: Keep FFmpeg and other libs current

---

## 18. Glossary & References

**libobs**: Core OBS library providing all streaming/recording functionality
**Frontend**: Desktop Qt application
**Plugin**: Loadable module adding sources, filters, encoders, outputs
**Source**: Media input (camera, image, window, etc.)
**Scene**: Collection of sources with layout and transitions
**Output**: Destination for media (stream, file, virtual camera)
**Encoder**: Compresses video/audio for transmission or storage
**RTMP**: Real-Time Messaging Protocol for streaming
**CEF**: Chromium Embedded Framework for browser source
**FFmpeg**: Multimedia library for encoding/decoding

**Related Documentation**:
- https://obsproject.com/docs
- https://github.com/obsproject/obs-studio/wiki
- https://obsproject.com/wiki/building-obs-studio

---

## 19. Conclusion

This PRD provides comprehensive specifications for building OBS Studio from scratch using Antigravity. The implementation should faithfully reproduce all functionality of OBS Studio v32.x while maintaining clean architecture, comprehensive testing, and excellent documentation.

**Expected Outcome**: A fully functional, production-ready streaming and recording application with feature parity to OBS Studio, deployable across Windows, macOS, and Linux platforms.
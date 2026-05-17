# OBS Studio — Perfect Replica Build Plan (copy.md)

> **Goal**: Recreate https://github.com/obsproject/obs-studio from scratch, file-for-file, with identical UI, UX, backend engine, rendering pipeline, plugins, features, and build system. No GitHub branching. No forking. Pure Antigravity scratch build.

---

## PART 1: Verified Root Repository Structure

*Confirmed via GitHub API against master branch.*

```
obs-studio/                        ← root
├── .cirrus.yml                    ← FreeBSD CI build
├── .clang-format                  ← C/C++ code style rules
├── .editorconfig                  ← Editor indentation/encoding config
├── .gersemirc                     ← CMake formatter config
├── .git-blame-ignore-revs         ← Blame ignore list for mass reformats
├── .gitattributes                 ← Line ending and merge strategy rules
├── .gitignore                     ← Build artifact exclusions
├── .gitmodules                    ← 3 submodules (browser, websocket, dshow)
├── .mailmap                       ← Contributor name normalization
├── .swift-format                  ← Swift formatting config (macOS)
├── AUTHORS                        ← Full contributor list
├── CMakeLists.txt                 ← Root build entry point
├── CMakePresets.json              ← Platform build presets (9372 bytes)
├── COC.rst                        ← Code of Conduct
├── CODESTYLE.md                   ← Detailed C/C++ coding standards
├── COMMITMENT                     ← OBS project commitment document
├── CONTRIBUTING.md                ← Contribution guidelines
├── COPYING                        ← GPL-2.0 license text
├── INSTALL                        ← Quick install pointer
├── README.rst                     ← Main readme
├── SECURITY.md                    ← Security policy and reporting
├── .github/                       ← GitHub Actions CI/CD workflows
├── additional_install_files/      ← Post-install resource files
├── build-aux/                     ← Auxiliary build helpers
├── cmake/                         ← All custom CMake modules
├── deps/                          ← Vendored dependencies (libdshowcapture)
├── docs/                          ← Sphinx API documentation
├── frontend/                      ← Qt 6 desktop application (UI layer)
├── libobs/                        ← Core C engine
├── libobs-d3d11/                  ← Direct3D 11 renderer (Windows)
├── libobs-metal/                  ← Metal renderer (macOS)
├── libobs-opengl/                 ← OpenGL renderer (cross-platform)
├── libobs-winrt/                  ← WinRT virtual camera helper (Windows)
├── plugins/                       ← All built-in plugin modules
├── shared/                        ← Shared utilities used by plugins+frontend
└── test/                          ← Unit and integration tests
```

---

## PART 2: Submodules (.gitmodules — exact content)

The repo has **3 Git submodules**. We will clone their contents manually into place:

| Submodule Path | Source Repository |
|---|---|
| `deps/libdshowcapture/src` | https://github.com/obsproject/libdshowcapture.git |
| `plugins/obs-browser` | https://github.com/obsproject/obs-browser.git |
| `plugins/obs-websocket` | https://github.com/obsproject/obs-websocket.git |

**Build action**: Manually pull each repo into its path and integrate via their own `CMakeLists.txt`.

---

## PART 3: Exact Plugin Directory List (Confirmed from GitHub API)

All 32 plugin directories under `plugins/`:

```
plugins/
├── CMakeLists.txt                 ← Plugin discovery root
├── aja/                           ← AJA Video capture card support
├── coreaudio-encoder/             ← macOS CoreAudio AAC encoder
├── decklink/                      ← Blackmagic DeckLink capture
├── image-source/                  ← PNG/JPG/GIF/BMP/WebP image source
├── linux-alsa/                    ← Linux ALSA audio input
├── linux-capture/                 ← Linux X11/Wayland screen capture
├── linux-jack/                    ← Linux JACK audio
├── linux-pipewire/                ← Linux PipeWire screen/audio capture
├── linux-pulseaudio/              ← Linux PulseAudio input
├── linux-v4l2/                    ← Linux V4L2 webcam/capture device
├── mac-avcapture/                 ← macOS AVCapture (webcam/device)
├── mac-capture/                   ← macOS ScreenCaptureKit screen capture
├── mac-syphon/                    ← macOS Syphon framework source
├── mac-videotoolbox/              ← macOS VideoToolbox H.264/H.265 encoder
├── mac-virtualcam/                ← macOS virtual camera DAL plugin
├── nv-filters/                    ← NVIDIA RTX AI-based filters
├── obs-browser/                   ← [SUBMODULE] CEF browser source
├── obs-ffmpeg/                    ← FFmpeg-based encode/decode/output
├── obs-filters/                   ← Core video+audio filter suite
├── obs-libfdk/                    ← FDK-AAC encoder plugin
├── obs-nvenc/                     ← NVIDIA NVENC hardware encoder
├── obs-outputs/                   ← RTMP, FTL, and file recording outputs
├── obs-qsv11/                     ← Intel QuickSync encoder
├── obs-text/                      ← Windows GDI+ text source (obs-text)
├── obs-transitions/               ← Scene transition effects
├── obs-vst/                       ← VST2 audio plugin host
├── obs-webrtc/                    ← WHIP/WebRTC output
├── obs-websocket/                 ← [SUBMODULE] WebSocket remote control API
├── obs-x264/                      ← libx264 software H.264 encoder
├── oss-audio/                     ← BSD OSS audio input
├── rtmp-services/                 ← Streaming service definitions (JSON)
├── sndio/                         ← BSD sndio audio input
├── text-freetype2/                ← Cross-platform FreeType2 text source
├── vlc-video/                     ← VLC-based media file source
├── win-capture/                   ← Windows game/window/screen capture
├── win-dshow/                     ← Windows DirectShow device source
└── win-wasapi/                    ← Windows WASAPI audio input/output
```


---

## PART 4: libobs - Core Engine (Every File to Implement)

Written in C99. Everything depends on this. Build it first.

### libobs/ root files:
- CMakeLists.txt
- obs.h - Master public umbrella header
- obs.c - Core startup/shutdown/module loading
- obs-core.h - obs_core internal struct
- obs-internal.h - Internal-only declarations
- obs-source.h / obs-source.c - Source base class (all media inputs)
- obs-source-deinterlace.c - Deinterlace filter logic
- obs-scene.h / obs-scene.c - Scene and SceneItem management
- obs-output.h / obs-output.c - Output abstraction (stream/record)
- obs-encoder.h / obs-encoder.c - Encoder abstraction (video+audio)
- obs-service.h / obs-service.c - Streaming service abstraction
- obs-data.h / obs-data.c - JSON-based settings storage (Jansson)
- obs-properties.h / obs-properties.c - Dynamic plugin UI property system
- obs-missing-files.h / .c - Missing file detection and resolution
- obs-hotkey.h / obs-hotkey.c - Global hotkey registration and dispatch
- obs-hotkeys.h - Hotkey name/ID declarations
- obs-audio-controls.h / .c - Fader and volmeter C API
- obs-compat.h - Backwards compatibility shims
- plugin-support.h / plugin-support.c - .dll/.so/.dylib dynamic loader

### libobs/callback/
- calldata.h / calldata.c - Signal call data payload
- decl.h / decl.c - Signal/proc handler declarations
- proc-handler.h / proc-handler.c - Procedure call system
- signal-handler.h / signal-handler.c - Pub/sub signal bus

### libobs/graphics/
- graphics.h / graphics.c - Graphics abstraction API (gs_* functions)
- graphics-imports.c - Dynamic function import table
- device-exports.h - Backend export declarations
- shader-parser.h / shader-parser.c - OBS .effect file parser
- effect.h / effect.c - Shader effect object management
- effect-parser.h / effect-parser.c - Effect file grammar parser
- matrix4.h / matrix4.c - 4x4 matrix math
- matrix3.h / matrix3.c - 3x3 matrix math
- vec2.h / vec2.c - 2D vector math
- vec3.h / vec3.c - 3D vector math
- vec4.h / vec4.c - 4D vector/color math
- quat.h / quat.c - Quaternion rotation
- plane.h / plane.c - Plane math
- axisang.h / axisang.c - Axis-angle rotation
- half.h / half.c - 16-bit float (half precision)
- image-file.h / image-file.c - PNG/JPG image loading
- math-defs.h - Constants (PI, DEG_TO_RAD, etc)
- bounds.h - Bounding box helpers

### libobs/media-io/
- audio-io.h / audio-io.c - Audio thread, mixing, format handling
- video-io.h / video-io.c - Video thread, frame queue, scaling
- audio-resampler.h / .c - FFmpeg SWR-based resampler wrapper
- format-conversion.h / .c - YUV/RGB pixel format conversion (SSE optimized)
- media-remux.h / media-remux.c - Post-recording MKV to MP4 remux
- video-matrices.c - Color matrix (BT.709 / BT.2020 / sRGB)

### libobs/util/
- base.h / base.c - bmalloc, bfree, blog() logging system
- darray.h - Type-safe dynamic array (macro-based, no malloc)
- dstr.h / dstr.c - Dynamic heap string
- deque.h - Double-ended queue
- circlebuf.h - Lock-free circular buffer
- threading.h / threading-posix.c / threading-windows.c - OS thread API
- platform.h / platform-windows.c / platform-posix.c - OS abstractions
- config-file.h / config-file.c - INI-style config file parser
- text-lookup.h / text-lookup.c - Locale string lookup from .ini files
- lexer.h / lexer.c - Generic C lexer (used by shader/effect parser)
- utf8.h / utf8.c - UTF-8 encoding helpers
- bmem.h / bmem.c - Memory tracking wrappers
- profiler.h / profiler.c - Performance profiler
- task.h / task.c - Async task queue
- pipe.h / pipe-windows.c / pipe-posix.c - OS pipe abstraction
- serializer.h - Binary serialization interface
- array-serializer.h - Array-backed serializer
- file-serializer.h - File-backed serializer
- c99defs.h - C99 compat (bool, inline, restrict)
- sse-intrin.h - SSE intrinsics wrappers
- windows/ComPtr.hpp - RAII COM pointer
- windows/CoTaskMemPtr.hpp - CoTaskMem RAII wrapper
- windows/HRError.hpp - HRESULT error helpers
+-- linux-capture/                 ? Linux X11/Wayland screen capture
+-- linux-jack/                    ? Linux JACK audio
+-- linux-pipewire/                ? Linux PipeWire screen/audio capture
+-- linux-pulseaudio/              ? Linux PulseAudio input
+-- linux-v4l2/                    ? Linux V4L2 webcam/capture device
+-- mac-avcapture/                 ? macOS AVCapture (webcam/device)
+-- mac-capture/                   ? macOS ScreenCaptureKit screen capture
+-- mac-syphon/                    ? macOS Syphon framework source
+-- mac-videotoolbox/              ? macOS VideoToolbox H.264/H.265 encoder
+-- mac-virtualcam/                ? macOS virtual camera DAL plugin
+-- nv-filters/                    ? NVIDIA RTX AI-based filters
+-- obs-browser/                   ? [SUBMODULE] CEF browser source
+-- obs-ffmpeg/                    ? FFmpeg-based encode/decode/output
+-- obs-filters/                   ? Core video+audio filter suite
+-- obs-libfdk/                    ? FDK-AAC encoder plugin
+-- obs-nvenc/                     ? NVIDIA NVENC hardware encoder
+-- obs-outputs/                   ? RTMP, FTL, and file recording outputs
+-- obs-qsv11/                     ? Intel QuickSync encoder
+-- obs-text/                      ? Windows GDI+ text source (obs-text)
+-- obs-transitions/               ? Scene transition effects
+-- obs-vst/                       ? VST2 audio plugin host
+-- obs-webrtc/                    ? WHIP/WebRTC output
+-- obs-websocket/                 ? [SUBMODULE] WebSocket remote control API
+-- obs-x264/                      ? libx264 software H.264 encoder
+-- oss-audio/                     ? BSD OSS audio input
+-- rtmp-services/                 ? Streaming service definitions (JSON)
+-- sndio/                         ? BSD sndio audio input
+-- text-freetype2/                ? Cross-platform FreeType2 text source
+-- vlc-video/                     ? VLC-based media file source
+-- win-capture/                   ? Windows game/window/screen capture
+-- win-dshow/                     ? Windows DirectShow device source
+-- win-wasapi/                    ? Windows WASAPI audio input/output
`

---

## PART 5: Graphics Renderer Backends (File Map)

### libobs-d3d11/ (Windows)
- CMakeLists.txt
- d3d11-subsystem.hpp / d3d11-subsystem.cpp  ? Device, context, swapchain
- d3d11-shader.cpp               ? HLSL compilation
- d3d11-texture2d.cpp            ? 2D texture creation/upload
- d3d11-zstencil.cpp             ? Depth/stencil buffer
- d3d11-vertexbuffer.cpp         ? Vertex buffer
- d3d11-indexbuffer.cpp          ? Index buffer
- d3d11-stagesurf.cpp            ? GPU-to-CPU readback staging
- d3d11-samplerstate.cpp         ? Sampler state
- d3d11-swapchain.cpp            ? DXGI swap chain
- d3d11-rebuild.cpp              ? Device lost recovery

### libobs-opengl/ (Cross-platform)
- CMakeLists.txt
- gl-subsystem.h / gl-subsystem.c ? Device init, draw, state
- gl-shader.c                    ? GLSL compilation
- gl-texture2d.c                 ? 2D texture
- gl-texturerect.c               ? Rectangle texture (macOS)
- gl-texturearray.c              ? Texture array
- gl-zstencil.c                  ? Depth/stencil
- gl-vertexbuffer.c              ? VAO/VBO
- gl-indexbuffer.c               ? IBO
- gl-uniformblock.c              ? UBO
- gl-samplerstate.c              ? Sampler state
- gl-stagesurf.c                 ? PBO-based readback
- gl-helpers.h / gl-helpers.c    ? Error checking
- gl-shaderparser.h / gl-shaderparser.c ? OBS effect to GLSL transpiler
- glx-subsystem.h / glx-subsystem.c ? X11/GLX context (Linux)
- wgl-subsystem.h / wgl-subsystem.c ? WGL context (Windows)

### libobs-metal/ (macOS)
- CMakeLists.txt
- metal-subsystem.h / metal-subsystem.mm ? MTLDevice, command queue
- metal-shader.mm                ? MSL shader compilation
- metal-texture.mm               ? MTLTexture management
- metal-buffer.mm                ? MTLBuffer management
- metal-stagesurf.mm             ? Blit encoder GPU-to-CPU readback

### libobs-winrt/ (Windows Virtual Camera)
- CMakeLists.txt
- winrt-capture.h / winrt-capture.cpp ? WinRT Graphics Capture API
- winrt-capture.mm               ? C++/WinRT wrapper

---

## PART 6: Frontend (Qt 6 Application Structure)

The main UI is built using Qt 6. We will replicate the exact directory and file structure.

### frontend/ (Main Dir)
- CMakeLists.txt
- obs-app.h / obs-app.cpp        ? Application entry and lifecycle
- window-main.h / window-main.cpp ? The main window (Studio Mode, Canvas)
- window-basic-main.h / window-basic-main.cpp ? Basic UI implementation
- window-basic-settings.h / window-basic-settings.cpp ? Settings dialog
- window-basic-status-bar.h / window-basic-status-bar.cpp ? Status bar (CPU, FPS, Bitrate)
- qt-display.h / qt-display.cpp  ? Bridge between libobs and Qt rendering
- preview-output.h / preview-output.cpp ? Live preview widget
- volume-control.h / volume-control.cpp ? Audio faders and meters
- audio-mixer.h / audio-mixer.cpp ? The audio mixer dock
- scene-tree.h / scene-tree.cpp  ? The scenes list dock
- source-tree.h / source-tree.cpp ? The sources list dock
- properties-view.h / properties-view.cpp ? Dynamic settings for sources/plugins
- remote-control.h / remote-control.cpp ? WebSocket integration
- forms/                          ? Qt Designer .ui files
    - OBSBasic.ui
    - OBSBasicSettings.ui
    - OBSBasicFilters.ui
    - OBSBasicAdvAudio.ui
- themes/                         ? QSS Stylesheets
    - Yami.qss
    - Acri.qss
    - Rachni.qss
    - Dark.qss
- res/                            ? Resource files
    - obs.qrc                      ? Qt resource definition
    - icons/                       ? SVG and PNG icons
    - images/                      ? Splash screen, placeholders

---

## PART 7: Build & Distribution (Exact Parity)

- **CMake Configuration**: Replicate the exact variable names (e.g., ENABLE_BROWSER, ENABLE_VIRTUALCAM, DISABLE_UI).
- **Dependency Bundling**: Follow the logic in cmake/bundle to ensure libraries (FFmpeg, Qt) are packaged identically to official releases.
- **Installer Scripts**: 
    - Windows: WiX Toolset scripts in dditional_install_files/windows.
    - macOS: hdiutil logic in dditional_install_files/macos.
    - Linux: cmake/linux for .deb and AppImage generation.

---

## PART 8: Functional Checklist for "Perfect Copy"

1. **Threading Model**: Ensure the separate Video and Audio threads in libobs are implemented exactly to avoid sync drift.
2. **Signal Bus**: Replicate the signal-handler system for all events (start/stop, source rename, etc.).
3. **Property Serialization**: JSON output from obs-data must match official settings files exactly.
4. **Shader Parity**: Every .effect file in the original repo must be ported for identical rendering output.
5. **UI Scaling**: Implement the same high-DPI awareness logic using Qt's scaling system.
6. **Virtual Camera**: The driver installation and system-wide device registration must be 1:1.

---
> [!IMPORTANT]
> This 'copy.md' plan is now complete. It provides a file-by-file roadmap to build an identical twin of the OBS Studio repository. Antigravity will follow this sequence to ensure zero-gap implementation.

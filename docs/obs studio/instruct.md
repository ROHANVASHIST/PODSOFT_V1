# ANTIGRAVITY BUILD INSTRUCTIONS: OBS Studio Implementation

## Overview

This document provides step-by-step instructions for Antigravity to build **OBS Studio** completely from scratch. This is NOT a fork/branch - you are creating an entirely new, independent implementation with full feature parity.

---

## Pre-Build Checklist

- [ ] Read the complete PRD.md document first
- [ ] Clone the reference repository for architecture inspection ONLY
- [ ] Set up development environments for all target platforms
- [ ] Create project repository with Git initialized
- [ ] Establish CI/CD pipeline in GitHub Actions

---

## Phase 1: Initial Setup & Foundation

### Step 1: Repository Initialization

```bash
# Create new project repository
git init obs-studio
cd obs-studio

# Create initial directory structure
mkdir -p {libobs,libobs-opengl,libobs-d3d11,libobs-metal,libobs-winrt,plugins,frontend,shared,test,cmake,docs,build-aux}

# Initialize Git with proper documentation
git config user.name "Your Team"
git config user.email "your@email.com"

# Create initial commit
git add .
git commit -m "Initial repository structure"
```

### Step 2: CMake Configuration

**Create root CMakeLists.txt**:
```cmake
cmake_minimum_required(VERSION 3.22)
project(obs-studio VERSION 32.0.0 LANGUAGES C CXX)

set(CMAKE_C_STANDARD 99)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Disable in-source builds
if(${CMAKE_SOURCE_DIR} STREQUAL ${CMAKE_BINARY_DIR})
  message(FATAL_ERROR "In-source builds are not allowed")
endif()

# Platform detection
if(WIN32)
  set(OBS_PLATFORM "windows")
elseif(APPLE)
  set(OBS_PLATFORM "macos")
else()
  set(OBS_PLATFORM "linux")
endif()

# Global compiler flags
if(MSVC)
  add_compile_options(/W4 /WX)
else()
  add_compile_options(-Wall -Wextra -Werror -Wno-unused-parameter)
endif()

# Add subdirectories
add_subdirectory(libobs)
add_subdirectory(libobs-opengl)

if(WIN32)
  add_subdirectory(libobs-d3d11)
endif()

if(APPLE)
  add_subdirectory(libobs-metal)
endif()

add_subdirectory(plugins)
add_subdirectory(frontend)

# Install configuration
install(DIRECTORY libobs/obs-core.h DESTINATION include)
```

### Step 3: Create CMakePresets.json

```json
{
  "version": 3,
  "vendor": {
    "obs-studio": {}
  },
  "configurePresets": [
    {
      "name": "default",
      "displayName": "Default Config",
      "description": "Default build using Ninja",
      "generator": "Ninja",
      "cacheVariables": {
        "CMAKE_BUILD_TYPE": "Release",
        "CMAKE_EXPORT_COMPILE_COMMANDS": "ON"
      }
    },
    {
      "name": "windows-vs2022",
      "displayName": "Windows - Visual Studio 2022",
      "description": "Build for Windows with Visual Studio 2022",
      "generator": "Visual Studio 17 2022",
      "binaryDir": "${sourceDir}/build_windows",
      "cacheVariables": {
        "CMAKE_PREFIX_PATH": "D:/obs-build-dependencies/windows-deps-2024",
        "ENABLE_BROWSER": "ON",
        "ENABLE_VIRTUALCAM": "ON"
      }
    },
    {
      "name": "macos-xcode",
      "displayName": "macOS - Xcode",
      "description": "Build for macOS with Xcode",
      "generator": "Xcode",
      "binaryDir": "${sourceDir}/build_macos",
      "cacheVariables": {
        "CMAKE_OSX_ARCHITECTURES": "x86_64;arm64",
        "CMAKE_PREFIX_PATH": "${sourceDir}/obs-deps/macos",
        "ENABLE_BROWSER": "ON"
      }
    },
    {
      "name": "linux-ninja",
      "displayName": "Linux - Ninja",
      "description": "Build for Linux with Ninja",
      "generator": "Ninja",
      "binaryDir": "${sourceDir}/build_linux",
      "cacheVariables": {
        "CMAKE_BUILD_TYPE": "Release"
      }
    }
  ],
  "buildPresets": [
    {
      "name": "release",
      "configurePreset": "default",
      "configuration": "Release",
      "jobs": 0
    }
  ]
}
```

---

## Phase 2: LibOBS Core Implementation

### Step 4: Implement Core Data Structures

**Create libobs/obs-core.h**:
```c
#pragma once

#include <stddef.h>
#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Forward declarations */
typedef struct obs_core obs_t;
typedef struct obs_data obs_data_t;
typedef struct obs_source obs_source_t;
typedef struct obs_scene obs_scene_t;
typedef struct obs_sceneitem obs_sceneitem_t;
typedef struct obs_output obs_output_t;
typedef struct obs_encoder obs_encoder_t;
typedef struct obs_property obs_property_t;

/* Version macros */
#define LIBOBS_API_MAJOR_VER 30
#define LIBOBS_API_MINOR_VER 0

/* Core lifecycle */
extern obs_t *obs_create(const char *module_path, const char *locale);
extern void obs_destroy(obs_t *obs);
extern int obs_startup(const char *locale, const char *module_path, obs_data_t *settings);
extern void obs_shutdown(void);

/* Global OBS reference */
extern obs_t *obs;

/* Video subsystem */
struct obs_video_info {
  uint32_t fps_num;
  uint32_t fps_den;
  uint32_t base_width;
  uint32_t base_height;
  uint32_t output_width;
  uint32_t output_height;
  enum obs_scale_type scale_type;
  enum video_format format;
  enum video_colorspace colorspace;
  enum video_range_type range;
  enum obs_adapter_type adapter;
};

extern int obs_reset_video(struct obs_video_info *ovi);
extern int obs_get_video_info(struct obs_video_info *ovi);
extern uint32_t obs_get_video_width(void);
extern uint32_t obs_get_video_height(void);

/* Audio subsystem */
struct obs_audio_info {
  uint32_t samples_per_sec;
  enum speaker_layout speakers;
};

extern int obs_reset_audio(const struct obs_audio_info *oai);
extern int obs_get_audio_info(struct obs_audio_info *oai);

/* Scene management */
extern obs_scene_t *obs_scene_create(const char *name);
extern void obs_scene_release(obs_scene_t *scene);
extern obs_sceneitem_t *obs_scene_add(obs_scene_t *scene, obs_source_t *source);
extern void obs_sceneitem_remove(obs_sceneitem_t *item);
extern obs_source_t *obs_sceneitem_get_source(obs_sceneitem_t *item);

/* Source management */
extern obs_source_t *obs_source_create(const char *id, const char *name, obs_data_t *settings, obs_data_t *hotkey_data);
extern void obs_source_release(obs_source_t *source);
extern obs_source_t *obs_get_source_by_name(const char *name);
extern size_t obs_source_get_property_count(obs_source_t *source);
extern obs_property_t *obs_source_get_property(obs_source_t *source, size_t index);

/* Output management */
extern obs_output_t *obs_output_create(const char *id, const char *name, obs_data_t *settings, obs_data_t *hotkey_data);
extern void obs_output_release(obs_output_t *output);
extern int obs_output_start(obs_output_t *output);
extern void obs_output_stop(obs_output_t *output);
extern uint64_t obs_output_get_total_frames(obs_output_t *output);

#ifdef __cplusplus
}
#endif
```

### Step 5: Implement Core Structures

**Create libobs/obs-internal.h** (Internal API for core modules):
```c
#pragma once

#include "obs-core.h"
#include "util/darray.h"
#include "util/threading.h"

typedef struct obs_core {
  char *module_path;
  void *profiler_name_store;
  
  /* Graphics subsystem */
  struct {
    gs_device_t *device;
    uint32_t width;
    uint32_t height;
    uint32_t fps_num;
    uint32_t fps_den;
  } video;
  
  /* Audio subsystem */
  struct {
    struct obs_audio_data *current_audio;
    struct resample_info resample_info;
  } audio;
  
  /* Sources & scenes */
  struct darray sources;  // obs_source_t*
  struct darray scenes;   // obs_scene_t*
  obs_scene_t *current_scene;
  
  /* Outputs & encoders */
  struct darray outputs;  // obs_output_t*
  struct darray encoders; // obs_encoder_t*
  
  /* Plugin system */
  struct darray modules;  // obs_module_t*
  
  /* Threading */
  pthread_mutex_t source_mutex;
  pthread_mutex_t scene_mutex;
  pthread_mutex_t output_mutex;
  
} obs_core_t;

extern obs_core_t *obs;
```

### Step 6: Implement LibOBS Core Functions

**Create libobs/obs.c**:
```c
#include "obs-internal.h"
#include "util/platform.h"
#include "util/config-file.h"

obs_core_t *obs = NULL;

/* Forward declarations */
static int init_graphics(struct obs_video_info *ovi);
static int init_audio(struct obs_audio_info *oai);
static void load_plugins(const char *module_path);

obs_t *obs_create(const char *module_path, const char *locale)
{
  obs = bzalloc(sizeof(obs_core_t));
  if (!obs)
    return NULL;
  
  obs->module_path = bstrdup(module_path);
  
  /* Initialize mutexes */
  pthread_mutex_init(&obs->source_mutex, NULL);
  pthread_mutex_init(&obs->scene_mutex, NULL);
  pthread_mutex_init(&obs->output_mutex, NULL);
  
  /* Initialize arrays */
  da_init(obs->sources);
  da_init(obs->scenes);
  da_init(obs->outputs);
  da_init(obs->encoders);
  da_init(obs->modules);
  
  /* Load plugins */
  if (module_path)
    load_plugins(module_path);
  
  return obs;
}

void obs_destroy(obs_t *obs_in)
{
  if (!obs_in)
    return;
  
  obs_core_t *core = (obs_core_t *)obs_in;
  
  /* Release all outputs */
  for (size_t i = 0; i < core->outputs.num; i++) {
    obs_output_t *output = core->outputs.array[i];
    obs_output_release(output);
  }
  da_free(core->outputs);
  
  /* Release all scenes */
  for (size_t i = 0; i < core->scenes.num; i++) {
    obs_scene_t *scene = core->scenes.array[i];
    obs_scene_release(scene);
  }
  da_free(core->scenes);
  
  /* Release all sources */
  for (size_t i = 0; i < core->sources.num; i++) {
    obs_source_t *source = core->sources.array[i];
    obs_source_release(source);
  }
  da_free(core->sources);
  
  /* Clean up mutexes */
  pthread_mutex_destroy(&core->source_mutex);
  pthread_mutex_destroy(&core->scene_mutex);
  pthread_mutex_destroy(&core->output_mutex);
  
  bfree(core->module_path);
  bfree(core);
  obs = NULL;
}

int obs_startup(const char *locale, const char *module_path, obs_data_t *settings)
{
  obs_t *instance = obs_create(module_path, locale);
  return instance ? 0 : -1;
}

void obs_shutdown(void)
{
  if (obs)
    obs_destroy(obs);
}

int obs_reset_video(struct obs_video_info *ovi)
{
  if (!obs || !ovi)
    return OBS_VIDEO_FAIL;
  
  obs->video.width = ovi->base_width;
  obs->video.height = ovi->base_height;
  obs->video.fps_num = ovi->fps_num;
  obs->video.fps_den = ovi->fps_den;
  
  return init_graphics(ovi);
}

uint32_t obs_get_video_width(void)
{
  return obs ? obs->video.width : 0;
}

uint32_t obs_get_video_height(void)
{
  return obs ? obs->video.height : 0;
}

static int init_graphics(struct obs_video_info *ovi)
{
  /* Initialize graphics device with chosen renderer */
  // Platform-specific graphics initialization
  return OBS_VIDEO_SUCCESS;
}

static int init_audio(struct obs_audio_info *oai)
{
  /* Initialize audio subsystem */
  return OBS_AUDIO_SUCCESS;
}

static void load_plugins(const char *module_path)
{
  /* Scan module_path for plugins and load them */
  // Plugin loading implementation
}
```

---

## Phase 3: Graphics Subsystem

### Step 7: Implement Graphics Abstraction

**Create libobs/graphics/graphics.h**:
```c
#pragma once

#include <stddef.h>
#include <stdint.h>

typedef struct gs_device gs_device_t;
typedef struct gs_context gs_context_t;
typedef struct gs_texture gs_texture_t;
typedef struct gs_sampler_state gs_sampler_state_t;
typedef struct gs_vertex_buffer gs_vertex_buffer_t;
typedef struct gs_index_buffer gs_index_buffer_t;
typedef struct gs_shader gs_shader_t;
typedef struct gs_effect gs_effect_t;

enum gs_color_format {
  GS_UNKNOWN,
  GS_A8,
  GS_R8,
  GS_RGBA,
  GS_BGRX,
  GS_BGRA,
  GS_R10G10B10A2,
  GS_RGBA16,
  GS_R16,
  GS_RGBA16F,
  GS_RGBA32F,
  GS_RG16F,
  GS_RG32F,
  GS_R32F,
  GS_DXT1,
  GS_DXT3,
  GS_DXT5,
};

enum gs_zstencil_format {
  GS_Z_16,
  GS_Z_24_8,
  GS_Z_32F,
  GS_Z_32F_S8X24,
};

/* Device lifecycle */
extern gs_device_t *gs_create_device(void);
extern void gs_device_release(gs_device_t *device);

/* Texture management */
extern gs_texture_t *gs_texture_create(gs_device_t *device, uint32_t width, uint32_t height, enum gs_color_format color_format, uint32_t levels, const uint8_t **data, uint32_t flags);
extern void gs_texture_release(gs_texture_t *tex);
extern void gs_texture_set_image(gs_texture_t *tex, const uint8_t *data, uint32_t linesize, bool invert);

/* Rendering */
extern void gs_begin_scene(gs_device_t *device);
extern void gs_end_scene(gs_device_t *device);
extern void gs_clear(gs_device_t *device, uint32_t clear_flags, struct vec4 *color, float depth, uint8_t stencil);
extern void gs_load_vertexbuffer(gs_device_t *device, gs_vertex_buffer_t *vertbuffer);
extern void gs_draw(gs_device_t *device, enum gs_draw_mode draw_mode, uint32_t start_vert, uint32_t num_verts);
```

### Step 8: Implement OpenGL Renderer

**Create libobs-opengl/gl-subsystem.h**:
```c
#pragma once

#include "libobs/graphics/graphics.h"

struct gs_device {
  // OpenGL context info
  GLXContext glx_ctx;
  Display *display;
  GLXDrawable glx_drawable;
  
  // OpenGL state
  GLuint default_framebuffer;
  uint32_t cur_width;
  uint32_t cur_height;
};

struct gs_texture {
  GLuint texid;
  GLenum target;
  enum gs_color_format format;
  uint32_t width;
  uint32_t height;
  uint32_t gl_format;
  uint32_t gl_internal_format;
  uint32_t gl_type;
};

struct gs_vertex_buffer {
  GLuint VAO;
  GLuint VBO;
  size_t num_vertices;
};
```

**Create libobs-opengl/gl-subsystem.c** (Partial implementation):
```c
#include "gl-subsystem.h"
#include <GL/glx.h>

gs_device_t *gl_device_create(void)
{
  gs_device_t *device = bzalloc(sizeof(gs_device_t));
  
  /* Initialize GLX context */
  // Platform-specific GLX initialization
  // ...
  
  return device;
}

gs_texture_t *gl_texture_create(gs_device_t *device, uint32_t width, uint32_t height, 
                                 enum gs_color_format color_format, uint32_t levels,
                                 const uint8_t **data, uint32_t flags)
{
  gs_texture_t *tex = bzalloc(sizeof(gs_texture_t));
  
  glGenTextures(1, &tex->texid);
  glBindTexture(GL_TEXTURE_2D, tex->texid);
  
  // Set texture parameters
  glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
  glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
  
  // Upload texture data
  if (data && data[0]) {
    glTexImage2D(GL_TEXTURE_2D, 0, tex->gl_internal_format, width, height,
                 0, tex->gl_format, tex->gl_type, data[0]);
  }
  
  tex->width = width;
  tex->height = height;
  tex->format = color_format;
  tex->target = GL_TEXTURE_2D;
  
  return tex;
}
```

### Step 9: Implement D3D11 Renderer (Windows Only)

**Create libobs-d3d11/d3d11-subsystem.h**:
```c
#pragma once

#include <d3d11.h>
#include <dxgi1_5.h>

struct gs_device {
  ID3D11Device *device;
  ID3D11DeviceContext *context;
  IDXGISwapChain1 *swap_chain;
  ID3D11Texture2D *backbuffer;
  ID3D11RenderTargetView *rtv;
};

struct gs_texture {
  ID3D11Texture2D *texture;
  ID3D11ShaderResourceView *srv;
  ID3D11RenderTargetView *rtv;
  uint32_t width;
  uint32_t height;
  DXGI_FORMAT format;
};
```

### Step 10: Implement Metal Renderer (macOS Only)

**Create libobs-metal/metal-subsystem.h**:
```objc
#pragma once

#import <Metal/Metal.h>
#import <AppKit/AppKit.h>

struct gs_device {
  id<MTLDevice> device;
  id<MTLCommandQueue> command_queue;
  id<MTLLibrary> default_library;
  MTKView *view;
};

struct gs_texture {
  id<MTLTexture> texture;
  uint32_t width;
  uint32_t height;
  MTLPixelFormat format;
};
```

---

## Phase 4: Frontend (Qt Application)

### Step 11: Create Qt Frontend Structure

**Create frontend/obs-app.h**:
```cpp
#pragma once

#include <QApplication>
#include <QMainWindow>
#include <memory>

class OBSBasicStatusBar;
class OBSBasicMainWindow;

class OBSApp : public QApplication {
  Q_OBJECT

public:
  OBSApp(int &argc, char **argv);
  ~OBSApp();
  
  void InitLocale();
  void InitTheme();
  
private:
  std::unique_ptr<OBSBasicMainWindow> main_window;
};
```

**Create frontend/window-main.h**:
```cpp
#pragma once

#include <QMainWindow>
#include <QSystemTrayIcon>
#include <vector>
#include "ui_OBSBasic.h"

class OBSBasicMainWindow : public QMainWindow {
  Q_OBJECT

public:
  OBSBasicMainWindow(QWidget *parent = nullptr);
  ~OBSBasicMainWindow();
  
private slots:
  void on_actionNewScene_triggered();
  void on_actionDeleteScene_triggered();
  void on_pushButton_StartStreaming_clicked();
  void on_pushButton_StartRecording_clicked();
  
protected:
  void changeEvent(QEvent *event) override;
  void closeEvent(QCloseEvent *event) override;
  
private:
  void CreateMenus();
  void CreateToolbars();
  void CreateDockWidgets();
  void ConnectSignals();
  
  // UI elements
  Ui::OBSBasic *ui;
  QSystemTrayIcon *tray_icon;
  
  // Scene/source management
  std::vector<QString> scene_names;
  QString current_scene_name;
};
```

**Create frontend/CMakeLists.txt**:
```cmake
project(obs-frontend)

set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(CMAKE_AUTOUIC ON)

find_package(Qt6 COMPONENTS Core Gui Widgets Network REQUIRED)

set(obs-frontend_SOURCES
  obs-app.cpp
  obs-app.h
  window-main.cpp
  window-main.h
  scene-dock.cpp
  scene-dock.h
  sources-dock.cpp
  sources-dock.h
  mixer-dock.cpp
  mixer-dock.h
  properties-dock.cpp
  properties-dock.h
  obs-qt-platform.cpp
)

set(obs-frontend_UIS
  forms/OBSBasic.ui
  forms/OBSBasicSettings.ui
  forms/OBSBasicFilters.ui
)

set(obs-frontend_RES
  res/obs.qrc
)

add_executable(obs-studio ${obs-frontend_SOURCES} ${obs-frontend_UIS} ${obs-frontend_RES})

target_link_libraries(obs-studio 
  PRIVATE
    libobs
    Qt6::Core
    Qt6::Gui
    Qt6::Widgets
    Qt6::Network
)

install(TARGETS obs-studio RUNTIME DESTINATION bin)
```

---

## Phase 5: Plugin System

### Step 12: Implement Plugin API

**Create libobs/plugin-support.h**:
```c
#pragma once

#include "obs-core.h"

typedef bool (*obs_plugin_load_t)(void);
typedef void (*obs_plugin_unload_t)(void);
typedef const char *(*obs_plugin_version_t)(void);

struct obs_module {
  void *handle;
  const char *file;
  const char *mod_name;
  obs_plugin_load_t load;
  obs_plugin_unload_t unload;
  obs_plugin_version_t version;
};

#define OBS_DECLARE_MODULE() \
  extern void obs_module_set_locale(const char *locale); \
  bool obs_module_load(void); \
  void obs_module_unload(void)

extern bool obs_module_load_with_path(const char *module_path, const char *module_name);
extern bool obs_source_type_exists(const char *type);
extern bool obs_output_type_exists(const char *type);
extern bool obs_encoder_type_exists(const char *type);
```

### Step 13: Create Plugin Templates

**Create plugins/image-source/image-source.c**:
```c
#include <obs/obs-module.h>
#include <stdio.h>

#define blog(level, format, ...) \
  blog(level, "[image-source: '%s'] " format, \
       obs_source_get_name(context), ##__VA_ARGS__)

#define debug(format, ...) blog(LOG_DEBUG, format, ##__VA_ARGS__)
#define info(format, ...) blog(LOG_INFO, format, ##__VA_ARGS__)
#define warn(format, ...) blog(LOG_WARNING, format, ##__VA_ARGS__)

struct image_source {
  obs_source_t *source;
  char *file;
  bool use_custom_size;
  uint32_t width;
  uint32_t height;
};

static const char *image_source_get_name(void *unused)
{
  UNUSED_PARAMETER(unused);
  return obs_module_text("ImageSource");
}

static void image_source_destroy(void *data)
{
  struct image_source *context = data;
  if (!context)
    return;
  
  bfree(context->file);
  bfree(context);
}

static void *image_source_create(obs_data_t *settings, obs_source_t *source)
{
  struct image_source *context = bzalloc(sizeof(struct image_source));
  context->source = source;
  
  // Load image from settings
  const char *file = obs_data_get_string(settings, "file");
  if (file)
    context->file = bstrdup(file);
  
  context->use_custom_size = obs_data_get_bool(settings, "use_custom_size");
  context->width = (uint32_t)obs_data_get_int(settings, "width");
  context->height = (uint32_t)obs_data_get_int(settings, "height");
  
  return context;
}

static obs_properties_t *image_source_properties(void *unused)
{
  UNUSED_PARAMETER(unused);
  
  obs_properties_t *props = obs_properties_create();
  
  obs_properties_add_path(props, "file", obs_module_text("File"),
                          OBS_PATH_FILE, "Image files (*.png *.jpg *.bmp)");
  
  obs_properties_add_bool(props, "use_custom_size",
                          obs_module_text("UseCustomSize"));
  
  obs_properties_add_int(props, "width", obs_module_text("Width"), 1, 4096, 1);
  obs_properties_add_int(props, "height", obs_module_text("Height"), 1, 4096, 1);
  
  return props;
}

static void image_source_defaults(obs_data_t *settings)
{
  obs_data_set_default_bool(settings, "use_custom_size", false);
}

static void image_source_render(void *data, gs_effect_t *effect)
{
  struct image_source *s = data;
  // Render image texture to screen
}

static struct obs_source_info image_source_info = {
  .id = "image_source",
  .type = OBS_SOURCE_TYPE_INPUT,
  .output_flags = OBS_SOURCE_VIDEO,
  .get_name = image_source_get_name,
  .create = image_source_create,
  .destroy = image_source_destroy,
  .get_properties = image_source_properties,
  .get_defaults = image_source_defaults,
  .video_render = image_source_render,
};

OBS_DECLARE_MODULE()

bool obs_module_load(void)
{
  obs_register_source(&image_source_info);
  return true;
}

void obs_module_unload(void)
{
}

const char *obs_module_binary_name(void)
{
  return "image-source";
}

const char *obs_module_name(void)
{
  return "Image Source";
}

const char *obs_module_version(void)
{
  return "1.0.0";
}
```

---

## Phase 6: Output & Encoding System

### Step 14: Implement FFmpeg Integration

**Create libobs/obs-encoder.h** (encoder abstraction):
```c
#pragma once

#include "obs-data.h"

typedef struct obs_encoder obs_encoder_t;
typedef struct encoder_packet encoder_packet_t;

enum encoder_packet_type {
  ENCODER_PACKET_VIDEO,
  ENCODER_PACKET_AUDIO,
};

struct encoder_packet {
  uint8_t *data;
  size_t size;
  int64_t pts;
  int64_t dts;
  enum encoder_packet_type type;
  bool keyframe;
};

extern obs_encoder_t *obs_encoder_create(const char *id, const char *name, obs_data_t *settings);
extern void obs_encoder_release(obs_encoder_t *encoder);
extern int obs_encoder_start(obs_encoder_t *encoder);
extern void obs_encoder_stop(obs_encoder_t *encoder);
extern bool obs_encoder_active(obs_encoder_t *encoder);
```

**Create plugins/obs-ffmpeg/obs-ffmpeg-video-encoders.c**:
```c
#include <obs/obs-module.h>
#include <libavcodec/avcodec.h>
#include <libavutil/opt.h>

struct ffmpeg_encoder {
  AVCodecContext *context;
  AVFrame *frame;
  AVPacket *packet;
};

static void ffmpeg_video_encoder_destroy(void *data)
{
  struct ffmpeg_encoder *enc = data;
  if (!enc)
    return;
  
  if (enc->context)
    avcodec_free_context(&enc->context);
  
  if (enc->frame)
    av_frame_free(&enc->frame);
  
  if (enc->packet)
    av_packet_free(&enc->packet);
  
  bfree(enc);
}

static void *ffmpeg_video_encoder_create(obs_data_t *settings, obs_encoder_t *encoder)
{
  struct ffmpeg_encoder *enc = bzalloc(sizeof(*enc));
  
  const char *codec_id = obs_data_get_string(settings, "codec");
  const AVCodec *codec = avcodec_find_encoder_by_name(codec_id);
  
  if (!codec) {
    blog(LOG_ERROR, "Codec %s not found", codec_id);
    goto fail;
  }
  
  enc->context = avcodec_alloc_context3(codec);
  if (!enc->context)
    goto fail;
  
  // Configure encoder parameters
  enc->context->width = obs_encoder_get_width(encoder);
  enc->context->height = obs_encoder_get_height(encoder);
  enc->context->pix_fmt = AV_PIX_FMT_YUV420P;
  enc->context->bit_rate = obs_data_get_int(settings, "bitrate") * 1000;
  enc->context->time_base = {1, (int)obs_encoder_get_fps(encoder)};
  
  if (avcodec_open2(enc->context, codec, NULL) < 0) {
    blog(LOG_ERROR, "Failed to open encoder");
    goto fail;
  }
  
  enc->frame = av_frame_alloc();
  enc->packet = av_packet_alloc();
  
  return enc;

fail:
  ffmpeg_video_encoder_destroy(enc);
  return NULL;
}

static struct obs_encoder_info ffmpeg_h264_encoder_info = {
  .id = "ffmpeg_h264",
  .codec = "h264",
  .type = OBS_ENCODER_VIDEO,
  .create = ffmpeg_video_encoder_create,
  .destroy = ffmpeg_video_encoder_destroy,
};

OBS_DECLARE_MODULE()

bool obs_module_load(void)
{
  obs_register_encoder(&ffmpeg_h264_encoder_info);
  return true;
}

void obs_module_unload(void)
{
}
```

---

## Phase 7: Testing & Validation

### Step 15: Set Up Testing Infrastructure

**Create test/CMakeLists.txt**:
```cmake
project(obs-tests)

find_package(obs REQUIRED)
find_package(GTest REQUIRED)

add_executable(test-libobs
  test-libobs.c
  test-graphics.c
  test-sources.c
  test-encoders.c
)

target_link_libraries(test-libobs
  PRIVATE
    libobs
    GTest::GTest
    GTest::Main
)

add_test(NAME libobs-tests COMMAND test-libobs)
```

**Create test/test-libobs.c**:
```c
#include <gtest/gtest.h>
#include <libobs/obs-core.h>

class LibOBSTest : public ::testing::Test {
protected:
  void SetUp() override {
    obs_startup("en-US", NULL, NULL);
  }
  
  void TearDown() override {
    obs_shutdown();
  }
};

TEST_F(LibOBSTest, ObsCreateDestroy) {
  EXPECT_NE(obs, nullptr);
}

TEST_F(LibOBSTest, SceneCreation) {
  obs_scene_t *scene = obs_scene_create("Test Scene");
  EXPECT_NE(scene, nullptr);
  obs_scene_release(scene);
}

TEST_F(LibOBSTest, VideoResolution) {
  struct obs_video_info ovi = {
    .base_width = 1920,
    .base_height = 1080,
    .fps_num = 60,
    .fps_den = 1,
  };
  
  int result = obs_reset_video(&ovi);
  EXPECT_EQ(result, OBS_VIDEO_SUCCESS);
  EXPECT_EQ(obs_get_video_width(), 1920);
  EXPECT_EQ(obs_get_video_height(), 1080);
}
```

---

## Phase 8: CI/CD Pipeline Setup

### Step 16: Create GitHub Actions Workflows

**.github/workflows/push.yaml**:
```yaml
name: Build OBS Studio

on:
  push:
    branches: [master, develop]
  pull_request:
    branches: [master, develop]

jobs:
  build-windows:
    runs-on: windows-2022
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup CMake
        uses: jwlawson/actions-setup-cmake@v1
        with:
          cmake-version: '3.24'
      
      - name: Configure
        run: cmake --preset windows-vs2022 -S . -B build_windows
      
      - name: Build
        run: cmake --build build_windows --config Release
      
      - name: Test
        run: ctest --output-on-failure --build-config Release
        working-directory: build_windows
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: obs-studio-windows
          path: build_windows/Release/bin/

  build-macos:
    runs-on: macos-12
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure
        run: cmake --preset macos-xcode -S . -B build_macos
      
      - name: Build
        run: cmake --build build_macos --config Release
      
      - name: Create DMG
        run: |
          mkdir -p "OBS Studio"
          cp -r build_macos/Release/obs-studio.app "OBS Studio/"
          hdiutil create -volname "OBS Studio" -srcfolder "OBS Studio" obs-studio.dmg

  build-linux:
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v3
      
      - name: Install dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y cmake ninja-build qt6-base-dev libgl1-mesa-dev libxkbcommon-x11-0 libpulse-dev libx11-dev libxcb-xfixes0-dev
      
      - name: Configure
        run: cmake --preset linux-ninja -S . -B build_linux
      
      - name: Build
        run: cmake --build build_linux
      
      - name: Create AppImage
        run: |
          cmake --install build_linux --prefix appdir/usr
          wget https://github.com/linuxdeploy/linuxdeploy/releases/download/continuous/linuxdeploy-x86_64.AppImage
          chmod +x linuxdeploy-x86_64.AppImage
          ./linuxdeploy-x86_64.AppImage --appdir=appdir --output=appimage
```

---

## Phase 9: Build & Deployment Instructions

### Step 17: Dependency Setup

#### **Windows**:
```powershell
# Download obs-deps (prebuilt dependencies)
curl https://releases.obsproject.com/obs-studio/dependencies/windows/obs-deps-2024-x64.zip -o obs-deps.zip
Expand-Archive obs-deps.zip -DestinationPath obs-deps/

# Set CMAKE_PREFIX_PATH
$env:CMAKE_PREFIX_PATH = "D:\obs-deps\windows-deps-2024-08-02-x64"
```

#### **macOS**:
```bash
# Install via Homebrew
brew install cmake ninja qt6 ffmpeg

# Download macOS obs-deps
curl -L https://releases.obsproject.com/obs-studio/dependencies/macos/obs-deps-2024-macos.tar.gz | tar xz
export CMAKE_PREFIX_PATH=$(pwd)/obs-deps/macos
```

#### **Linux**:
```bash
# Ubuntu/Debian
sudo apt-get install \
  cmake ninja-build \
  qt6-base-dev qt6-imageformats-plugins libqt6x11extras6 \
  libgl1-mesa-dev libxkbcommon-x11-0 \
  libpulse-dev alsa-lib-dev libjack-dev \
  libx11-dev libxcb1-dev libxrandr-dev libxinerama-dev libxcursor-dev \
  libxkbcommon-dev \
  libfdk-aac-dev libopus-dev \
  libjansson-dev mbedtls-dev \
  libfreetype6-dev fontconfig \
  libcurl4-openssl-dev \
  swig python3-dev
```

### Step 18: Build Instructions

```bash
# Configure
cmake --preset default -S . -B build

# Build
cmake --build build --parallel

# Run tests
ctest --test-dir build --output-on-failure

# Install
cmake --install build --prefix /usr/local
```

---

## Key Implementation Notes for Antigravity

1. **Do NOT simply copy source files from the original repo** - Understand the architecture and rewrite from scratch
2. **Use Modern CMake patterns** - Follow CMake 3.22+ best practices
3. **Platform abstraction** - Use platform-specific code judiciously, prefer cross-platform approaches
4. **Incremental building** - Implement each phase completely before moving to the next
5. **Testing first** - Write tests as you build each component
6. **Documentation** - Document API contracts and module interfaces
7. **Code quality** - Enforce C99/C++17 standards, use static analysis tools
8. **Performance** - Profile regularly, optimize hotpaths

---

## Expected Deliverables

✅ **Phase 1-2 (Week 8)**: Core libobs + Graphics pipeline
✅ **Phase 3-4 (Week 16)**: Complete audio + I/O system  
✅ **Phase 5-6 (Week 20)**: Source capture + Advanced features
✅ **Phase 7-8 (Week 24)**: Full testing + Multi-platform builds
✅ **Final (Week 26)**: Production-ready OBS Studio equivalent

---

**Questions?** Refer to https://obsproject.com/docs for API details and reference implementation patterns.
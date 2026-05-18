# PodSoft - Product Requirements Document (PRD)

## Project Overview
PodSoft is a professional-grade web-based video production and streaming studio, inspired by the architecture and layout of OBS Studio. It aims to provide high-performance video compositing, scene management, and streaming capabilities directly in the browser using modern web APIs (WebRTC, MediaRecorder, Canvas).

## Core Architecture
- **Media Pipeline**: Producer-consumer model where sources (camera, screen, windows) push frames to a central compositor (Canvas/WebGL).
- **Scene Management**: A hierarchical system where Scenes contain SceneItems, which are wrappers around Sources with transform and filter properties.
- **Plugin System (Web)**: Modular React components for different source types (Video, Image, Text, Browser).

## Feature Specifications
- **Studio Mode**: Dual-pane view for Preview and Program with transition controls.
- **Audio Mixer**: Multi-channel audio mixing with gain, filters, and peak meters.
- **Transitions**: Fade, Cut, and custom shader-based transitions.
- **Recording**: Local recording to WEBM/MP4 using `MediaRecorder`.
- **Advanced Filters**: Brightness, contrast, saturation, chroma key (green screen).
- **Device Support**: Native support for DroidCam and standard UVC devices.

# Source Code Parity Map (copy.md)

This app maps OBS Studio C++ concepts to React/TypeScript:

| OBS Concept (C++) | PodSoft Implementation (React/TS) |
| :--- | :--- |
| `libobs/obs-source.c` | `src/App.tsx` (Source State) |
| `libobs/obs-scene.c` | `src/App.tsx` (Scene State Array) |
| `libobs-opengl/` | CSS / Canvas Filtering |
| `frontend/qt/` | Tailwind CSS + Lucide Icons |
| `obs-ffmpeg/` | `MediaRecorder` API |
| `obs-properties.c` | `FilterSlider` Components |

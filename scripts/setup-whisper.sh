#!/usr/bin/env bash
# NeuralAir local transcription setup — Phase 4.
# Builds whisper.cpp and downloads a model so dictation works offline
# (STT provider "Local", or "Auto" failover when Groq is down or slow).
#
# Install layout (the defaults electron/transcribe.js expects):
#   ~/.local/share/neuralair/whisper.cpp/build/bin/whisper-cli
#   ~/.local/share/neuralair/whisper.cpp/models/ggml-base.en.bin
#
# Requirements: git, cmake, a C/C++ compiler, curl.
set -euo pipefail

DEST="${HOME}/.local/share/neuralair/whisper.cpp"
MODEL="${1:-base.en}"   # e.g. base.en, small.en, medium.en (bigger = better + slower)

for cmd in git cmake curl; do
  command -v "$cmd" >/dev/null || { echo "missing: $cmd" >&2; exit 1; }
done

mkdir -p "$(dirname "$DEST")"

if [ ! -d "$DEST" ]; then
  git clone --depth 1 https://github.com/ggml-org/whisper.cpp "$DEST"
else
  echo "whisper.cpp already cloned at $DEST"
fi

cd "$DEST"
cmake -B build -DWHISPER_BUILD_EXAMPLES=ON -DWHISPER_BUILD_TESTS=OFF
cmake --build build --target whisper-cli -j"$(nproc)"

bash ./models/download-ggml-model.sh "$MODEL"

echo
echo "Done. NeuralAir now finds the local engine at:"
echo "  $DEST/build/bin/whisper-cli"
echo "  $DEST/models/ggml-${MODEL}.bin"

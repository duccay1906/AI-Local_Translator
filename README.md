# AI Local Translator (LM Studio Desktop App)

An ultra-sleek, modern Windows desktop application that captures selected text anywhere on your PC, queries your local AI model hosted on **LM Studio** via OpenAI-compatible REST API, and displays real-time streaming translations right next to your cursor.

---

## 🌟 Key Features

- ⚡ **Instant Floating Translation Overlay**: Appears at your cursor position when you select text and press <kbd>Alt + T</kbd>.
- 🤖 **LM Studio Local LLM Direct Integration**: Connects via `http://localhost:1234/v1/chat/completions` (no external API keys needed, 100% private & free).
- 🌊 **Realtime Token Streaming**: Watch translations appear word-by-word with zero delay.
- 📌 **Always-on-top Pinning**: Keep the translation window pinned open while taking notes.
- 🔊 **Text-to-Speech**: Listen to translated pronunciation with built-in voice playback.
- ⚙️ **Custom Configuration**: Change models, global hotkeys, target languages, and system prompts.
- 📜 **Translation History**: Auto-saves past translation logs with search & quick copy.

---

## 🚀 Quick Setup & Usage Guide

### 1. LM Studio Setup
1. Download and open **LM Studio** on your PC.
2. Download any lightweight LLM (e.g. `Llama-3-8B-Instruct`, `Mistral-7B`, `Qwen-2.5-7B`, or `Phi-3`).
3. Click on the **Local Server icon (↔️)** on the left sidebar in LM Studio.
4. Select your loaded model and click **Start Server** (Server will start on `http://localhost:1234`).

### 2. Running the Translator App
```bash
# Install dependencies
npm install

# Start Dev Server & Electron Desktop App
npm run dev
```

### 3. How to Translate Text Anywhere
1. Highlight/select any text in your browser, PDF reader, Word document, VS Code, etc.
2. Press **`Alt + T`** (or your custom shortcut).
3. The floating translation popup will appear instantly near your cursor!

---

## 🛠️ Tech Stack
- **Desktop Core**: Electron 31 + TypeScript
- **UI Framework**: React 18 + Vite 5
- **Icons & Styling**: Lucide React + Modern Glassmorphism CSS Design System
- **API Engine**: HTTP/HTTPS Server-Sent Events (SSE) Streaming Client

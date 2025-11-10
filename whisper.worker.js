// public/whisper/whisper.worker.js

// 1) Download this file into public/whisper/whisper.cpp.js:
//    https://raw.githubusercontent.com/ggerganov/whisper.cpp/master/web/whisper.cpp.js
//    It’s the “single-file” build that already embeds the WASM.
// 2) Download your model into public/whisper/ggml-tiny.en.bin

// Load the single‐file Emscripten bundle (with WASM inlined)
importScripts('/whisper/whisper.cpp.js')

let ModuleInstance = null
let modelCtx = null
let streamCtx = null

// Instantiate ModuleInstance (handles both MODULARIZE=1 and classic)
const moduleReady = (async () => {
    if (typeof Module === 'function') {
        ModuleInstance = await Module()
    } else {
        ModuleInstance = Module
    }
    console.log('[worker] ModuleInstance keys:', Object.keys(ModuleInstance))
})()

self.onmessage = async (e) => {
    await moduleReady
    const { command, model } = e.data

    try {
        if (command === 'init') {
            const resp = await fetch(model)
            if (!resp.ok) throw new Error(`Model load failed: ${resp.status}`)
            const bytes = new Uint8Array(await resp.arrayBuffer())

            if (typeof ModuleInstance.Context !== 'function') {
                throw new Error('ModuleInstance.Context not found, keys: ' +
                    Object.keys(ModuleInstance).join(', '))
            }
            modelCtx = new ModuleInstance.Context(bytes)
            self.postMessage({ type: 'ready' })
        }
        else if (command === 'process') {
            if (!modelCtx) throw new Error('Model not initialized')
            if (!streamCtx) {
                streamCtx = modelCtx.createStream({
                    n_threads: 4,
                    strip_partial: true
                })
            }
            streamCtx.feed(e.data.data)
            let seg
            while ((seg = streamCtx.nextSegment()) !== null) {
                self.postMessage({ type: 'partial', text: seg.text })
            }
        }
        else if (command === 'stop') {
            if (streamCtx) {
                streamCtx.flush()
                let seg
                while ((seg = streamCtx.nextSegment()) !== null) {
                    self.postMessage({ type: 'final', text: seg.text })
                }
                streamCtx.free()
                streamCtx = null
            }
        }
    } catch (err) {
        self.postMessage({ type: 'error', msg: err.message })
    }
}

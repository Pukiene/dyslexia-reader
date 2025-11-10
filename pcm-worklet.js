//pcm-worklet.js
class PCMProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this._stopped = false;
        this.port.onmessage = (event) => {
            if (event.data.command === 'stop') {
                this._stopped = true;
            }
        };
    }

    process(inputs) {
        if (this._stopped) {
            return false;      // tear down worklet
        }
        const input = inputs[0];
        if (input && input[0]) {
            // input[0] is a Float32Array of PCM samples at your AudioContext sampleRate
            this.port.postMessage(input[0]);
        }
        return true;         // keep the processor alive
    }
}

registerProcessor('pcm-capture', PCMProcessor);
class HoldRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.active = true;
    this.port.onmessage = (event) => {
      if (event.data === 'finish') {
        this.active = false;
        this.port.postMessage('finished');
      }
    };
  }
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (this.active && channel) this.port.postMessage(channel.slice());
    return this.active;
  }
}
registerProcessor('hold-recorder', HoldRecorder);

export class MockContext {
  constructor() {
    this.sampleRate = 8000;
    this.currentTime = 1;
    this.destination = {};
    this.nodes = [];
  }
  async resume() {}
  createGain() {
    const node = {
      gain: {
        value: 0,
        cancelScheduledValues() {},
        setValueAtTime(value) {
          this.value = value;
        },
        linearRampToValueAtTime(value, time) {
          this.ramp = { value, time };
        },
      },
      connect() {},
      disconnect() {},
    };
    return node;
  }
  source() {
    const node = {
      connect() {},
      disconnect() {},
      start() {
        this.started = true;
      },
      stop() {
        this.stopped = true;
      },
    };
    this.nodes.push(node);
    return node;
  }
  createOscillator() {
    return Object.assign(this.source(), { frequency: { value: 0 } });
  }
  createStereoPanner() {
    return { pan: { value: 0 }, connect() {} };
  }
  createBiquadFilter() {
    return { frequency: { value: 0 }, connect() {} };
  }
  createBuffer(channels, length, sampleRate) {
    const data = new Float32Array(length);
    return {
      length,
      sampleRate,
      getChannelData() {
        return data;
      },
    };
  }
  createBufferSource() {
    return this.source();
  }
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Stream = void 0;
const events_1 = require("events");
const wrtc_1 = require("wrtc");
const binding_1 = require("./binding");
const buffer_optimized_1 = require("./buffer_optimized");
const os = require("os");
const utils_1 = require("./utils");
class Stream extends events_1.EventEmitter {
    constructor(readable, bitsPerSample = 16, sampleRate = 48000, channelCount = 1, buffer_length = 10, timePulseBuffer = buffer_length == 4 ? 1.5 : 0) {
        super();
        this.readable = readable;
        this.bitsPerSample = bitsPerSample;
        this.sampleRate = sampleRate;
        this.channelCount = channelCount;
        this.buffer_length = buffer_length;
        this.timePulseBuffer = timePulseBuffer;
        this.paused = false;
        this.finished = true;
        this.stopped = false;
        this.stopped_done = false;
        this.finishedLoading = false;
        this.bytesLoaded = 0;
        this.playedBytes = 0;
        this.bytesSpeed = 0;
        this.lastLag = 0;
        this.equalCount = 0;
        this.lastBytesLoaded = 0;
        this.finishedBytes = false;
        this.lastByteCheck = 0;
        this.lastByte = 0;
        this.runningPulse = false;
        this.isVideo = false;
        this.videoWidth = 0;
        this.videoHeight = 0;
        this.videoFramerate = 0;
        this.lastDifferenceRemote = 0;
        this.lipSync = false;
        this.bytesLength = 0;
        this.overloadQuiet = false;
        this.endListener = (() => {
            this.finishedLoading = true;
            if (this.readable !== undefined) {
                binding_1.Binding.log('COMPLETED_BUFFERING -> ' + new Date().getTime() +
                    ' -> ' + (this.isVideo ? 'VIDEO' : 'AUDIO'), utils_1.LogLevel.DEBUG);
                binding_1.Binding.log('BYTES_STREAM_CACHE_LENGTH -> ' + this.cache.length +
                    ' -> ' + (this.isVideo ? 'VIDEO' : 'AUDIO'), utils_1.LogLevel.DEBUG);
                binding_1.Binding.log('BYTES_LOADED -> ' +
                    this.bytesLoaded +
                    'OF -> ' +
                    this.readable.fileSize() +
                    ' -> ' + (this.isVideo ? 'VIDEO' : 'AUDIO'), utils_1.LogLevel.DEBUG);
            }
        });
        this.dataListener = ((data) => {
            this.bytesLoaded += data.length;
            this.bytesSpeed = data.length;
            try {
                if (!(this.needsBuffering())) {
                    this.readable?.pause();
                    this.runningPulse = false;
                }
            }
            catch (e) {
                this.emit('stream_deleted');
                return;
            }
            this.cache.push(data);
        }).bind(this);
        this.audioSource = new wrtc_1.nonstandard.RTCAudioSource();
        this.videoSource = new wrtc_1.nonstandard.RTCVideoSource();
        this.paused = true;
        this.cache = new buffer_optimized_1.BufferOptimized(this.bytesLength);
        if (this.readable !== undefined) {
            this.setReadable(this.readable);
        }
        setTimeout(() => this.processData(), 1);
    }
    setLipSyncStatus(status) {
        this.lipSync = status;
    }
    setOverloadQuietStatus(status) {
        this.overloadQuiet = status;
    }
    setReadable(readable) {
        this.finished = true;
        this.finishedLoading = false;
        this.bytesLoaded = 0;
        this.playedBytes = 0;
        this.bytesSpeed = 0;
        this.lastLag = 0;
        this.equalCount = 0;
        this.lastBytesLoaded = 0;
        this.finishedBytes = false;
        this.lastByteCheck = 0;
        this.lastByte = 0;
        this.runningPulse = false;
        this.lastDifferenceRemote = 0;
        this.readable = readable;
        this.bytesLength = this.bytesLengthCalculated();
        this.cache = new buffer_optimized_1.BufferOptimized(this.bytesLength);
        this.readable?.resume();
        if (this.stopped) {
            return;
        }
        if (this.readable != undefined) {
            this.finished = false;
            this.finishedLoading = false;
            this.readable.onData = this.dataListener;
            this.readable.onEnd = this.endListener;
        }
    }
    needed_time() {
        return this.isVideo ? 0.30 : 50;
    }
    needsBuffering(withPulseCheck = true) {
        if (this.finishedLoading || this.readable === undefined) {
            return false;
        }
        let result = this.cache.length < this.bytesLength * this.needed_time() * this.buffer_length;
        result =
            result &&
                (this.bytesLoaded <
                    this.readable.fileSize() -
                        this.bytesSpeed * 2 ||
                    this.finishedBytes);
        if (this.timePulseBuffer > 0 && withPulseCheck) {
            result = result && this.runningPulse;
        }
        return result;
    }
    checkLag() {
        if (this.finishedLoading) {
            return false;
        }
        return this.cache.length < this.bytesLength * this.needed_time();
    }
    pause() {
        if (this.stopped) {
            throw new Error('Cannot pause when stopped');
        }
        this.paused = true;
        this.emit('pause', this.paused);
    }
    resume() {
        if (this.stopped) {
            throw new Error('Cannot resume when stopped');
        }
        this.paused = false;
        this.emit('resume', this.paused);
    }
    finish() {
        this.readable?.stop();
        this.finished = true;
        this.finishedLoading = true;
    }
    stop() {
        this.finish();
        this.stopped = true;
    }
    restart(readable) {
        this.stopped = true;
        setTimeout(() => {
            if (this.stopped_done) {
                this.stopped = false;
                this.stopped_done = false;
                this.emit('restarted', readable);
                this.processData();
            }
            else {
                this.restart(readable);
            }
        }, 10);
    }
    createAudioTrack() {
        return this.audioSource.createTrack();
    }
    createVideoTrack(width, height, framerate) {
        this.videoWidth = width;
        this.videoHeight = height;
        this.isVideo = true;
        this.videoFramerate = 1000 / framerate;
        this.bytesLength = this.bytesLengthCalculated();
        this.cache.byteLength = this.bytesLength;
        return this.videoSource.createTrack();
    }
    setVideoParams(width, height, framerate) {
        this.videoWidth = width;
        this.videoHeight = height;
        this.videoFramerate = 1000 / framerate;
        this.bytesLength = this.bytesLengthCalculated();
        this.cache.byteLength = this.bytesLength;
    }
    setAudioParams(bitrate) {
        this.sampleRate = bitrate;
        this.bytesLength = this.bytesLengthCalculated();
        this.cache.byteLength = this.bytesLength;
    }
    bytesLengthCalculated() {
        if (this.isVideo) {
            return 1.5 * this.videoWidth * this.videoHeight;
        }
        else {
            return ((this.sampleRate * this.bitsPerSample) / 8 / 100) * this.channelCount;
        }
    }
    processData() {
        const oldTime = new Date().getTime();
        if (this.stopped) {
            this.stopped_done = true;
            return;
        }
        const lagging_remote = this.isLaggingRemote();
        const byteLength = this.bytesLength;
        const timeoutWait = this.frameTime() - this.lastDifferenceRemote;
        setTimeout(() => this.processData(), timeoutWait > 0 ? timeoutWait : 0);
        if (!(!this.finished &&
            this.finishedLoading &&
            this.cache.length < byteLength) && this.readable !== undefined) {
            try {
                if ((this.needsBuffering(false))) {
                    let checkBuff = true;
                    if (this.timePulseBuffer > 0) {
                        this.runningPulse =
                            this.cache.length <
                                byteLength * this.needed_time() * this.timePulseBuffer;
                        checkBuff = this.runningPulse;
                    }
                    if (this.readable !== undefined && checkBuff) {
                        this.readable.resume();
                    }
                }
            }
            catch (e) {
                this.emit('stream_deleted');
                this.stopped = true;
                return;
            }
            const checkLag = this.checkLag();
            let fileSize;
            try {
                if (oldTime - this.lastByteCheck > 1000) {
                    fileSize = this.readable.fileSize();
                    this.lastByte = fileSize;
                    this.lastByteCheck = oldTime;
                }
                else {
                    fileSize = this.lastByte;
                }
            }
            catch (e) {
                this.emit('stream_deleted');
                this.stopped = true;
                return;
            }
            if (!this.paused &&
                !this.finished &&
                !lagging_remote &&
                (this.cache.length >= byteLength || this.finishedLoading) &&
                !checkLag) {
                this.playedBytes += byteLength;
                const buffer = this.cache.readBytes();
                if (this.isVideo) {
                    const i420Frame = {
                        width: this.videoWidth,
                        height: this.videoHeight,
                        data: new Uint8ClampedArray(buffer)
                    };
                    this.videoSource.onFrame(i420Frame);
                }
                else {
                    const samples = new Int16Array(new Uint8Array(buffer).buffer);
                    this.audioSource.onData({
                        bitsPerSample: this.bitsPerSample,
                        sampleRate: this.sampleRate,
                        channelCount: this.channelCount,
                        numberOfFrames: samples.length,
                        samples,
                    });
                }
            }
            else if (checkLag) {
                this.notifyOverloadCpu((cpuPercentage) => {
                    if (cpuPercentage >= 90) {
                        binding_1.Binding.log('CPU_OVERLOAD_DETECTED -> ' + new Date().getTime() +
                            ' -> ' + (this.isVideo ? 'VIDEO' : 'AUDIO'), !this.overloadQuiet ? utils_1.LogLevel.WARNING : utils_1.LogLevel.DEBUG);
                    }
                    else {
                        binding_1.Binding.log('STREAM_LAG -> ' + new Date().getTime() +
                            ' -> ' + (this.isVideo ? 'VIDEO' : 'AUDIO'), utils_1.LogLevel.DEBUG);
                    }
                    binding_1.Binding.log('BYTES_STREAM_CACHE_LENGTH -> ' + this.cache.length +
                        ' -> ' + (this.isVideo ? 'VIDEO' : 'AUDIO'), utils_1.LogLevel.DEBUG);
                    binding_1.Binding.log('BYTES_LOADED -> ' +
                        this.bytesLoaded +
                        'OF -> ' +
                        this.readable?.fileSize() +
                        ' -> ' + (this.isVideo ? 'VIDEO' : 'AUDIO'), utils_1.LogLevel.DEBUG);
                });
            }
            if (!this.finishedLoading) {
                if (fileSize === this.lastBytesLoaded) {
                    if (this.equalCount >= 4) {
                        this.equalCount = 0;
                        binding_1.Binding.log('NOT_ENOUGH_BYTES -> ' + oldTime +
                            ' -> ' + (this.isVideo ? 'VIDEO' : 'AUDIO'), utils_1.LogLevel.DEBUG);
                        this.finishedBytes = true;
                        this.readable?.resume();
                    }
                    else {
                        if (oldTime - this.lastLag > 1000) {
                            this.equalCount += 1;
                            this.lastLag = oldTime;
                        }
                    }
                }
                else {
                    this.lastBytesLoaded = fileSize;
                    this.equalCount = 0;
                    this.finishedBytes = false;
                }
            }
        }
        if (!this.finished &&
            this.finishedLoading &&
            this.cache.length < byteLength &&
            this.readable !== undefined) {
            this.finish();
            this.emit('finish');
        }
    }
    haveEnd() {
        if (this.readable != undefined) {
            return this.readable.haveEnd;
        }
        else {
            return true;
        }
    }
    isLaggingRemote() {
        if (this.remotePlayingTime != undefined && !this.paused && this.lipSync && this.remoteLagging != undefined) {
            const remote_play_time = this.remotePlayingTime().time;
            const local_play_time = this.currentPlayedTime();
            if (remote_play_time != undefined && local_play_time != undefined) {
                if (local_play_time > remote_play_time) {
                    this.lastDifferenceRemote = (local_play_time - remote_play_time) * 10000;
                    return true;
                }
                else if (this.remoteLagging().isLagging && remote_play_time > local_play_time) {
                    this.lastDifferenceRemote = 0;
                    return true;
                }
            }
        }
        return false;
    }
    notifyOverloadCpu(action) {
        function cpuAverage() {
            let totalIdle = 0, totalTick = 0;
            const cpus = os.cpus();
            for (let i = 0, len = cpus.length; i < len; i++) {
                const cpu = cpus[i];
                for (let type in cpu.times) {
                    totalTick += cpu.times[type];
                }
                totalIdle += cpu.times.idle;
            }
            return { idle: totalIdle / cpus.length, total: totalTick / cpus.length };
        }
        const startMeasure = cpuAverage();
        setTimeout(function () {
            const endMeasure = cpuAverage();
            const idleDifference = endMeasure.idle - startMeasure.idle;
            const totalDifference = endMeasure.total - startMeasure.total;
            const percentageCPU = 100 - ~~(100 * idleDifference / totalDifference);
            action(percentageCPU);
        }, 500);
    }
    frameTime() {
        return (this.finished || this.paused || this.checkLag() || this.readable === undefined ? 500 : this.isVideo ? this.videoFramerate : 10);
    }
    getCurrentPlayedTime() {
        return Math.ceil((this.playedBytes / this.bytesLength) / (0.0001 / this.frameTime()));
    }
    currentPlayedTime() {
        if (this.readable === undefined || this.finished) {
            return undefined;
        }
        else {
            return this.getCurrentPlayedTime();
        }
    }
}
exports.Stream = Stream;

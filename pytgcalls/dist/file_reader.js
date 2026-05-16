"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileReader = void 0;
const fs_1 = require("fs");
class FileReader {
    constructor(path) {
        this.path = path;
        this.haveEnd = true;
        this.readable = (0, fs_1.createReadStream)(path);
        this.readable.on('data', (data) => {
            if (this.onData != undefined) {
                this.onData(data);
            }
        });
        this.readable.on('end', () => {
            if (this.onEnd != undefined) {
                this.onEnd();
            }
        });
        this.readable?.pause();
    }
    pause() {
        this.readable?.pause();
    }
    resume() {
        this.readable?.resume();
    }
    fileSize() {
        return (0, fs_1.statSync)(this.path).size;
    }
    stop() {
        this.readable?.pause();
        this.readable?.destroy();
    }
}
exports.FileReader = FileReader;

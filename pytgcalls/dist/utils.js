"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogLevel = exports.getErrorMessage = exports.getBuiltSingleCommands = exports.getBuiltCommands = exports.parseSdp = exports.uuid = exports.second = void 0;
const crypto_1 = require("crypto");
const second = (_, s) => s;
exports.second = second;
const uuid = (t = 21) => crypto_1.webcrypto.getRandomValues(new Uint8Array(t)).reduce(((t, e) => t += (e &= 63) < 36 ? e.toString(36) : e < 62 ? (e - 26).toString(36).toUpperCase() : e > 62 ? "-" : "_"), "");
exports.uuid = uuid;
function parseSdp(sdp) {
    let lines = sdp.split('\r\n');
    let lookup = (prefix) => {
        for (let line of lines) {
            if (line.startsWith(prefix)) {
                return line.substring(prefix.length);
            }
        }
        return null;
    };
    let rawAudioSource = lookup('a=ssrc:');
    let rawVideoSource = lookup('a=ssrc-group:FID ');
    return {
        fingerprint: lookup('a=fingerprint:')?.split(' ')[1] ?? null,
        hash: lookup('a=fingerprint:')?.split(' ')[0] ?? null,
        setup: lookup('a=setup:'),
        pwd: lookup('a=ice-pwd:'),
        ufrag: lookup('a=ice-ufrag:'),
        audioSource: rawAudioSource ? parseInt(rawAudioSource.split(' ')[0]) : null,
        source_groups: rawVideoSource ? rawVideoSource.split(' ').map(obj => {
            return parseInt(obj);
        }) : null,
    };
}
exports.parseSdp = parseSdp;
function getBuiltCommands(stringCommand) {
    let audioCommands;
    let videoCommands;
    if (stringCommand.includes('--audio')) {
        audioCommands = getBuiltSingleCommands(stringCommand.split('--audio')[1].split('--video')[0]);
    }
    else if (!stringCommand.includes('--video')) {
        audioCommands = getBuiltSingleCommands(stringCommand);
    }
    else {
        audioCommands = {
            before: [],
            middle: [],
            after: []
        };
    }
    if (stringCommand.includes('--video')) {
        videoCommands = getBuiltSingleCommands(stringCommand.split('--video')[1].split('--audio')[0]);
    }
    else if (!stringCommand.includes('--audio')) {
        videoCommands = getBuiltSingleCommands(stringCommand);
    }
    else {
        videoCommands = {
            before: [],
            middle: [],
            after: []
        };
    }
    return {
        audio: audioCommands,
        video: videoCommands,
    };
}
exports.getBuiltCommands = getBuiltCommands;
function getBuiltSingleCommands(stringCommand) {
    const beforeCmd = stringCommand.split('-atmid')[0].split('-atend')[0];
    let middleCmd = '';
    let afterCmd = '';
    if (stringCommand.includes('-atmid')) {
        middleCmd = stringCommand.split('-atmid')[1].split('-atend')[0];
    }
    if (stringCommand.includes('-atend')) {
        afterCmd = stringCommand.split('-atend')[1].split('-atmid')[0];
    }
    return {
        before: beforeCmd.split(':_cmd_:').filter(e => e),
        middle: middleCmd.split(':_cmd_:').filter(e => e),
        after: afterCmd.split(':_cmd_:').filter(e => e),
    };
}
exports.getBuiltSingleCommands = getBuiltSingleCommands;
function getErrorMessage(error) {
    if (error.includes('APP_UPGRADE_NEEDED')) {
        return 'APP_UPGRADE_NEEDED';
    }
    else if (error.includes('No transport') || error.includes('UNMUTE_NEEDED')) {
        return 'UNMUTE_NEEDED';
    }
    return 'JOIN_ERROR';
}
exports.getErrorMessage = getErrorMessage;
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 1] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 2] = "INFO";
    LogLevel[LogLevel["WARNING"] = 3] = "WARNING";
    LogLevel[LogLevel["ERROR"] = 4] = "ERROR";
})(LogLevel = exports.LogLevel || (exports.LogLevel = {}));

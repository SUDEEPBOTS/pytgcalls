"use strict";
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var _SdpBuilder_lines, _SdpBuilder_newLine;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SdpBuilder = void 0;
class SdpBuilder {
    constructor() {
        _SdpBuilder_lines.set(this, []);
        _SdpBuilder_newLine.set(this, []);
    }
    get lines() {
        return __classPrivateFieldGet(this, _SdpBuilder_lines, "f").slice();
    }
    join() {
        return __classPrivateFieldGet(this, _SdpBuilder_lines, "f").join('\n');
    }
    finalize() {
        return this.join() + '\n';
    }
    add(line) {
        __classPrivateFieldGet(this, _SdpBuilder_lines, "f").push(line);
    }
    push(word) {
        __classPrivateFieldGet(this, _SdpBuilder_newLine, "f").push(word);
    }
    addJoined(separator = '') {
        this.add(__classPrivateFieldGet(this, _SdpBuilder_newLine, "f").join(separator));
        __classPrivateFieldSet(this, _SdpBuilder_newLine, [], "f");
    }
    addCandidate(c) {
        this.push('a=candidate:');
        this.push(`${c.foundation} ${c.component} ${c.protocol} ${c.priority} ${c.ip} ${c.port} typ ${c.type}`);
        this.push(` generation ${c.generation}`);
        this.addJoined();
    }
    addHeader(session_id) {
        this.add('v=0');
        this.add(`o=- ${session_id} 2 IN IP4 0.0.0.0`);
        this.add('s=-');
        this.add('t=0 0');
        this.add(`a=group:BUNDLE 0 1`);
        this.add('a=ice-lite');
    }
    addTransport(transport) {
        this.add(`a=ice-ufrag:${transport.ufrag}`);
        this.add(`a=ice-pwd:${transport.pwd}`);
        for (let fingerprint of transport.fingerprints) {
            this.add(`a=fingerprint:${fingerprint.hash} ${fingerprint.fingerprint}`);
            this.add(`a=setup:passive`);
        }
        let candidates = transport.candidates;
        for (let candidate of candidates) {
            this.addCandidate(candidate);
        }
    }
    addSsrcEntry(transport) {
        //AUDIO CODECS
        this.add(`m=audio 1 RTP/SAVPF 111 126`);
        this.add('c=IN IP4 0.0.0.0');
        this.add(`a=mid:0`);
        this.addTransport(transport);
        this.add('a=rtpmap:111 opus/48000/2');
        this.add('a=rtpmap:126 telephone-event/8000');
        this.add('a=fmtp:111 minptime=10; useinbandfec=1; usedtx=1');
        this.add('a=rtcp:1 IN IP4 0.0.0.0');
        this.add('a=rtcp-mux');
        this.add('a=rtcp-fb:111 transport-cc');
        this.add('a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level');
        this.add('a=recvonly');
        //END AUDIO CODECS
        //VIDEO CODECS
        this.add(`m=video 1 RTP/SAVPF 100 101 102 103`);
        this.add('c=IN IP4 0.0.0.0');
        this.add(`a=mid:1`);
        this.addTransport(transport);
        //VP8 CODEC
        this.add('a=rtpmap:100 VP8/90000/1');
        this.add('a=fmtp:100 x-google-start-bitrate=800');
        this.add('a=rtcp-fb:100 goog-remb');
        this.add('a=rtcp-fb:100 transport-cc');
        this.add('a=rtcp-fb:100 ccm fir');
        this.add('a=rtcp-fb:100 nack');
        this.add('a=rtcp-fb:100 nack pli');
        this.add('a=rtpmap:101 rtx/90000');
        this.add('a=fmtp:101 apt=100');
        //VP9 CODEC
        this.add('a=rtpmap:102 VP9/90000/1');
        this.add('a=rtcp-fb:102 goog-remb');
        this.add('a=rtcp-fb:102 transport-cc');
        this.add('a=rtcp-fb:102 ccm fir');
        this.add('a=rtcp-fb:102 nack');
        this.add('a=rtcp-fb:102 nack pli');
        this.add('a=rtpmap:103 rtx/90000');
        this.add('a=fmtp:103 apt=102');
        this.add('a=recvonly');
        this.add('a=rtcp:1 IN IP4 0.0.0.0');
        this.add('a=rtcp-mux');
        //END VIDEO CODECS
    }
    addConference(conference) {
        this.addHeader(conference.session_id);
        this.addSsrcEntry(conference.transport);
    }
    static fromConference(conference) {
        const sdp = new SdpBuilder();
        sdp.addConference(conference);
        return sdp.finalize();
    }
}
exports.SdpBuilder = SdpBuilder;
_SdpBuilder_lines = new WeakMap(), _SdpBuilder_newLine = new WeakMap();

"use strict";
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _TGCalls_connection, _TGCalls_params;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TGCalls = exports.Stream = void 0;
const events_1 = require("events");
const wrtc_1 = require("wrtc");
const sdp_builder_1 = require("./sdp-builder");
const utils_1 = require("./utils");
const binding_1 = require("./binding");
var stream_1 = require("./stream");
Object.defineProperty(exports, "Stream", { enumerable: true, get: function () { return stream_1.Stream; } });
class TGCalls extends events_1.EventEmitter {
    constructor(params) {
        super();
        _TGCalls_connection.set(this, void 0);
        _TGCalls_params.set(this, void 0);
        this.defaultMaxClientRetries = 10;
        __classPrivateFieldSet(this, _TGCalls_params, params, "f");
    }
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    async checkConnection() {
        if (__classPrivateFieldGet(this, _TGCalls_connection, "f")) {
            throw new Error('Connection already started');
        }
        else if (!this.joinVoiceCall) {
            throw new Error('Please set the `joinVoiceCall` callback before calling `start()`');
        }
    }
    async setConnectionListener(connection, resolve) {
        connection.oniceconnectionstatechange = async () => {
            const connection_status = connection.iceConnectionState;
            if (connection_status) {
                this.emit('iceConnectionState', connection_status);
                const isConnected = connection_status == 'completed' || connection_status == 'connected';
                if (connection_status != 'checking') {
                    resolve(isConnected);
                }
                switch (connection_status) {
                    case 'closed':
                    case 'failed':
                        this.emit('hangUp');
                        break;
                }
            }
        };
        return connection;
    }
    async start(audioTrack, videoTrack, maxRetries = this.defaultMaxClientRetries) {
        let resolve;
        let resolver = new Promise(ok => resolve = ok);
        const setConnection = () => __classPrivateFieldSet(this, _TGCalls_connection, new wrtc_1.RTCPeerConnection(), "f");
        const setListener = (conn) => this.setConnectionListener(conn, resolve);
        const setAudioTrack = (conn) => (0, utils_1.second)(this.audioTrack = audioTrack, conn);
        const addAudioTrack = (conn) => (0, utils_1.second)(conn.addTrack(this.audioTrack), conn);
        const setVideoTrack = (conn) => (0, utils_1.second)(this.videoTrack = videoTrack, conn);
        const addVideoTrack = (conn) => (0, utils_1.second)(conn.addTrack(this.videoTrack), conn);
        const createOffer = async (conn) => conn.createOffer({
            offerToReceiveVideo: true,
            offerToReceiveAudio: true
        })
            .then(offer => ({ conn, offer }));
        const setLocalDescription = async ({ conn, offer }) => conn.setLocalDescription(offer).then(() => {
            if (!offer.sdp)
                throw new Error('No offer sdp');
            return offer;
        })
            .then(offer => ({ conn, offer }));
        const setSdp = ({ conn, offer }) => ({ conn, offer, parsedSdp: (0, utils_1.parseSdp)(offer.sdp) });
        const checkSdp = ({ conn, parsedSdp }) => {
            if (!parsedSdp.ufrag
                || !parsedSdp.pwd
                || !parsedSdp.hash
                || !parsedSdp.fingerprint
                || !parsedSdp.audioSource
                || !parsedSdp.source_groups)
                throw new Error('Invalid SDP');
            return ({ conn, sdp: parsedSdp });
        };
        const joinVoiceCall = async ({ conn, sdp }) => this.joinVoiceCall({
            ufrag: sdp.ufrag,
            pwd: sdp.pwd,
            hash: sdp.hash,
            fingerprint: sdp.fingerprint,
            source: sdp.audioSource,
            source_groups: sdp.source_groups,
            params: __classPrivateFieldGet(this, _TGCalls_params, "f"),
            setup: 'active' //The setup need to be active
        }).catch(e => {
            binding_1.Binding.log(e.toString(), utils_1.LogLevel.ERROR);
            conn.close();
            throw e;
        }).then(answer => {
            if (!answer || !answer.transport) {
                conn.close();
                if (answer.error) {
                    const messageError = (0, utils_1.getErrorMessage)(answer.error);
                    if (messageError != 'JOIN_ERROR') {
                        throw new Error(messageError);
                    }
                }
                throw new Error('No active voice chat found on ' + __classPrivateFieldGet(this, _TGCalls_params, "f").chatId);
            }
            else
                return answer;
        }).then(answer => ({ conn, sdp, answer }));
        const setUUID = ({ conn, sdp, answer }) => ({
            conn,
            answer,
            sdp,
            connId: Number((0, utils_1.uuid)(8).split('').map(s => s.charCodeAt(0)).join()),
        });
        const setConference = ({ conn, answer, sdp, connId }) => ({
            conn,
            answer,
            connId,
            conference: {
                session_id: connId,
                transport: answer.transport,
                ssrcs: [
                    {
                        ssrc: sdp.audioSource,
                        ssrc_group: sdp.source_groups,
                    },
                ]
            }
        });
        const setRemoteDescription = ({ conn, conference }) => (0, utils_1.second)(conn.setRemoteDescription({ type: 'answer', sdp: sdp_builder_1.SdpBuilder.fromConference(conference) }), conn);
        const waitConnection = (conn) => resolver.then(isConnected => ({ conn, isConnected }));
        const retryOrDone = async ({ conn, isConnected }) => {
            if (!isConnected) {
                try {
                    conn.close();
                }
                catch (e) { }
                if (maxRetries > 0) {
                    __classPrivateFieldSet(this, _TGCalls_connection, undefined, "f");
                    await this.sleep(125);
                    binding_1.Binding.log('Telegram is having some internal server issues. Retrying ' + ((this.defaultMaxClientRetries + 1) - maxRetries) + ' of ' + this.defaultMaxClientRetries, utils_1.LogLevel.WARNING);
                    return this.start(audioTrack, videoTrack, maxRetries - 1);
                }
                throw new Error('Telegram is having some internal server issues. Retries exhausted');
            }
        };
        return this.checkConnection()
            .then(setConnection)
            .then(setListener)
            .then(setAudioTrack)
            .then(addAudioTrack)
            .then(setVideoTrack)
            .then(addVideoTrack)
            .then(createOffer)
            .then(setLocalDescription)
            .then(setSdp)
            .then(checkSdp)
            .then(joinVoiceCall)
            .then(setUUID)
            .then(setConference)
            .then(setRemoteDescription)
            .then(waitConnection)
            .then(retryOrDone);
    }
    mute() {
        if (this.audioTrack && this.audioTrack.enabled) {
            this.audioTrack.enabled = false;
            return true;
        }
        return false;
    }
    unmute() {
        if (this.audioTrack && !this.audioTrack.enabled) {
            this.audioTrack.enabled = true;
            return true;
        }
        return false;
    }
    isClosed() {
        return __classPrivateFieldGet(this, _TGCalls_connection, "f")?.connectionState == 'closed';
    }
    close() {
        __classPrivateFieldGet(this, _TGCalls_connection, "f")?.close();
        __classPrivateFieldSet(this, _TGCalls_connection, undefined, "f");
    }
}
exports.TGCalls = TGCalls;
_TGCalls_connection = new WeakMap(), _TGCalls_params = new WeakMap();

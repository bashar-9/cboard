export type SignalMessage = {
    to: string;
    from: string;
    type: 'offer' | 'answer' | 'candidate';
    data: unknown;
};

interface ExtendedRTCPeerConnection extends RTCPeerConnection {
    _safeSignalHandle?: (msg: SignalMessage) => Promise<void>;
}

export class WebRTCManager {
    private peers: Map<string, RTCPeerConnection> = new Map();
    private channels: Map<string, RTCDataChannel> = new Map();
    private myId: string;

    // Callbacks
    public onSignal?: (msg: SignalMessage) => void;
    public onData?: (peerId: string, data: unknown) => void;
    public onConnect?: (peerId: string) => void;
    public onChannelOpen?: (peerId: string) => void;
    public onDisconnect?: (peerId: string) => void;

    constructor(myId: string) {
        this.myId = myId;
    }

    // Common config for STUN servers
    private get rtcConfig() {
        return {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' }
            ]
        };
    }

    public createPeer(peerId: string, polite: boolean) {
        if (this.peers.has(peerId)) return;

        const pc = new RTCPeerConnection(this.rtcConfig);
        this.peers.set(peerId, pc);

        let makingOffer = false;
        let ignoreOffer = false;
        let signalingChain = Promise.resolve();

        pc.onicecandidate = (event) => {
            if (event.candidate && this.onSignal) {
                this.onSignal({
                    to: peerId,
                    from: this.myId,
                    type: 'candidate',
                    data: event.candidate,
                });
            }
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'connected') {
                this.onConnect?.(peerId);
            } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
                this.onDisconnect?.(peerId);
                this.removePeer(peerId);
            }
        };

        pc.ondatachannel = (event) => {
            this.setupChannel(peerId, event.channel);
        };

        // If we are not the polite peer (we initiate), we proactively open the data channel.
        if (!polite) {
            const channel = pc.createDataChannel('share-board');
            this.setupChannel(peerId, channel);

            // Proactively trigger the first offer since some browsers lag on negotiationneeded
            pc.createOffer().then(offer => {
                makingOffer = true;
                pc.setLocalDescription(offer).then(() => {
                    this.onSignal?.({
                        to: peerId,
                        from: this.myId,
                        type: 'offer',
                        data: pc.localDescription
                    });
                }).finally(() => {
                    makingOffer = false;
                });
            }).catch(e => console.error("Offer creation error", e));
        }

        // Attach safe signal handler for this specific peer to handle stare/glare correctly
        (pc as ExtendedRTCPeerConnection)._safeSignalHandle = async (msg: SignalMessage) => {
            signalingChain = signalingChain.then(async () => {
                try {
                    if (msg.type === 'offer' || msg.type === 'answer') {
                        const desc = new RTCSessionDescription(msg.data as RTCSessionDescriptionInit);
                        const isOffer = desc.type === 'offer';

                        // Collision detection (glare)
                        const offerCollision = isOffer && (makingOffer || pc.signalingState !== 'stable');

                        ignoreOffer = !polite && offerCollision;
                        if (ignoreOffer) {
                            return; // Polite peer drops their offer, we keep ours
                        }

                        // Ignore stray answers if we are not expecting one to prevent InvalidStateError
                        if (desc.type === 'answer' && pc.signalingState !== 'have-local-offer') {
                            return;
                        }

                        await pc.setRemoteDescription(desc);

                        if (desc.type === 'offer') {
                            await pc.setLocalDescription();
                            this.onSignal?.({
                                to: peerId,
                                from: this.myId,
                                type: 'answer',
                                data: pc.localDescription
                            });
                        }
                    } else if (msg.type === 'candidate') {
                        try {
                            await pc.addIceCandidate(new RTCIceCandidate(msg.data as RTCIceCandidateInit));
                        } catch (err) {
                            if (!ignoreOffer) {
                                console.error('Signal handling candidate error:', err);
                            }
                        }
                    }
                } catch (err) {
                    console.error("Error handling signal:", err);
                }
            });
            await signalingChain;
        };
    }

    private setupChannel(peerId: string, channel: RTCDataChannel) {
        this.channels.set(peerId, channel);
        // Needed for large file transfers later
        channel.binaryType = 'arraybuffer';

        channel.onopen = () => {
            this.onChannelOpen?.(peerId);
        };

        channel.onmessage = (event) => {
            this.onData?.(peerId, event.data);
        };

        channel.onclose = () => {
            this.channels.delete(peerId);
        };
    }

    public handleSignal(msg: SignalMessage) {
        const pc = this.peers.get(msg.from);
        if (!pc) return;

        // Pass signal directly into the peer's custom handler to maintain closure state over `ignoreOffer`
        const extendedPc = pc as ExtendedRTCPeerConnection;
        if (extendedPc._safeSignalHandle) {
            extendedPc._safeSignalHandle(msg);
        }
    }

    public broadcast(data: string | ArrayBuffer) {
        this.channels.forEach((channel) => {
            if (channel.readyState === 'open') {
                if (typeof data === 'string') channel.send(data);
                else channel.send(data);
            }
        });
    }

    public sendTo(peerId: string, data: string | ArrayBuffer) {
        const channel = this.channels.get(peerId);
        if (channel?.readyState === 'open') {
            if (typeof data === 'string') channel.send(data);
            else channel.send(data);
        }
    }

    public removePeer(peerId: string) {
        const pc = this.peers.get(peerId);
        if (pc) {
            pc.close();
            this.peers.delete(peerId);
        }
        const channel = this.channels.get(peerId);
        if (channel) {
            channel.close();
            this.channels.delete(peerId);
        }
    }

    public cleanup() {
        this.peers.forEach(pc => pc.close());
        this.peers.clear();
        this.channels.clear();
    }
}

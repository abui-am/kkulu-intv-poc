import { MODELS } from "@/lib/openai/models";

export type TranscriptHandlers = {
  onPartial: (text: string, itemId: string) => void;
  onFinal: (text: string, itemId: string) => void;
  onError: (message: string) => void;
};

type TranscriptItem = { partial: string; final: string | null };

export class RealtimeTranscription {
  private peer: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private mic: MediaStream | null = null;
  private items = new Map<string, TranscriptItem>();

  constructor(private readonly handlers: TranscriptHandlers) {}

  async connect(
    stream: MediaStream,
    vadCommit: { commit: () => void },
  ): Promise<{ commit: () => void }> {
    const tokenResponse = await fetch("/api/openai/transcription-session", { method: "POST" });
    const tokenPayload: unknown = await tokenResponse.json();
    if (!tokenResponse.ok) {
      throw new Error("Could not start transcription");
    }
    const value = (tokenPayload as { value?: string }).value;
    if (!value) throw new Error("Missing ephemeral transcription credential");

    this.mic = stream;
    this.peer = new RTCPeerConnection();
    this.channel = this.peer.createDataChannel("oai-events");
    this.channel.onmessage = (event) => this.handleMessage(String(event.data));
    this.channel.onopen = () => {
      this.channel?.send(
        JSON.stringify({
          type: "session.update",
          session: {
            type: "transcription",
            audio: {
              input: {
                transcription: {
                  model: MODELS.transcription,
                  languages: ["en"],
                  prompt: "English only. A user onboarding a SaaS product and connecting GitHub.",
                },
                turn_detection: null,
              },
            },
          },
        }),
      );
    };
    for (const track of this.mic.getTracks()) this.peer.addTrack(track);

    const offer = await this.peer.createOffer();
    await this.peer.setLocalDescription(offer);
    const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${value}`,
        "Content-Type": "application/sdp",
      },
    });
    if (!sdpResponse.ok) throw new Error("Realtime connection failed");
    await this.peer.setRemoteDescription({ type: "answer", sdp: await sdpResponse.text() });

    const commit = () => {
      if (this.channel?.readyState === "open") {
        this.channel.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
      }
      vadCommit.commit();
    };
    return { commit };
  }

  private handleMessage(raw: string): void {
    let event: { type?: string; item_id?: string; delta?: string; transcript?: string };
    try {
      event = JSON.parse(raw) as typeof event;
    } catch {
      return;
    }
    const itemId = event.item_id ?? "unknown";
    if (event.type === "conversation.item.input_audio_transcription.delta" && event.delta) {
      const current = this.items.get(itemId) ?? { partial: "", final: null };
      current.partial += event.delta;
      this.items.set(itemId, current);
      this.handlers.onPartial(current.partial, itemId);
    }
    if (event.type === "conversation.item.input_audio_transcription.completed" && event.transcript) {
      const current = this.items.get(itemId) ?? { partial: "", final: null };
      current.final = event.transcript;
      this.items.set(itemId, current);
      this.handlers.onFinal(event.transcript, itemId);
    }
  }

  stop(): void {
    this.channel?.close();
    this.peer?.close();
    this.channel = null;
    this.peer = null;
    this.mic = null;
  }
}

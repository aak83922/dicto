export interface Message {
  id: string;
  text: string;
  sender: 'me' | 'stranger';
  timestamp: number;
  replyTo?: {
    id: string;
    text: string;
    sender: 'me' | 'stranger';
  };
}

export type ChatMode = 'text' | 'video';

export interface RTCPeerData {
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}
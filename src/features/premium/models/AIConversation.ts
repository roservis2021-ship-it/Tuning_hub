import type { EntityMetadata } from './common';

export interface AIConversation extends EntityMetadata {
  ownerId: string;
  projectId: string;
  userVehicleId: string;
  title: string;
  status: 'active' | 'archived' | 'escalated';
  summary?: string;
  summaryVersion: number;
  lastMessageAt?: Date;
  messageCount: number;
}

export interface SpecialistReference { type: string; id: string; label: string; }
export interface SpecialistReply {
  answer: string;
  confidence: 'unverified' | 'low' | 'medium' | 'high';
  uncertainty: string;
  needsMoreData: boolean;
  clarificationQuestions: string[];
  nextStep: string;
  references: SpecialistReference[];
}

export interface AIMessage extends EntityMetadata {
  ownerId: string;
  role: 'user' | 'assistant';
  content: string;
  module: 'vehicle' | 'maintenance' | 'modifications' | 'issues' | 'advisor';
  runId?: string;
  structured?: SpecialistReply;
}

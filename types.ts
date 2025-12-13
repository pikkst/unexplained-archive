
export type UserRole = 'GUEST' | 'USER' | 'INVESTIGATOR' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  avatar: string;
  bio: string;
  role: UserRole;
  isVerified?: boolean;
  specialization?: string; // For investigators
  joinedDate: string;
  // New fields for Investigator Reward System
  walletBalance?: number;
  reputationScore?: number;
  badges?: string[];
  completedCasesCount?: number;
}

export interface Post {
  id: string;
  userId: string;
  user: User;
  content: string;
  imageUrl?: string;
  likes: number;
  comments: number;
  timestamp: string;
  type: 'STORY' | 'EDUCATIONAL' | 'UPDATE';
}

export type CaseStatus = 'OPEN' | 'INVESTIGATING' | 'PENDING_REVIEW' | 'RESOLVED' | 'CLOSED' | 'DISPUTED' | 'VOTING';
export type CaseCategory = 'UFO' | 'CRYPTID' | 'PARANORMAL' | 'SUPERNATURAL' | 'OTHER';

export interface Review {
  rating: number; // 1-5
  comment: string;
  date: string;
}

export interface Comment {
  id: string;
  user: User;
  text: string;
  date: string;
  likes: number;
}

export interface CaseDocument {
  id: string;
  name: string;
  type: 'PDF' | 'IMAGE' | 'AUDIO' | 'TEXT';
  url: string;
  uploadedAt: string;
  addedBy: 'USER' | 'INVESTIGATOR';
}

export interface InvestigatorLogEntry {
  id: string;
  timestamp: string;
  content: string;
  type: 'NOTE' | 'EVIDENCE' | 'INTERVIEW';
}

export interface Case {
  id: string;
  title: string;
  description: string;
  detailedDescription?: string; // For machines, beings, specific phenomena
  category: CaseCategory;
  status: CaseStatus;
  submittedBy: User;
  assignedInvestigator?: User;
  submittedDate: string;
  incidentDate: string;
  location: string;
  coordinates?: { lat: number; lng: number };
  imageUrl?: string;
  isAiGeneratedImage?: boolean; // Flag if image was created by AI
  
  // Reward & Resolution System
  reward: number; // Total pool
  investigatorNotes?: string; // Legacy simple note
  investigationLog?: InvestigatorLogEntry[]; // New structured log (maps to investigation_log in DB)
  documents?: CaseDocument[]; // Files associated with the case (maps to documents in DB)
  
  resolutionProposal?: string; // Text submitted by investigator for review (maps to resolution_proposal in DB)
  resolution?: string; // Final accepted resolution
  userReview?: Review; // Rating given by submitter
  
  // Dispute System
  isDisputed?: boolean;
  adminOutcome?: 'RELEASED' | 'REJECTED' | 'SENT_TO_VOTE';
  
  communityVotes: {
    agree: number;
    disagree: number;
  };
  comments?: Comment[]; // Community comments on the case
}

export interface Article {
  id: string;
  title: string;
  excerpt: string;
  author: User;
  date: string;
  imageUrl: string;
  category: string;
}

export interface ForumThread {
  id: string;
  title: string;
  author: User;
  category: CaseCategory | 'GENERAL';
  replies: number;
  views: number;
  lastActive: string;
  isPinned?: boolean;
}

export interface Stats {
  openCases: number;
  resolvedCases: number;
  activeInvestigators: number;
  totalUsers: number;
}

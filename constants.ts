
import { User, Case, Post, Stats, Article, ForumThread, Comment } from './types';

// ⚠️ WARNING: MOCK DATA BELOW IS NOT USED IN PRODUCTION
// These constants are kept for reference/testing only
// All real data comes from Supabase database

export const MOCK_USERS: Record<string, User> = {
  regular: {
    id: 'u1',
    name: 'Alex Mothman',
    avatar: 'https://picsum.photos/seed/alex/150/150',
    bio: 'Avid skywatcher and amateur radio enthusiast. Looking for the truth.',
    role: 'USER',
    joinedDate: '2023-01-15',
  },
  investigator: {
    id: 'i1',
    name: 'Dr. Dana Skully',
    avatar: 'https://picsum.photos/seed/dana/150/150',
    bio: 'Paranormal researcher with 10 years of field experience. Specializing in atmospheric anomalies.',
    role: 'INVESTIGATOR',
    isVerified: true,
    specialization: 'Atmospheric Anomalies',
    joinedDate: '2022-11-01',
    walletBalance: 1250,
    reputationScore: 480,
    badges: ['Top Investigator', 'UFO Specialist'],
    completedCasesCount: 12,
  },
  investigator2: {
    id: 'i2',
    name: 'Fox M.',
    avatar: 'https://picsum.photos/seed/fox/150/150',
    bio: 'I want to believe. Specialized in government cover-ups.',
    role: 'INVESTIGATOR',
    isVerified: true,
    specialization: 'Conspiracies',
    joinedDate: '2022-10-15',
    walletBalance: 800,
    reputationScore: 420,
    badges: ['Truth Seeker'],
    completedCasesCount: 8,
  },
  admin: {
    id: 'a1',
    name: 'Director Skinner',
    avatar: 'https://picsum.photos/seed/skinner/150/150',
    bio: 'Platform Administrator. Ensuring integrity and safety.',
    role: 'ADMIN',
    joinedDate: '2022-01-01',
  }
};

export const MOCK_COMMENTS: Comment[] = [
  {
    id: 'cm1',
    user: MOCK_USERS.investigator2,
    text: 'I have seen similar patterns in sector 7 regarding the lights.',
    date: '2023-10-13T10:00:00Z',
    likes: 5
  },
  {
    id: 'cm2',
    user: MOCK_USERS.regular,
    text: 'This is terrifying! Stay safe out there.',
    date: '2023-10-13T12:30:00Z',
    likes: 2
  }
];

export const MOCK_CASES: Case[] = [
  {
    id: 'c1',
    title: 'Lights over the Mojave',
    description: 'Saw three amber lights moving in a triangular formation near Baker. No sound.',
    detailedDescription: 'The lights were perfectly synchronized. They moved faster than any aircraft I have ever seen. No navigation lights, just a solid amber glow.',
    category: 'UFO',
    status: 'INVESTIGATING',
    submittedBy: MOCK_USERS.regular,
    assignedInvestigator: MOCK_USERS.investigator,
    submittedDate: '2023-10-12',
    incidentDate: '2023-10-10',
    location: 'Mojave Desert, CA',
    coordinates: { lat: 35.1317, lng: -116.0593 },
    imageUrl: 'https://picsum.photos/seed/ufo1/600/400',
    reward: 150,
    investigatorNotes: 'Initial spectral analysis of video footage suggests ionization of the surrounding air.',
    investigationLog: [
      { id: 'l1', timestamp: '2023-10-13T09:00:00Z', type: 'NOTE', content: 'Case accepted. Initial review of footage shows no signs of CGI.' },
      { id: 'l2', timestamp: '2023-10-14T14:30:00Z', type: 'EVIDENCE', content: 'Downloaded meteorological data for the night in question. Clear skies, no storms.' }
    ],
    documents: [
      { id: 'd1', name: 'Raw_Footage_Frame_Analysis.pdf', type: 'PDF', url: '#', uploadedAt: '2023-10-13', addedBy: 'INVESTIGATOR' },
      { id: 'd2', name: 'Witness_Statement.txt', type: 'TEXT', url: '#', uploadedAt: '2023-10-12', addedBy: 'USER' }
    ],
    communityVotes: { agree: 12, disagree: 2 },
    comments: MOCK_COMMENTS,
  },
  {
    id: 'c2',
    title: 'Strange howling in the woods',
    description: 'Recorded audio of a guttural howl that does not match known local wildlife.',
    category: 'CRYPTID',
    status: 'OPEN',
    submittedBy: MOCK_USERS.regular,
    submittedDate: '2023-10-15',
    incidentDate: '2023-10-14',
    location: 'Black Forest, CO',
    coordinates: { lat: 39.0207, lng: -104.6648 },
    imageUrl: 'https://picsum.photos/seed/woods/600/400',
    reward: 50,
    communityVotes: { agree: 0, disagree: 0 },
    comments: []
  },
  {
    id: 'c3',
    title: 'Shadow figure in hallway',
    description: 'Recurring shadow phenomenon at 3AM. Temperature drops recorded.',
    category: 'PARANORMAL',
    status: 'RESOLVED',
    submittedBy: MOCK_USERS.regular,
    assignedInvestigator: MOCK_USERS.investigator,
    submittedDate: '2023-09-01',
    incidentDate: '2023-08-30',
    location: 'Salem, MA',
    coordinates: { lat: 42.5195, lng: -70.8967 },
    imageUrl: 'https://picsum.photos/seed/ghost/600/400',
    resolution: 'Determined to be a trick of light from passing vehicles reflecting off a neighbor\'s wind chime.',
    reward: 200,
    investigationLog: [
      { id: 'l3', timestamp: '2023-09-02T10:00:00Z', type: 'NOTE', content: 'Site visit conducted. EMF readings nominal.' }
    ],
    userReview: {
      rating: 5,
      comment: 'Very thorough analysis, thank you for clearing this up!',
      date: '2023-09-10',
    },
    communityVotes: { agree: 45, disagree: 3 },
    comments: []
  },
  {
    id: 'c4',
    title: 'Poltergeist in the Kitchen',
    description: 'Dishes flying off shelves.',
    category: 'SUPERNATURAL',
    status: 'DISPUTED',
    submittedBy: MOCK_USERS.regular,
    assignedInvestigator: MOCK_USERS.investigator2,
    submittedDate: '2023-11-01',
    incidentDate: '2023-10-31',
    location: 'Enfield, London',
    coordinates: { lat: 51.6515, lng: -0.0811 },
    imageUrl: 'https://picsum.photos/seed/kitchen/600/400',
    reward: 350,
    investigatorNotes: 'Seismic activity reported in the area coincides with event.',
    resolutionProposal: 'Geological movement causing structural vibration, not supernatural.',
    isDisputed: true,
    communityVotes: { agree: 0, disagree: 0 },
    comments: []
  }
];

export const MOCK_POSTS: Post[] = [
  {
    id: 'p1',
    userId: 'i1',
    user: MOCK_USERS.investigator,
    content: 'Just analyzed the spectral data from the Mojave case. High ionization levels detected. Full report coming soon.',
    imageUrl: 'https://picsum.photos/seed/spectrum/600/300',
    likes: 124,
    comments: 45,
    timestamp: '2 hours ago',
    type: 'EDUCATIONAL',
  },
  {
    id: 'p2',
    userId: 'u1',
    user: MOCK_USERS.regular,
    content: 'Anyone else seeing weird lights tonight? #UFO',
    likes: 12,
    comments: 3,
    timestamp: '5 hours ago',
    type: 'STORY',
  }
];

export const MOCK_ARTICLES: Article[] = [
  {
    id: 'a1',
    title: 'The Physics of Trans-Medium Travel',
    excerpt: 'Analyzing how UAPs seamlessly transition between air and water without sonic booms.',
    author: MOCK_USERS.investigator,
    date: '2023-10-05',
    imageUrl: 'https://picsum.photos/seed/physics/600/300',
    category: 'Science'
  },
  {
    id: 'a2',
    title: 'Top 5 Cryptid Sightings of 2023',
    excerpt: 'A look back at the most credible encounters in the Pacific Northwest this year.',
    author: MOCK_USERS.investigator2,
    date: '2023-09-20',
    imageUrl: 'https://picsum.photos/seed/bigfoot/600/300',
    category: 'Cryptids'
  }
];

export const MOCK_THREADS: ForumThread[] = [
  {
    id: 't1',
    title: 'Welcome to UA! Introduce yourself here.',
    author: MOCK_USERS.admin,
    category: 'GENERAL',
    replies: 154,
    views: 3420,
    lastActive: '10 mins ago',
    isPinned: true
  },
  {
    id: 't2',
    title: 'Theories on the Phoenix Lights - 25 Years Later',
    author: MOCK_USERS.investigator,
    category: 'UFO',
    replies: 45,
    views: 1205,
    lastActive: '1 hour ago'
  },
  {
    id: 't3',
    title: 'Has anyone investigated the Skinwalker Ranch updates?',
    author: MOCK_USERS.regular,
    category: 'PARANORMAL',
    replies: 12,
    views: 350,
    lastActive: '3 hours ago'
  }
];

export const MOCK_TESTIMONIALS = [
  {
    id: 1,
    quote: "I thought I was going crazy until Investigator Skully analyzed my footage. The explanation was grounded and scientific.",
    author: "Sarah J.",
    location: "Phoenix, AZ"
  },
  {
    id: 2,
    quote: "The community here is so supportive. No ridicule, just genuine curiosity.",
    author: "Mike T.",
    location: "London, UK"
  }
];

export const MOCK_STATS: Stats = {
  openCases: 142,
  resolvedCases: 89,
  activeInvestigators: 24,
  totalUsers: 1540
};

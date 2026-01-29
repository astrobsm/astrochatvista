// ============================================================================
// CHATVISTA - Enterprise Video Conferencing Platform
// Core Type Definitions
// ============================================================================

// ============================================================================
// USER & AUTHENTICATION TYPES
// ============================================================================

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  avatarUrl?: string;
  role: UserRole;
  organizationId: string;
  departmentId?: string;
  timezone: string;
  locale: string;
  preferences: UserPreferences;
  biometricEnabled: boolean;
  mfaEnabled: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ORG_ADMIN = 'ORG_ADMIN',
  DEPT_ADMIN = 'DEPT_ADMIN',
  HOST = 'HOST',
  CO_HOST = 'CO_HOST',
  PARTICIPANT = 'PARTICIPANT',
  OBSERVER = 'OBSERVER',
  AUDITOR = 'AUDITOR',
  GUEST = 'GUEST'
}

export interface UserPreferences {
  defaultVideoDevice?: string;
  defaultAudioDevice?: string;
  defaultAudioOutput?: string;
  virtualBackground?: VirtualBackgroundConfig;
  noiseSuppressionLevel: NoiseSuppressionLevel;
  captionsEnabled: boolean;
  captionsLanguage: string;
  translationLanguage?: string;
  hdVideoEnabled: boolean;
  mirrorSelfView: boolean;
  autoJoinAudio: boolean;
  muteOnEntry: boolean;
  notificationsEnabled: boolean;
}

export interface VirtualBackgroundConfig {
  enabled: boolean;
  type: 'blur' | 'image' | 'video';
  blurIntensity?: number;
  imageUrl?: string;
  videoUrl?: string;
}

export enum NoiseSuppressionLevel {
  OFF = 'OFF',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  AUTO = 'AUTO'
}

// ============================================================================
// ORGANIZATION & HIERARCHY TYPES
// ============================================================================

export interface Organization {
  id: string;
  name: string;
  domain: string;
  logoUrl?: string;
  brandingConfig: BrandingConfig;
  subscriptionTier: SubscriptionTier;
  complianceSettings: ComplianceSettings;
  ssoConfig?: SSOConfig;
  dataResidency: DataResidencyRegion;
  createdAt: Date;
  updatedAt: Date;
}

export interface BrandingConfig {
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string;
  faviconUrl?: string;
  letterheadUrl?: string;
  footerText?: string;
  customCss?: string;
  watermarkText?: string;
  watermarkPosition: WatermarkPosition;
}

export enum WatermarkPosition {
  TOP_LEFT = 'TOP_LEFT',
  TOP_RIGHT = 'TOP_RIGHT',
  BOTTOM_LEFT = 'BOTTOM_LEFT',
  BOTTOM_RIGHT = 'BOTTOM_RIGHT',
  CENTER = 'CENTER'
}

export enum SubscriptionTier {
  FREE = 'FREE',
  PROFESSIONAL = 'PROFESSIONAL',
  BUSINESS = 'BUSINESS',
  ENTERPRISE = 'ENTERPRISE',
  HEALTHCARE = 'HEALTHCARE',
  LEGAL = 'LEGAL',
  GOVERNMENT = 'GOVERNMENT'
}

export interface ComplianceSettings {
  gdprEnabled: boolean;
  hipaaEnabled: boolean;
  soc2Enabled: boolean;
  iso27001Enabled: boolean;
  dataRetentionDays: number;
  consentRequiredForRecording: boolean;
  legalHoldEnabled: boolean;
  auditLogRetentionDays: number;
  eDiscoveryEnabled: boolean;
}

export interface SSOConfig {
  provider: SSOProvider;
  entityId: string;
  ssoUrl: string;
  certificate: string;
  attributeMapping: Record<string, string>;
  autoProvision: boolean;
  defaultRole: UserRole;
}

export enum SSOProvider {
  SAML = 'SAML',
  OIDC = 'OIDC',
  AZURE_AD = 'AZURE_AD',
  OKTA = 'OKTA',
  GOOGLE = 'GOOGLE'
}

export enum DataResidencyRegion {
  US = 'US',
  EU = 'EU',
  UK = 'UK',
  APAC = 'APAC',
  CANADA = 'CANADA',
  AUSTRALIA = 'AUSTRALIA',
  GERMANY = 'GERMANY',
  JAPAN = 'JAPAN'
}

export interface Department {
  id: string;
  name: string;
  organizationId: string;
  parentDepartmentId?: string;
  managerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// MEETING TYPES
// ============================================================================

export interface Meeting {
  id: string;
  title: string;
  description?: string;
  type: MeetingType;
  status: MeetingStatus;
  hostId: string;
  organizationId: string;
  scheduledStartTime?: Date;
  scheduledEndTime?: Date;
  actualStartTime?: Date;
  actualEndTime?: Date;
  timezone: string;
  recurrence?: RecurrenceConfig;
  accessCode?: string;
  waitingRoomEnabled: boolean;
  e2eEncrypted: boolean;
  recordingEnabled: boolean;
  transcriptionEnabled: boolean;
  translationEnabled: boolean;
  maxParticipants: number;
  settings: MeetingSettings;
  agenda?: AgendaItem[];
  createdAt: Date;
  updatedAt: Date;
}

export enum MeetingType {
  INSTANT = 'INSTANT',
  SCHEDULED = 'SCHEDULED',
  RECURRING = 'RECURRING',
  WEBINAR = 'WEBINAR',
  BREAKOUT = 'BREAKOUT',
  TRAINING = 'TRAINING',
  INTERVIEW = 'INTERVIEW',
  BOARD_MEETING = 'BOARD_MEETING'
}

export enum MeetingStatus {
  SCHEDULED = 'SCHEDULED',
  WAITING_ROOM = 'WAITING_ROOM',
  IN_PROGRESS = 'IN_PROGRESS',
  ON_HOLD = 'ON_HOLD',
  ENDED = 'ENDED',
  CANCELLED = 'CANCELLED'
}

export interface MeetingSettings {
  allowJoinBeforeHost: boolean;
  muteParticipantsOnEntry: boolean;
  disableVideo: boolean;
  allowScreenShare: boolean;
  screenSharePermission: ScreenSharePermission;
  allowChat: boolean;
  chatPermission: ChatPermission;
  allowReactions: boolean;
  allowRaiseHand: boolean;
  allowPolls: boolean;
  allowWhiteboard: boolean;
  allowBreakoutRooms: boolean;
  allowRecording: boolean;
  recordingAutoStart: boolean;
  allowLiveStream: boolean;
  interpretationEnabled: boolean;
  interpretationLanguages: string[];
  focusModeEnabled: boolean;
}

export enum ScreenSharePermission {
  HOST_ONLY = 'HOST_ONLY',
  CO_HOST_AND_ABOVE = 'CO_HOST_AND_ABOVE',
  ALL_PARTICIPANTS = 'ALL_PARTICIPANTS'
}

export enum ChatPermission {
  DISABLED = 'DISABLED',
  HOST_ONLY = 'HOST_ONLY',
  ALL_PANELISTS = 'ALL_PANELISTS',
  EVERYONE = 'EVERYONE',
  EVERYONE_PUBLICLY = 'EVERYONE_PUBLICLY'
}

export interface RecurrenceConfig {
  pattern: RecurrencePattern;
  interval: number;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  weekOfMonth?: number;
  monthOfYear?: number;
  endType: RecurrenceEndType;
  endDate?: Date;
  occurrences?: number;
}

export enum RecurrencePattern {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY'
}

export enum RecurrenceEndType {
  NEVER = 'NEVER',
  BY_DATE = 'BY_DATE',
  AFTER_OCCURRENCES = 'AFTER_OCCURRENCES'
}

export interface AgendaItem {
  id: string;
  title: string;
  description?: string;
  duration: number; // in minutes
  presenter?: string;
  order: number;
  status: AgendaItemStatus;
  startedAt?: Date;
  completedAt?: Date;
  notes?: string;
}

export enum AgendaItemStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  SKIPPED = 'SKIPPED'
}

// ============================================================================
// PARTICIPANT TYPES
// ============================================================================

export interface Participant {
  id: string;
  meetingId: string;
  userId?: string;
  displayName: string;
  email?: string;
  role: ParticipantRole;
  status: ParticipantStatus;
  joinedAt?: Date;
  leftAt?: Date;
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenShareActive: boolean;
  handRaised: boolean;
  isSpeaking: boolean;
  connectionQuality: ConnectionQuality;
  deviceInfo: DeviceInfo;
  networkStats?: NetworkStats;
}

export enum ParticipantRole {
  HOST = 'HOST',
  CO_HOST = 'CO_HOST',
  PANELIST = 'PANELIST',
  PARTICIPANT = 'PARTICIPANT',
  INTERPRETER = 'INTERPRETER',
  OBSERVER = 'OBSERVER',
  ATTENDEE = 'ATTENDEE'
}

export enum ParticipantStatus {
  WAITING = 'WAITING',
  JOINED = 'JOINED',
  ON_HOLD = 'ON_HOLD',
  LEFT = 'LEFT',
  REMOVED = 'REMOVED',
  DISCONNECTED = 'DISCONNECTED'
}

export enum ConnectionQuality {
  EXCELLENT = 'EXCELLENT',
  GOOD = 'GOOD',
  FAIR = 'FAIR',
  POOR = 'POOR',
  CRITICAL = 'CRITICAL',
  UNKNOWN = 'UNKNOWN'
}

export interface DeviceInfo {
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  deviceType: DeviceType;
  screenResolution: string;
  cameras: MediaDeviceInfo[];
  microphones: MediaDeviceInfo[];
  speakers: MediaDeviceInfo[];
}

export enum DeviceType {
  DESKTOP = 'DESKTOP',
  LAPTOP = 'LAPTOP',
  TABLET = 'TABLET',
  MOBILE = 'MOBILE',
  CONFERENCE_ROOM = 'CONFERENCE_ROOM'
}

export interface MediaDeviceInfo {
  deviceId: string;
  label: string;
  kind: 'videoinput' | 'audioinput' | 'audiooutput';
  isActive: boolean;
}

export interface NetworkStats {
  latency: number;
  jitter: number;
  packetLoss: number;
  bandwidth: {
    upload: number;
    download: number;
  };
  videoResolution: {
    width: number;
    height: number;
    frameRate: number;
  };
  audioCodec: string;
  videoCodec: string;
}

// ============================================================================
// TRANSCRIPTION & SPEECH-TO-TEXT TYPES
// ============================================================================

export interface Transcript {
  id: string;
  meetingId: string;
  language: string;
  status: TranscriptStatus;
  segments: TranscriptSegment[];
  speakers: SpeakerProfile[];
  wordCount: number;
  duration: number;
  accuracy?: number;
  createdAt: Date;
  updatedAt: Date;
  finalizedAt?: Date;
}

export enum TranscriptStatus {
  RECORDING = 'RECORDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  EDITING = 'EDITING',
  FINALIZED = 'FINALIZED'
}

export interface TranscriptSegment {
  id: string;
  speakerId: string;
  speakerName: string;
  text: string;
  startTime: number; // milliseconds from meeting start
  endTime: number;
  confidence: number;
  language: string;
  translation?: TranslatedText;
  words: TranscriptWord[];
  isEdited: boolean;
  editedBy?: string;
  editedAt?: Date;
}

export interface TranscriptWord {
  word: string;
  startTime: number;
  endTime: number;
  confidence: number;
  isPunctuation: boolean;
}

export interface TranslatedText {
  language: string;
  text: string;
  translatedAt: Date;
}

export interface SpeakerProfile {
  id: string;
  participantId?: string;
  name: string;
  color: string;
  totalSpeakingTime: number;
  segmentCount: number;
  averageConfidence: number;
  voiceSignature?: string; // For speaker re-identification
}

export interface TranscriptionConfig {
  enabled: boolean;
  language: string;
  enableDiarization: boolean;
  maxSpeakers: number;
  vocabularyHints: string[];
  profanityFilter: boolean;
  punctuationEnabled: boolean;
  enableTranslation: boolean;
  translationLanguages: string[];
  customVocabulary?: CustomVocabulary;
}

export interface CustomVocabulary {
  id: string;
  name: string;
  domain: VocabularyDomain;
  terms: VocabularyTerm[];
}

export enum VocabularyDomain {
  GENERAL = 'GENERAL',
  MEDICAL = 'MEDICAL',
  LEGAL = 'LEGAL',
  TECHNICAL = 'TECHNICAL',
  FINANCIAL = 'FINANCIAL',
  SCIENTIFIC = 'SCIENTIFIC'
}

export interface VocabularyTerm {
  term: string;
  pronunciation?: string;
  boost?: number; // Likelihood boost factor
}

// ============================================================================
// MEETING MINUTES (MoM) TYPES
// ============================================================================

export interface MeetingMinutes {
  id: string;
  meetingId: string;
  version: number;
  status: MinutesStatus;
  template: MinutesTemplate;
  header: MinutesHeader;
  attendance: AttendanceRecord;
  agendaComparison: AgendaComparison;
  discussions: DiscussionSummary[];
  decisions: Decision[];
  actionItems: ActionItem[];
  followUp: FollowUpRecommendation;
  appendices: Appendix[];
  approvals: ApprovalRecord[];
  metadata: MinutesMetadata;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
}

export enum MinutesStatus {
  DRAFT = 'DRAFT',
  PENDING_REVIEW = 'PENDING_REVIEW',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED'
}

export enum MinutesTemplate {
  CORPORATE = 'CORPORATE',
  ACADEMIC = 'ACADEMIC',
  MEDICAL = 'MEDICAL',
  LEGAL = 'LEGAL',
  BOARD = 'BOARD',
  PROJECT = 'PROJECT',
  STANDUP = 'STANDUP',
  INTERVIEW = 'INTERVIEW',
  CUSTOM = 'CUSTOM'
}

export interface MinutesHeader {
  meetingTitle: string;
  meetingType: string;
  date: Date;
  startTime: Date;
  endTime: Date;
  duration: number; // in minutes
  location: string;
  organizer: string;
  chairperson?: string;
  minuteTaker?: string;
  organizationName: string;
  departmentName?: string;
  confidentialityLevel: ConfidentialityLevel;
}

export enum ConfidentialityLevel {
  PUBLIC = 'PUBLIC',
  INTERNAL = 'INTERNAL',
  CONFIDENTIAL = 'CONFIDENTIAL',
  STRICTLY_CONFIDENTIAL = 'STRICTLY_CONFIDENTIAL',
  LEGAL_PRIVILEGE = 'LEGAL_PRIVILEGE'
}

export interface AttendanceRecord {
  present: AttendeeInfo[];
  absent: AttendeeInfo[];
  excused: AttendeeInfo[];
  guests: AttendeeInfo[];
  lateArrivals: LateArrival[];
  earlyDepartures: EarlyDeparture[];
}

export interface AttendeeInfo {
  name: string;
  email?: string;
  title?: string;
  department?: string;
  role: string;
}

export interface LateArrival {
  attendee: AttendeeInfo;
  arrivalTime: Date;
  minutesLate: number;
}

export interface EarlyDeparture {
  attendee: AttendeeInfo;
  departureTime: Date;
  minutesEarly: number;
  reason?: string;
}

export interface AgendaComparison {
  plannedItems: AgendaItem[];
  discussedItems: DiscussedAgendaItem[];
  skippedItems: AgendaItem[];
  additionalTopics: string[];
  timeVariance: number; // Percentage over/under planned time
}

export interface DiscussedAgendaItem extends AgendaItem {
  actualDuration: number;
  variance: number;
  keyPoints: string[];
}

export interface DiscussionSummary {
  id: string;
  topic: string;
  agendaItemId?: string;
  summary: string;
  keyPoints: string[];
  speakerContributions: SpeakerContribution[];
  sentiment: DiscussionSentiment;
  priorityScore: number;
  conflictsIdentified: Conflict[];
  consensusReached: boolean;
  relatedDecisions: string[];
  relatedActionItems: string[];
  timestamp: {
    start: number;
    end: number;
  };
}

export interface SpeakerContribution {
  speakerName: string;
  contributionSummary: string;
  speakingTime: number;
  keyStatements: string[];
}

export enum DiscussionSentiment {
  POSITIVE = 'POSITIVE',
  NEUTRAL = 'NEUTRAL',
  NEGATIVE = 'NEGATIVE',
  MIXED = 'MIXED',
  CONTENTIOUS = 'CONTENTIOUS'
}

export interface Conflict {
  id: string;
  description: string;
  parties: string[];
  status: ConflictStatus;
  resolution?: string;
}

export enum ConflictStatus {
  IDENTIFIED = 'IDENTIFIED',
  DISCUSSED = 'DISCUSSED',
  RESOLVED = 'RESOLVED',
  ESCALATED = 'ESCALATED',
  DEFERRED = 'DEFERRED'
}

export interface Decision {
  id: string;
  number: number;
  title: string;
  description: string;
  madeBy: string;
  approvedBy: string[];
  opposedBy: string[];
  abstainedBy: string[];
  votingResult?: VotingResult;
  timestamp: Date;
  effectiveDate?: Date;
  expiryDate?: Date;
  priority: Priority;
  category: string;
  relatedTopics: string[];
  linkedActionItems: string[];
}

export interface VotingResult {
  type: VotingType;
  inFavor: number;
  against: number;
  abstain: number;
  quorumMet: boolean;
  passed: boolean;
}

export enum VotingType {
  UNANIMOUS = 'UNANIMOUS',
  MAJORITY = 'MAJORITY',
  SUPER_MAJORITY = 'SUPER_MAJORITY',
  CONSENSUS = 'CONSENSUS'
}

export interface ActionItem {
  id: string;
  number: number;
  title: string;
  description: string;
  assignee: string;
  assigneeEmail?: string;
  coAssignees: string[];
  reporter: string;
  priority: Priority;
  status: ActionItemStatus;
  dueDate?: Date;
  estimatedEffort?: number; // in hours
  category: string;
  dependencies: string[];
  blockedBy: string[];
  relatedDecisionId?: string;
  discussionContext: string;
  timestamp: Date;
  completedAt?: Date;
  completionNotes?: string;
  externalTaskId?: string; // Integration with external tools
  externalTaskUrl?: string;
}

export enum Priority {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW'
}

export enum ActionItemStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  BLOCKED = 'BLOCKED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  DEFERRED = 'DEFERRED'
}

export interface FollowUpRecommendation {
  nextMeetingSuggested: boolean;
  suggestedDate?: Date;
  suggestedDuration?: number;
  suggestedAgenda: string[];
  pendingItems: string[];
  escalationRequired: boolean;
  escalationTo?: string;
  notes: string;
}

export interface Appendix {
  id: string;
  title: string;
  type: AppendixType;
  content: string;
  fileUrl?: string;
  pageNumber?: number;
}

export enum AppendixType {
  TRANSCRIPT = 'TRANSCRIPT',
  PRESENTATION = 'PRESENTATION',
  DOCUMENT = 'DOCUMENT',
  CHART = 'CHART',
  WHITEBOARD = 'WHITEBOARD',
  POLL_RESULTS = 'POLL_RESULTS',
  CHAT_LOG = 'CHAT_LOG'
}

export interface ApprovalRecord {
  id: string;
  approverId: string;
  approverName: string;
  approverTitle: string;
  status: ApprovalStatus;
  comments?: string;
  timestamp: Date;
  signature?: string;
}

export enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CHANGES_REQUESTED = 'CHANGES_REQUESTED'
}

export interface MinutesMetadata {
  aiConfidenceScore: number;
  processingTime: number;
  transcriptWordCount: number;
  totalSpeakers: number;
  primaryLanguage: string;
  secondaryLanguages: string[];
  customTemplateId?: string;
  versionHistory: VersionHistoryEntry[];
}

export interface VersionHistoryEntry {
  version: number;
  changedBy: string;
  changedAt: Date;
  changeDescription: string;
  changeType: ChangeType;
}

export enum ChangeType {
  CREATED = 'CREATED',
  EDITED = 'EDITED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PUBLISHED = 'PUBLISHED'
}

// ============================================================================
// DOCUMENT EXPORT TYPES
// ============================================================================

export interface ExportConfig {
  format: ExportFormat;
  template: ExportTemplate;
  branding: BrandingConfig;
  includeTranscript: boolean;
  includeTimestamps: boolean;
  includeVideoLinks: boolean;
  includeQRCode: boolean;
  security: ExportSecurity;
  tableOfContents: boolean;
  appendices: AppendixType[];
  watermark?: WatermarkConfig;
}

export enum ExportFormat {
  PDF = 'PDF',
  DOCX = 'DOCX',
  HTML = 'HTML',
  TXT = 'TXT',
  MARKDOWN = 'MARKDOWN',
  JSON = 'JSON'
}

export interface ExportTemplate {
  id: string;
  name: string;
  type: MinutesTemplate;
  headerHtml: string;
  footerHtml: string;
  stylesCss: string;
  pageSize: PageSize;
  orientation: PageOrientation;
  margins: PageMargins;
}

export enum PageSize {
  A4 = 'A4',
  LETTER = 'LETTER',
  LEGAL = 'LEGAL'
}

export enum PageOrientation {
  PORTRAIT = 'PORTRAIT',
  LANDSCAPE = 'LANDSCAPE'
}

export interface PageMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ExportSecurity {
  encrypted: boolean;
  password?: string;
  allowPrinting: boolean;
  allowCopying: boolean;
  allowEditing: boolean;
  digitalSignature?: DigitalSignatureConfig;
}

export interface DigitalSignatureConfig {
  enabled: boolean;
  certificatePath: string;
  signerName: string;
  signerTitle: string;
  reason: string;
  location: string;
  timestamp: boolean;
}

export interface WatermarkConfig {
  text: string;
  opacity: number;
  fontSize: number;
  rotation: number;
  color: string;
  position: WatermarkPosition;
}

export interface ExportedDocument {
  id: string;
  minutesId: string;
  format: ExportFormat;
  fileName: string;
  fileSize: number;
  fileUrl: string;
  checksum: string;
  encrypted: boolean;
  signed: boolean;
  expiresAt?: Date;
  downloadCount: number;
  createdAt: Date;
  createdBy: string;
}

// ============================================================================
// RECORDING TYPES
// ============================================================================

export interface Recording {
  id: string;
  meetingId: string;
  type: RecordingType;
  status: RecordingStatus;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  fileSize?: number;
  storageLocation: StorageLocation;
  storageUrl: string;
  thumbnailUrl?: string;
  tracks: RecordingTrack[];
  processingInfo: ProcessingInfo;
  accessControl: RecordingAccessControl;
  retentionPolicy: RetentionPolicy;
  highlights: RecordingHighlight[];
  chapters: RecordingChapter[];
  createdAt: Date;
  updatedAt: Date;
}

export enum RecordingType {
  CLOUD = 'CLOUD',
  LOCAL = 'LOCAL',
  COMPOSITE = 'COMPOSITE',
  INDIVIDUAL = 'INDIVIDUAL'
}

export enum RecordingStatus {
  RECORDING = 'RECORDING',
  PAUSED = 'PAUSED',
  STOPPED = 'STOPPED',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  FAILED = 'FAILED',
  DELETED = 'DELETED'
}

export enum StorageLocation {
  PRIMARY = 'PRIMARY',
  SECONDARY = 'SECONDARY',
  ARCHIVE = 'ARCHIVE',
  LOCAL = 'LOCAL'
}

export interface RecordingTrack {
  id: string;
  type: TrackType;
  participantId?: string;
  codec: string;
  bitrate: number;
  fileUrl: string;
  fileSize: number;
}

export enum TrackType {
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
  SCREEN_SHARE = 'SCREEN_SHARE',
  COMPOSITE = 'COMPOSITE'
}

export interface ProcessingInfo {
  silenceRemoved: boolean;
  silenceRemovedDuration?: number;
  transcriptSynced: boolean;
  highlightsGenerated: boolean;
  thumbnailsGenerated: boolean;
  processingStartedAt?: Date;
  processingCompletedAt?: Date;
  processingDuration?: number;
}

export interface RecordingAccessControl {
  visibility: RecordingVisibility;
  allowedUsers: string[];
  allowedRoles: UserRole[];
  passwordProtected: boolean;
  passwordHash?: string;
  expiresAt?: Date;
  downloadAllowed: boolean;
  shareAllowed: boolean;
}

export enum RecordingVisibility {
  PRIVATE = 'PRIVATE',
  PARTICIPANTS_ONLY = 'PARTICIPANTS_ONLY',
  ORGANIZATION = 'ORGANIZATION',
  PUBLIC = 'PUBLIC'
}

export interface RetentionPolicy {
  id: string;
  name: string;
  retentionDays: number;
  autoDelete: boolean;
  archiveAfterDays?: number;
  legalHold: boolean;
  complianceRule?: string;
}

export interface RecordingHighlight {
  id: string;
  timestamp: number;
  duration: number;
  type: HighlightType;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  createdBy: string;
  aiGenerated: boolean;
}

export enum HighlightType {
  DECISION = 'DECISION',
  ACTION_ITEM = 'ACTION_ITEM',
  IMPORTANT = 'IMPORTANT',
  QUESTION = 'QUESTION',
  KEY_POINT = 'KEY_POINT',
  USER_MARKED = 'USER_MARKED'
}

export interface RecordingChapter {
  id: string;
  title: string;
  startTime: number;
  endTime: number;
  agendaItemId?: string;
  thumbnailUrl?: string;
}

// ============================================================================
// COLLABORATION TYPES
// ============================================================================

export interface Whiteboard {
  id: string;
  meetingId: string;
  name: string;
  elements: WhiteboardElement[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WhiteboardElement {
  id: string;
  type: WhiteboardElementType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  content: any;
  style: WhiteboardStyle;
  createdBy: string;
  createdAt: Date;
}

export enum WhiteboardElementType {
  FREEHAND = 'FREEHAND',
  LINE = 'LINE',
  ARROW = 'ARROW',
  RECTANGLE = 'RECTANGLE',
  ELLIPSE = 'ELLIPSE',
  TEXT = 'TEXT',
  STICKY_NOTE = 'STICKY_NOTE',
  IMAGE = 'IMAGE',
  CONNECTOR = 'CONNECTOR',
  SHAPE = 'SHAPE'
}

export interface WhiteboardStyle {
  strokeColor: string;
  strokeWidth: number;
  fillColor?: string;
  fontSize?: number;
  fontFamily?: string;
  opacity: number;
}

export interface ChatMessage {
  id: string;
  meetingId: string;
  senderId: string;
  senderName: string;
  recipientId?: string; // null for public messages
  type: ChatMessageType;
  content: string;
  attachments: ChatAttachment[];
  reactions: ChatReaction[];
  replyToId?: string;
  isEdited: boolean;
  isDeleted: boolean;
  timestamp: Date;
}

export enum ChatMessageType {
  TEXT = 'TEXT',
  FILE = 'FILE',
  POLL = 'POLL',
  SYSTEM = 'SYSTEM',
  REACTION = 'REACTION'
}

export interface ChatAttachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
  thumbnailUrl?: string;
}

export interface ChatReaction {
  emoji: string;
  userId: string;
  userName: string;
}

export interface Poll {
  id: string;
  meetingId: string;
  question: string;
  type: PollType;
  options: PollOption[];
  status: PollStatus;
  anonymous: boolean;
  multipleChoice: boolean;
  createdBy: string;
  createdAt: Date;
  closedAt?: Date;
  results?: PollResults;
}

export enum PollType {
  SINGLE_CHOICE = 'SINGLE_CHOICE',
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  RATING = 'RATING',
  OPEN_ENDED = 'OPEN_ENDED'
}

export enum PollStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED'
}

export interface PollOption {
  id: string;
  text: string;
  order: number;
}

export interface PollResults {
  totalVotes: number;
  optionResults: {
    optionId: string;
    votes: number;
    percentage: number;
  }[];
}

// ============================================================================
// ANALYTICS & INSIGHTS TYPES
// ============================================================================

export interface MeetingAnalytics {
  meetingId: string;
  duration: number;
  participantCount: number;
  peakParticipants: number;
  averageParticipants: number;
  speakerStats: SpeakerStats[];
  engagementMetrics: EngagementMetrics;
  technicalMetrics: TechnicalMetrics;
  sentimentAnalysis: SentimentAnalysis;
  effectivenessScore: number;
  recommendations: AnalyticsRecommendation[];
}

export interface SpeakerStats {
  participantId: string;
  participantName: string;
  totalSpeakingTime: number;
  speakingPercentage: number;
  interruptions: number;
  questionsAsked: number;
  responseRate: number;
  dominanceScore: number;
}

export interface EngagementMetrics {
  averageAttentionScore: number;
  chatActivityScore: number;
  reactionCount: number;
  pollParticipationRate: number;
  handRaiseCount: number;
  cameraOnPercentage: number;
  screenShareDuration: number;
}

export interface TechnicalMetrics {
  averageLatency: number;
  averageJitter: number;
  averagePacketLoss: number;
  connectionDrops: number;
  audioQualityScore: number;
  videoQualityScore: number;
  bandwidthUtilization: number;
}

export interface SentimentAnalysis {
  overallSentiment: DiscussionSentiment;
  sentimentOverTime: {
    timestamp: number;
    sentiment: number; // -1 to 1
  }[];
  topPositiveTopics: string[];
  topNegativeTopics: string[];
  conflictAreas: string[];
}

export interface AnalyticsRecommendation {
  type: RecommendationType;
  priority: Priority;
  title: string;
  description: string;
  impact: string;
}

export enum RecommendationType {
  TIME_MANAGEMENT = 'TIME_MANAGEMENT',
  PARTICIPATION = 'PARTICIPATION',
  TECHNICAL = 'TECHNICAL',
  ENGAGEMENT = 'ENGAGEMENT',
  STRUCTURE = 'STRUCTURE',
  FOLLOW_UP = 'FOLLOW_UP'
}

// ============================================================================
// AUDIT & COMPLIANCE TYPES
// ============================================================================

export interface AuditLog {
  id: string;
  timestamp: Date;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  actorIp: string;
  actorDevice: string;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string;
  resourceName?: string;
  details: Record<string, any>;
  result: AuditResult;
  organizationId: string;
  sessionId?: string;
}

export enum AuditAction {
  CREATE = 'CREATE',
  READ = 'READ',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  JOIN = 'JOIN',
  LEAVE = 'LEAVE',
  START_RECORDING = 'START_RECORDING',
  STOP_RECORDING = 'STOP_RECORDING',
  SHARE_SCREEN = 'SHARE_SCREEN',
  EXPORT = 'EXPORT',
  DOWNLOAD = 'DOWNLOAD',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  INVITE = 'INVITE',
  REMOVE = 'REMOVE',
  MUTE = 'MUTE',
  UNMUTE = 'UNMUTE',
  DISABLE_VIDEO = 'DISABLE_VIDEO',
  ENABLE_VIDEO = 'ENABLE_VIDEO',
  ADMIT = 'ADMIT',
  DENY = 'DENY'
}

export enum AuditResourceType {
  USER = 'USER',
  MEETING = 'MEETING',
  RECORDING = 'RECORDING',
  TRANSCRIPT = 'TRANSCRIPT',
  MINUTES = 'MINUTES',
  DOCUMENT = 'DOCUMENT',
  ORGANIZATION = 'ORGANIZATION',
  SETTINGS = 'SETTINGS'
}

export enum AuditResult {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  PARTIAL = 'PARTIAL',
  DENIED = 'DENIED'
}

// ============================================================================
// INTEGRATION & API TYPES
// ============================================================================

export interface Integration {
  id: string;
  type: IntegrationType;
  name: string;
  status: IntegrationStatus;
  config: Record<string, any>;
  credentials: Record<string, any>;
  scopes: string[];
  lastSyncAt?: Date;
  organizationId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum IntegrationType {
  CALENDAR = 'CALENDAR',
  PROJECT_MANAGEMENT = 'PROJECT_MANAGEMENT',
  CRM = 'CRM',
  CLOUD_STORAGE = 'CLOUD_STORAGE',
  COMMUNICATION = 'COMMUNICATION',
  SSO = 'SSO',
  CUSTOM = 'CUSTOM'
}

export enum IntegrationStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ERROR = 'ERROR',
  PENDING = 'PENDING'
}

export interface Webhook {
  id: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  status: WebhookStatus;
  headers: Record<string, string>;
  retryPolicy: RetryPolicy;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum WebhookEvent {
  MEETING_STARTED = 'meeting.started',
  MEETING_ENDED = 'meeting.ended',
  PARTICIPANT_JOINED = 'participant.joined',
  PARTICIPANT_LEFT = 'participant.left',
  RECORDING_STARTED = 'recording.started',
  RECORDING_COMPLETED = 'recording.completed',
  TRANSCRIPT_READY = 'transcript.ready',
  MINUTES_GENERATED = 'minutes.generated',
  ACTION_ITEM_CREATED = 'action_item.created',
  ACTION_ITEM_COMPLETED = 'action_item.completed'
}

export enum WebhookStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  FAILED = 'FAILED'
}

export interface RetryPolicy {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

// ============================================================================
// WEBRTC & MEDIA TYPES
// ============================================================================

export interface MediaServerConfig {
  rtcMinPort: number;
  rtcMaxPort: number;
  announcedIp: string;
  listenIps: string[];
  webRtcTransportOptions: WebRtcTransportOptions;
  routerMediaCodecs: MediaCodec[];
}

export interface WebRtcTransportOptions {
  enableUdp: boolean;
  enableTcp: boolean;
  preferUdp: boolean;
  initialAvailableOutgoingBitrate: number;
  maxIncomingBitrate: number;
}

export interface MediaCodec {
  kind: 'audio' | 'video';
  mimeType: string;
  clockRate: number;
  channels?: number;
  parameters?: Record<string, any>;
}

export interface ProducerStats {
  producerId: string;
  kind: 'audio' | 'video';
  mimeType: string;
  bitrate: number;
  packetCount: number;
  byteCount: number;
  timestamp: number;
}

export interface ConsumerStats {
  consumerId: string;
  producerId: string;
  kind: 'audio' | 'video';
  mimeType: string;
  bitrate: number;
  packetCount: number;
  packetsLost: number;
  jitter: number;
  timestamp: number;
}

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, any>;
  read: boolean;
  actionUrl?: string;
  createdAt: Date;
  expiresAt?: Date;
}

export enum NotificationType {
  MEETING_REMINDER = 'MEETING_REMINDER',
  MEETING_STARTED = 'MEETING_STARTED',
  MEETING_ENDED = 'MEETING_ENDED',
  RECORDING_READY = 'RECORDING_READY',
  TRANSCRIPT_READY = 'TRANSCRIPT_READY',
  MINUTES_READY = 'MINUTES_READY',
  ACTION_ITEM_ASSIGNED = 'ACTION_ITEM_ASSIGNED',
  ACTION_ITEM_DUE = 'ACTION_ITEM_DUE',
  APPROVAL_REQUESTED = 'APPROVAL_REQUESTED',
  SYSTEM_UPDATE = 'SYSTEM_UPDATE'
}

// ============================================================================
// EXPORT ALL TYPES
// ============================================================================

export * from './index';

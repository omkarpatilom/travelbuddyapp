import { Platform } from 'react-native';
import { api, API_BASE_URL } from '../utils/api';

/** Route slug of each driver document (matches UserService `POST /Verification/{type}`). */
export type VerificationDocType = 'license' | 'aadhar' | 'vehicle-rc';

export type DocumentReviewStatus =
  | 'NotStarted'
  | 'Pending'
  | 'Approved'
  | 'Rejected'
  | 'ReuploadRequested';

export interface VerificationDocumentState {
  status: DocumentReviewStatus;
  documentId?: string | null;
  version?: number | null;
  originalFileName?: string | null;
  contentType?: string | null;
  rejectionReason?: string | null;
  uploadedAt?: string | null;
}

export interface VerificationOverview {
  overallStatus: 'NotStarted' | 'Pending' | 'Approved' | 'Rejected';
  license: VerificationDocumentState;
  aadhar: VerificationDocumentState;
  vehicleRc: VerificationDocumentState;
}

export interface UploadedDocument {
  documentId: string;
  documentType: string;
  status: DocumentReviewStatus;
  version: number;
}

export interface PickedFile {
  uri: string;
  name?: string | null;
  mimeType?: string | null;
  size?: number | null;
}

export interface ResolvedUpload {
  uri: string;
  name: string;
  type: string;
}

/** Must match FileStorage:MaxFileSizeBytes / AllowedVerificationExtensions on the server. */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

const EXTENSION_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

const TYPE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export const SUPPORTED_FORMATS_LABEL = 'JPG, PNG, WEBP or PDF';

/** Document picker filter: only formats the server accepts and the portal can preview. */
export const DOCUMENT_PICKER_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export class DocumentValidationError extends Error {
  constructor(public readonly title: string, message: string) {
    super(message);
    this.name = 'DocumentValidationError';
  }
}

const extensionOf = (value: string) => {
  const last = value.split('?')[0].split('/').pop() ?? '';
  return last.includes('.') ? last.split('.').pop()!.toLowerCase() : '';
};

/**
 * Normalises a picked file into the multipart part the server expects and
 * rejects unsupported or oversized files before any upload starts. The
 * server re-checks everything (including the file's real content).
 */
export function resolveUpload(type: VerificationDocType, file: PickedFile): ResolvedUpload {
  const rawName = (file.name || '').split('/').pop() || '';
  let ext = extensionOf(rawName);
  if (!EXTENSION_TYPES[ext]) {
    ext = TYPE_EXTENSIONS[(file.mimeType || '').toLowerCase()] || extensionOf(file.uri);
  }

  const contentType = EXTENSION_TYPES[ext];
  if (!contentType) {
    throw new DocumentValidationError(
      'Unsupported File Format',
      `Please choose a ${SUPPORTED_FORMATS_LABEL} file.`,
    );
  }

  if (file.size && file.size > MAX_DOCUMENT_BYTES) {
    throw new DocumentValidationError(
      'File Too Large',
      `The selected file is ${(file.size / (1024 * 1024)).toFixed(1)} MB. The limit is ${MAX_DOCUMENT_BYTES / (1024 * 1024)} MB.`,
    );
  }

  const base = rawName && rawName.includes('.') ? rawName.slice(0, rawName.lastIndexOf('.')) : rawName || type;
  return { uri: file.uri, name: `${base}.${ext}`, type: contentType };
}

/** Absolute URL for a gateway-relative path such as `/api/v1/...`. */
export function toAbsoluteApiUrl(path: string, baseUrl: string | undefined = API_BASE_URL): string {
  const origin = (baseUrl || '').match(/^(https?:\/\/[^/]+)/i)?.[1] ?? '';
  return `${origin}${path}`;
}

export const verificationService = {
  getStatus() {
    return api.get<VerificationOverview>('/Verification/status');
  },

  /** Rejects with DocumentValidationError for files refused on the device. */
  async upload(type: VerificationDocType, file: PickedFile) {
    const part = resolveUpload(type, file);
    const formData = new FormData();
    if (Platform.OS === 'web') {
      // Browsers need a real Blob; picker uris on web are blob:/data: URLs.
      const blob = await (await fetch(part.uri)).blob();
      formData.append('file', new Blob([blob], { type: part.type }), part.name);
    } else {
      // Native: React Native file part, sent by api.post via XMLHttpRequest.
      formData.append('file', part as any);
    }
    return api.post<UploadedDocument>(`/Verification/${type}`, formData);
  },

  /**
   * Documents are private; this returns a short-lived link that a browser can
   * open without the bearer token.
   */
  async getViewUrl(documentId: string) {
    const signed = await api.get<{ path: string; expiresAt: string }>(`/Verification/documents/${documentId}/signed-url`);
    return toAbsoluteApiUrl(signed.path);
  },
};

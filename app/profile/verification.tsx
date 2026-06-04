import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { api } from '@/utils/api';
import { 
  Shield, 
  FileCheck, 
  CreditCard, 
  Car, 
  Camera, 
  ArrowLeft, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  FileText,
  X,
  Eye,
  AlertCircle,
  FolderOpen,
  Image as LucideImage
} from 'lucide-react-native';

interface DocumentStatus {
  status: 'NotStarted' | 'Pending' | 'Approved' | 'Rejected';
  documentUrl?: string | null;
  originalFileName?: string | null;
  rejectionReason?: string | null;
}

interface VerificationStatus {
  status: 'Pending' | 'Approved' | 'Rejected' | 'NotStarted';
  documents: {
    license: DocumentStatus;
    aadhar: DocumentStatus;
    vehicleRc: DocumentStatus;
  };
}

export default function VerificationScreen() {
  const { theme } = useTheme();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState<string | null>(null);
  const [status, setStatus] = useState<VerificationStatus>({
    status: 'NotStarted',
    documents: {
      license: { status: 'NotStarted' },
      aadhar: { status: 'NotStarted' },
      vehicleRc: { status: 'NotStarted' },
    }
  });

  const [activeUploadType, setActiveUploadType] = useState<'license' | 'aadhar' | 'vehicle-rc' | null>(null);
  const [isOptionModalOpen, setIsOptionModalOpen] = useState(false);

  useEffect(() => {
    fetchVerificationStatus();
  }, []);

  const fetchVerificationStatus = async () => {
    try {
      const data = await api.get<any>('/Verification/status');
      setStatus({
        status: data.overallStatus || 'NotStarted',
        documents: {
          license: data.license || { status: 'NotStarted' },
          aadhar: data.aadhar || { status: 'NotStarted' },
          vehicleRc: data.vehicleRc || { status: 'NotStarted' },
        }
      });
    } catch (error) {
      console.error('Error fetching verification status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadPress = (type: 'license' | 'aadhar' | 'vehicle-rc') => {
    setActiveUploadType(type);
    setIsOptionModalOpen(true);
  };

  const handleTakePhoto = async () => {
    console.log('[Verification] handleTakePhoto triggered for type:', activeUploadType);
    if (!activeUploadType) return;

    try {
      console.log('[Verification] Requesting camera permissions...');
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      console.log('[Verification] Camera permission result:', permissionResult);
      if (permissionResult.granted === false) {
        Alert.alert('Permission Denied', 'Permission to access camera is required');
        return;
      }

      console.log('[Verification] Launching camera...');
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });
      console.log('[Verification] Camera launch result:', result);

      // Close option modal after native window returns control
      setIsOptionModalOpen(false);

      if (!result.canceled && result.assets[0].uri) {
        const asset = result.assets[0];
        await processAndUploadFile(
          activeUploadType,
          asset.uri,
          asset.fileName || `camera-capture.jpg`,
          asset.mimeType || 'image/jpeg',
          asset.fileSize
        );
      }
    } catch (error) {
      console.error('[Verification] Error launching camera:', error);
      setIsOptionModalOpen(false);
      Alert.alert('Error', 'Failed to launch camera.');
    }
  };

  const handleChooseFromGallery = async () => {
    console.log('[Verification] handleChooseFromGallery triggered for type:', activeUploadType);
    if (!activeUploadType) return;

    try {
      console.log('[Verification] Requesting media library permissions...');
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('[Verification] Media library permission result:', permissionResult);
      if (permissionResult.granted === false) {
        Alert.alert('Permission Denied', 'Permission to access gallery is required');
        return;
      }

      console.log('[Verification] Launching image library...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      console.log('[Verification] Image library result:', result);

      // Close option modal after native window returns control
      setIsOptionModalOpen(false);

      if (!result.canceled && result.assets[0].uri) {
        const asset = result.assets[0];
        await processAndUploadFile(
          activeUploadType,
          asset.uri,
          asset.fileName || `gallery-image.jpg`,
          asset.mimeType || 'image/jpeg',
          asset.fileSize
        );
      }
    } catch (error) {
      console.error('[Verification] Error opening gallery:', error);
      setIsOptionModalOpen(false);
      Alert.alert('Error', 'Failed to open gallery.');
    }
  };

  const handleSelectDocument = async () => {
    console.log('[Verification] handleSelectDocument triggered for type:', activeUploadType);
    if (!activeUploadType) return;

    try {
      console.log('[Verification] Launching document picker...');
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/*'
        ],
        copyToCacheDirectory: true,
      });
      console.log('[Verification] Document picker result:', result);

      // Close option modal after native window returns control
      setIsOptionModalOpen(false);

      if (!result.canceled && result.assets[0].uri) {
        const asset = result.assets[0];
        await processAndUploadFile(
          activeUploadType,
          asset.uri,
          asset.name,
          asset.mimeType || 'application/octet-stream',
          asset.size
        );
      }
    } catch (error) {
      console.error('[Verification] Error selecting document:', error);
      setIsOptionModalOpen(false);
      Alert.alert('Error', 'Failed to select document.');
    }
  };

  const processAndUploadFile = async (
    type: 'license' | 'aadhar' | 'vehicle-rc',
    uri: string,
    name: string,
    mimeType: string,
    size?: number
  ) => {
    // 1. Resolve and normalize MIME Type and Name
    let resolvedName = name || `${type}.jpg`;
    
    // Normalize path or uri names (sometimes DocumentPicker gives paths)
    resolvedName = resolvedName.split('/').pop() || resolvedName;

    // Detect extension
    let ext = resolvedName.split('.').pop()?.toLowerCase() || '';
    
    // If no valid extension exists in the name, infer it from the mimeType
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx'];
    if (!allowedExtensions.includes(ext)) {
      if (mimeType.includes('pdf')) {
        ext = 'pdf';
        resolvedName = resolvedName.includes('.') ? resolvedName.substring(0, resolvedName.lastIndexOf('.')) + '.pdf' : resolvedName + '.pdf';
      } else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
        ext = 'jpg';
        resolvedName = resolvedName.includes('.') ? resolvedName.substring(0, resolvedName.lastIndexOf('.')) + '.jpg' : resolvedName + '.jpg';
      } else if (mimeType.includes('png')) {
        ext = 'png';
        resolvedName = resolvedName.includes('.') ? resolvedName.substring(0, resolvedName.lastIndexOf('.')) + '.png' : resolvedName + '.png';
      } else if (mimeType.includes('gif')) {
        ext = 'gif';
        resolvedName = resolvedName.includes('.') ? resolvedName.substring(0, resolvedName.lastIndexOf('.')) + '.gif' : resolvedName + '.gif';
      } else if (mimeType.includes('word') || mimeType.includes('msword') || mimeType.includes('document')) {
        ext = 'docx';
        resolvedName = resolvedName.includes('.') ? resolvedName.substring(0, resolvedName.lastIndexOf('.')) + '.docx' : resolvedName + '.docx';
      } else {
        // Try to infer from URI extension
        const uriExt = uri.split('.').pop()?.toLowerCase() || '';
        if (allowedExtensions.includes(uriExt)) {
          ext = uriExt;
          resolvedName = resolvedName.includes('.') ? resolvedName.substring(0, resolvedName.lastIndexOf('.')) + '.' + ext : resolvedName + '.' + ext;
        }
      }
    }

    // Standardize MIME type to match the backend whitelist exactly
    let resolvedMimeType = mimeType;
    if (ext === 'pdf') resolvedMimeType = 'application/pdf';
    else if (ext === 'jpg' || ext === 'jpeg') resolvedMimeType = 'image/jpeg';
    else if (ext === 'png') resolvedMimeType = 'image/png';
    else if (ext === 'gif') resolvedMimeType = 'image/gif';
    else if (ext === 'webp') resolvedMimeType = 'image/webp';
    else if (ext === 'doc') resolvedMimeType = 'application/msword';
    else if (ext === 'docx') resolvedMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    // Verify format support on client side
    if (!allowedExtensions.includes(ext)) {
      Alert.alert(
        'Unsupported File Format',
        'Please select a valid document or image file. Supported formats: PDF, DOC, DOCX, JPG, JPEG, PNG, GIF, WEBP.'
      );
      return;
    }

    // 2. Client-Side Size Validation
    const isImage = resolvedMimeType.startsWith('image/');
    const maxSizeBytes = isImage ? 5 * 1024 * 1024 : 10 * 1024 * 1024; // 5MB photo, 10MB doc
    const limitLabel = isImage ? '5 MB' : '10 MB';

    if (size && size > maxSizeBytes) {
      Alert.alert(
        'File Too Large',
        `The selected file size (${(size / (1024 * 1024)).toFixed(1)} MB) exceeds the limit of ${limitLabel}.`
      );
      return;
    }

    setIsUploading(type);
    try {
      const formData = new FormData();
      // @ts-ignore
      formData.append('file', {
        uri,
        name: resolvedName,
        type: resolvedMimeType,
      });
      
      await api.post(`/Verification/${type}`, formData);
      Alert.alert('Success', 'Document uploaded successfully and is under review.');
      fetchVerificationStatus();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to upload document');
    } finally {
      setIsUploading(null);
      setActiveUploadType(null);
    }
  };

  const viewDocument = async (url?: string | null) => {
    if (!url) {
      Alert.alert('Not Available', 'Document URL is not available.');
      return;
    }
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch (error) {
      console.error('Error opening browser:', error);
      Alert.alert('Error', 'Could not open the document.');
    }
  };

  const renderDocStatus = (type: 'license' | 'aadhar' | 'vehicle-rc', title: string, description: string, icon: any) => {
    const docKey = type === 'vehicle-rc' ? 'vehicleRc' : type;
    const docState = status.documents[docKey];
    const Icon = icon;

    const docStatus = docState?.status || 'NotStarted';
    const isVerified = docStatus === 'Approved';
    const isRejected = docStatus === 'Rejected';

    const badgeColor = docStatus === 'Approved' ? theme.colors.success :
                       docStatus === 'Pending' ? theme.colors.warning :
                       docStatus === 'Rejected' ? '#EF4444' :
                       theme.colors.textSecondary;

    if (docStatus === 'NotStarted') {
      return (
        <TouchableOpacity
          style={[styles.uploadTapTarget, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          onPress={() => handleUploadPress(type)}
          accessible={true}
          accessibilityLabel={`Upload ${title}`}
        >
          <View style={[styles.docIcon, { backgroundColor: theme.colors.background }]}>
            <Icon size={24} color={theme.colors.primary} />
          </View>
          <View style={styles.docInfo}>
            <Text style={[styles.docTitle, { color: theme.colors.text }]}>{title}</Text>
            <Text style={[styles.docDescription, { color: theme.colors.textSecondary }]}>{description}</Text>
          </View>
          {isUploading === type ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : (
            <View style={[styles.uploadButtonCircle, { backgroundColor: theme.colors.primary }]}>
              <Camera size={16} color="#FFFFFF" />
            </View>
          )}
        </TouchableOpacity>
      );
    }

    return (
      <View style={[styles.docCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={styles.cardHeaderRow}>
          <View style={[styles.docIcon, { backgroundColor: theme.colors.surface }]}>
            <Icon size={24} color={isVerified ? theme.colors.success : theme.colors.primary} />
          </View>
          <View style={styles.docInfo}>
            <Text style={[styles.docTitle, { color: theme.colors.text }]}>{title}</Text>
            <Text style={[styles.docDescription, { color: theme.colors.textSecondary }]}>{description}</Text>
            
            {/* Status Badge */}
            <View style={[styles.badge, { backgroundColor: badgeColor + '15', borderColor: badgeColor }]}>
              <View style={[styles.badgeDot, { backgroundColor: badgeColor }]} />
              <Text style={[styles.badgeText, { color: badgeColor }]}>
                {docStatus === 'Approved' ? 'Verified' :
                 docStatus === 'Pending' ? 'Under Review' :
                 docStatus === 'Rejected' ? 'Rejected' : 'Not Uploaded'}
              </Text>
            </View>
          </View>
          
          <View style={styles.actionColumn}>
            {isUploading === type ? (
              <ActivityIndicator color={theme.colors.primary} />
            ) : (
              <View style={styles.actionButtons}>
                {/* View Document Button */}
                {docState?.documentUrl && (
                  <TouchableOpacity 
                    style={[styles.actionBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                    onPress={() => viewDocument(docState.documentUrl)}
                    accessible={true}
                    accessibilityLabel={`View uploaded ${title}`}
                  >
                    <Eye size={16} color={theme.colors.text} />
                  </TouchableOpacity>
                )}
                
                {/* Upload / Re-upload Button */}
                {docStatus === 'Rejected' && (
                  <TouchableOpacity 
                    style={[styles.actionBtn, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]}
                    onPress={() => handleUploadPress(type)}
                    accessible={true}
                    accessibilityLabel={`Upload ${title}`}
                  >
                    <Camera size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>

        {/* File Metadata Details */}
        {docState?.originalFileName && (
          <View style={[styles.metaContainer, { backgroundColor: theme.colors.surface }]}>
            <FileText size={14} color={theme.colors.textSecondary} />
            <Text style={[styles.metaText, { color: theme.colors.textSecondary }]} numberOfLines={1}>
              {docState.originalFileName}
            </Text>
          </View>
        )}

        {/* Rejection Reason Block */}
        {isRejected && docState?.rejectionReason && (
          <View style={[styles.rejectionContainer, { backgroundColor: '#EF4444' + '10', borderColor: '#EF4444' }]}>
            <AlertCircle size={16} color="#EF4444" style={{ marginTop: 2 }} />
            <View style={styles.rejectionInfo}>
              <Text style={styles.rejectionTitle}>Rejection Reason:</Text>
              <Text style={[styles.rejectionReasonText, { color: theme.colors.text }]}>
                {docState.rejectionReason}
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.colors.text }]}>Verification Center</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.content}>
          <View style={[styles.statusBanner, { 
            backgroundColor: status.status === 'Approved' ? theme.colors.success + '20' : 
                           status.status === 'Pending' ? theme.colors.warning + '20' : 
                           status.status === 'Rejected' ? '#EF444420' : 
                           theme.colors.surface,
            borderColor: status.status === 'Approved' ? theme.colors.success : 
                        status.status === 'Pending' ? theme.colors.warning : 
                        status.status === 'Rejected' ? '#EF4444' : 
                        theme.colors.border
          }]}>
            {status.status === 'Approved' ? <CheckCircle size={32} color={theme.colors.success} /> :
             status.status === 'Pending' ? <Clock size={32} color={theme.colors.warning} /> :
             status.status === 'Rejected' ? <AlertTriangle size={32} color="#EF4444" /> :
             <Shield size={32} color={theme.colors.primary} />}
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusTitle, { color: theme.colors.text }]}>
                {status.status === 'Approved' ? 'Fully Verified' : 
                 status.status === 'Pending' ? 'Verification Pending' : 
                 status.status === 'Rejected' ? 'Verification Rejected' :
                 'Not Verified'}
              </Text>
              <Text style={[styles.statusSubtitle, { color: theme.colors.textSecondary }]}>
                {status.status === 'Approved' ? 'Your account is fully trusted' : 
                 status.status === 'Pending' ? 'Our team is reviewing your docs' : 
                 status.status === 'Rejected' ? 'Please re-upload rejected document(s)' :
                 'Please upload required documents'}
              </Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Required Documents</Text>
          <View style={styles.docList}>
            {renderDocStatus('license', 'Driving License', 'Valid government driving license', FileCheck)}
            {renderDocStatus('aadhar', 'Aadhar Card', 'National identity document', CreditCard)}
            {renderDocStatus('vehicle-rc', 'Vehicle RC', 'Vehicle registration certificate', Car)}
          </View>

          <View style={[styles.infoBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <AlertTriangle size={20} color={theme.colors.warning} />
            <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
              Verification ensures safety for both drivers and passengers. Your documents are stored securely and never shared.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Custom Bottom Sheet Option Modal */}
      <Modal
        visible={isOptionModalOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsOptionModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          {/* Backdrop Touch Target */}
          <Pressable 
            style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent' }]} 
            onPress={() => setIsOptionModalOpen(false)} 
          />

          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Upload Document</Text>
              <TouchableOpacity onPress={() => setIsOptionModalOpen(false)} style={styles.closeBtn}>
                <X size={20} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>
              Select a source for your document or image. Max size: 5MB for images, 10MB for documents.
            </Text>

            <View style={styles.optionButtons}>
              <TouchableOpacity 
                style={[styles.optionBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]} 
                onPress={handleTakePhoto}
              >
                <Camera size={20} color={theme.colors.primary} />
                <Text style={[styles.optionBtnText, { color: theme.colors.text }]}>Take Photo (Camera)</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.optionBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]} 
                onPress={handleChooseFromGallery}
              >
                <LucideImage size={20} color={theme.colors.primary} />
                <Text style={[styles.optionBtnText, { color: theme.colors.text }]}>Choose from Gallery</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.optionBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]} 
                onPress={handleSelectDocument}
              >
                <FolderOpen size={20} color={theme.colors.primary} />
                <Text style={[styles.optionBtnText, { color: theme.colors.text }]}>Select PDF/Word Document</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 40,
  },
  content: {
    padding: 20,
    gap: 24,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    gap: 16,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statusSubtitle: {
    fontSize: 14,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  docList: {
    gap: 16,
  },
  docCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  docIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  docInfo: {
    flex: 1,
  },
  docTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  docDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    gap: 6,
    marginTop: 6,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  actionColumn: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    minWidth: 40,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  metaText: {
    fontSize: 12,
    flex: 1,
  },
  rejectionContainer: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    alignItems: 'flex-start',
  },
  rejectionInfo: {
    flex: 1,
  },
  rejectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  rejectionReasonText: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  closeBtn: {
    padding: 4,
  },
  optionButtons: {
    gap: 12,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  optionBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  uploadTapTarget: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    gap: 16,
  },
  uploadButtonCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

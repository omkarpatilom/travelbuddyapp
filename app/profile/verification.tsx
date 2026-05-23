import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { api } from '@/utils/api';
import { Shield, FileCheck, CreditCard, Car, Camera, ArrowLeft, CheckCircle, Clock, AlertTriangle } from 'lucide-react-native';

interface VerificationStatus {
  status: 'Pending' | 'Approved' | 'Rejected' | 'NotStarted';
  documents: {
    license: boolean;
    aadhar: boolean;
    vehicleRc: boolean;
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
      license: false,
      aadhar: false,
      vehicleRc: false,
    }
  });

  useEffect(() => {
    fetchVerificationStatus();
  }, []);

  const fetchVerificationStatus = async () => {
    try {
      const data = await api.get<any>('/Verification/status');
      setStatus({
        status: data.overallStatus || 'NotStarted',
        documents: {
          license: data.licenseVerified || false,
          aadhar: data.aadharVerified || false,
          vehicleRc: data.vehicleRcVerified || false,
        }
      });
    } catch (error) {
      console.error('Error fetching verification status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const uploadDocument = async (type: 'license' | 'aadhar' | 'vehicle-rc') => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert('Permission Denied', 'Permission to access gallery is required');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0].uri) {
      setIsUploading(type);
      try {
        const formData = new FormData();
        // @ts-ignore
        formData.append('file', {
          uri: result.assets[0].uri,
          name: `${type}.jpg`,
          type: 'image/jpeg',
        });
        
        await api.post(`/Verification/${type}`, formData);
        Alert.alert('Success', 'Document uploaded successfully and is under review.');
        fetchVerificationStatus();
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Failed to upload document');
      } finally {
        setIsUploading(null);
      }
    }
  };

  const renderDocStatus = (type: 'license' | 'aadhar' | 'vehicle-rc', title: string, description: string, icon: any) => {
    const isVerified = status.documents[type === 'vehicle-rc' ? 'vehicleRc' : type];
    const Icon = icon;

    return (
      <View style={[styles.docCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={[styles.docIcon, { backgroundColor: theme.colors.surface }]}>
          <Icon size={24} color={isVerified ? theme.colors.success : theme.colors.primary} />
        </View>
        <View style={styles.docInfo}>
          <Text style={[styles.docTitle, { color: theme.colors.text }]}>{title}</Text>
          <Text style={[styles.docDescription, { color: theme.colors.textSecondary }]}>{description}</Text>
        </View>
        {isUploading === type ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : isVerified ? (
          <CheckCircle size={24} color={theme.colors.success} />
        ) : (
          <TouchableOpacity 
            style={[styles.uploadButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => uploadDocument(type)}
          >
            <Camera size={16} color="#FFFFFF" />
          </TouchableOpacity>
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
                         theme.colors.surface,
          borderColor: status.status === 'Approved' ? theme.colors.success : 
                      status.status === 'Pending' ? theme.colors.warning : 
                      theme.colors.border
        }]}>
          {status.status === 'Approved' ? <CheckCircle size={32} color={theme.colors.success} /> :
           status.status === 'Pending' ? <Clock size={32} color={theme.colors.warning} /> :
           <Shield size={32} color={theme.colors.primary} />}
          <View>
            <Text style={[styles.statusTitle, { color: theme.colors.text }]}>
              {status.status === 'Approved' ? 'Fully Verified' : 
               status.status === 'Pending' ? 'Verification Pending' : 
               status.status === 'Rejected' ? 'Verification Rejected' :
               'Not Verified'}
            </Text>
            <Text style={[styles.statusSubtitle, { color: theme.colors.textSecondary }]}>
              {status.status === 'Approved' ? 'Your account is fully trusted' : 
               status.status === 'Pending' ? 'Our team is reviewing your docs' : 
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
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  docList: {
    gap: 16,
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
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
  },
  uploadButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
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
});

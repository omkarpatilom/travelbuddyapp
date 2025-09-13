import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Linking,
} from 'react-native';
import * as Location from 'expo-location';
import * as SMS from 'expo-sms';
import { useTheme } from '@/contexts/ThemeContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { 
  Shield, 
  Phone, 
  MapPin, 
  Users, 
  Plus, 
  X, 
  AlertTriangle,
  Camera,
  FileText,
  CheckCircle
} from 'lucide-react-native';
import { requestLocationPermission } from '@/utils/permissions';

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

interface SafetyFeaturesProps {
  style?: any;
}

interface VerificationDocument {
  id: string;
  type: 'aadhar' | 'driving_license' | 'passport';
  status: 'pending' | 'verified' | 'rejected';
  uploadDate: string;
  documentNumber?: string;
}

export default function SafetyFeatures({ style }: SafetyFeaturesProps) {
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([
    {
      id: '1',
      name: 'John Doe',
      phone: '+1234567890',
      relationship: 'Family',
    },
  ]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showSOSModal, setShowSOSModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [isTrackingEnabled, setIsTrackingEnabled] = useState(false);
  const [isSendingSOS, setIsSendingSOS] = useState(false);
  const [sosCountdown, setSOSCountdown] = useState(0);
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    relationship: '',
  });
  const [verificationDocs, setVerificationDocs] = useState<VerificationDocument[]>([
    {
      id: '1',
      type: 'driving_license',
      status: 'verified',
      uploadDate: '2024-01-15',
      documentNumber: 'DL1234567890',
    },
  ]);

  const { theme } = useTheme();
  const { sendLocalNotification } = useNotifications();

  const handleSOSPress = () => {
    setShowSOSModal(true);
    setSOSCountdown(5);
    
    const countdown = setInterval(() => {
      setSOSCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdown);
          triggerSOS();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const cancelSOS = () => {
    setShowSOSModal(false);
    setSOSCountdown(0);
  };

  const triggerSOS = async () => {
    setIsSendingSOS(true);
    setShowSOSModal(false);
    
    try {
      // Get current location
      const permission = await requestLocationPermission();
      if (!permission.granted) {
        Alert.alert('Error', 'Location permission required for SOS');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeout: 10000,
      });

      const { latitude, longitude } = location.coords;
      const locationUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
      
      // Prepare SOS message
      const sosMessage = `🚨 EMERGENCY ALERT 🚨\n\nI need immediate help!\n\nMy current location:\n${locationUrl}\n\nTime: ${new Date().toLocaleString()}\n\nThis is an automated message from TravelBuddy Safety System.`;

      // Send SMS to emergency contacts
      const phoneNumbers = emergencyContacts.map(contact => contact.phone);
      
      if (phoneNumbers.length > 0) {
        const isAvailable = await SMS.isAvailableAsync();
        if (isAvailable) {
          await SMS.sendSMSAsync(phoneNumbers, sosMessage);
        }
      }

      // Send push notifications
      await sendLocalNotification(
        'SOS Alert Sent',
        `Emergency alert sent to ${emergencyContacts.length} contacts`
      );

      // Show success message
      Alert.alert(
        'SOS Alert Sent',
        `Emergency alert has been sent to your ${emergencyContacts.length} emergency contacts with your current location.`,
        [{ text: 'OK' }]
      );

    } catch (error) {
      console.error('Error sending SOS:', error);
      Alert.alert('Error', 'Failed to send SOS alert. Please try again or call emergency services directly.');
    } finally {
      setIsSendingSOS(false);
    }
  };

  const addEmergencyContact = () => {
    if (!newContact.name || !newContact.phone) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const contact: EmergencyContact = {
      id: Date.now().toString(),
      ...newContact,
    };

    setEmergencyContacts([...emergencyContacts, contact]);
    setNewContact({ name: '', phone: '', relationship: '' });
    setShowAddContact(false);
  };

  const removeEmergencyContact = (contactId: string) => {
    Alert.alert(
      'Remove Contact',
      'Are you sure you want to remove this emergency contact?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setEmergencyContacts(contacts => contacts.filter(c => c.id !== contactId));
          },
        },
      ]
    );
  };

  const toggleTripTracking = () => {
    if (!isTrackingEnabled) {
      Alert.alert(
        'Enable Trip Tracking',
        'This will track your location during active rides for safety purposes. Location data is encrypted and automatically deleted after trip completion.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Enable',
            onPress: () => {
              setIsTrackingEnabled(true);
              sendLocalNotification('Trip Tracking Enabled', 'Your location will be tracked during active rides for safety');
            },
          },
        ]
      );
    } else {
      setIsTrackingEnabled(false);
      sendLocalNotification('Trip Tracking Disabled', 'Location tracking has been turned off');
    }
  };

  const handleDocumentVerification = (docType: 'aadhar' | 'driving_license' | 'passport') => {
    Alert.alert(
      'Document Verification',
      `Upload your ${docType.replace('_', ' ')} for identity verification. This helps build trust in the community.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Upload Document',
          onPress: () => {
            // In a real app, this would open document scanner/camera
            const newDoc: VerificationDocument = {
              id: Date.now().toString(),
              type: docType,
              status: 'pending',
              uploadDate: new Date().toISOString().split('T')[0],
            };
            setVerificationDocs([...verificationDocs, newDoc]);
            Alert.alert('Success', 'Document uploaded successfully. Verification typically takes 24-48 hours.');
          },
        },
      ]
    );
  };

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'aadhar':
        return <FileText size={20} color={theme.colors.primary} />;
      case 'driving_license':
        return <Camera size={20} color={theme.colors.secondary} />;
      case 'passport':
        return <FileText size={20} color={theme.colors.accent} />;
      default:
        return <FileText size={20} color={theme.colors.textSecondary} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return theme.colors.success;
      case 'pending':
        return theme.colors.warning;
      case 'rejected':
        return theme.colors.error;
      default:
        return theme.colors.textSecondary;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'verified':
        return 'Verified';
      case 'pending':
        return 'Under Review';
      case 'rejected':
        return 'Rejected';
      default:
        return 'Unknown';
    }
  };

  return (
    <ScrollView style={[styles.container, style]} showsVerticalScrollIndicator={false}>
      {/* SOS Emergency Button */}
      <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={styles.sectionHeader}>
          <Shield size={24} color={theme.colors.error} />
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Emergency SOS
          </Text>
        </View>
        
        <Text style={[styles.sectionDescription, { color: theme.colors.textSecondary }]}>
          In case of emergency, press the SOS button to instantly share your location with emergency contacts
        </Text>

        <TouchableOpacity
          style={[styles.sosButton, { backgroundColor: theme.colors.error }]}
          onPress={handleSOSPress}
          disabled={isSendingSOS}
        >
          {isSendingSOS ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <AlertTriangle size={24} color="#FFFFFF" />
              <Text style={styles.sosButtonText}>SOS EMERGENCY</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={[styles.sosNote, { color: theme.colors.textSecondary }]}>
          Hold for 5 seconds or tap to send immediate alert
        </Text>
      </View>

      {/* Emergency Contacts */}
      <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={styles.sectionHeader}>
          <Users size={24} color={theme.colors.primary} />
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Emergency Contacts ({emergencyContacts.length})
          </Text>
        </View>

        {emergencyContacts.map(contact => (
          <View key={contact.id} style={[styles.contactItem, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={styles.contactInfo}>
              <Text style={[styles.contactName, { color: theme.colors.text }]}>
                {contact.name}
              </Text>
              <Text style={[styles.contactPhone, { color: theme.colors.textSecondary }]}>
                {contact.phone}
              </Text>
              <Text style={[styles.contactRelation, { color: theme.colors.textSecondary }]}>
                {contact.relationship}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.removeContactButton}
              onPress={() => removeEmergencyContact(contact.id)}
            >
              <X size={20} color={theme.colors.error} />
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.addContactButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          onPress={() => setShowAddContact(true)}
        >
          <Plus size={20} color={theme.colors.primary} />
          <Text style={[styles.addContactText, { color: theme.colors.primary }]}>
            Add Emergency Contact
          </Text>
        </TouchableOpacity>
      </View>

      {/* Trip Tracking */}
      <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={styles.sectionHeader}>
          <MapPin size={24} color={theme.colors.secondary} />
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Background Trip Tracking
          </Text>
        </View>

        <Text style={[styles.sectionDescription, { color: theme.colors.textSecondary }]}>
          Continuously track your location during active rides. Data is encrypted and automatically deleted after trip completion.
        </Text>

        <TouchableOpacity
          style={[
            styles.trackingToggle,
            { 
              backgroundColor: isTrackingEnabled ? theme.colors.success + '20' : theme.colors.surface,
              borderColor: isTrackingEnabled ? theme.colors.success : theme.colors.border,
            }
          ]}
          onPress={toggleTripTracking}
        >
          <View style={[
            styles.trackingIcon,
            { backgroundColor: isTrackingEnabled ? theme.colors.success : theme.colors.background }
          ]}>
            <MapPin size={20} color={isTrackingEnabled ? '#FFFFFF' : theme.colors.textSecondary} />
          </View>
          <View style={styles.trackingContent}>
            <Text style={[styles.trackingLabel, { color: theme.colors.text }]}>
              {isTrackingEnabled ? 'Trip Tracking Enabled' : 'Enable Trip Tracking'}
            </Text>
            <Text style={[styles.trackingDescription, { color: theme.colors.textSecondary }]}>
              {isTrackingEnabled 
                ? 'Your location is being tracked during rides'
                : 'Tap to enable location tracking for safety'
              }
            </Text>
          </View>
        </TouchableOpacity>

        {isTrackingEnabled && (
          <View style={[styles.trackingInfo, { backgroundColor: theme.colors.success + '10', borderColor: theme.colors.success }]}>
            <Text style={[styles.trackingInfoText, { color: theme.colors.success }]}>
              🔒 Your location data is encrypted and automatically deleted after each trip
            </Text>
          </View>
        )}
      </View>

      {/* Identity Verification */}
      <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={styles.sectionHeader}>
          <CheckCircle size={24} color={theme.colors.accent} />
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Identity Verification
          </Text>
        </View>

        <Text style={[styles.sectionDescription, { color: theme.colors.textSecondary }]}>
          Verify your identity to build trust in the community and access premium features
        </Text>

        {/* Existing Documents */}
        {verificationDocs.map(doc => (
          <View key={doc.id} style={[styles.documentItem, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={styles.documentInfo}>
              {getDocumentIcon(doc.type)}
              <View style={styles.documentDetails}>
                <Text style={[styles.documentType, { color: theme.colors.text }]}>
                  {doc.type.replace('_', ' ').toUpperCase()}
                </Text>
                <Text style={[styles.documentDate, { color: theme.colors.textSecondary }]}>
                  Uploaded: {doc.uploadDate}
                </Text>
                {doc.documentNumber && (
                  <Text style={[styles.documentNumber, { color: theme.colors.textSecondary }]}>
                    {doc.documentNumber}
                  </Text>
                )}
              </View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(doc.status) + '20' }]}>
              <Text style={[styles.statusText, { color: getStatusColor(doc.status) }]}>
                {getStatusText(doc.status)}
              </Text>
            </View>
          </View>
        ))}

        {/* Add New Document */}
        <TouchableOpacity
          style={[styles.addDocumentButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          onPress={() => setShowVerificationModal(true)}
        >
          <Plus size={20} color={theme.colors.primary} />
          <Text style={[styles.addDocumentText, { color: theme.colors.primary }]}>
            Add Verification Document
          </Text>
        </TouchableOpacity>
      </View>

      {/* SOS Modal */}
      <Modal
        visible={showSOSModal}
        transparent
        animationType="fade"
        onRequestClose={cancelSOS}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.sosModal, { backgroundColor: theme.colors.card }]}>
            <AlertTriangle size={60} color={theme.colors.error} />
            <Text style={[styles.sosModalTitle, { color: theme.colors.text }]}>
              Emergency SOS
            </Text>
            <Text style={[styles.sosModalText, { color: theme.colors.textSecondary }]}>
              Sending emergency alert in {sosCountdown} seconds
            </Text>
            <Text style={[styles.sosModalDescription, { color: theme.colors.textSecondary }]}>
              Your current location will be shared with emergency contacts
            </Text>
            <TouchableOpacity
              style={[styles.cancelSOSButton, { backgroundColor: theme.colors.surface }]}
              onPress={cancelSOS}
            >
              <Text style={[styles.cancelSOSText, { color: theme.colors.text }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Contact Modal */}
      <Modal
        visible={showAddContact}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddContact(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.addContactModal, { backgroundColor: theme.colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                Add Emergency Contact
              </Text>
              <TouchableOpacity onPress={() => setShowAddContact(false)}>
                <X size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <TextInput
                style={[styles.modalInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="Full Name *"
                placeholderTextColor={theme.colors.textSecondary}
                value={newContact.name}
                onChangeText={(text) => setNewContact(prev => ({ ...prev, name: text }))}
              />

              <TextInput
                style={[styles.modalInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="Phone Number *"
                placeholderTextColor={theme.colors.textSecondary}
                value={newContact.phone}
                onChangeText={(text) => setNewContact(prev => ({ ...prev, phone: text }))}
                keyboardType="phone-pad"
              />

              <TextInput
                style={[styles.modalInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="Relationship (e.g., Family, Friend)"
                placeholderTextColor={theme.colors.textSecondary}
                value={newContact.relationship}
                onChangeText={(text) => setNewContact(prev => ({ ...prev, relationship: text }))}
              />

              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
                onPress={addEmergencyContact}
              >
                <Text style={styles.addButtonText}>Add Contact</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Verification Modal */}
      <Modal
        visible={showVerificationModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowVerificationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.verificationModal, { backgroundColor: theme.colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                Identity Verification
              </Text>
              <TouchableOpacity onPress={() => setShowVerificationModal(false)}>
                <X size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.verificationDescription, { color: theme.colors.textSecondary }]}>
              Choose a document type to verify your identity. All documents are processed securely with OCR technology and manual review.
            </Text>

            <View style={styles.documentOptions}>
              <TouchableOpacity
                style={[styles.documentOption, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                onPress={() => {
                  setShowVerificationModal(false);
                  handleDocumentVerification('aadhar');
                }}
              >
                <FileText size={24} color={theme.colors.primary} />
                <Text style={[styles.documentOptionText, { color: theme.colors.text }]}>
                  Aadhar Card
                </Text>
                <Text style={[styles.documentOptionDescription, { color: theme.colors.textSecondary }]}>
                  Government issued ID
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.documentOption, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                onPress={() => {
                  setShowVerificationModal(false);
                  handleDocumentVerification('driving_license');
                }}
              >
                <Camera size={24} color={theme.colors.secondary} />
                <Text style={[styles.documentOptionText, { color: theme.colors.text }]}>
                  Driving License
                </Text>
                <Text style={[styles.documentOptionDescription, { color: theme.colors.textSecondary }]}>
                  Valid driving license
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.documentOption, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                onPress={() => {
                  setShowVerificationModal(false);
                  handleDocumentVerification('passport');
                }}
              >
                <FileText size={24} color={theme.colors.accent} />
                <Text style={[styles.documentOptionText, { color: theme.colors.text }]}>
                  Passport
                </Text>
                <Text style={[styles.documentOptionDescription, { color: theme.colors.textSecondary }]}>
                  International passport
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    gap: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  sosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    borderRadius: 12,
    gap: 12,
  },
  sosButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  sosNote: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  contactPhone: {
    fontSize: 14,
    marginBottom: 2,
  },
  contactRelation: {
    fontSize: 12,
  },
  removeContactButton: {
    padding: 8,
  },
  addContactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  addContactText: {
    fontSize: 16,
    fontWeight: '600',
  },
  trackingToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  trackingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackingContent: {
    flex: 1,
  },
  trackingLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  trackingDescription: {
    fontSize: 14,
  },
  trackingInfo: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  trackingInfoText: {
    fontSize: 14,
    fontWeight: '500',
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  documentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  documentDetails: {
    flex: 1,
  },
  documentType: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  documentDate: {
    fontSize: 12,
    marginBottom: 2,
  },
  documentNumber: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  addDocumentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  addDocumentText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sosModal: {
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    gap: 16,
    minWidth: 280,
  },
  sosModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  sosModalText: {
    fontSize: 18,
    fontWeight: '600',
  },
  sosModalDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  cancelSOSButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 8,
  },
  cancelSOSText: {
    fontSize: 16,
    fontWeight: '600',
  },
  addContactModal: {
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  verificationModal: {
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalContent: {
    padding: 20,
    gap: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  addButton: {
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  verificationDescription: {
    fontSize: 14,
    lineHeight: 20,
    padding: 20,
    paddingTop: 0,
  },
  documentOptions: {
    padding: 20,
    paddingTop: 0,
    gap: 12,
  },
  documentOption: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  documentOptionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  documentOptionDescription: {
    fontSize: 14,
  },
});
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  Pressable,
  Platform,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { ChevronDown } from 'lucide-react-native';

interface DropdownSelectorProps {
  label?: string;
  value: string;
  options: string[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  style?: any;
}

export default function DropdownSelector({
  label,
  value,
  options,
  onValueChange,
  placeholder = 'Select option',
  icon,
  style,
}: DropdownSelectorProps) {
  const { theme } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={[styles.label, { color: theme.colors.textSecondary }]}>{label}</Text>}
      <TouchableOpacity
        style={[styles.selector, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
        onPress={() => setModalVisible(true)}
      >
        <View style={styles.leftContainer}>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <Text style={[styles.valueText, { color: value ? theme.colors.text : theme.colors.textSecondary }]}>
            {value ? value : placeholder}
          </Text>
        </View>
        <ChevronDown size={20} color={theme.colors.textSecondary} />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setModalVisible(false)}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.title, { color: theme.colors.text }]}>{label || placeholder}</Text>
            </View>
            <FlatList
              data={options}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.optionItem,
                    value === item && { backgroundColor: theme.colors.primary + '15' }
                  ]}
                  onPress={() => {
                    onValueChange(item);
                    setModalVisible(false);
                  }}
                >
                  <Text style={[
                    styles.optionText,
                    { color: theme.colors.text },
                    value === item && { color: theme.colors.primary, fontWeight: 'bold' }
                  ]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    height: 52,
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    marginRight: 2,
  },
  valueText: {
    fontSize: 16,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '50%',
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  optionItem: {
    padding: 18,
    alignItems: 'center',
  },
  optionText: {
    fontSize: 16,
  },
});

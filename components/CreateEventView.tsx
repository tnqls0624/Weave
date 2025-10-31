import { MaterialIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Event, RepeatOption, User } from '../types';
import { toYYYYMMDD } from '../utils/date';
import DatePicker from './DatePicker';

interface CreateEventViewProps {
  onSave: (eventData: Omit<Event, 'id' | 'calendarId'>, eventId?: string) => void;
  users: User[];
  currentUser: User;
  setActiveView: (view: string) => void;
  eventToEdit: Event | null;
}

const CreateEventView: React.FC<CreateEventViewProps> = ({ onSave, users, currentUser, setActiveView, eventToEdit }) => {
  const [prompt, setPrompt] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(toYYYYMMDD(new Date()));
  const [endDate, setEndDate] = useState<string | undefined>(undefined);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const [participantIds, setParticipantIds] = useState<string[]>([currentUser.id]);
  const [repeat, setRepeat] = useState<RepeatOption>('none');

  const isEditing = !!eventToEdit;

  useEffect(() => {
    if (eventToEdit) {
      setTitle(eventToEdit.title);
      setDescription(eventToEdit.description || '');
      setStartDate(eventToEdit.startDate);
      setEndDate(eventToEdit.endDate);
      setParticipantIds(eventToEdit.participantIds);
      setRepeat(eventToEdit.repeat || 'none'); 
    } else {
        setTitle('');
        setDescription('');
        setStartDate(toYYYYMMDD(new Date()));
        setEndDate(undefined);
        setParticipantIds([currentUser.id]);
        setRepeat('none');
    }
  }, [eventToEdit, currentUser.id]);

  const handleParse = async () => {
    if (!prompt.trim()) return;
    setIsParsing(true);
    setError(null);
    // TODO: Implement Gemini service integration
    setError("AI parsing not yet implemented");
    setIsParsing(false);
  };

  const handleSubmit = () => {
    if (title && startDate && participantIds.length > 0) {
      const eventData: Omit<Event, 'id' | 'calendarId'> = { 
        title, 
        description: description || undefined,
        startDate, 
        participantIds, 
        repeat,
        endDate: endDate && endDate !== startDate ? endDate : undefined,
        startTime: undefined,
        endTime: undefined,
        location: eventToEdit?.location,
      };
      onSave(eventData, eventToEdit?.id);
    } else {
      setError("Please add a title, start date, and at least one participant.");
    }
  };

  const toggleParticipant = (id: string) => {
    setParticipantIds(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  const formattedDate = (start: string, end?: string) => {
      if (!start) return '연도. 월. 일.';
      const startDateObj = new Date(start + 'T00:00:00');
      const formattedStart = startDateObj.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\.$/, '');
      if (!end || start === end) {
          return formattedStart;
      }
      const endDateObj = new Date(end + 'T00:00:00');
      const formattedEnd = endDateObj.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\.$/, '');
      return `${formattedStart} - ${formattedEnd}`;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Pressable onPress={() => setActiveView('calendar')} style={styles.button}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{isEditing ? 'Edit Event' : 'New Event'}</Text>
        <Pressable onPress={handleSubmit} style={styles.saveButton}>
          <Text style={styles.saveButtonText}>{isEditing ? 'Update' : 'Save'}</Text>
        </Pressable>
      </View>
      
      <View style={styles.form}>
        {!isEditing && (
          <View style={styles.aiSection}>
            <Text style={styles.sectionTitle}>Quick Add with AI ✨</Text>
            <TextInput
              value={prompt}
              onChangeText={setPrompt}
              placeholder="e.g., 'Team lunch tomorrow'"
              style={styles.textArea}
              multiline
              numberOfLines={4}
            />
            <Pressable 
              onPress={handleParse} 
              disabled={isParsing} 
              style={[styles.aiButton, isParsing && styles.aiButtonDisabled]}
            >
              <Text style={styles.aiButtonText}>{isParsing ? 'Parsing...' : 'Fill Details'}</Text>
            </Pressable>
          </View>
        )}
        
        <View style={styles.formSection}>
          <TextInput 
            value={title} 
            onChangeText={setTitle} 
            placeholder="Event Title" 
            style={styles.input} 
          />
          
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Add description..."
            style={styles.textArea}
            multiline
            numberOfLines={4}
          />

          <View style={styles.dateSection}>
            <Text style={styles.dateLabel}>날짜</Text>
            <Pressable 
              onPress={() => setIsDatePickerOpen(true)} 
              style={styles.dateButton}
            >
              <Text style={styles.dateText}>{formattedDate(startDate, endDate)}</Text>
              <MaterialIcons name="event" size={20} color="#6b7280" />
            </Pressable>
            {isDatePickerOpen && (
              <DatePicker 
                value={{ start: startDate, end: endDate }}
                onChange={({ start, end }) => {
                  setStartDate(start);
                  setEndDate(end);
                  if (end) {
                    setIsDatePickerOpen(false);
                  }
                }}
                onClose={() => setIsDatePickerOpen(false)}
              />
            )}
          </View>
          
          <View style={styles.pickerSection}>
            <Text style={styles.pickerLabel}>Repeat</Text>
            <Picker
              selectedValue={repeat}
              onValueChange={(itemValue) => setRepeat(itemValue)}
              style={styles.picker}
            >
              <Picker.Item label="Does not repeat" value="none" />
              <Picker.Item label="Daily" value="daily" />
              <Picker.Item label="Weekly" value="weekly" />
              <Picker.Item label="Monthly" value="monthly" />
            </Picker>
          </View>

          <View style={styles.participantsSection}>
            <Text style={styles.participantsTitle}>Participants</Text>
            <View style={styles.participantsList}>
              {users.map(user => (
                <Pressable 
                  key={user.id} 
                  onPress={() => toggleParticipant(user.id)} 
                  style={styles.participantButton}
                >
                  <Image 
                    source={{ uri: user.avatarUrl }} 
                    style={[
                      styles.participantAvatar,
                      participantIds.includes(user.id) && styles.selectedParticipant
                    ]} 
                  />
                  {participantIds.includes(user.id) && (
                    <View style={styles.checkIcon}>
                      <MaterialIcons name="check" size={12} color="#fff" />
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 32,
  },
  contentContainer: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  button: {
    padding: 8,
  },
  cancelButton: {
    color: '#2563eb',
    fontWeight: '600',
    fontSize: 16,
  },
  cancelButtonText: {
    color: '#2563eb',
    fontWeight: '600',
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    fontWeight: '600',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  saveButtonText: {
    color: '#fff',
  },
  form: {
    gap: 24,
  },
  aiSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    gap: 12,
  },
  sectionTitle: {
    fontWeight: 'bold',
    color: '#374151',
    fontSize: 16,
  },
  formSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    gap: 16,
  },
  input: {
    fontSize: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    color: '#1f2937',
  },
  textArea: {
    fontSize: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    color: '#1f2937',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  dateSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    paddingVertical: 12,
    position: 'relative',
  },
  dateLabel: {
    fontSize: 16,
    color: '#9ca3af',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    fontSize: 16,
    color: '#1f2937',
  },
  pickerSection: {
    gap: 8,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  picker: {
    backgroundColor: '#fff',
  },
  participantsSection: {
    gap: 12,
  },
  participantsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  participantsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  participantButton: {
    position: 'relative',
  },
  participantAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 4,
    borderColor: 'transparent',
    opacity: 0.5,
  },
  selectedParticipant: {
    borderColor: '#3b82f6',
    opacity: 1,
  },
  checkIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    backgroundColor: '#10b981',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  aiButton: {
    backgroundColor: '#1f2937',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  aiButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  aiButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  errorContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  errorText: {
    color: '#ef4444',
    fontWeight: '500',
    fontSize: 14,
  },
});

export default CreateEventView;

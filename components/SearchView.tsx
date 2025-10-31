import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Event } from '../types';

interface SearchViewProps {
  isOpen: boolean;
  onClose: () => void;
  events: Event[];
  onEventSelect: (event: Event) => void;
}

const SearchView: React.FC<SearchViewProps> = ({ isOpen, onClose, events, onEventSelect }) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      setQuery('');
    }
  }, [isOpen]);

  const filteredEvents = React.useMemo(() => {
    if (!query.trim()) {
      return [];
    }
    return events.filter(event => 
      event.title.toLowerCase().includes(query.toLowerCase())
    ).sort((a, b) => {
      const dateA = a.startTime ? new Date(`${a.startDate}T${a.startTime}`) : new Date(a.startDate + 'T00:00:00');
      const dateB = b.startTime ? new Date(`${b.startDate}T${b.startTime}`) : new Date(b.startDate + 'T00:00:00');
      return dateA.getTime() - dateB.getTime();
    });
  }, [query, events]);

  const handleSelect = (event: Event) => {
    onEventSelect(event);
    onClose();
  };
  
  const formatEventDate = (event: Event) => {
    const date = new Date(`${event.startDate}T00:00:00`);
    const datePart = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
    return `${datePart} at ${event.startTime || 'all day'}`;
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.container} onStartShouldSetResponder={() => false}>
          <View style={styles.searchContainer}>
            <View style={styles.inputContainer}>
              <MaterialIcons name="search" size={20} color="#9ca3af" style={styles.searchIcon} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search for events..."
                style={styles.input}
                autoFocus
              />
              <Pressable onPress={onClose} style={styles.closeButton}>
                <MaterialIcons name="close" size={24} color="#6b7280" />
              </Pressable>
            </View>

            <View style={styles.results}>
              {query.trim() && (
                <>
                  {filteredEvents.length > 0 ? (
                    filteredEvents.map(event => (
                      <Pressable 
                        key={event.id} 
                        onPress={() => handleSelect(event)} 
                        style={styles.resultItem}
                      >
                        <View style={styles.iconContainer}>
                          <MaterialIcons name="event" size={24} color="#6b7280" />
                        </View>
                        <View style={styles.resultContent}>
                          <Text style={styles.resultTitle}>{event.title}</Text>
                          <Text style={styles.resultDate}>{formatEventDate(event)}</Text>
                        </View>
                      </Pressable>
                    ))
                  ) : (
                    <View style={styles.noResults}>
                      <Text style={styles.noResultsText}>No events found for "{query}".</Text>
                    </View>
                  )}
                </>
              )}
            </View>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(243, 244, 246, 0.7)',
  },
  container: {
    position: 'absolute',
    top: 100,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  searchContainer: {
    width: '100%',
    maxWidth: 512,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 18,
    paddingVertical: 12,
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  results: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  resultContent: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  resultDate: {
    fontSize: 14,
    color: '#6b7280',
  },
  noResults: {
    padding: 24,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  noResultsText: {
    fontSize: 14,
    color: '#6b7280',
  },
});

export default SearchView;

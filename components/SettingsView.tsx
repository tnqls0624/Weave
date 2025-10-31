import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Text, Pressable, Image, Switch } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { User } from '../types';

type SettingsPage = 'main' | 'account' | 'tags' | 'notifications' | 'privacy';

interface SettingsViewProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
}

const SettingsView: React.FC<SettingsViewProps> = ({ users, setUsers }) => {
  const [page, setPage] = useState<SettingsPage>('main');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const availableColors = ['red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'];

  const handleColorChange = (userId: string, color: string) => {
    setUsers(currentUsers => currentUsers.map(u => u.id === userId ? { ...u, color } : u));
  };

  const getColorCode = (colorName: string) => {
    const colorMap: { [key: string]: string } = {
      red: '#ef4444',
      orange: '#f97316',
      amber: '#f59e0b',
      yellow: '#eab308',
      lime: '#84cc16',
      green: '#22c55e',
      emerald: '#10b981',
      teal: '#14b8a6',
      cyan: '#06b6d4',
      blue: '#3b82f6',
      indigo: '#6366f1',
      violet: '#8b5cf6',
      purple: '#a855f7',
      fuchsia: '#d946ef',
      pink: '#ec4899',
      rose: '#f43f5e',
    };
    return colorMap[colorName] || '#6b7280';
  };

  const renderMainPage = () => (
    <>
      <View style={styles.card}>
        <SettingsItem icon="person" label="Account" onPress={() => setPage('account')} />
        <SettingsItem icon="local-offer" label="Tag Settings" onPress={() => setPage('tags')} />
        <SettingsItem icon="notifications" label="Notifications" onPress={() => setPage('notifications')} />
        <SettingsItem icon="security" label="Privacy & Security" onPress={() => setPage('privacy')} isLast={true} />
      </View>

      <View style={styles.card}>
        <Pressable style={styles.logoutButton}>
          <MaterialIcons name="logout" size={24} color="#dc2626" />
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
      </View>
    </>
  );

  const renderSubPage = (title: string, children: React.ReactNode) => (
    <View>
      <Pressable onPress={() => setPage('main')} style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={20} color="#6b7280" />
        <Text style={styles.backText}>Back</Text>
      </Pressable>
      <View style={styles.card}>
        <Text style={styles.pageTitle}>{title}</Text>
        {children}
      </View>
    </View>
  );

  const renderPage = () => {
    switch(page) {
      case 'main': return renderMainPage();
      case 'account': return renderSubPage('Account', <Text style={styles.placeholder}>Account settings will be available here.</Text>);
      case 'tags': return renderSubPage('Tag & Color Settings', (
          <View>
            <Text style={styles.sectionTitle}>User Colors</Text>
            <View style={styles.colorsSection}>
              {users.map(user => (
                <View key={user.id} style={styles.colorRow}>
                  <View style={styles.userInfo}>
                    <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
                    <Text style={styles.userName}>{user.name}</Text>
                  </View>
                  <View style={styles.colorOptions}>
                    {availableColors.slice(0, 8).map(color => (
                      <Pressable 
                        key={color} 
                        onPress={() => handleColorChange(user.id, color)} 
                        style={[
                          styles.colorButton,
                          { backgroundColor: getColorCode(color) },
                          user.color === color && styles.selectedColor
                        ]}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </View>
        ));
      case 'notifications': return renderSubPage('Notifications', (
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>New Event Notifications</Text>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
            thumbColor="#fff"
          />
        </View>
      ));
      case 'privacy': return renderSubPage('Privacy & Security', <Text style={styles.placeholder}>Privacy settings will be available here.</Text>);
      default: return renderMainPage();
    }
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      {renderPage()}
    </ScrollView>
  );
};

const SettingsItem: React.FC<{icon: string, label: string, onPress: () => void, isLast?: boolean}> = ({ icon, label, onPress, isLast }) => (
  <Pressable
    onPress={onPress}
    style={[styles.settingsItem, !isLast && styles.settingsItemBorder]}
  >
    <View style={styles.iconContainer}>
      <MaterialIcons name={icon as keyof typeof MaterialIcons.glyphMap} size={24} color="#6b7280" />
    </View>
    <Text style={styles.settingsItemText}>{label}</Text>
    <MaterialIcons name="chevron-right" size={20} color="#9ca3af" />
  </Pressable>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 24,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  settingsItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
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
  settingsItemText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    color: '#dc2626',
  },
  logoutText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
    marginLeft: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
    marginLeft: 8,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  placeholder: {
    fontSize: 16,
    color: '#6b7280',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  colorsSection: {
    gap: 16,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  colorOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColor: {
    borderColor: '#3b82f6',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
});

export default SettingsView;

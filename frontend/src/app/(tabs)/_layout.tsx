import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import React from 'react';

import { colors } from '@common/dependent';

import { HeaderBrand, SettingsButton } from '../../screens/dependent/HeaderParts';

type IconName = keyof typeof Ionicons.glyphMap;

const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'index', title: 'Tailor', icon: 'sparkles-outline', iconActive: 'sparkles' },
  { name: 'tracker', title: 'Tracker', icon: 'briefcase-outline', iconActive: 'briefcase' },
  { name: 'credentials', title: 'Logins', icon: 'key-outline', iconActive: 'key' },
  { name: 'profile', title: 'Profile', icon: 'person-outline', iconActive: 'person' },
  { name: 'history', title: 'History', icon: 'folder-open-outline', iconActive: 'folder-open' },
];

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: false,
        headerTitle: () => <HeaderBrand />,
        headerRight: () => <SettingsButton />,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons name={focused ? t.iconActive : t.icon} size={size} color={String(color)} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

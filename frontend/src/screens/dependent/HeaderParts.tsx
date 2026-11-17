import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font, spacing } from '@common/dependent';

const logo = require('../../../assets/images/logo.png');

export function HeaderBrand() {
  return (
    <View style={styles.brand} accessibilityRole="header">
      <Image source={logo} style={styles.logo} accessibilityLabel="Irish logo" />
      <Text style={styles.name}>Irish</Text>
    </View>
  );
}

export function SettingsButton() {
  return (
    <Pressable
      onPress={() => router.push('/settings')}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Settings"
      style={styles.settings}
    >
      <Ionicons name="settings-outline" size={22} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logo: { width: 30, height: 30, borderRadius: 8 },
  name: { fontSize: font.h2, fontWeight: '800', color: colors.text, letterSpacing: 0.3 },
  settings: { paddingHorizontal: spacing.lg },
});

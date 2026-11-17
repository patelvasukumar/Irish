import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, font, spacing } from './theme';

/**
 * Renders the small Markdown subset the resume writer produces:
 * "# " name, "## " headings, "- " bullets, **bold** and _italic_ text.
 */
export function MarkdownView({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <View style={styles.page}>
      {lines.map((raw, i) => {
        const line = raw.trim();
        if (!line) return <View key={i} style={{ height: spacing.sm }} />;
        if (line.startsWith('# ')) return <Text key={i} style={styles.h1}>{inline(line.slice(2))}</Text>;
        if (line.startsWith('## ')) return <Text key={i} style={styles.h2}>{inline(line.slice(3))}</Text>;
        if (line.startsWith('### ')) return <Text key={i} style={styles.h3}>{inline(line.slice(4))}</Text>;
        if (/^[-*•]\s/.test(line)) {
          return (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.body}>{inline(line.slice(2))}</Text>
            </View>
          );
        }
        return <Text key={i} style={styles.body}>{inline(line)}</Text>;
      })}
    </View>
  );
}

/** Split a line into plain / bold / italic pieces. */
function inline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).filter(Boolean);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <Text key={i} style={styles.bold}>{p.slice(2, -2)}</Text>;
    if (p.startsWith('_') && p.endsWith('_') && p.length > 2) return <Text key={i} style={styles.italic}>{p.slice(1, -1)}</Text>;
    return <Text key={i}>{p}</Text>;
  });
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.xl,
    gap: 3,
  },
  h1: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 2 },
  h2: {
    fontSize: font.h3,
    fontWeight: '700',
    color: colors.primaryDark,
    marginTop: spacing.md,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: colors.primarySoft,
  },
  h3: { fontSize: font.body, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  body: { fontSize: font.small, color: colors.text, lineHeight: 20, flexShrink: 1 },
  bulletRow: { flexDirection: 'row', gap: spacing.sm, paddingLeft: spacing.xs },
  bullet: { fontSize: font.small, color: colors.primary, lineHeight: 20 },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic', color: colors.textMuted },
});

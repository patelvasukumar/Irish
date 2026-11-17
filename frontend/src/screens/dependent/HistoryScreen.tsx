/** Saved tailored resumes in history/<company>/ (local only). */
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  Banner,
  Button,
  Card,
  Chip,
  colors,
  Dialog,
  EmptyState,
  font,
  Loading,
  Muted,
  platform,
  Row,
  Screen,
  spacing,
} from '@common/dependent';

import { useAction, useLoader } from '../../services/dependent/hooks';
import { useApi } from '../../services/dependent/settings';
import { formatBytes, formatDate } from '../../services/independent/format';
import type { HistoryItem } from '../../services/independent/types';

const ICONS = { pdf: 'document-outline', docx: 'document-text-outline', txt: 'reader-outline' } as const;

export default function HistoryScreen() {
  const api = useApi();
  const { busy, run } = useAction();
  const { data, setData, error, loading, reload } = useLoader(useCallback(() => api.history(), [api]));
  const [target, setTarget] = useState<HistoryItem | 'all' | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, HistoryItem[]>();
    for (const item of data ?? []) map.set(item.company, [...(map.get(item.company) ?? []), item]);
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [data]);

  const download = (item: HistoryItem) =>
    run(item.path, () => platform.saveDownload(api.historyDownloadUrl(item.path), item.file_name));

  const remove = async () => {
    if (!target) return;
    const r = await run('delete', () => api.deleteHistory(target === 'all' ? 'all' : target.path));
    if (r) {
      setData((list) => (target === 'all' ? [] : (list ?? []).filter((x) => x.path !== target.path)));
      setTarget(null);
    }
  };

  return (
    <Screen
      title="History"
      subtitle="Tailored resumes saved on this laptop, one folder per company."
      refreshing={loading && !!data}
      onRefresh={reload}
      actions={
        data?.length ? <Button title="Delete all" variant="danger" icon="trash-outline" small onPress={() => setTarget('all')} /> : null
      }
    >
      {error && <Banner tone="danger" message={error} />}
      {loading && !data ? (
        <Loading />
      ) : !groups.length ? (
        <EmptyState icon="folder-open-outline" title="No saved resumes" message="Write a tailored resume in the Tailor tab and save it as PDF, DOCX or TXT." />
      ) : (
        groups.map(([company, items]) => (
          <Card key={company} title={company.replace(/_/g, ' ')} icon="business-outline" subtitle={`${items.length} file${items.length > 1 ? 's' : ''}`}>
            {items.map((item) => (
              <View key={item.path} style={styles.row}>
                <Ionicons name={ICONS[item.format]} size={22} color={colors.primary} />
                <View style={{ flex: 1, minWidth: 140, gap: 2 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.file_name}
                  </Text>
                  <Muted>
                    {formatBytes(item.size_bytes)} · {formatDate(new Date(item.modified * 1000).toISOString(), true)}
                  </Muted>
                </View>
                <Chip label={item.format.toUpperCase()} tone="success" />
                <Row gap={spacing.xs}>
                  <Button title="Download" variant="ghost" icon="download-outline" small loading={busy === item.path} onPress={() => download(item)} />
                  <Button title="Delete" variant="ghost" icon="trash-outline" small onPress={() => setTarget(item)} />
                </Row>
              </View>
            ))}
          </Card>
        ))
      )}

      <Dialog
        visible={!!target}
        title={target === 'all' ? 'Delete every saved resume?' : `Delete ${target ? target.file_name : ''}?`}
        onClose={() => setTarget(null)}
        footer={
          <>
            <Button title="Cancel" variant="ghost" onPress={() => setTarget(null)} />
            <Button title="Delete" variant="danger" icon="trash-outline" loading={busy === 'delete'} onPress={remove} />
          </>
        }
      >
        <Muted>The file is removed from the history folder on this laptop. This cannot be undone.</Muted>
      </Dialog>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  name: { fontSize: font.body, fontWeight: '600', color: colors.text },
});

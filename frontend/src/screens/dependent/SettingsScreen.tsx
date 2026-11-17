/** Backend address + status of each AI component. */
import Constants from 'expo-constants';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  Banner,
  Button,
  Card,
  colors,
  font,
  Muted,
  platform,
  Row,
  Screen,
  spacing,
  TextField,
} from '@common/dependent';

import { ApiClient } from '../../services/dependent/api';
import { useSettings } from '../../services/dependent/settings';
import { isValidUrl } from '../../services/independent/format';
import type { Health } from '../../services/independent/types';

export default function SettingsScreen() {
  const { apiUrl } = useSettings();
  // Restart the form whenever the saved address changes.
  return <SettingsForm key={apiUrl} />;
}

function SettingsForm() {
  const { apiUrl, defaultApiUrl, setApiUrl } = useSettings();
  const [url, setUrl] = useState(apiUrl);
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(true);

  const test = async (address = url) => {
    setTesting(true);
    setError(null);
    setHealth(null);
    try {
      setHealth(await new ApiClient(address.trim().replace(/\/+$/, '')).health());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTesting(false);
    }
  };

  // Check the saved address once when the screen opens.
  useEffect(() => {
    let cancelled = false;
    new ApiClient(apiUrl)
      .health()
      .then((h) => !cancelled && setHealth(h))
      .catch((e) => !cancelled && setError((e as Error).message))
      .finally(() => !cancelled && setTesting(false));
    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

  return (
    <Screen title="Settings" subtitle="Where the app finds the Irish backend, and the status of each AI component.">
      <Card title="Backend address" icon="server-outline">
        <TextField
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder={defaultApiUrl}
          error={url && !isValidUrl(url) ? 'Use a full address like http://192.168.1.20:8000' : null}
          hint={`Default for ${platform.name}: ${defaultApiUrl}`}
        />
        <Row>
          <Button title="Test connection" variant="secondary" icon="pulse-outline" loading={testing} disabled={!isValidUrl(url)} onPress={() => test()} />
          <Button
            title="Save"
            icon="save-outline"
            disabled={!isValidUrl(url) || url === apiUrl}
            onPress={() => setApiUrl(url)}
          />
          <Button title="Use default" variant="ghost" onPress={() => setApiUrl(null)} />
        </Row>
        {platform.name !== 'web' && (
          <Muted>
            On a phone, start the backend with “--host 0.0.0.0” and use your laptop’s Wi-Fi address (same network as the phone).
          </Muted>
        )}
      </Card>

      {error && <Banner tone="danger" title="Not connected" message={error} />}
      {health && (
        <Card title="Connected" icon="checkmark-circle-outline" subtitle={`${health.app} backend is running`}>
          <Status label="C2 Text generation" value={`${health.llm.provider} · ${health.llm.model}`} />
          <Status label="Offline fallback" value={health.llm_fallback_to_stub ? 'On' : 'Off'} />
          <Status label="C3 Image recognition" value={health.ocr} warn={health.ocr === 'not installed'} />
          <Status label="C4 Skill graph" value={health.graph} />
          <Status label="C5 Database" value={health.database} />
          <Muted>Change the AI model in configuration/settings.py or the .env file, then restart the backend.</Muted>
        </Card>
      )}

      <Card title="About" icon="information-circle-outline">
        <Status label="App" value={`Irish ${Constants.expoConfig?.version ?? ''}`} />
        <Status label="Platform" value={platform.name} />
        <Muted>CST8327 Group #1 — AI-Powered Resume Tailoring and Job Application Agent.</Muted>
      </Card>
    </Screen>
  );
}

function Status({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, warn && { color: colors.warning }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  label: { width: 170, fontSize: font.small, color: colors.textMuted },
  value: { flex: 1, minWidth: 120, fontSize: font.small, fontWeight: '600', color: colors.text },
});

/** Credential manager (C8, demo step 7). Passwords are never shown or sent back. */
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import {
  Banner,
  Button,
  Card,
  colors,
  Dialog,
  EmptyState,
  font,
  Loading,
  Muted,
  Row,
  Screen,
  spacing,
  TextField,
} from '@common/dependent';

import { useAction, useLoader } from '../../services/dependent/hooks';
import { useApi } from '../../services/dependent/settings';
import { isValidUrl, timeAgo } from '../../services/independent/format';
import type { Credential } from '../../services/independent/types';

export default function CredentialsScreen() {
  const api = useApi();
  const { busy, run } = useAction();
  const { data, setData, error, loading, reload } = useLoader(useCallback(() => api.credentials(), [api]));
  const [editing, setEditing] = useState<Credential | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Credential | null>(null);

  const setPermission = async (c: Credential, value: boolean) => {
    const updated = await run(
      c.id,
      () => api.updateCredential(c.id, { permission_to_apply: value }),
      value ? `Irish may now sign in and apply on ${c.company}` : `Permission removed for ${c.company}`,
    );
    if (updated) setData((list) => (list ?? []).map((x) => (x.id === c.id ? updated : x)));
  };

  const remove = async () => {
    if (!deleting) return;
    const ok = await run('delete', () => api.deleteCredential(deleting.id), 'Login deleted');
    if (ok) {
      setData((list) => (list ?? []).filter((x) => x.id !== deleting.id));
      setDeleting(null);
    }
  };

  return (
    <Screen
      title="Company logins"
      subtitle="Saved logins for job sites such as Workday. Stored encrypted on this laptop only."
      refreshing={loading && !!data}
      onRefresh={reload}
      actions={<Button title="Add company credential" icon="add" small onPress={() => setEditing('new')} />}
    >
      <Banner
        tone="info"
        message="Irish never opens a site, signs in or applies unless you turn on permission for that site."
      />
      {error && <Banner tone="danger" message={error} />}
      {loading && !data ? (
        <Loading />
      ) : !data?.length ? (
        <EmptyState icon="key-outline" title="No saved logins" message="Add the login for a company website to let Irish sign in for you.">
          <Button title="Add company credential" icon="add" onPress={() => setEditing('new')} />
        </EmptyState>
      ) : (
        data.map((c) => (
          <Card key={c.id}>
            <View style={styles.row}>
              <View style={styles.icon}>
                <Ionicons name="globe-outline" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.company}>{c.company}</Text>
                <Muted numberOfLines={1}>{c.domain ?? c.site_url}</Muted>
                <Muted>
                  {c.username} · password {c.password_masked} · updated {timeAgo(c.updated_at)}
                </Muted>
              </View>
            </View>
            <View style={styles.permRow}>
              <Switch
                value={c.permission_to_apply}
                onValueChange={(v) => setPermission(c, v)}
                disabled={busy === c.id}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor={colors.surface}
                accessibilityLabel={`Permission to apply on ${c.company}`}
              />
              <Text style={[styles.perm, c.permission_to_apply && { color: colors.primaryDark }]}>
                {c.permission_to_apply ? 'Allowed to open, sign in and apply' : 'Not allowed to apply'}
              </Text>
            </View>
            <Row gap={spacing.sm}>
              <Button title="Edit" variant="secondary" icon="create-outline" small onPress={() => setEditing(c)} />
              <Button title="Delete" variant="danger" icon="trash-outline" small onPress={() => setDeleting(c)} />
            </Row>
          </Card>
        ))
      )}

      <CredentialDialog
        value={editing}
        onClose={() => setEditing(null)}
        onSaved={(saved) => {
          setData((list) => {
            const rest = (list ?? []).filter((x) => x.id !== saved.id);
            return [saved, ...rest];
          });
          setEditing(null);
        }}
      />

      <Dialog
        visible={!!deleting}
        title={`Delete the login for ${deleting?.company}?`}
        onClose={() => setDeleting(null)}
        footer={
          <>
            <Button title="Cancel" variant="ghost" onPress={() => setDeleting(null)} />
            <Button title="Delete" variant="danger" icon="trash-outline" loading={busy === 'delete'} onPress={remove} />
          </>
        }
      >
        <Muted>The saved username and encrypted password are removed from this laptop.</Muted>
      </Dialog>
    </Screen>
  );
}

function CredentialDialog({
  value,
  onClose,
  onSaved,
}: {
  value: Credential | 'new' | null;
  onClose: () => void;
  onSaved: (c: Credential) => void;
}) {
  const api = useApi();
  const { busy, run } = useAction();
  const isNew = value === 'new';
  const existing = value && value !== 'new' ? value : null;
  const [form, setForm] = useState({ company: '', site_url: '', username: '', password: '', permission: false });
  const [showPassword, setShowPassword] = useState(false);

  // Fill the form when the dialog opens.
  const key = value === 'new' ? 'new' : value?.id ?? null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  if (key !== loadedKey) {
    setLoadedKey(key);
    setShowPassword(false);
    setForm(
      existing
        ? { company: existing.company, site_url: existing.site_url, username: existing.username, password: '', permission: existing.permission_to_apply }
        : { company: '', site_url: '', username: '', password: '', permission: false },
    );
  }

  const set = (k: keyof typeof form) => (v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const urlError = form.site_url && !isValidUrl(form.site_url) ? 'Use a full link starting with https://' : null;
  const valid =
    form.company.trim() && isValidUrl(form.site_url) && form.username.trim() && (existing || form.password);

  const save = async () => {
    const result = await run(
      'save',
      () =>
        existing
          ? api.updateCredential(existing.id, {
              company: form.company.trim(),
              site_url: form.site_url.trim(),
              username: form.username.trim(),
              permission_to_apply: form.permission,
              ...(form.password ? { password: form.password } : {}),
            })
          : api.addCredential({
              company: form.company.trim(),
              site_url: form.site_url.trim(),
              username: form.username.trim(),
              password: form.password,
              permission_to_apply: form.permission,
            }),
      existing ? 'Login updated' : 'Login saved',
    );
    if (result) onSaved(result);
  };

  return (
    <Dialog
      visible={!!value}
      title={isNew ? 'Add company credential' : `Edit ${existing?.company}`}
      onClose={onClose}
      footer={
        <>
          <Button title="Cancel" variant="ghost" onPress={onClose} />
          <Button title="Save" icon="lock-closed-outline" disabled={!valid} loading={busy === 'save'} onPress={save} />
        </>
      }
    >
      <TextField label="Company *" placeholder="Shopify" value={form.company} onChangeText={set('company')} />
      <TextField
        label="Website link *"
        placeholder="https://company.wd3.myworkday.com/"
        value={form.site_url}
        onChangeText={set('site_url')}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        error={urlError}
      />
      <TextField
        label="Username or email *"
        value={form.username}
        onChangeText={set('username')}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
      />
      <TextField
        label={existing ? 'New password (leave empty to keep the current one)' : 'Password *'}
        value={form.password}
        onChangeText={set('password')}
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="password"
      />
      <Button
        title={showPassword ? 'Hide password' : 'Show password'}
        variant="ghost"
        small
        icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
        onPress={() => setShowPassword((s) => !s)}
      />
      <View style={styles.permRow}>
        <Switch
          value={form.permission}
          onValueChange={set('permission')}
          trackColor={{ true: colors.primary, false: colors.border }}
          thumbColor={colors.surface}
          accessibilityLabel="Permission to apply"
        />
        <Text style={styles.perm}>Allow Irish to open this site, sign in and apply for me</Text>
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  company: { fontSize: font.h3, fontWeight: '700', color: colors.text },
  permRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  perm: { fontSize: font.small, color: colors.textMuted, flex: 1 },
});

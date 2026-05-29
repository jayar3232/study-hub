import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { AxiosError } from 'axios';
import { ArrowRight, Eye, EyeOff, Lock, Mail, MessageCircle } from 'lucide-react-native';
import { useAuth } from '../store/AuthContext';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await login(email.trim(), password);
    } catch (err) {
      const axiosError = err as AxiosError<{ msg?: string }>;
      setError(axiosError.response?.data?.msg || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        style={styles.keyboard}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.logoWrap}>
              <MessageCircle color="#FFFFFF" size={31} strokeWidth={2.4} />
            </View>
            <Text style={styles.appName} numberOfLines={1}>
              Syncrova Messenger
            </Text>
            <Text style={styles.tagline}>
              Sign in to continue your realtime campus conversations.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.accentLine} />
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Use your Syncrova account to open chats.</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Student Email</Text>
              <View style={styles.inputShell}>
                <Mail color="#0891B2" size={19} />
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  onChangeText={setEmail}
                  placeholder="example@nemsu.edu.ph"
                  placeholderTextColor="#94A3B8"
                  returnKeyType="next"
                  style={styles.input}
                  textContentType="emailAddress"
                  value={email}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputShell}>
                <Lock color="#DB2777" size={19} />
                <TextInput
                  onChangeText={setPassword}
                  onSubmitEditing={submit}
                  placeholder="Enter your password"
                  placeholderTextColor="#94A3B8"
                  returnKeyType="done"
                  secureTextEntry={!showPassword}
                  style={styles.input}
                  textContentType="password"
                  value={password}
                />
                <Pressable
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  hitSlop={10}
                  onPress={() => setShowPassword(value => !value)}
                  style={styles.eyeButton}
                >
                  {showPassword ? <EyeOff color="#64748B" size={20} /> : <Eye color="#64748B" size={20} />}
                </Pressable>
              </View>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              android_ripple={{ color: 'rgba(255,255,255,0.18)' }}
              disabled={!email.trim() || !password || submitting}
              onPress={submit}
              style={({ pressed }) => [
                styles.loginButton,
                (!email.trim() || !password || submitting) && styles.loginButtonDisabled,
                pressed && !submitting ? styles.loginButtonPressed : null
              ]}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View style={styles.loginButtonContent}>
                  <Text style={styles.loginButtonText}>Sign in</Text>
                  <ArrowRight color="#FFFFFF" size={18} />
                </View>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#08111F'
  },
  keyboard: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 28
  },
  hero: {
    alignItems: 'center',
    marginBottom: 28
  },
  logoWrap: {
    alignItems: 'center',
    backgroundColor: '#0A7CFF',
    borderRadius: 24,
    height: 68,
    justifyContent: 'center',
    shadowColor: '#0A7CFF',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.32,
    shadowRadius: 22,
    width: 68,
    elevation: 8
  },
  appName: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 18
  },
  tagline: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
    marginTop: 8,
    maxWidth: 310,
    textAlign: 'center'
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    overflow: 'hidden',
    padding: 22,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.24,
    shadowRadius: 28,
    elevation: 10
  },
  accentLine: {
    backgroundColor: '#0A7CFF',
    height: 4,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0
  },
  title: {
    color: '#0F172A',
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 6,
    textAlign: 'center'
  },
  subtitle: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    marginBottom: 22,
    marginTop: 6,
    textAlign: 'center'
  },
  fieldGroup: {
    marginBottom: 14
  },
  label: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 7
  },
  inputShell: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 56,
    paddingHorizontal: 14
  },
  input: {
    color: '#0F172A',
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    minHeight: 54,
    paddingHorizontal: 11
  },
  eyeButton: {
    alignItems: 'center',
    height: 38,
    justifyContent: 'center',
    width: 38
  },
  error: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10
  },
  loginButton: {
    alignItems: 'center',
    backgroundColor: '#0A7CFF',
    borderRadius: 18,
    height: 56,
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#0A7CFF',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 7
  },
  loginButtonDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0
  },
  loginButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }]
  },
  loginButtonContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900'
  }
});

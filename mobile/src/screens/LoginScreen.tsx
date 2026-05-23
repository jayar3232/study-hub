import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { AxiosError } from 'axios';
import { MessageCircle } from 'lucide-react-native';
import { useAuth } from '../store/AuthContext';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
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
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      className="flex-1 justify-center bg-white px-6"
    >
      <View className="items-center">
        <View className="h-16 w-16 items-center justify-center rounded-3xl bg-blue-600">
          <MessageCircle color="white" size={30} />
        </View>
        <Text className="mt-5 text-3xl font-bold text-slate-950" numberOfLines={1}>
          Syncrova Messenger
        </Text>
        <Text className="mt-2 text-center text-sm text-slate-500" numberOfLines={2}>
          Native chat shell for faster scrolling, gestures, and media.
        </Text>
      </View>

      <View className="mt-10 gap-3">
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          className="h-14 rounded-2xl bg-slate-100 px-4 text-base text-slate-950"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor="#94A3B8"
          textContentType="emailAddress"
          value={email}
        />
        <TextInput
          className="h-14 rounded-2xl bg-slate-100 px-4 text-base text-slate-950"
          onChangeText={setPassword}
          onSubmitEditing={submit}
          placeholder="Password"
          placeholderTextColor="#94A3B8"
          secureTextEntry
          textContentType="password"
          value={password}
        />
        {error ? <Text className="px-1 text-sm text-red-600">{error}</Text> : null}
        <Pressable
          className={`mt-2 h-14 items-center justify-center rounded-2xl ${email.trim() && password ? 'bg-blue-600' : 'bg-slate-300'}`}
          disabled={!email.trim() || !password || submitting}
          onPress={submit}
        >
          {submitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-base font-semibold text-white">Log in</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

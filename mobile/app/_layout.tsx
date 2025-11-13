import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider } from '../src/contexts/AuthContext';
import { ConfirmationProvider } from '../src/contexts/ConfirmationContext';
import { ProductProvider } from '../src/contexts/ProductContext';

export const unstable_settings = {
  anchor: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <ConfirmationProvider>
        <ProductProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="login" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="sale" options={{ title: 'Nova Venda', headerBackTitle: 'Voltar' }} />
              <Stack.Screen name="configuracoes" options={{ title: 'Configurações', headerBackTitle: 'Voltar' }} />
            </Stack>
            <StatusBar style="auto" />
          </ThemeProvider>
        </ProductProvider>
      </ConfirmationProvider>
    </AuthProvider>
  );
}

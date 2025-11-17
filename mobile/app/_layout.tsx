import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { Platform } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

// Mitigar erro de timeout do FontFaceObserver no Web: forçar resolução imediata
if (typeof window !== 'undefined' && Platform.OS === 'web') {
  try {
    const FFO = (window as any).FontFaceObserver;
    if (FFO && FFO.prototype && typeof FFO.prototype.load === 'function') {
      FFO.prototype.load = function () {
        return Promise.resolve(true);
      };
    }
    // Patches adicionais: garantir que document.fonts.load resolva imediatamente
    if (typeof document !== 'undefined' && (document as any).fonts && typeof (document as any).fonts.load === 'function') {
      const originalLoad = (document as any).fonts.load;
      (document as any).fonts.load = function (...args: any[]) {
        // Resolve instantaneamente com um array de tamanho >= 1 para satisfazer verificações internas
        return Promise.resolve([{}]);
      };
    }
  } catch {}
}

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider } from '../src/contexts/AuthContext';
import { ConfirmationProvider } from '../src/contexts/ConfirmationContext';
import { ProductProvider } from '../src/contexts/ProductContext';

export const unstable_settings = {
  initialRouteName: 'index',
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

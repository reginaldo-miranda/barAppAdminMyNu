import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';

export default function IndexScreen() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Aguardar um tick para garantir que o layout esteja montado
    const timer = setTimeout(() => {
      console.log('🏠 IndexScreen: Layout pronto, redirecionando para login...');
      setIsReady(true);
      router.replace('/login');
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  console.log('🏠 IndexScreen: Renderizando - aguardando layout estar pronto');

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#2196F3" />
    </View>
  );
}
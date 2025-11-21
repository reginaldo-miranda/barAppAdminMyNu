import { Stack } from "expo-router";
import { AuthProvider } from "../src/contexts/AuthContext";
import { ProductProvider } from "../src/contexts/ProductContext";
import { ConfirmationProvider } from "../src/contexts/ConfirmationContext";

export default function RootLayout() {
  return (
    <AuthProvider>
      <ProductProvider>
        <ConfirmationProvider>
          <Stack initialRouteName="login">
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ title: 'Login' }} />
          </Stack>
        </ConfirmationProvider>
      </ProductProvider>
    </AuthProvider>
  );
}

import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { Platform } from "react-native";
import { AuthProvider } from "../src/contexts/AuthContext";
import { ProductProvider } from "../src/contexts/ProductContext";
import { ConfirmationProvider } from "../src/contexts/ConfirmationContext";

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === "web") {
      const handler = (e: any) => {
        const msg = String(e?.reason?.message || e?.message || "");
        if (msg.includes("timeout exceeded")) {
          e.preventDefault?.();
        }
      };
      (globalThis as any).addEventListener?.("unhandledrejection", handler);
      return () => {
        (globalThis as any).removeEventListener?.("unhandledrejection", handler);
      };
    }
  }, []);
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

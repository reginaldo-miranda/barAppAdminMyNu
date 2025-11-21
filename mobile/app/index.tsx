import React from "react";
import { Redirect } from "expo-router";

export default function Index() {
  // Redireciona imediatamente para a tela de Login
  return <Redirect href="/login" />;
}

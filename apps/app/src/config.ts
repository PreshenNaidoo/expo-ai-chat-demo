import { Platform } from "react-native";

const API_PORT = "3001";
const ANDROID_EMULATOR_HOST = "10.0.2.2";
const LOCALHOST = "localhost";

export const API_BASE_URL =
  Platform.OS === "android"
    ? `http://${ANDROID_EMULATOR_HOST}:${API_PORT}`
    : `http://${LOCALHOST}:${API_PORT}`;
